const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../public/engine.js');
const app=fs.readFileSync('public/app.js','utf8');
function harness(rate=1){
 let wall=0,seconds=0;const heads=[],caps=[],misses=[],elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{value:1,style:{},hidden:id==='stageMessage',src:'',paused:false});return elements.get(id);};
 const state={playing:true,paused:false,playbackRate:rate,presentationClock:{wall:0},notes:[{time:10,lane:0,duration:.25}],holds:[null,null,null,null],pressed:[false,false,false,false],flashes:[0,0,0,0],palette:['#ffffff','#ffffff','#ffffff','#ffffff'],buffer:{duration:20},feedbackUntil:Infinity,noteCursor:0,noteTravel:1};
 const gradient={addColorStop(){}},g=new Proxy({createLinearGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const c={state,E,$,g,w:1000,h:600,ctx:{currentTime:0},audibleContextTime:()=>0,practiceBeatDuration:()=>.5,songTime(){state.presentationClock.wall=wall;return seconds;},offset:()=>0,drawStageBackground(){},point:(lane,p)=>({x:lane*100,y:28+p*530}),quad(){},drawHoldCues(){},drawHitEffects(){},fmt:String,requestAnimationFrame(){},judge(n,grade){misses.push(grade);n.result=grade;},PulseNoteSprites:{prepare:()=>({head(g,lane,x,y){heads.push(y);},cap(g,lane,x,y){caps.push(y);}})}};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function render(now)'),app.indexOf('function laneFromEvent')),c);
 return {state,heads,caps,misses,draw(frame,delay,time){wall=frame+delay;seconds=time;c.render(frame);}};
}
let worstError=0;
for(const hz of [60,120,144,240])for(const rate of [.5,1,2]){
 const h=harness(rate),delays=[0,3,1,4,0,2];let previous;
 for(let i=0;i<Math.min(40,Math.floor(.9*hz/rate));i++){
  const frame=i*1000/hz,delay=delays[i%delays.length],frameTime=9+frame/1000*rate;
  h.draw(frame,delay,frameTime+delay/1000*rate);
  assert(Math.abs(h.heads.at(-1)-(28+(frameTime-9)*530))<1e-8,'Note position follows display time at '+hz+'Hz / '+rate+'x');
  assert(Math.abs(h.caps.at(-1)-(28+Math.max(0,frameTime-9.25)*530))<1e-8,'Hold tails follow the same frame time');
  if(previous!==undefined){const error=Math.abs((h.heads.at(-1)-previous)-530*rate/hz);worstError=Math.max(worstError,error);assert(error<1e-8,'Uniform movement despite callback delay');}
  previous=h.heads.at(-1);
 }
}
const paused=harness();paused.state.playing=false;paused.state.paused=true;paused.draw(100,4,9.5);const frozen=paused.heads.at(-1);paused.draw(200,1,9.5);assert.equal(paused.heads.at(-1),frozen,'Practice freeze stays still');
const rewind=harness();rewind.state.origin=0;rewind.state.rewindTarget=9.5;rewind.draw(100,4,9.5);assert.equal(rewind.heads.at(-1),frozen,'Rewind countdown never draws before its saved position');
const judged=harness();judged.state.notes=[{time:9,lane:0,duration:0}];judged.draw(100,4,9+E.HIT_WINDOW+.001);assert.deepEqual(judged.misses,['MISS'],'Miss window uses audio time even when visual frame time is earlier');
console.log('PASS: uniform note/hold movement at 60/120/144/240Hz and 0.5/1/2x with 0–4ms dispatch jitter, pause, rewind clamp, and unchanged audio-clock judgments; worst step error '+worstError.toExponential(2)+'px.');
