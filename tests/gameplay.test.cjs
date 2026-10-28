const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),E=require('../public/engine.js');
const app=fs.readFileSync('public/app.js','utf8'),els={practice:{checked:false},feedback:{style:{}}};let failed=false,bursts=0;
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
const stopped={state:{finished:false,playing:false,paused:true,buffer:{duration:100},position:25,judged:2,weight:2,notes:[{},{},{}],counts:{PERFECT:2,GREAT:0,GOOD:0,MISS:0},score:2000,maxCombo:2,best:{}},$:id=>finishEls[id],songTime:()=>25,stopSource(){},clearInput(){},leaveFullscreen(){},updateLife(){},E,document:{body:{classList:{remove(){}}},createElement:()=>({append(){}})},save(){saves++;},bestKey:()=> 'track',showBest(){}};
vm.createContext(stopped);vm.runInContext(app.slice(app.indexOf('function finish('),app.indexOf('const canvas=')),stopped);stopped.finish(true,true);
assert(!pauseDialog.open);assert(results.open);assert(!stopped.state.paused);assert(!stopped.state.playing);assert.equal(stopped.state.position,25);assert.equal(heading.textContent,'TRACK ENDED EARLY');assert.equal(finishEls.grade.textContent,'—');assert.equal(finishEls.resultTitle.textContent,'Results so far.');assert.equal(saves,0);assert.equal(stopped.state.counts.MISS,0);
assert(html.includes('id="endGame"'));assert(app.includes("$('endGame').onclick=()=>{if(state.paused)finish(true,true);}"));
console.log('PASS: manual end closes pause menu, stops play, displays partial results, preserves judgements and does not save a partial best or award S.');
