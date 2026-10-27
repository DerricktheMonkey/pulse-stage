const MAX_AUDIO=25*1024*1024,MAX_BACKGROUND=20*1024*1024;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function identity(request){return request.headers.get('oai-authenticated-user-id')||null;}
function requireUser(request){const id=identity(request);if(!id)throw fail('Sign in to save your songs.',401);return id;}
function cleanText(value,max,label){const text=String(value||'').trim();if(!text||text.length>max)throw fail(label+' is required (up to '+max+' characters).');return text;}
function publicSong(row){return {id:row.id,title:row.title,creator:row.creator,difficulty:row.difficulty,rating:row.rating??(row.chart_json?JSON.parse(row.chart_json).rating:null)??null,duration:row.duration,noteCount:row.note_count,shared:!!row.shared,createdAt:row.created_at,hasBackground:!!row.background_key};}
async function authorizedSong(env,id,user){const row=await env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(id).first();if(!row||(!row.shared&&row.owner_id!==user))throw fail('Song not found.',404);return row;}
export async function api(request,env,ctx){
 const url=new URL(request.url),path=url.pathname,user=identity(request);
 try{
  if(path==='/api/me')return json({signedIn:!!user});
  if(!env.DB||!env.BUCKET)throw fail('The song library is not configured yet.',503);
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==url.origin)throw fail('Please save from this game’s own page.',403);
  if(path==='/api/songs'&&request.method==='GET'){
   const mine=url.searchParams.get('mine')==='1',q=String(url.searchParams.get('q')||'').slice(0,80);if(mine)requireUser(request);
   const rows=await env.DB.prepare('SELECT id,title,creator,difficulty,duration,note_count,shared,created_at,background_key,json_extract(chart_json, \'$.rating\') AS rating FROM songs WHERE '+(mine?'owner_id = ?':'shared = 1')+' AND title LIKE ? ORDER BY created_at DESC LIMIT 60').bind(...(mine?[user,'%'+q+'%']:['%'+q+'%'])).all();return json({songs:rows.results.map(publicSong)});
  }
  if(path==='/api/songs'&&request.method==='POST'){
   const owner=requireUser(request),length=Number(request.headers.get('content-length'));if(length>49*1024*1024)throw fail('Upload must be smaller than 49 MB.',413);
   const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM songs WHERE owner_id = ?').bind(owner).first();if(count.count>=40)throw fail('Your library holds up to 40 songs. Delete an older save first.');
   const form=await request.formData(),title=cleanText(form.get('title'),100,'Song title'),creator=cleanText(form.get('creator'),50,'Creator name'),audio=form.get('audio'),background=form.get('background'),rawChart=form.get('chart');
   if(!audio||typeof audio==='string'||!audio.size||audio.size>MAX_AUDIO||!/^audio\//.test(audio.type))throw fail('Choose an audio file up to 25 MB.');
   if(background&&(typeof background==='string'||background.size>MAX_BACKGROUND||! /^(image|video)\//.test(background.type)||/svg/i.test(background.type)))throw fail('Background must be an image or video up to 20 MB (SVG is unsupported).');
   if(typeof rawChart!=='string'||rawChart.length>2000000)throw fail('Chart is missing or too large.');let chart;try{chart=JSON.parse(rawChart);}catch{throw fail('Chart JSON is invalid.');}
   const duration=Number(form.get('duration'));if(!Number.isFinite(duration)||duration<=0||duration>1200)throw fail('Song must be shorter than 20 minutes.');
   let notes;try{notes=globalThis.RhythmEngine.validateChart(chart,duration);}catch(error){throw fail(error.message);}if(!notes.length)throw fail('Add notes before saving your song.');
   const rating=chart.rating??null;if(rating!==null&&(!Number.isInteger(rating)||rating<1||rating>40))throw fail('Level rating must be a whole number from 1 to 40.');
   const difficulty=['easy','normal','hard'].includes(form.get('difficulty'))?form.get('difficulty'):'normal',shared=form.get('shared')==='1'?1:0,id=crypto.randomUUID(),audioKey='songs/'+owner+'/'+id+'/audio',bgKey=background?'songs/'+owner+'/'+id+'/background':null,offset=Math.max(-1000,Math.min(1000,Number(chart.offsetMs)||0));
   await env.BUCKET.put(audioKey,audio.stream(),{httpMetadata:{contentType:audio.type}});try{if(background)await env.BUCKET.put(bgKey,background.stream(),{httpMetadata:{contentType:background.type}});await env.DB.prepare('INSERT INTO songs (id,owner_id,title,creator,difficulty,duration,note_count,chart_json,audio_key,audio_type,background_key,background_type,shared,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,owner,title,creator,difficulty,duration,notes.length,JSON.stringify({rating,chordGlow:chart.chordGlow!==false,customChart:!!chart.customChart,notes,offsetMs:offset,bpm:Number(chart.bpm)||120}),audioKey,audio.type,bgKey,background?.type||null,shared,new Date().toISOString()).run();}catch(error){await env.BUCKET.delete([audioKey,...(bgKey?[bgKey]:[])]);throw error;}return json({id,shared:!!shared},201);
  }
  const match=path.match(/^\/api\/songs\/([a-zA-Z0-9-]+)(?:\/(audio|background))?$/);
  if(match){const [,id,asset]=match,row=await authorizedSong(env,id,user);
   if(request.method==='GET'&&asset){const key=asset==='audio'?row.audio_key:row.background_key;if(!key)throw fail('Background not found.',404);const file=await env.BUCKET.get(key,{range:request.headers});if(!file)throw fail('Media not found.',404);const headers=new Headers({'Content-Type':asset==='audio'?row.audio_type:row.background_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});file.writeHttpMetadata?.(headers);if(file.range){const {offset=0,length}=file.range;headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${file.size}`);headers.set('Content-Length',String(length));return new Response(file.body,{status:206,headers});}headers.set('Content-Length',String(file.size));return new Response(file.body,{headers});}
   if(request.method==='GET')return json({...publicSong(row),chart:JSON.parse(row.chart_json),isOwner:row.owner_id===user});
   if(['PATCH','DELETE'].includes(request.method)){requireUser(request);if(row.owner_id!==user)throw fail('Only the creator can change this song.',403);if(request.method==='PATCH'){const body=await request.json();if(typeof body.shared!=='boolean')throw fail('Choose public or private visibility.');await env.DB.prepare('UPDATE songs SET shared = ? WHERE id = ? AND owner_id = ?').bind(body.shared?1:0,id,user).run();return json({ok:true,shared:body.shared});}await env.DB.prepare('DELETE FROM songs WHERE id = ? AND owner_id = ?').bind(id,user).run();await env.BUCKET.delete([row.audio_key,...(row.background_key?[row.background_key]:[])]);return json({ok:true});}
  }
  return json({error:'Not found.'},404);
 }catch(error){return json({error:error.status?error.message:'Could not complete the library request. Try again.'},error.status||500);}
}
