const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('public/app.js','utf8');
const state={playing:true,origin:2,position:4},ctx={currentTime:10,getOutputTimestamp:()=>({contextTime:9.94,performanceTime:990})};
const c={ctx,state,performance:{now:()=>1000}};vm.createContext(c);
vm.runInContext(app.slice(app.indexOf('function audibleContextTime('),app.indexOf('function offset(')),c);
assert(Math.abs(c.songTime()-7.95)<1e-9,'Use the audio presentation clock for notes and judgement');
state.playing=false;assert.equal(c.songTime(),4,'Pause keeps its saved position');state.playing=true;
ctx.getOutputTimestamp=()=>({contextTime:1,performanceTime:1});ctx.outputLatency=.04;
assert(Math.abs(c.songTime()-7.96)<1e-9,'Stale output timestamps fall back to reported latency');
ctx.getOutputTimestamp=()=>{throw Error('Unavailable');};assert(Math.abs(c.songTime()-7.96)<1e-9);
ctx.outputLatency=0;ctx.baseLatency=.01;assert(Math.abs(c.songTime()-7.99)<1e-9);
ctx.baseLatency=0;assert.equal(c.songTime(),8,'Browsers without latency reporting retain the normal clock');
console.log('PASS: audio output timestamps, latency fallback, stale/throwing timestamps and pause position.');
// At startup some drivers switch from a latency estimate to delayed timestamps.
// That correction must not jump the notes backwards or freeze their movement.
let wall=0;const liveCtx={currentTime:1,outputLatency:.02,getOutputTimestamp(){return wall<200?{contextTime:0,performanceTime:0}:{contextTime:this.currentTime-.1,performanceTime:wall};}},liveState={playing:true,origin:3,position:0,presentationClock:{time:.98,wall:0}},live={ctx:liveCtx,state:liveState,performance:{now:()=>wall}};vm.createContext(live);vm.runInContext(app.slice(app.indexOf('function audibleContextTime('),app.indexOf('function offset(')),live);let previous=live.songTime();
for(let frame=1;frame<=126;frame++){wall=frame*1000/60;liveCtx.currentTime=1+wall/1000;const time=live.songTime(),step=time-previous;assert(step>=.0152&&step<=.0181,'Opening notes keep moving smoothly through an 80ms driver-clock correction');previous=time;}
assert(Math.abs(live.songTime())<.002,'Presentation clock is aligned by the first audible beat');assert.equal(live.songTime(),previous,'Repeated reads at the same instant agree for rendering and judgement');liveState.playing=false;liveState.position=4;assert.equal(live.songTime(),4);liveState.playing=true;wall+=500;liveCtx.currentTime+=.5;assert(Math.abs(live.songTime()-(liveCtx.currentTime-.1-liveState.origin))<1e-9,'Catch up after an actual long interruption');
console.log('PASS: smooth opening through driver timestamp changes, monotonic movement, alignment by the first beat, consistent input/render reads and long-interruption catch-up.');
