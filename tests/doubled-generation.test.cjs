const assert=require('node:assert/strict'),E=require('../public/engine.js');
const dt=.01,duration=24,env=Array(2400).fill(.3),peaks=Array.from({length:92},(_,i)=>({time:1+i*.25,strength:1,lane:i%4}));
for(const difficulty of ['easy','normal','hard','insane','impossible']){
 const original=Array.from({length:40},(_,i)=>({time:1+i*.5,lane:i%4,duration:i%11===0?.3:0}));original.splice(3,0,{time:2,lane:3,duration:0});original.sort((a,b)=>a.time-b.time||a.lane-b.lane);
 const before=JSON.stringify(original),out=E.doubleGeneratedNotes(original,{env,dt,bpm:120,duration,peaks},difficulty);
 assert.equal(out.length,original.length*2,difficulty+' doubles note count');assert.equal(JSON.stringify(original),before);
 const key=n=>n.time+'|'+n.lane,keys=new Set(original.map(key));for(const n of original)assert.deepEqual(out.find(x=>key(x)===key(n)),n,'Retain original head, lane, hold and release');
 const added=out.filter(n=>!keys.has(key(n)));assert(added.every(n=>n.duration===0));for(const n of added)for(const other of out)if(n!==other)assert(Math.abs(n.time-other.time)>.04,'New taps cannot become chords');
 assert.equal(out.filter(n=>n.duration>0).length,original.filter(n=>n.duration>0).length);E.validateChart({notes:out},duration);
 const silent=E.doubleGeneratedNotes(original,{env:env.map(()=>0),dt,bpm:120,duration,peaks},difficulty);assert.deepEqual(silent,original,'No notes in silence');
}
// Compare complete real-audio generation to the original pipeline, not just the helper.
const rate=11025,audio=new Float32Array(rate*16);for(let i=0;i<audio.length;i++){const t=i/rate;if(t<.5||t>15.5)continue;const p=(t-.5)%.25,hz=[220,330,440,660][Math.floor((t-.5)/.25)%4];audio[i]=.3*Math.sin(2*Math.PI*hz*t)*(.5+.5*Math.exp(-p*35));}
for(const difficulty of ['easy','normal','hard','insane','impossible']){
 const base=E.analyzeLegacy(audio,rate,difficulty,{densityMultiplier:1}),dense=E.analyzeLegacy(audio,rate,difficulty);console.log(difficulty,base.notes.length,'→',dense.notes.length);
 assert(dense.notes.length>=base.notes.length*1.85,'Near double on active music for '+difficulty);assert(dense.notes.length<=base.notes.length*2);
 for(const n of base.notes)assert(dense.notes.some(x=>x.time===n.time&&x.lane===n.lane&&x.duration===n.duration));E.validateChart(dense,16);
 assert.equal(dense.generation.targetNotes,base.notes.length*2);
}
assert.equal(E.MAX_LIFE,10);assert.equal(E.nextHealth(9,'PERFECT'),9);assert.equal(E.nextHealth(10,'MISS','impossible'),9);
console.log('PASS: double single-tap density across all five tiers, immutable holds/chords, silence safety, real-audio integration, ten-life solo cap and one-life miss penalty.');
// Exercise the actual ten-life run and restart lifecycle.
const fs=require('node:fs'),vm=require('node:vm'),app=fs.readFileSync('public/app.js','utf8'),state={notes:[],releaseUntil:[0,0,0,0],palette:['#fff']},feedback={style:{}};
let failures=0;const context={E,state,$:id=>id==='practice'?{checked:false}:feedback,performance:{now:()=>0},clearInput(){},updateHUD(){},burst(){},finish(){failures++;}};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function resetRun('),app.indexOf('function requestGameFullscreen('))+app.slice(app.indexOf('function judge('),app.indexOf('function press(')),context);
context.resetRun();assert.equal(state.health,10);assert.equal(state.maxHealth,10);context.judge({lane:0},'PERFECT');assert.equal(state.health,10);state.difficulty='impossible';for(let i=0;i<9;i++)context.judge({lane:0},'MISS');assert.equal(failures,0);assert.equal(state.health,1);context.judge({lane:0},'MISS');assert.equal(failures,1);context.resetRun();assert.equal(state.health,10);
