import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
const source=await readFile('dist/server/index.js','utf8'),worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const sqlite=new DatabaseSync(':memory:');sqlite.exec(await readFile('drizzle/0000_song_library.sql','utf8'));
const DB={prepare(sql){return {bind(...args){const stmt=sqlite.prepare(sql);return {first:async()=>stmt.get(...args),all:async()=>({results:stmt.all(...args)}),run:async()=>stmt.run(...args)};}};}};
const objects=new Map();const BUCKET={async put(key,stream,options){objects.set(key,{bytes:await new Response(stream).arrayBuffer(),type:options.httpMetadata.contentType});},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key);},async get(key){const item=objects.get(key);return item?{body:item.bytes,size:item.bytes.byteLength,writeHttpMetadata:h=>h.set('Content-Type',item.type)}:null;}};
async function call(path,options={},user){const headers=new Headers(options.headers);headers.set('Origin','https://stage.test');if(user)headers.set('oai-authenticated-user-id',user);return worker.fetch(new Request('https://stage.test'+path,{...options,headers}),{DB,BUCKET},{});}
const form=()=>{const f=new FormData();for(const [key,value] of Object.entries({title:'My original melody',creator:'Player One',difficulty:'normal',duration:'5',chart:JSON.stringify({notes:[{time:1,lane:0,duration:.4,kind:'slide',endLane:1}],offsetMs:20,rating:17,customChart:true,chordGlow:false}),shared:'0'}))f.set(key,value);f.set('audio',new Blob(['test audio'],{type:'audio/wav'}),'song.wav');return f;};
assert.equal((await call('/api/songs',{method:'POST',body:form()})).status,401);
const saved=await call('/api/songs',{method:'POST',body:form()},'owner');assert.equal(saved.status,201);const {id}=await saved.json();assert.equal(objects.size,1);
assert.equal((await call('/api/songs/'+id)).status,404);assert.equal((await call('/api/songs/'+id+'/audio',{},'other')).status,404);
assert.equal((await (await call('/api/songs?mine=1',{},'owner')).json()).songs.length,1);
assert.equal((await (await call('/api/songs')).json()).songs.length,0);
assert.equal((await call('/api/songs/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{"shared":true}'},'owner')).status,200);
const shared=await (await call('/api/songs/'+id)).json();assert.equal(shared.chart.notes[0].duration,.4);assert(!('kind' in shared.chart.notes[0]));assert(!('owner_id' in shared));assert.equal(shared.creator,'Player One');assert.equal(shared.chart.rating,17);assert.equal(shared.rating,17);assert.equal(shared.chart.customChart,true);assert.equal(shared.chart.chordGlow,false);assert.equal((await (await call('/api/songs')).json()).songs[0].rating,17);
assert.equal((await call('/api/songs/'+id+'/audio')).status,200);
assert.equal((await call('/api/songs/'+id,{method:'DELETE'},'other')).status,403);
assert.equal((await call('/api/songs/'+id,{method:'DELETE'},'owner')).status,200);assert.equal(objects.size,0);
const invalidRating=form();invalidRating.set('chart',JSON.stringify({notes:[{time:1,lane:0}],rating:41}));assert.equal((await call('/api/songs',{method:'POST',body:invalidRating},'owner')).status,400);
const bad=form();bad.set('chart',JSON.stringify({notes:[{time:1,lane:7}]}));assert.equal((await call('/api/songs',{method:'POST',body:bad},'owner')).status,400);
const cross=new Request('https://stage.test/api/songs',{method:'POST',headers:{Origin:'https://evil.test','oai-authenticated-user-id':'owner'},body:form()});assert.equal((await worker.fetch(cross,{DB,BUCKET},{})).status,403);
const landing=await call('/');assert.equal(landing.status,200);assert((await landing.text()).includes('pauseMenu'));assert.equal((await call('/library.js')).status,200);
console.log('PASS: database migration, authenticated saves, private media, public sharing, ownership, delete cleanup, hold chart round-trip, CSRF and Worker assets.');

const gameOrigin='https://derrickthemonkey.github.io';
const preflight=await worker.fetch(new Request('https://stage.test/api/songs',{method:'OPTIONS',headers:{Origin:gameOrigin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'Content-Type'}}),{DB,BUCKET},{});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),gameOrigin);assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),'true');
const foreign=await worker.fetch(new Request('https://stage.test/api/songs',{method:'OPTIONS',headers:{Origin:'https://evil.test'}}),{DB,BUCKET},{});assert.equal(foreign.status,403);assert.equal(foreign.headers.get('Access-Control-Allow-Origin'),null);
const spoof=await worker.fetch(new Request('https://stage.test/api/songs',{method:'OPTIONS',headers:{Origin:gameOrigin,'Access-Control-Request-Headers':'oai-authenticated-user-id'}}),{DB,BUCKET},{});assert.equal(spoof.status,403);
const guest=await worker.fetch(new Request('https://stage.test/api/songs?mine=1',{headers:{Origin:gameOrigin}}),{DB,BUCKET},{});assert.equal(guest.status,401);assert.equal(guest.headers.get('Access-Control-Allow-Origin'),gameOrigin);
const online=await worker.fetch(new Request('https://stage.test/api/songs',{headers:{Origin:gameOrigin}}),{DB,BUCKET},{});assert.equal(online.status,200);assert.equal(online.headers.get('Access-Control-Allow-Origin'),gameOrigin);
const noOwner=await worker.fetch(new Request('https://stage.test/api/songs',{method:'POST',headers:{Origin:gameOrigin},body:form()}),{DB,BUCKET},{});assert.equal(noOwner.status,401);
console.log('PASS: trusted game-origin CORS, preflight, disallowed origins/identity headers and unchanged sign-in requirements.');
// A large 4K image is stored and served verbatim, with no image resizing in the API.
const imageBytes=new Uint8Array(21*1024*1024);imageBytes[0]=77;imageBytes[imageBytes.length-1]=88;const largeImageForm=form();largeImageForm.set('background',new Blob([imageBytes],{type:'image/png'}),'4k-scene.png');const imageSave=await call('/api/songs',{method:'POST',body:largeImageForm},'owner');assert.equal(imageSave.status,201);const imageId=(await imageSave.json()).id;const imageResult=await call('/api/songs/'+imageId+'/background',{},'owner');assert.equal(imageResult.status,200);const roundTrip=new Uint8Array(await imageResult.arrayBuffer());assert.equal(roundTrip.length,imageBytes.length);assert.equal(roundTrip[0],77);assert.equal(roundTrip.at(-1),88);await call('/api/songs/'+imageId,{method:'DELETE'},'owner');
const largeVideoForm=form();largeVideoForm.set('background',new Blob([imageBytes],{type:'video/mp4'}),'video.mp4');assert.equal((await call('/api/songs',{method:'POST',body:largeVideoForm},'owner')).status,400);assert.equal((await call('/note-visuals.js')).status,200);console.log('PASS: backgrounds above the old 20 MB image limit round-trip unchanged, videos retain the 20 MB limit, and the shared note renderer is served.');
