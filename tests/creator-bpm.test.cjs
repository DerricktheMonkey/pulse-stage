const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app.js','utf8');
(async()=>{
 const state={editor:true,notes:[]},buffer={duration:30},elements={playBtn:{},offset:{value:0},alignBpm:{value:120},songFile:{value:'audio'}},saved=[];let scanFails=false,silent=false,generated=0;
 const context={state,$:id=>elements[id],status(){},stopToStudio(){},audio:()=>({decodeAudioData:async()=>buffer}),save:async(k,v)=>saved.push([k,v]),saveChart(){},updateMeta(){},scanSong:async()=>{if(scanFails)throw Error('worker failed');return {bpm:156,peaks:silent?[]:[1,2,3,4],notes:[{time:2,lane:1,duration:1}]};},generate:async()=>generated++};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function importSong('),source.indexOf('async function fillSparseSections(')),context);
 const file={size:20,type:'audio/wav',name:'Test.wav',arrayBuffer:async()=>new ArrayBuffer(20)};await context.importSong(file);
 assert.equal(state.analysis.bpm,156);assert.equal(elements.alignBpm.value,156);assert.equal(state.notes.length,0,'Tempo scanning must never insert generated notes into the creator');assert(state.customChart);assert(!state.loading);assert.equal(generated,0);
 scanFails=true;await context.importSong(file);assert.equal(state.buffer,buffer);assert(!state.loading);assert(state.customChart,'Scan failure keeps audio usable');
 scanFails=false;silent=true;await context.importSong(file);assert.equal(state.analysis,null,'Do not claim a detected tempo for silence');
 const editor=fs.readFileSync('public/editor.js','utf8');vm.runInContext(editor.slice(editor.indexOf("$('alignBpm').onchange=")),context);elements.alignBpm.value=92;const notes=[{time:1.234,lane:2,duration:.73}];state.notes=notes;elements.alignBpm.onchange();assert.equal(state.analysis.bpm,92);assert.equal(state.notes,notes,'Manual correction never snaps existing notes');elements.alignBpm.value=0;elements.alignBpm.onchange();assert.equal(state.analysis.bpm,92);
 console.log('PASS: creator BPM detection, manual correction, no generated chart insertion, silent audio and scan-error recovery.');
})().catch(e=>{console.error(e);process.exitCode=1;});
