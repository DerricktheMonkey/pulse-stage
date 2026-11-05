const assert=require('node:assert/strict'),fs=require('node:fs'),E=require('../public/engine.js');
function groups(notes){const map=new Map();for(const n of notes){if(!map.has(n.time))map.set(n.time,[]);map.get(n.time).push(n);}return [...map.values()];}
let trills=0,triplets=0,chords=0,jacks=0;
for(const step of [.045,.055,.075,.1,.125,1/6,.2,.3]){
 const base=E.spreadLanes(Array.from({length:160},(_,i)=>({time:+(.5+i*step).toFixed(6),lane:i%4,duration:0}))),events=base.map(n=>({...n,strength:1})),original=JSON.stringify(base),notes=E.impossiblePatterns(base,events,120),g=groups(notes);
 assert.equal(JSON.stringify(base),original,'Do not mutate the input');assert.deepEqual(g.map(a=>a[0].time),base.map(n=>n.time),'Never move, invent or drop an audio attack');assert(g.every(a=>a.length<=3),'At most three simultaneous notes');assert(notes.length<=base.length*1.55,'Bound chord inflation');E.validateChart({notes},60);
 const last=[-Infinity,-Infinity,-Infinity,-Infinity];for(const n of notes){assert(n.time-last[n.lane]>=.104999,'Every finger has at least 105ms recovery');last[n.lane]=n.time+n.duration;}
 for(let i=0;i<g.length-5;i++){
  const run=g.slice(i,i+6);if(run.every(a=>a.length===1)&&new Set(run.map(a=>a[0].lane)).size===2&&run.every((a,j)=>!j||a[0].lane!==run[j-1][0].lane))trills++;
  if(step===1/6&&g.slice(i,i+3).every(a=>a.length===1)&&new Set(g.slice(i,i+3).map(a=>a[0].lane)).size===3)triplets++;
  if(g.slice(i,i+3).every(a=>a.length===1&&a[0].lane===g[i][0].lane))jacks++;
 }
 let repeated=1;for(let i=1;i<g.length;i++){repeated=g[i].length===1&&g[i-1].length===1&&g[i][0].lane===g[i-1][0].lane?repeated+1:1;assert(repeated<=3,'Never more than three single-finger hits');}
 chords+=g.filter(a=>a.length>1).length;
 const travel=E.scrollTravel(notes,3,'impossible');assert.equal(travel,3);for(const n of notes)assert(n.duration>=0);
}
assert(trills>0,'Includes two-finger alternating spam');assert(triplets>0,'Includes three-note rolls on detected beat thirds');assert(chords>0,'Includes simultaneous chords');assert(jacks>0,'Retains short single-finger spam');
const holdBase=E.spreadLanes([{time:1,lane:0,duration:1},{time:2.5,lane:1,duration:0},{time:3,lane:2,duration:0}]);assert.equal(E.impossiblePatterns(holdBase,[],120)[0].duration,1,'Retain sustained holds');
// A known song with very fast attacks and a triplet phrase verifies actual scanning.
const rate=11025,duration=9,audio=new Float32Array(rate*duration),attacks=[];
for(let i=0;i<54;i++)attacks.push(.5+i*.055);
for(let i=0;i<18;i++)attacks.push(4+i/6);
for(let j=0;j<attacks.length;j++){const start=attacks[j],frequency=[330,440,660,880][j%4],length=Math.min(.05,(attacks[j+1]||start+.05)-start);for(let k=0;k<length*rate;k++){const t=k/rate;audio[Math.floor(start*rate)+k]+=.5*Math.sin(2*Math.PI*frequency*t)*Math.min(1,t/.003)*Math.exp(-t*20);}}
const chart=E.analyzeLegacy(audio,rate,'impossible'),insane=E.analyzeLegacy(audio,rate,'insane');E.validateChart(chart,duration);assert(chart.notes.length>insane.notes.length,'Harder tier retains more fast musical attacks');assert(chart.notes.every(n=>attacks.some(t=>Math.abs(n.time-t)<.04)||chart.rhythmSubdivisions.some(p=>Math.abs(p.time-n.time)<.002)),'Notes follow actual attacks or explicitly generated beat subdivisions');assert.equal(E.analyzeLegacy(new Float32Array(rate*2),rate,'impossible').notes.length,0,'Silence stays empty');
const sustained=new Float32Array(rate*6);for(const [start,end,hz] of [[.5,1.8,440],[2.5,3.8,660],[4.5,5.7,880]])for(let k=Math.floor(start*rate);k<end*rate;k++){const t=k/rate-start;sustained[k]=.4*Math.sin(2*Math.PI*hz*t)*Math.min(1,t/.01,(end-k/rate)/.02);}const held=E.analyzeLegacy(sustained,rate,'impossible');assert(held.notes.some(n=>n.duration>.5),'Real sustained tones create hold notes');E.validateChart(held,6);
const noise=new Float32Array(rate*2),vibrato=new Float32Array(rate*2);let seed=19;for(let k=0;k<noise.length;k++){seed=(seed*1664525+1013904223)>>>0;noise[k]=((seed/4294967296)*2-1)*.015;const t=k/rate;vibrato[k]=.3*Math.sin(2*Math.PI*440*t+2*Math.sin(2*Math.PI*5*t));}assert.equal(E.analyzeLegacy(noise,rate,'impossible').notes.length,0,'Noise is not mapped to a random stream');assert(E.analyzeLegacy(vibrato,rate,'impossible').notes.length<=2,'Vibrato is not turned into spam');
assert.equal(E.missDamage('impossible'),1);assert.equal(E.nextHealth(10,'MISS','impossible'),9);assert.equal(E.nextHealth(1,'MISS','impossible'),0);
const html=fs.readFileSync('public/index.html','utf8');assert(html.includes('data-diff="impossible"'));assert.equal((html.match(/option value="impossible"/g)||[]).length,2,'Editor and battle both offer Impossible');assert(fs.readFileSync('public/analysis-worker.js','utf8').includes('engine.js?v=99'),'Worker uses the current analyzer');
console.log('PASS: Impossible trills, triplets, short jacks, bounded chords, holds, safe finger spacing, exact attack timestamps, faster scrolling, real audio scanning, silence and all difficulty controls.');
