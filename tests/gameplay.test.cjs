const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),E=require('../public/engine.js');
const app=fs.readFileSync('public/app.js','utf8'),els={practice:{checked:false},feedback:{style:{}},perfectStatus:{dataset:{}},streakBreak:{classList:{add(){},remove(){}}}};let failed=false,bursts=0;
const context={E,state:{judged:0,counts:{PERFECT:0,GREAT:0,GOOD:0,MISS:0},weight:0,combo:0,maxCombo:0,score:0,health:100,palette:['#fff']},$:id=>els[id],performance:{now:()=>0},burst:()=>bursts++,updateHUD:()=>{},finish:()=>failed=true};
vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function judge('),app.indexOf('function press(')),context);
for(let i=0;i<9;i++)context.judge({lane:0},'MISS');assert(failed);assert.equal(context.state.health,0);
failed=false;els.practice.checked=true;context.state.health=12;context.judge({lane:0},'MISS');assert(!failed);
const note={lane:0};context.judge(note,'PERFECT');context.judge(note,'PERFECT');assert.equal(bursts,1);assert.equal(context.state.health,2);
const html=fs.readFileSync('public/index.html','utf8'),ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);for(const m of app.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(m[1]),m[1]);assert(!html.includes('id="practice" type="checkbox" checked'));
console.log('PASS: gameplay life loss, Practice exemption, hit animation trigger, duplicate hit protection and UI wiring.');

// Ending a paused run must replace the pause dialog with results without saving a partial best.
const dialog=()=>({open:false,close(){this.open=false;},showModal(){this.open=true;}}),pauseDialog=dialog(),results=dialog(),heading={};pauseDialog.open=true;results.querySelector=()=>heading;
const finishEls={pauseMenu:pauseDialog,results,bgVideo:{pause(){}},pauseBtn:{},resultTitle:{},grade:{classList:{toggle(){}}},resultStats:{replaceChildren(){},append(){}}};let saves=0;
const stopped={state:{finished:false,playing:false,paused:true,buffer:{duration:100},position:25,judged:2,weight:2,notes:[{},{},{}],counts:{PERFECT:2,GREAT:0,GOOD:0,MISS:0},score:2000,maxCombo:2,best:{},holds:[null,null,null,null]},$:id=>finishEls[id],songTime:()=>stopped.state.position,offset:()=>0,stopSource(){},clearInput(){},leaveFullscreen(){},updateLife(){},E,document:{body:{classList:{remove(){}}},createElement:()=>({append(){}})},save(){saves++;},bestKey:()=> 'track',showBest(){}};
vm.createContext(stopped);vm.runInContext(app.slice(app.indexOf('function canCompleteRun('),app.indexOf('const canvas=')),stopped);stopped.finish(true,true);
assert(!pauseDialog.open);assert(results.open);assert(!stopped.state.paused);assert(!stopped.state.playing);assert.equal(stopped.state.position,25);assert.equal(heading.textContent,'TRACK ENDED EARLY');assert.equal(finishEls.grade.textContent,'—');assert.equal(finishEls.resultTitle.textContent,'Results so far.');assert.equal(saves,0);assert.equal(stopped.state.counts.MISS,0);
assert(html.includes('id="endGame"'));assert(app.includes("$('endGame').onclick=()=>{if(state.paused)finish(true,true);}"));
console.log('PASS: manual end closes pause menu, stops play, displays partial results, preserves judgements and does not save a partial best or award S.');

// Completion depends on judgements, even when the final tap is hit early and music continues.
stopped.state.buffer={duration:100};
stopped.state.notes=[{time:10,duration:0,result:'PERFECT'},{time:60,duration:0,result:'PERFECT'}];stopped.state.judged=2;stopped.state.position=59.9;
assert(stopped.canCompleteRun(),'Final tap hit within the early Perfect window qualifies immediately');
stopped.state.notes[1].result=null;assert(!stopped.canCompleteRun(),'A pending final note or simultaneous chord member blocks completion');
stopped.state.notes[1].duration=5;stopped.state.notes[1].started=true;stopped.state.holds[1]=stopped.state.notes[1];assert(!stopped.canCompleteRun(),'Hold still in progress');
stopped.state.notes[1].result='PERFECT';stopped.state.holds[1]=null;assert(stopped.canCompleteRun(),'Judged hold tail qualifies');
stopped.state.notes[1].duration=0;stopped.state.finished=false;stopped.finish(true,true);assert.equal(heading.textContent,'TRACK COMPLETE');assert.equal(finishEls.grade.textContent,'S');assert.equal(finishEls.resultTitle.textContent,'All Perfect!');assert.equal(saves,1);assert.equal(stopped.state.best.track.rank,'S');
stopped.state.notes[0].result='MISS';assert(stopped.canCompleteRun(),'A fully judged attempt can include misses');stopped.state.judged=1;assert(!stopped.canCompleteRun(),'Incomplete judged total');
console.log('PASS: Enter immediately after final tap or judged hold counts as complete while audio continues, awards earned S and saves bests; unjudged notes and active holds remain partial.');

// Only consecutive Perfect judgements build combo.
context.state.combo=0;context.state.maxCombo=0;context.state.runGrades=[];context.state.health=100;
for(const [grade,combo] of [['PERFECT',1],['PERFECT',2],['GREAT',0],['PERFECT',1],['GOOD',0],['PERFECT',1],['MISS',0]]){context.judge({lane:0},grade);assert.equal(context.state.combo,combo);}
assert.equal(context.state.maxCombo,2);assert.equal(context.state.runGrades.length,7);
assert(!html.includes('id="streakBreak"'));assert(!app.includes('updatePerfectStreak'));
console.log('PASS: Perfect-only combos reset on Great, Good and Miss, and no streak-break banner remains.');

for(const [difficulty,misses] of Object.entries({easy:13,normal:9,hard:5,insane:3})){
 context.state.difficulty=difficulty;context.state.health=100;els.practice.checked=false;failed=false;
 for(let i=0;i<misses-1;i++){context.judge({lane:0},'MISS');assert(!failed,difficulty+' failed too soon');}
 context.judge({lane:0},'MISS');assert(failed,difficulty+' should fail at the configured miss total');
}
console.log('PASS: real judgement flow applies the selected difficulty life penalty.');
