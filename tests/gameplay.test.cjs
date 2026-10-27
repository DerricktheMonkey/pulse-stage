const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),E=require('../public/engine.js');
const app=fs.readFileSync('public/app.js','utf8'),els={practice:{checked:false},feedback:{style:{}}};let failed=false,bursts=0;
const context={E,state:{judged:0,counts:{PERFECT:0,GREAT:0,GOOD:0,MISS:0},weight:0,combo:0,maxCombo:0,score:0,health:100,palette:['#fff']},$:id=>els[id],performance:{now:()=>0},burst:()=>bursts++,updateHUD:()=>{},finish:()=>failed=true};
vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function judge('),app.indexOf('function press(')),context);
for(let i=0;i<9;i++)context.judge({lane:0},'MISS');assert(failed);assert.equal(context.state.health,0);
failed=false;els.practice.checked=true;context.state.health=12;context.judge({lane:0},'MISS');assert(!failed);
const note={lane:0};context.judge(note,'PERFECT');context.judge(note,'PERFECT');assert.equal(bursts,1);assert.equal(context.state.health,2);
const html=fs.readFileSync('public/index.html','utf8'),ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);for(const m of app.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(m[1]),m[1]);assert(!html.includes('id="practice" type="checkbox" checked'));
console.log('PASS: gameplay life loss, Practice exemption, hit animation trigger, duplicate hit protection and UI wiring.');
