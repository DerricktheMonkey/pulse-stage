const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../public/engine.js');
const app=fs.readFileSync('public/app.js','utf8'),elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{value:1,hidden:id==='stageMessage',style:{},open:false,src:'',pause(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);};
const scheduled=[],sources=[],judgements=[];let wall=0;
const ac={currentTime:20,resume:async()=>{},createBufferSource(){const source={connect(){},disconnect(){},stop(){this.stopped=true;},start(when,offset){scheduled.push({when,offset});}};sources.push(source);return source;}};
const state={buffer:{duration:60},playing:false,paused:false,position:7,notes:[{time:6.6,lane:1},{time:7,lane:0}],noteCursor:0,noteTravel:.7,pressed:[false,false,false,false],holds:[null,null,null,null],pointers:new Map(),releaseUntil:[],flashes:[0,0,0,0],palette:['#ffffff','#ffffff','#ffffff','#ffffff'],feedbackUntil:Infinity};
const gradient={addColorStop(){}},g=new Proxy({createLinearGradient:()=>gradient},{get:(t,k)=>t[k]||(()=>{}),set(t,k,v){t[k]=v;return true;}});
const c={state,E,$,ctx:ac,g,gain:{},w:1000,h:600,audio:()=>ac,audibleContextTime:()=>ac.currentTime,performance:{now:()=>wall},offset:()=>0,updateLife(){},syncVideo(){},point:(lane,p)=>({x:lane*100,y:p*500}),quad(){},drawStageBackground(){},drawHoldCues(){},drawHitEffects(){},fmt:String,requestAnimationFrame(){},burst(){},judge(n,grade){n.result=grade;judgements.push(grade);},requestGameFullscreen(){}};vm.createContext(c);
for(const [from,to] of [['function songTime(','function offset('],['function stopSource(','function clearInput('],['function startSource(','function pause('],['function pause(){','function returnToMenu('],['function press(','function release('],['function render(now)','function laneFromEvent']])vm.runInContext(app.slice(app.indexOf(from),app.indexOf(to)),c);
function frame(time){ac.currentTime=time;wall=(time-20)*1000;c.render(wall);}
(async()=>{
 c.startSource(7,3);assert.deepEqual(scheduled[0],{when:23,offset:7});
 for(const [time,label] of [[20,3],[21.1,2],[22.1,1]]){frame(time);assert.equal(Number($('countdown').textContent),label);assert.equal(c.songTime(),7,'The chart is frozen at the five-second rewind target');c.press(0);assert.equal(judgements.length,0,'No misses or early hits during countdown');assert(!state.pressed[0]);}
 frame(23);assert.equal($('countdown').textContent,'');assert.equal(state.rewindTarget,undefined);c.press(0);assert.equal(state.notes[1].result,'PERFECT');assert.equal(c.songTime(),7);frame(23.1);assert(c.songTime()>7,'Notes resume with scheduled audio');
 c.startSource(7,3);const stopped=sources.at(-1);ac.currentTime=24.1;wall=4100;c.pause();assert(stopped.stopped,'Pausing cancels the pending source');assert.equal(state.position,7);assert(Math.abs(state.rewindDelay-2)<1e-9);ac.currentTime=40;c.pause();await Promise.resolve();assert.deepEqual(scheduled.at(-1),{when:42,offset:7},'Resume preserves remaining countdown rather than playing early');
 c.stopSource();assert.equal(state.rewindTarget,undefined);assert.equal(state.rewindDelay,undefined);assert(sources.at(-1).stopped,'Leaving or restarting cancels pending playback');
 c.startSource(-2);assert.deepEqual(scheduled.at(-1),{when:42,offset:0},'Normal initial countdown still works');
 console.log('PASS: audio scheduled three seconds ahead, visible 3-2-1, frozen notes, no countdown judgements, exact resume offset, pause/resume remaining time and cancelled pending playback.');
})();
