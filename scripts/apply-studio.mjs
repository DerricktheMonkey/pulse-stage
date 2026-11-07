import {readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const baseline='3299c53e96f6c6353b8b3431ed65ff6db617dc27';
const old=path=>execFileSync('git',['show',baseline+':'+path],{encoding:'utf8',maxBuffer:8e6});
const replace=(s,from,to)=>{if(!s.includes(from))throw Error('Missing source anchor: '+from.slice(0,100));return s.replace(from,to);};
let engine=old('engine.js');
const voice=(await readFile('scripts/phrase-voice.js','utf8')).split("if(typeof module!=='undefined')")[0];
engine=replace(engine,"function analyze(samples,rate,difficulty='normal',options={}){",voice+"\nfunction analyze(samples,rate,difficulty='normal',options={}){");
engine=replace(engine,'notes=musicAccents(base,analysis,difficulty);','notes=musicAccents(phraseVoice(base,analysis,difficulty),analysis,difficulty);');
engine=replace(engine,"scanVersion:23,patternStyle:beginner?'melody':'music'","scanVersion:25,patternStyle:beginner?'melody':'phrase-aware'");
engine=replace(engine,'const api={MAX_LIFE:10','const api={phraseVoice,MAX_LIFE:10');
const from=engine.indexOf(' // First cover audible phrases'),to=engine.indexOf(' // Subdivide the measured gaps',from);
if(from<0||to<0)throw Error('Music phrase selector anchors missing');
engine=engine.slice(0,from)+` // Stronger, busier phrases receive more detail without lowering the song's
 // total budget or moving notes onto an invented BPM grid.
 const phrases=new Map();for(const p of pool){const key=Math.floor(p.time/4);if(!phrases.has(key))phrases.set(key,[]);phrases.get(key).push(p);}
 const queues=[...phrases.values()].map(list=>{const energy=list.reduce((sum,p)=>sum+(env[Math.floor(p.time/dt)]||0),0)/Math.max(1,list.length);list.sort((a,b)=>(b.strength||0)-(a.strength||0)||a.time-b.time);return {list,index:0,placed:0,weight:Math.max(.05,Math.sqrt(energy/ceiling)*Math.sqrt(list.length))};});
 // Give each audible phrase an anchor before distributing the remaining detail.
 for(const q of queues){if(heads.length>=target)break;const p=q.list[q.index++];if(p&&add(p))q.placed++;}
 while(heads.length<target){let chosen=null,score=Infinity;for(const q of queues){const value=(q.placed+1)/q.weight;if(q.index<q.list.length&&value<score){chosen=q;score=value;}}if(!chosen)break;if(add(chosen.list[chosen.index++]))chosen.placed++;}
`+engine.slice(to);
await writeFile('public/engine.js',engine);
let editor=old('editor.js');
// Keep the stable live-recorder adapter; Studio replaces its horizontal UI.
editor=editor.replace('Record your notes, or preview the chart.','Draw notes on the grid, or preview from the cursor.');
await writeFile('public/editor.js',editor);
let html=old('index.html');
html=replace(html,'</head>','<link rel="stylesheet" href="studio.css?v=110"></head>');
html=replace(html,'</body>','<script src="studio-model.js?v=110"></script><script src="studio.js?v=110"></script></body>');
html=html.replace(/(engine\.js|app\.js|editor\.js|local-songs\.js|style\.css)\?v=\d+/g,'$1?v=110');
await writeFile('public/index.html',html);
await writeFile('public/style.css',old('style.css'));
let app=old('app.js');
app=replace(app,"analysis-worker.js?v=101","analysis-worker.js?v=110");
app=replace(app,'state.notes=[];state.analysis=null;','state.notes=[];state.analysis=null;state.creatorTiming=null;');
app=replace(app,'state.notes=E.snapCloseNotes(state.notes);','state.notes=state.customChart?E.markChords(state.notes):E.snapCloseNotes(state.notes);');
app=replace(app,'state.analysis=await scanSong(state.buffer,state.difficulty);if(!state.customChart)',"state.analysis=state.customChart?{bpm:chart.bpm||120}:await scanSong(state.buffer,state.difficulty);state.creatorTiming=chart.creatorTiming||null;if(!state.customChart)");
app=app.replace('Record your own chart with D / F / J / K.','Draw your chart in Beatmap Studio.');
app=replace(app,'state.notes=E.validateChart(chart,state.buffer.duration);','state.notes=E.validateChart(chart,state.buffer.duration,{snap:!chart.customChart});');
await writeFile('public/app.js',app);
let local=old('local-songs.js');local=replace(local,'E.validateChart(level.chart,buffer.duration)','E.validateChart(level.chart,buffer.duration,{snap:!level.chart.customChart})');await writeFile('public/local-songs.js',local);
await writeFile('public/analysis-worker.js',"importScripts('engine.js?v=110');\nonmessage=e=>{try{const {samples,rate,difficulty}=e.data;postMessage({analysis:RhythmEngine.analyze(samples,rate,difficulty)});}catch(error){postMessage({error:error.message});}};\n");
// Only version assertions change. All density, timing, silence and playability
// assertions stay intact. The new generator intentionally has a new identity.
for(const name of await readdir('tests')){if(!name.endsWith('.cjs'))continue;const path='tests/'+name;let s=await readFile(path,'utf8');const changed=s.replace(/\.patternStyle,'music'/g,".patternStyle,'phrase-aware'").replace(/\.scanVersion,23/g,'.scanVersion,25');if(s!==changed)await writeFile(path,changed);}
for(const name of await readdir('public'))if(/\.(?:js|css|html)$/.test(name))await copyFile('public/'+name,name);
console.log('Applied Studio 2, synchronized root/public, and updated worker/browser asset versions.');
