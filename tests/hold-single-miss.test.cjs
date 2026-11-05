const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../public/engine.js');
const source=fs.readFileSync('public/app.js','utf8');let now=0,reports=0;
const state={playing:true,health:100,difficulty:'normal',judged:0,counts:{PERFECT:0,GREAT:0,GOOD:0,MISS:0},weight:0,score:0,combo:0,maxCombo:0,holds:[null,null,null,null],pressed:[false,false,false,false],palette:['#fff']};
const sandbox={E,state,performance:{now:()=>0},$:id=>id==='practice'?{checked:false}:{style:{}},burst(){},updateHUD(){},finish(){},songTime:()=>now,offset:()=>0};
vm.createContext(sandbox);vm.runInContext(source.slice(source.indexOf('function judge('),source.indexOf('function press('))+source.slice(source.indexOf('function release('),source.indexOf('function canCompleteRun(')),sandbox);
for(const scenario of ['missed head','early release','lost input']){
 state.health=100;state.judged=0;state.counts.MISS=0;const n={time:1,duration:3,lane:0};state.holds[0]=scenario==='missed head'?null:n;state.pressed[0]=true;now=2;
 if(scenario==='early release')sandbox.release(0);else sandbox.judge(n,'MISS');
 assert.equal(state.holds[0],null,scenario+' retires its release');now=4;sandbox.release(0);sandbox.release(0);sandbox.judge(n,'MISS');
 assert.equal(state.health,88,scenario+' costs exactly one normal miss');assert.equal(state.judged,1);assert.equal(state.counts.MISS,1);
}
state.health=100;const good={time:1,duration:3,lane:0,started:true,startGrade:'PERFECT'};state.holds[0]=good;now=3.9;sandbox.release(0);sandbox.release(0);assert.equal(good.result,'PERFECT');assert.equal(state.health,100);
// The same finalization guard covers Battle reports, so release cannot send another miss.
sandbox.BattleMode={isRunning:()=>true,onJudge(){reports++;}};const battleHold={time:1,duration:3,lane:0};state.holds[0]=battleHold;sandbox.judge(battleHold,'MISS');sandbox.release(0);sandbox.judge(battleHold,'MISS');assert.equal(reports,1);
console.log('PASS: missed heads, early releases and input loss retire each hold once; late release cannot deduct another life or duplicate a Battle report.');
