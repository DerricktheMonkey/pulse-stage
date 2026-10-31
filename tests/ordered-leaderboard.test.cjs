const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto'),E=require('../public/engine.js'),L=require('../public/leaderboard.js');
const notes=[{time:1,lane:0},{time:1.08,lane:1},{time:1.08,lane:2},{time:1.2,lane:0}];
assert.equal(E.nextPlayable(notes,1,.99),null,'A later lane cannot bypass a note before its beat');assert.equal(E.nextPlayable(notes,0,1.07),notes[0]);notes[0].result='PERFECT';assert.equal(E.nextPlayable(notes,2,1.08),notes[2],'Chords allow either lane first');notes[2].result='PERFECT';assert.equal(E.nextPlayable(notes,0,1.09),null,'A later note cannot skip an earlier note that is still the better timing match');notes[1].started=true;assert.equal(E.nextPlayable(notes,0,1.2),notes[3],'An active hold head does not block later notes');assert.equal(E.nextPlayable(notes,0,2),null);
const app=fs.readFileSync('public/app.js','utf8');let time=1.08;const state={playing:true,pressed:[false,false,false,false],flashes:[],holds:[],notes:[{time:1,lane:0},{time:1.08,lane:1}]},hits=[];
const c={state,E,songTime:()=>time,offset:()=>0,performance:{now:()=>0},judge:(n,g)=>{n.result=g;hits.push(g);},burst(){}};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function press('),app.indexOf('function release(')),c);
// Before the first beat, later lanes remain blocked.
time=.99;c.press(1);assert.equal(hits.length,0);state.pressed[1]=false;time=1;c.press(0);time=1.08;c.press(1);assert.deepEqual(hits,['PERFECT','PERFECT']);
// Dense notes overlap in their late windows. Missing one must not cascade.
state.notes=[{time:1,lane:0},{time:1.08,lane:1},{time:1.16,lane:2}];state.pressed.fill(false);hits.length=0;time=1.08;c.press(1);assert.deepEqual(hits,['MISS','PERFECT']);time=1.16;c.press(2);assert.deepEqual(hits,['MISS','PERFECT','PERFECT']);
// Same-finger recovery chooses the closer head, with one miss per skipped head.
state.notes=[{time:1,lane:0},{time:1.08,lane:0}];state.pressed.fill(false);hits.length=0;time=1.08;c.press(0);assert.deepEqual(hits,['MISS','PERFECT']);
// A remaining chord member can be missed without blocking the following beat.
state.notes=[{time:1,lane:0,result:'PERFECT'},{time:1,lane:1},{time:1.08,lane:2}];state.pressed.fill(false);hits.length=0;time=1.08;c.press(2);assert.deepEqual(hits,['MISS','PERFECT']);
// Do not skip unplayed future heads or heads closer to the current press.
state.notes=[{time:1,lane:0},{time:1.08,lane:1},{time:1.16,lane:2}];state.pressed.fill(false);hits.length=0;time=1.01;c.press(1);assert.equal(hits.length,0);state.pressed.fill(false);time=1.07;c.press(2);assert.equal(hits.length,0);
state.notes=[{time:1,lane:0},{time:1.3,lane:1}];state.pressed.fill(false);hits.length=0;time=1.3;c.press(1);assert.deepEqual(hits,['MISS','PERFECT'],'Expired heads miss before the next head can count');
// A started hold stays active while the next head counts.
const hold={time:1,lane:0,started:true,duration:1};state.notes=[hold,{time:1.08,lane:1}];state.holds[0]=hold;state.pressed.fill(false);hits.length=0;time=1.08;c.press(1);assert.deepEqual(hits,['PERFECT']);assert(!hold.result);
// If the skipped note depletes life, stop before awarding the new hit.
state.holds=[];state.notes=[{time:1,lane:0},{time:1.08,lane:1}];state.pressed.fill(false);hits.length=0;c.judge=(n,g)=>{n.result=g;hits.push(g);if(g==='MISS')state.playing=false;};time=1.08;c.press(1);assert.deepEqual(hits,['MISS']);
assert.deepEqual(L.summarize(['PERFECT','PERFECT','GREAT','GOOD','MISS','PERFECT'],6),{score:4300,accuracy:4300/6/10,maxCombo:2,noteCount:6});assert.throws(()=>L.summarize(['PERFECT'],2));assert.throws(()=>L.summarize(['FAKE'],1));
const first={playerId:'a',score:2000,maxCombo:2,createdAt:'2026-01-01'},better={...first,score:2800},other={...first,playerId:'b',score:2500};let rows=L.insert([],first);rows=L.insert(rows,other);rows=L.insert(rows,better);assert.deepEqual(rows.map(r=>r.score),[2800,2500]);assert.deepEqual(L.insert(rows,first),rows,'Worse runs never overwrite personal best');assert.notEqual(L.canonical(notes,'easy'),L.canonical(notes,'hard'));assert.notEqual(L.canonical(notes,'hard'),L.canonical([...notes,{time:3,lane:1}],'hard'));
(async()=>{global.crypto=webcrypto;assert.match(await L.digest(L.canonical(notes,'hard')),/^[a-f0-9]{64}$/);console.log('PASS: chronological presses, arbitrary chord order, hold heads, overdue misses, leaderboard grading, chart isolation and best-run ranking.');})();
