const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../public/engine.js');
const app=fs.readFileSync('public/app.js','utf8'),elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{value:1,hidden:id==='stageMessage',style:{},open:false,src:'',pause(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);};
const scheduled=[],sources=[],judgements=[];let wall=0;
const ac={currentTime:20,resume:async()=>{},createBufferSource(){const source={playbackRate:{value:1},connect(){},disconnect(){},stop(){this.stopped=true;},start(when,offset){scheduled.push({when,offset});}};sources.push(source);return source;}};
const state={buffer:{duration:60},playing:false,paused:false,position:7,notes:[{time:6.6,lane:1},{time:7,lane:0}],noteCursor:0,noteTravel:.7,pressed:[false,false,false,false],holds:[null,null,null,null],pointers:new Map(),releaseUntil:[],flashes:[0,0,0,0],palette:['#ffffff','#ffffff','#ffffff','#ffffff'],feedbackUntil:Infinity};
const gradient={addColorStop(){}},g=new Proxy({createLinearGradient:()=>gradient},{get:(t,k)=>t[k]||(()=>{}),set(t,k,v){t[k]=v;return true;}});
const c={state,E,$,ctx:ac,g,gain:{},w:1000,h:600,audio:()=>ac,audibleContextTime:()=>ac.currentTime,performance:{now:()=>wall},offset:()=>0,updateLife(){},syncVideo(){},point:(lane,p)=>({x:lane*100,y:p*500}),quad(){},drawStageBackground(){},drawHoldCues(){},drawHitEffects(){},fmt:String,requestAnimationFrame(){},burst(){},judge(n,grade){n.result=grade;judgements.push(grade);},requestGameFullscreen(){}};vm.createContext(c);
for(const [from,to] of [['function practiceBeatDuration(','function rewindPractice('],['function songTime(','function offset('],['function stopSource(','function clearInput('],['function trainingPlaybackRate(','function pause('],['function pause(){','function returnToMenu('],['function press(','function release('],['function render(now)','function laneFromEvent']])vm.runInContext(app.slice(app.indexOf(from),app.indexOf(to)),c);
function frame(time){ac.currentTime=time;wall=(time-20)*1000;c.render(wall);}
(async()=>{
 for(const bpm of [60,120,180,240]){
  const beat=60/bpm,begin=20+bpm/10,ready=begin+3*beat;state.analysis={bpm};ac.currentTime=begin;wall=(begin-20)*1000;judgements.length=0;state.pressed.fill(false);for(const n of state.notes)delete n.result;state.noteCursor=0;state.position=7;
  c.startSource(7,3*c.practiceBeatDuration());assert.deepEqual(scheduled.at(-1),{when:ready,offset:7});
  for(const [time,label] of [[begin,3],[begin+beat*1.05,2],[begin+beat*2.05,1]]){frame(time);assert.equal(Number($('countdown').textContent),label,bpm+' BPM count-in');assert.equal(c.songTime(),7,'Chart stays frozen at rewind target');c.press(0);assert.equal(judgements.length,0,'No misses or early hits during countdown');assert(!state.pressed[0]);}
  frame(ready);assert.equal($('countdown').textContent,'');assert.equal(state.rewindTarget,undefined);c.press(0);assert.equal(state.notes[1].result,'PERFECT');assert(Math.abs(c.songTime()-7)<1e-9);frame(ready+.1);assert(c.songTime()>7,'Notes resume with scheduled audio');
  c.startSource(7,3*beat);const stopped=sources.at(-1);ac.currentTime=ready+.1+beat;wall=(ac.currentTime-20)*1000;c.pause();assert(stopped.stopped,'Pausing cancels pending audio');assert.equal(state.position,7);assert(Math.abs(state.rewindDelay-2*beat)<1e-9);ac.currentTime=begin+8;c.pause();await Promise.resolve();assert(Math.abs(scheduled.at(-1).when-(ac.currentTime+2*beat))<1e-9,'Resume preserves remaining beats');assert.equal(scheduled.at(-1).offset,7);
  c.stopSource();assert.equal(state.rewindTarget,undefined);assert.equal(state.rewindDelay,undefined);assert(sources.at(-1).stopped);
  c.startSource(-2);assert.deepEqual(scheduled.at(-1),{when:ac.currentTime+2,offset:0},'Normal initial countdown is unchanged');
 }
 for(const bpm of [undefined,0,-20,Infinity,NaN]){state.analysis={bpm};assert.equal(c.practiceBeatDuration(),.5,'Invalid BPM falls back to 120 BPM');}
 console.log('PASS: three-beat 3-2-1 at 60/120/180/240 BPM, frozen notes, audio resume timing, pause/resume remaining beats, cancelled playback, and missing/invalid BPM fallback.');
})();
