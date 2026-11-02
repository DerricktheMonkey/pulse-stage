const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto'),E=require('../public/engine.js'),L=require('../public/leaderboard.js');
const notes=[{time:1,lane:0},{time:1.08,lane:1},{time:1.08,lane:2},{time:1.2,lane:0}];
assert.equal(E.nextPlayable(notes,1,.99),notes[1],'Different lanes can be pressed independently within their timing windows');
assert.equal(E.nextPlayable(notes,0,1.07),notes[0]);notes[0].result='PERFECT';assert.equal(E.nextPlayable(notes,2,1.08),notes[2]);
assert.equal(E.nextPlayable(notes,0,1.09),notes[3],'Other lanes do not block an independent lane hit');
const app=fs.readFileSync('public/app.js','utf8');let time=1.08;const state={playing:true,pressed:[false,false,false,false],flashes:[],holds:[],notes:[]},hits=[];
const c={state,E,$:()=>({style:{}}),songTime:()=>time,offset:()=>0,performance:{now:()=>0},judge:(n,g)=>{n.result=g;hits.push(g);},burst(){}};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function press('),app.indexOf('function release(')),c);
function setup(chart,t){state.playing=true;state.noteCursor=0;state.notes=chart.map(n=>({...n}));state.pressed.fill(false);state.holds=[];hits.length=0;time=t;}
// Close heads must survive either order, including OS key events a few ms apart.
for(const gap of [0,.01,.025,.04])for(const order of [[0,1],[1,0]])for(const t of [1,1+gap/2,1+gap]){
 setup([{time:1,lane:0},{time:1+gap,lane:1}],t);
 c.press(order[0]);assert.equal(hits.length,1);assert(!hits.includes('MISS'));
 time+=.003;c.press(order[1]);assert.deepEqual(hits,['PERFECT','PERFECT']);assert.equal(state.noteCursor,2);
}
// All four keys can arrive in any order for a compact multi-note accent.
function permutations(xs){return xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>i!==j)).map(rest=>[x,...rest])):[[]];}
for(const order of permutations([0,1,2,3])){setup([0,.01,.025,.04].map((dt,lane)=>({time:1+dt,lane})),1.02);for(const lane of order){c.press(lane);time+=.001;}assert.deepEqual(hits,['PERFECT','PERFECT','PERFECT','PERFECT']);}
// The tolerance does not consume another lane's head or extend the normal hit window.
setup([{time:1,lane:0},{time:1.04,lane:1}],1.04);c.press(1);assert(!state.notes[0].result);time=1.20;c.press(0);assert.deepEqual(hits,['PERFECT','MISS']);
// More widely separated heads still miss when skipped, and recovery stays usable.
setup([{time:1,lane:0},{time:1.041,lane:1},{time:1.2,lane:2}],1.041);c.press(1);assert.deepEqual(hits,['MISS','PERFECT']);time=1.2;c.press(2);assert.deepEqual(hits,['MISS','PERFECT','PERFECT']);
// Repeated heads on one finger still require separate presses; closer-head recovery works.
setup([{time:1,lane:0},{time:1.08,lane:0}],1.08);c.press(0);assert.deepEqual(hits,['MISS','PERFECT']);
setup([{time:1,lane:0},{time:1.08,lane:0}],1);c.press(0);time=1.08;c.press(0);assert.equal(hits.length,1,'Holding a key cannot hit another head');state.pressed[0]=false;c.press(0);assert.deepEqual(hits,['PERFECT','PERFECT']);
// A hold head can join a close accent and remains held while other keys count.
setup([{time:1,lane:0,duration:1},{time:1.04,lane:1}],1.04);c.press(1);c.press(0);assert(state.notes[0].started);assert.equal(state.holds[0],state.notes[0]);assert.deepEqual(hits,['PERFECT']);
setup([{time:1,lane:0,started:true,duration:1},{time:1.4,lane:1}],1.4);state.holds[0]=state.notes[0];c.press(1);assert.deepEqual(hits,['PERFECT']);assert(!state.notes[0].result);
// Close heads get input leniency without chord glow or changed timestamps.
const group=[{time:1,lane:0,chord:true},{time:1.02,lane:1,chord:true},{time:1.04,lane:2,chord:true}];E.markChords(group);assert(group.every(n=>!n.chord));assert.deepEqual(group.map(n=>n.time),[1,1.02,1.04]);assert(!E.simultaneousHeads({time:1,lane:0},{time:1.04,lane:0}));
const exact=[{time:2,lane:0},{time:2,lane:1}];E.markChords(exact);assert(exact.every(n=>n.chord),'True simultaneous chords retain their existing glow');
// Death from an actual skipped head stops scoring before the new note is awarded.
setup([{time:1,lane:0},{time:1.12,lane:1}],1.12);c.judge=(n,g)=>{n.result=g;hits.push(g);if(g==='MISS')state.playing=false;};c.press(1);assert.deepEqual(hits,['MISS']);
assert.deepEqual(L.summarize(['PERFECT','PERFECT','GREAT','GOOD','MISS','PERFECT'],6),{score:4300,accuracy:4300/6/10,maxCombo:2,noteCount:6});assert.throws(()=>L.summarize(['PERFECT'],2));assert.throws(()=>L.summarize(['FAKE'],1));
const first={playerId:'a',score:2000,maxCombo:2,createdAt:'2026-01-01'},better={...first,score:2800},other={...first,playerId:'b',score:2500};let rows=L.insert([],first);rows=L.insert(rows,other);rows=L.insert(rows,better);assert.deepEqual(rows.map(r=>r.score),[2800,2500]);assert.deepEqual(L.insert(rows,first),rows,'Worse runs never overwrite personal best');assert.notEqual(L.canonical(notes,'easy'),L.canonical(notes,'hard'));assert.notEqual(L.canonical(notes,'hard'),L.canonical([...notes,{time:3,lane:1}],'hard'));
(async()=>{global.crypto=webcrypto;assert.match(await L.digest(L.canonical(notes,'hard')),/^[a-f0-9]{64}$/);console.log('PASS: chronological presses, arbitrary chord order, hold heads, overdue misses, leaderboard grading, chart isolation and best-run ranking.');})();
