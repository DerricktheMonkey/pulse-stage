const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../public/performance-monitor.js'),E=require('../public/engine.js');
const app=fs.readFileSync('public/app.js','utf8');
for(const hz of [60,120,144,240])for(const rate of [.5,1,2]){
 const clock=P.createNoteMotionClock(),delays=[0,5,2,8,1,4,7,0],jitter=[0,.003,-.002,.004,-.003,.001],duration=1000/hz;
 let previous=null,maxStepError=0;
 for(let i=0;i<Math.round(hz*.7);i++){
  const frame=i*duration,wall=frame+delays[i%delays.length];
  const t=8+(wall/1000+jitter[i%jitter.length])*rate;
  const visual=clock.sample(frame,t,wall,rate);
  if(previous!==null){
   const step=visual-previous,expected=rate/hz;
   maxStepError=Math.max(maxStepError,Math.abs(step-expected));
   assert(step>expected*.95&&step<expected*1.05,'Audio timestamp jitter must not make falling notes jump at '+hz+'Hz / '+rate+'x');
  }
  previous=visual;
 }
 assert(maxStepError>0,'Controlled driver jitter exercised correction');
 clock.reset();
 assert.equal(clock.sample(0,4,0,rate),4,'Reset starts at audio presentation time');
 assert(Math.abs(clock.sample(150,4+.15*rate,150,rate)-(4+.15*rate))<1e-7,'Skipped frames catch up without a slow-motion freeze');
 assert.equal(clock.sample(160,2,160,rate*2),2,'Changing playback rate resets the visual clock');
}
const effects=[{lane:0,color:'#fff',born:0,duration:200,particles:0},{lane:1,color:'#fff',born:100,duration:300,particles:10}];
const context={state:{effects},point:(lane,p)=>({x:lane*100,y:p*500}),PulseNoteSprites:{effects:{draw:()=>true}},g:{}};
vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function drawHitEffects('),app.indexOf('function drawHoldCues(')),context);
context.drawHitEffects(150);assert.equal(context.state.effects,effects,'No effect-list allocation per frame');
context.drawHitEffects(250);assert.equal(effects.length,1);assert.equal(effects[0].lane,1);
context.drawHitEffects(500);assert.equal(effects.length,0);
let heads=[],ticks=0,wall=0,readTime=9.15;
const els=new Map(),$=id=>{if(!els.has(id))els.set(id,{value:'1',style:{},textContent:'',src:'',paused:false,hidden:id==='stageMessage'});return els.get(id);};
const state={playing:true,paused:false,playbackRate:1,presentationClock:{wall:0},notes:[{time:10,lane:0,duration:0}],holds:[null,null,null,null],pressed:[false,false,false,false],flashes:[0,0,0,0],releaseUntil:[0,0,0,0],palette:['#fff','#fff','#fff','#fff'],buffer:{duration:20},feedbackUntil:Infinity,noteCursor:0,noteTravel:1};
const canvasContext={state,E,$,performance:{now:()=>wall},g:new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),w:1000,h:600,ctx:{state:'running',currentTime:1},PulsePerformance:{noteMotion:P.createNoteMotionClock(),playfield:{update:()=>false},sample(){ticks++;}},songTime(){state.presentationClock.wall=wall;return readTime;},audibleContextTime:()=>0,offset:()=>0,practiceBeatDuration:()=>.5,drawStageBackground(){},point:(lane,p)=>({x:lane*100,y:28+p*530}),quad(){},drawHoldCues(){},drawHitEffects(){},fmt:String,requestAnimationFrame(){},judge(){throw Error('Judgement not expected in this timing-only sample');},PulseNoteSprites:{prepare:()=>({head(g,lane,x,y){heads.push(y);},cap(){}})}};
vm.createContext(canvasContext);vm.runInContext(app.slice(app.indexOf('function render(now)'),app.indexOf('function laneFromEvent')),canvasContext);
let previous=null;
for(let i=0;i<100;i++){
 const frame=i*1000/144,delay=[0,6,1,3,8,2][i%6],noise=[0,.002,-.002,.003,-.001][i%5];
 wall=frame+delay;readTime=9.15+wall/1000+noise;
 canvasContext.render(frame);
 const y=heads.at(-1);
 assert(Number.isFinite(y),'A visible note is drawn each frame');
 if(previous!==null){
  const expected=530/144,step=y-previous;
  assert(step>expected*.95&&step<expected*1.05,'Visual note travel stays uniform despite uneven callback and driver timestamps');
 }
 previous=y;
}
assert.equal(ticks,100,'Existing diagnostics remain active');
assert(app.includes('state.hudDirty=true')&&app.includes('if(state.hudDirty){state.hudDirty=false;updateHUD();}'),'Simultaneous judgements share one HUD update');
console.log('PASS: smooth note motion under driver jitter at 60-240Hz and 0.5-2x, callback delays, catchup, pause/restart, effect reuse and HUD batching.');
