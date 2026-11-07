'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../public/engine.js');
const counts=(perfect,great=0,good=0,miss=0)=>({PERFECT:perfect,GREAT:great,GOOD:good,MISS:miss});
test('SS is exclusive to all-Perfect completion, not rounded accuracy or a full combo',()=>{
 assert.equal(E.rank(counts(100),100),'SS');assert.equal(E.rank(counts(9,1),10),'S');
 assert.equal(E.rank(counts(99999,1),100000),'S');assert.equal(E.rank(counts(99,0,1),100),'S');
 assert.equal(E.rank(counts(99,0,0,1),100),'S');assert.equal(E.rank(counts(0,10),10),'B');
 assert.equal(E.rank(counts(0),0),'\u2014');assert.equal(E.rank(counts(9),10),'\u2014');
 assert.equal(E.rank(counts(100),100,false),'F');assert.equal(E.rank(counts(1,0,0,-1),0),'\u2014');
});
test('all boundaries use raw weighted accuracy without rounding up',()=>{
 for(const [perfect,expected] of [[100,'SS'],[99,'S'],[95,'S'],[94,'A'],[90,'A'],[89,'B'],[80,'B'],[79,'C'],[70,'C'],[69,'D'],[0,'D']])assert.equal(E.rank(counts(perfect,0,0,100-perfect),100),expected);
 assert.equal(E.rank(counts(75,25),100),'S');assert.equal(E.rank(counts(74,26),100),'A');
 for(const [perfect,expected] of [[949999,'A'],[899999,'B'],[799999,'C'],[699999,'D']])assert.equal(E.rank(counts(perfect,0,0,1000000-perfect),1000000),expected);
});
test('all UI builds have neutral copy, correct help, and matched worker cache versions',()=>{
 const banned=['FIND YOUR FLOW','MAKE IT YOURS','Your next run starts here.','WELCOME TO YOUR STAGE','Feel the beat.','YOUR MUSIC, TOGETHER','Nice flow.','Compose a chart. Every note is yours.','Just exploring?','Vibecoded'];
 for(const file of ['index.html','app.js','studio.js','README.md']){const source=fs.readFileSync(file,'utf8');for(const text of banned)assert(!source.includes(text),file+': '+text);}
 for(const file of ['index.html','engine.js','app.js','studio.js','analysis-worker.js'])assert.equal(fs.readFileSync(file,'utf8'),fs.readFileSync('public/'+file,'utf8'));
 const html=fs.readFileSync('index.html','utf8');assert(html.includes('id="gradeRules"'));assert(html.includes('earn SS'));assert(!html.includes('earn S rank'));assert(!html.includes('Misses cost more life at higher difficulties'));
 const version=html.match(/src="engine\.js\?v=([^"\s]+)/)[1];assert(fs.readFileSync('analysis-worker.js','utf8').includes('engine.js?v='+version));assert(fs.readFileSync('app.js','utf8').includes('analysis-worker.js?v='+version));
});
test('actual results handler displays every grade, only SS glows, and partial/failed runs do not save',()=>{
 const app=fs.readFileSync('public/app.js','utf8');
 const node=()=>({open:false,textContent:'',style:{},classList:{toggle(name,on){this[name]=on;}},close(){this.open=false;},showModal(){this.open=true;},replaceChildren(){},append(){},pause(){}});
 const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};$('practice').checked=false;$('results').querySelector=()=>$('heading');
 let saves=0,eligible=null;const c={E,$,state:{buffer:{duration:100},best:{},holds:[null,null,null,null]},songTime:()=>50,stopSource(){},clearInput(){},leaveFullscreen(){},updateLife(){},save(){saves++;},showBest(){},bestKey:()=> 'test',Leaderboard:{finishRun(value){eligible=value;}},document:{body:{classList:{remove(){}}},createElement:node}};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function canCompleteRun('),app.indexOf('const canvas=')),c);
 for(const [perfect,expected] of [[100,'SS'],[95,'S'],[90,'A'],[80,'B'],[70,'C'],[69,'D']]){
  Object.assign(c.state,{finished:false,playing:true,paused:false,notes:Array.from({length:100},(_,i)=>({result:i<perfect?'PERFECT':'MISS'})),judged:100,weight:perfect,counts:counts(perfect,0,0,100-perfect),score:1000*perfect,maxCombo:perfect,best:{},trainingRun:false});
  c.finish(true);assert.equal($('grade').textContent,expected);assert.equal($('grade').classList['all-perfect'],expected==='SS');assert.equal(c.state.best.test.rank,expected);assert.equal(eligible,true);
 }
 const before=saves;c.state.finished=false;c.finish(false);assert.equal($('grade').textContent,'F');assert.equal(saves,before);assert.equal(eligible,false);
 c.state.finished=false;c.state.judged=1;c.state.notes[1].result=null;c.finish(true,true);assert.equal($('grade').textContent,'\u2014');assert.equal(saves,before);assert.equal(eligible,false);
});
