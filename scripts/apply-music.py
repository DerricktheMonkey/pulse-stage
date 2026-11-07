from pathlib import Path
import subprocess,re,json
BASE='235a3f254aade39d831cae3b9ec4b06e82557578'
ROOT=Path('.')
def original(p): return subprocess.check_output(['git','show',BASE+':'+p]).decode()
def put(p,s):
 Path(p).parent.mkdir(parents=True,exist_ok=True);Path(p).write_text(s)
def pair(p,s): put(p,s);put('public/'+p,s)
def once(s,a,b):
 n=s.count(a)
 if n!=1: raise RuntimeError('Expected one anchor, found '+str(n)+': '+a[:160])
 return s.replace(a,b,1)
# Keep the playable difficulty list in one place. Legacy IDs migrate without deleting charts.
s=original('engine.js')
s=once(s,'const HIT_WINDOW=.19;',"const DIFFICULTIES=Object.freeze(['easy','normal','hard','insane','impossible']);\nfunction normalizeDifficulty(value){return value==='beginner'?'easy':DIFFICULTIES.includes(value)?value:'normal';}\nconst HIT_WINDOW=.19;")
s=s.replace('beginner:.9,','')
s=re.sub(r'^ beginner:\{[^\n]+\n','',s,flags=re.M)
a=s.index('// Beginner follows');b=s.index('/* Embedded inside engine.js',a);s=s[:a]+s[b:]
s=s.replace("if(original.length<3||difficulty==='beginner')",'if(original.length<3)')
a=s.index("function analyze(samples,");b=s.index('// Give early notes',a)
s=s[:a]+'''function analyze(samples,rate,difficulty='normal',options={}){
 difficulty=normalizeDifficulty(difficulty);
 const analysis=analyzeLegacy(samples,rate,difficulty,options),easy=difficulty==='easy';
 const target=easy?Math.max(0,Math.round(analysis.notes.length*.78)):analysis.notes.length;
 let base=musicChart(analysis,target);
 if(easy){const spaced=[];for(const n of base)if(!spaced.length||n.time-spaced.at(-1).time>=.24)spaced.push(n);base=spaced;}
 const notes=musicAccents(phraseVoice(base,analysis,difficulty),analysis,difficulty);
 return {...analysis,notes,scanVersion:26,patternStyle:'phrase-aware',generation:{targetNotes:easy?notes.length:target,actualNotes:notes.length},rhythmSubdivisions:[],density:{...analysis.density,targetPerSecond:analysis.density.targetPerSecond*(easy?.78:1),actualPerSecond:notes.length/(samples.length/rate||1)}};
}
'''+s[b:]
s=s.replace('beginnerMelody,','')
s=once(s,'const api={phraseVoice,','const api={DIFFICULTIES,normalizeDifficulty,phraseVoice,')
s=once(s,"function analyzeLegacy(samples,rate,difficulty='normal',{densityMultiplier=2}={}){","function analyzeLegacy(samples,rate,difficulty='normal',{densityMultiplier=2}={}){\n difficulty=normalizeDifficulty(difficulty);")
s=once(s,".filter(p=>p.time>=.35&&p.time<duration", ".filter(p=>p.time>=0&&p.time<duration")
s=once(s,'const heads=[],gap=.044;', '''const heads=[],gap=.044;
 // Reject subdivisions crossing any silent run, not merely a silent midpoint.
 const quiet=new Uint32Array(env.length+1);for(let i=0;i<env.length;i++)quiet[i+1]=quiet[i]+(env[i]<=floor?1:0);
 const attackTimes=[...new Set(pool.map(p=>p.time))].sort((a,b)=>a-b),intervals=[];
 for(let i=1;i<attackTimes.length;i++){const d=attackTimes[i]-attackTimes[i-1];if(d>=gap)intervals.push(d);}
 intervals.sort((a,b)=>a-b);const subdivisionLimit=Math.min(2,Math.max(.75,(intervals[Math.floor(intervals.length/2)]||.5)*3));''')
s=once(s,'if(right.time-left.time<gap*2)return;', '''if(right.time-left.time<gap*2||right.time-left.time>subdivisionLimit)return;
  const a=Math.max(0,Math.floor(left.time/dt)+1),b=Math.min(env.length,Math.floor(right.time/dt));
  if(b>a&&quiet[b]-quiet[a]>1)return;''')
# Keep motif variation but give real pitch contour a stronger role on detected attacks.
s=once(s,'const names=Object.keys(templates),groups=[];', '''const pitchEvents=(analysis.musicAttacks||[]).filter(p=>p.frequency>0).sort((a,b)=>a.time-b.time);
  const pitches=pitchEvents.map(p=>p.frequency).sort((a,b)=>a-b),low=pitches[Math.floor(pitches.length*.1)]||130,high=pitches[Math.floor(pitches.length*.9)]||1000;
  const pitchLane=time=>{const i=noteIndex(pitchEvents,time-.035),p=pitchEvents[i];return p&&Math.abs(p.time-time)<=.035?Math.max(0,Math.min(3,Math.round(3*Math.log2(p.frequency/low)/Math.max(.5,Math.log2(high/low))))):null;};
  const names=Object.keys(templates),groups=[];''')
s=once(s,'const g=gs[gi],time=g.time,count=g.notes.length;','const g=gs[gi],time=g.time,count=g.notes.length,melodicLane=pitchLane(time);')
s=once(s,'Math.abs(lane-note.lane)*.22','Math.abs(lane-(index===0&&melodicLane!==null?melodicLane:note.lane))*(melodicLane!==null?1.1:.22)')
pair('engine.js',s)
# PCM buffers are cropped only for playback; compressed original bytes + trim metadata are saved.
pair('audio-trim.js',Path('repair-src/audio-trim.js').read_text())
s=original('app.js')
s=once(s,"function makeSamples(buffer)",'''function prepareSongAudio(buffer,chart={}){
 return typeof PulseAudioTrim==='undefined'?{buffer,chart,audioTrim:null}:PulseAudioTrim.prepare(buffer,chart,(channels,length,rate)=>audio().createBuffer(channels,length,rate));
}
async function trimCurrentSong(){
 if(!state.buffer||state.audioTrim||typeof PulseAudioTrim==='undefined')return;
 const original=state.buffer,prepared=prepareSongAudio(original,{notes:[],bpm:state.analysis?.bpm});
 if(!state.audioBytes&&prepared.removed>0){state.audioBytes=wavBytes(original);state.audioType='audio/wav';}
 state.buffer=prepared.buffer;state.audioTrim=prepared.audioTrim;
 await save('song',{bytes:state.audioBytes,name:state.name,type:state.audioType,audioTrim:state.audioTrim,communitySongId:state.communitySongId});
}
function makeSamples(buffer)''')
s=once(s,'try{state.analysis=await scanSong(state.buffer,state.difficulty);',"try{if(typeof trimCurrentSong==='function')await trimCurrentSong();state.difficulty=E.normalizeDifficulty(state.difficulty);state.analysis=await scanSong(state.buffer,state.difficulty);")
s=once(s,"status(state.difficulty==='beginner'?'Beginner ready: detected vocal phrasing, frequent solo holds, and one input at a time.':'Chart ready: closer musical timing, sustained-note holds, and playable two-note accents.')","status('Chart ready: musical attacks, sustained-note holds, and two-note accents.')")
s=once(s,'const bytes=await file.arrayBuffer(),buffer=await audio().decodeAudioData(bytes.slice(0));',"const bytes=await file.arrayBuffer(),decoded=await audio().decodeAudioData(bytes.slice(0)),prepared=typeof prepareSongAudio==='function'?prepareSongAudio(decoded):{buffer:decoded,audioTrim:null},buffer=prepared.buffer;")
s=once(s,'state.buffer=buffer;state.communitySongId=null;', 'state.buffer=buffer;state.audioTrim=prepared.audioTrim;state.communitySongId=null;')
s=s.replace("await save('song',{bytes,name:state.name,type:state.audioType})","await save('song',{bytes,name:state.name,type:state.audioType,audioTrim:state.audioTrim})")
s=s.replace('notes:chartNotes(),bpm:state.analysis?.bpm}', 'notes:chartNotes(),bpm:state.analysis?.bpm,audioTrim:state.audioTrim}')
s=s.replace('bpm:state.analysis?.bpm,notes:chartNotes()', 'bpm:state.analysis?.bpm,audioTrim:state.audioTrim,notes:chartNotes()')
s=once(s,"state.buffer=await audio().decodeAudioData(song.bytes.slice(0));", "const decoded=await audio().decodeAudioData(song.bytes.slice(0)),restoredInput=chart?.name===song.name?chart:{notes:[],audioTrim:song.audioTrim},restored=typeof prepareSongAudio==='function'?prepareSongAudio(decoded,restoredInput):{buffer:decoded,chart:restoredInput,audioTrim:null};state.buffer=restored.buffer;state.audioTrim=restored.audioTrim;")
s=s.replace("state.difficulty=chart.difficulty||'normal'",'state.difficulty=E.normalizeDifficulty(chart.difficulty)')
s=once(s,'state.notes=E.validateChart(chart,state.buffer.duration);state.analysis=await scanSong', 'state.notes=E.validateChart(restored.chart,state.buffer.duration,{snap:false});state.creatorTiming=restored.chart.creatorTiming||null;state.analysis=await scanSong')
s=s.replace('if(!state.customChart){state.notes=state.analysis.notes;saveChart();}', 'if(!state.customChart)state.notes=state.analysis.notes;saveChart();')
s=once(s,'state.buffer=b;state.audioBytes=null;','state.buffer=b;state.audioTrim=null;state.audioBytes=null;')
pair('app.js',s)
s=original('local-songs.js')
s=once(s,'bpm:state.analysis?.bpm||120}', 'bpm:state.analysis?.bpm||120,audioTrim:state.audioTrim}')
s=once(s,'const buffer=await audio().decodeAudioData(level.audioBytes.slice(0));','const decoded=await audio().decodeAudioData(level.audioBytes.slice(0)),prepared=typeof prepareSongAudio===\'function\'?prepareSongAudio(decoded,level.chart):{buffer:decoded,chart:level.chart,audioTrim:null},buffer=prepared.buffer,preparedChart=prepared.chart;')
s=s.replace('E.validateChart(level.chart,buffer.duration)', 'E.validateChart(preparedChart,buffer.duration,{snap:false})')
s=once(s,'state.buffer=buffer;state.audioBytes=', 'state.buffer=buffer;state.audioTrim=prepared.audioTrim;state.creatorTiming=preparedChart.creatorTiming||null;state.audioBytes=')
s=once(s,"state.difficulty=['beginner','easy','normal','hard','insane','impossible'].includes(level.difficulty)?level.difficulty:'normal';",'state.difficulty=E.normalizeDifficulty(level.difficulty);')
s=s.replace('bpm:Number(level.chart.bpm)||120','bpm:Number(preparedChart.bpm)||120')
s=s.replace('type:state.audioType,communitySongId:state.communitySongId}', 'type:state.audioType,audioTrim:state.audioTrim,communitySongId:state.communitySongId}')
s=s.replace("item.difficulty+(item.rating", "(item.difficulty==='beginner'?'easy':item.difficulty)+(item.rating")
s=s.replace('duration:level.duration};','duration:level.duration,audioTrim:level.chart.audioTrim};')
pair('local-songs.js',s)
s=original('library.js')
s=once(s,'const bytes=await audioResponse.arrayBuffer(),buffer=await audio().decodeAudioData(bytes.slice(0));const notes=E.validateChart(info.chart,buffer.duration);',"const bytes=await audioResponse.arrayBuffer(),decoded=await audio().decodeAudioData(bytes.slice(0)),prepared=typeof prepareSongAudio==='function'?prepareSongAudio(decoded,info.chart):{buffer:decoded,chart:info.chart,audioTrim:null},buffer=prepared.buffer;info.chart=prepared.chart;const notes=E.validateChart(info.chart,buffer.duration,{snap:false});")
s=once(s,'state.buffer=buffer;state.audioBytes=bytes;', 'state.buffer=buffer;state.audioTrim=prepared.audioTrim;state.creatorTiming=info.chart.creatorTiming||null;state.audioBytes=bytes;')
s=s.replace('state.difficulty=info.difficulty;', 'state.difficulty=E.normalizeDifficulty(info.difficulty);')
s=s.replace('type:state.audioType,communitySongId:id}', 'type:state.audioType,audioTrim:state.audioTrim,communitySongId:id}')
s=once(s,'bpm:state.analysis?.bpm||120,mediaEncoding:', 'bpm:state.analysis?.bpm||120,audioTrim:state.audioTrim,creatorTiming:state.creatorTiming,mediaEncoding:')
s=s.replace("song.creator+' \u00b7 '+song.difficulty", "song.creator+' \u00b7 '+(song.difficulty==='beginner'?'easy':song.difficulty)")
# Preview keeps original media, but respects the same saved source window.
s=s.replace('duration:song.duration};','duration:song.duration,audioTrim:song.audioTrim};')
pair('library.js',s)
s=original('editor.js')
s=s.replace('audioType:state.audioType,background:','audioType:state.audioType,audioTrim:state.audioTrim,background:')
s=s.replace("'audioBytes','audioType']","'audioBytes','audioType','audioTrim']")
s=s.replace('type:state.audioType}:null','type:state.audioType,audioTrim:state.audioTrim}:null')
pair('editor.js',s)
s=original('studio.js')
s=once(s,'creatorTiming:state.creatorTiming});};','creatorTiming:state.creatorTiming,audioTrim:state.audioTrim});};')
s=once(s,'state.creatorTiming=level.chart.creatorTiming||null;','state.creatorTiming=state.creatorTiming||level.chart.creatorTiming||null;')
s=once(s,"['buffer','name','audioBytes','audioType','analysis','difficulty','rating']","['buffer','name','audioBytes','audioType','audioTrim','analysis','difficulty','rating']")
s=s.replace('name:state.name,type:state.audioType});','name:state.name,type:state.audioType,audioTrim:state.audioTrim});')
s=once(s,'creatorTiming:state.creatorTiming||settings(),notes:chartNotes()', 'creatorTiming:state.creatorTiming||settings(),audioTrim:state.audioTrim,notes:chartNotes()')
s=once(s,'const chart=JSON.parse(await file.text()),notes=M.validate(chart.notes,state.buffer.duration);stopEditorTransport();history();',"let chart=JSON.parse(await file.text());const decoded=state.audioBytes?await audio().decodeAudioData(state.audioBytes.slice(0)):state.buffer,prepared=typeof prepareSongAudio==='function'?prepareSongAudio(decoded,chart):{buffer:decoded,chart,audioTrim:state.audioTrim};chart=prepared.chart;const notes=M.validate(chart.notes,prepared.buffer.duration);stopEditorTransport();if(JSON.stringify(state.audioTrim)!==JSON.stringify(prepared.audioTrim)){recorder.undo=[];recorder.redo=[];}else history();state.buffer=prepared.buffer;state.audioTrim=prepared.audioTrim;state.difficulty=E.normalizeDifficulty(chart.difficulty||state.difficulty);")
s=s.replace('state.creatorTiming=chart.creatorTiming||null;', 'state.creatorTiming=state.creatorTiming||chart.creatorTiming||null;')
pair('studio.js',s)
s=original('battle.js')
s=s.replace("'original','beginner','easy'", "'original','easy'")
s=once(s,"const buffer=await audio().decodeAudioData(bytes.slice(0)),analysis=await scanSong(buffer,difficulty);", "const decoded=await audio().decodeAudioData(bytes.slice(0)),prepared=typeof prepareSongAudio==='function'?prepareSongAudio(decoded,{audioTrim:info.chart.audioTrim,notes:[]}):{buffer:decoded,audioTrim:null},buffer=prepared.buffer,analysis=await scanSong(buffer,difficulty);")
s=once(s,'info.chart={...info.chart,notes:analysis.notes,bpm:analysis.bpm,customChart:false,offsetMs:0};','info.duration=buffer.duration;info.chart={...info.chart,audioTrim:prepared.audioTrim,notes:analysis.notes,bpm:analysis.bpm,customChart:false,offsetMs:0};')
pair('battle.js',s)
s=original('song-preview.js')
s=once(s,"player.onloadedmetadata=()=>{if(active===owner)player.currentTime=Number.isFinite(player.duration)&&player.duration>2?Math.min(30,player.duration*.25):0;};", "player.onloadedmetadata=()=>{if(active!==owner)return;const trim=payload.audioTrim,start=Number.isFinite(trim?.start)?Math.max(0,trim.start):0,end=Number.isFinite(trim?.end)?Math.min(player.duration,trim.end):player.duration;owner.end=end;player.currentTime=start+(Number.isFinite(end)&&end-start>2?Math.min(30,(end-start)*.25):0);};player.ontimeupdate=()=>{if(active===owner&&Number.isFinite(owner.end)&&player.currentTime>=owner.end)stop();};")
pair('song-preview.js',s)
# Remove Beginner from all selectable modes. Keep a read compatibility alias for old data only.
s=original('index.html')
s,n=re.subn(r'<button data-diff="beginner"[^>]*>Beginner</button>','',s);assert n==1
s,n=re.subn(r'<option value="beginner">Beginner</option>','',s);assert n==2
s=once(s,'<script src="app.js', '<script src="audio-trim.js?v=112"></script><script src="app.js')
pair('index.html',s)
s=original('style.css').replace('grid-template-columns:repeat(3,minmax(0,1fr));gap:3px}#difficulties','grid-template-columns:repeat(5,minmax(0,1fr));gap:3px}#difficulties')
pair('style.css',s)
s=original('supabase-backend.js')
s=s.replace("difficulty:['beginner','insane','impossible'].includes(row.chart?.difficulty)?row.chart.difficulty:row.difficulty", "difficulty:row.chart?.difficulty==='beginner'||row.difficulty==='beginner'?'easy':['insane','impossible'].includes(row.chart?.difficulty)?row.chart.difficulty:row.difficulty")
s=s.replace('duration:row.duration,noteCount:', 'duration:row.duration,audioTrim:row.chart?.audioTrim,noteCount:')
s=once(s,"difficulty:form.get('difficulty'),notes", "difficulty:form.get('difficulty')==='beginner'?'easy':form.get('difficulty'),notes")
pair('supabase-backend.js',s)
s=original('worker/api.js')
s=once(s,'difficulty:row.difficulty,rating:',"difficulty:row.difficulty==='beginner'?'easy':row.difficulty,rating:")
s=once(s,"const difficulty=['beginner','easy','normal','hard','insane','impossible'].includes(form.get('difficulty'))?form.get('difficulty'):'normal'", "const difficulty=form.get('difficulty')==='beginner'?'easy':['easy','normal','hard','insane','impossible'].includes(form.get('difficulty'))?form.get('difficulty'):'normal'")
s=once(s,'offsetMs:offset,bpm:Number(chart.bpm)||120}', 'offsetMs:offset,bpm:Number(chart.bpm)||120,audioTrim:chart.audioTrim,creatorTiming:chart.creatorTiming}')
put('worker/api.js',s)
# Every changed frontend/worker reference gets a new cache key, including the analyzer worker.
for p in list(Path('public').glob('*.js'))+[Path('public/index.html')]:
 s=p.read_text();s=re.sub(r'(\.js|\.css)\?v=\d+',r'\1?v=112',s);pair(p.name,s)
# Update tests that deliberately pinned the retired mode/version. Never weaken timing/count checks.
for p in Path('tests').glob('*'):
 if p.suffix not in ('.cjs','.mjs'):continue
 s=p.read_text().replace("next.scanVersion,25","next.scanVersion,26").replace("'scanVersion,25'","'scanVersion,26'")
 s=re.sub(r'(\.js|\.css)\?v=111',r'\1?v=112',s)
 put(str(p),s)
put('tests/beginner.test.cjs',Path('repair-src/retired-mode.test.cjs').read_text())
put('tests/audio-edges.test.cjs',Path('repair-src/audio-edges.test.cjs').read_text())
put('tests/music-boundaries.test.cjs',Path('repair-src/music-boundaries.test.cjs').read_text())
put('scripts/music-browser.mjs',Path('repair-src/music-browser.mjs').read_text())
put('docs/audio-timing.md',Path('repair-src/audio-timing.md').read_text())
# Candidate diagnostics for precise follow-up, not a claim that tests have passed.
Path('.music-results').mkdir(exist_ok=True)
paths=[*Path('.').glob('*.js'),Path('worker/api.js')]
put('.music-results/references.txt','\n'.join(str(p)+': '+line for p in paths for line in p.read_text().splitlines() if 'beginner' in line.lower() or 'decodeAudioData' in line or 'audioTrim' in line))
print('Applied checked musicality, edge-trimming and mode-removal changes.')
