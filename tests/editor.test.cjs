const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),E=require('../public/engine.js');
const src=fs.readFileSync('public/editor.js','utf8');let clock=0,saved=0;
const pads=Array.from({length:4},()=>({classList:{add(){},remove(){},toggle(){}}}));
const elements=new Map();function $(id){if(!elements.has(id))elements.set(id,{classList:{toggle(){}},value:0,disabled:false,textContent:'',replaceChildren(){},querySelector(){return null;},querySelectorAll(){return pads;}});return elements.get(id);}
$('recordSpeed').value=1;
const state={editor:true,notes:[{time:9,lane:3,duration:0}],buffer:{duration:10},busy:false,loading:false};
const ac={get currentTime(){return clock;},resume:async()=>{},createBufferSource(){return {playbackRate:{},connect(){},start(){},stop(){},disconnect(){}};}};
const c={state,$,E,audio:()=>ac,gain:{},offset:()=>.1,fmt:t=>String(t),chartNotes:()=>state.notes.map(n=>({...n})),saveChart:()=>saved++,requestAnimationFrame:()=>1,cancelAnimationFrame(){},document:{activeElement:{blur(){}},querySelectorAll:()=>pads}};
vm.createContext(c);vm.runInContext(src.slice(0,src.indexOf("$('timeline').onclick"))+'\nglobalThis.recorder=recorder;renderEditor=()=>{};drawRecordStage=()=>{};',c);
(async()=>{
 c.refreshRecorder();$('recordOverdub').checked=true;
 await c.startEditorTransport('record');clock=1.334;c.recordPress(0);c.recordPress(1);assert.equal(c.recordingTiles(1.334).filter(n=>n.head===1).length,2,'Key-down immediately produces visible tiles');clock=1.39;c.recordRelease(0);c.recordRelease(1);
 assert.equal(state.notes.length,3);assert(Math.abs(state.notes[0].time-1.234)<1e-9);assert.equal(state.notes[0].lane,0);assert.equal(state.notes[1].lane,1);assert.equal(state.notes[0].duration,0);
 clock=2;c.recordPress(2);clock=2.5;c.recordRelease(2);assert(Math.abs(state.notes[2].duration-.5)<1e-9);
 clock=3;c.recordPress(3);clock=3.6;c.stopEditorTransport();assert(!c.recorder.mode);assert.equal(c.recorder.pending.size,0);assert(Math.abs(state.notes[3].duration-.6)<1e-9);assert(state.notes.some(n=>n.time===9));assert(saved>=4);assert.equal(c.recorder.undo[0].length,1);
 c.recorder.selected=0;c.reviseEditorNote(.01);assert(Math.abs(state.notes.find(n=>n.lane===0).time-1.244)<1e-9);const before=JSON.stringify(state.notes);c.reviseEditorNote(-5);assert.equal(JSON.stringify(state.notes),before);assert.match($('recordStatus').textContent,/valid time/);
 c.recorder.position=4;$('recordSpeed').value=.5;clock=5;await c.startEditorTransport('record');clock=7;c.recordPress(0);clock=7.5;c.recordRelease(0);c.stopEditorTransport();const slow=state.notes.find(n=>Math.abs(n.time-4.9)<1e-9);assert(slow);assert(Math.abs(slow.duration-.25)<1e-9);
 c.recorder.position=9.7;clock=8;$('recordSpeed').value=1;await c.startEditorTransport('record');clock=8.1;c.recordPress(2);clock=8.3;c.recorder.source.onended();assert(!c.recorder.mode);assert.equal(c.recorder.position,10);assert(state.notes.every(n=>n.time+n.duration<=10));
 $('recordOverdub').checked=false;c.recorder.position=5;clock=10;await c.startEditorTransport('record');assert.equal(state.notes.length,0,'A new run starts blank');assert.equal(c.recorder.position,0);assert.equal(c.recordingTiles(0).length,0);clock=11;c.recordPress(1);assert.equal(c.recordingTiles(1).length,1);clock=11.1;c.recordRelease(1);assert.equal(state.notes.length,1);c.stopEditorTransport();assert(c.recorder.undo.at(-1).length>0,'Previous chart can be restored with Undo');
 const html=fs.readFileSync('public/index.html','utf8');for(const m of src.matchAll(/\$\('([^']+)'\)/g))assert(html.includes('id="'+m[1]+'"'),m[1]);assert(!html.includes('id="lifeValue"'));assert(!html.includes('<span>LIFE</span>'));assert(html.includes('id="lifeBar"'));
 console.log('PASS: performance recording timestamps, chords, tap/hold detection, stop finalization, retained notes, undo snapshots, 10ms edits, validation, half-speed timing, song end and editor DOM wiring.');
})();
