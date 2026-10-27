const assert=require('node:assert/strict');
const E=require('../public/engine.js');
const rate=11025,samples=new Float32Array(rate*12);
for(let beat=1;beat<24;beat++){let start=Math.floor(beat*.5*rate);for(let i=0;i<500;i++)samples[start+i]=Math.sin(i*.14)*Math.exp(-i/100);}
for(const difficulty of ['easy','normal','hard']){
 const chart=E.analyze(samples,rate,difficulty);
 assert.equal(chart.bpm,120);assert(chart.notes.length>=23);if(difficulty==='normal')assert(chart.notes.some(n=>n.kind==='slide'));if(difficulty==='hard')assert(chart.notes.some((n,i)=>i&&n.time===chart.notes[i-1].time));
 assert(chart.notes.every(n=>Math.abs(n.time/.5-Math.round(n.time/.5))<.07));
 E.validateChart(chart,12);
}
assert.equal(E.judgement(.02),'PERFECT');assert.equal(E.judgement(.08),'PERFECT');assert.equal(E.judgement(.14),'GREAT');assert.equal(E.judgement(.18),'GOOD');assert.equal(E.judgement(.20),null);
for(const notes of [[{time:1,lane:4}],[{time:-1,lane:0}],[{time:1,lane:0,duration:2},{time:2,lane:0}],[{time:9,lane:0,duration:2}]])assert.throws(()=>E.validateChart({notes},10));
assert.equal(E.analyze(new Float32Array(22050),rate).notes.length,0);
console.log('PASS: beat timing, BPM, all difficulties, silence, judgement windows and invalid charts.');

const melody=new Float32Array(rate*5),tones=[220,330,440,660,880,1100];
for(let n=0;n<tones.length;n++){const start=Math.floor((.5+n*.6)*rate);for(let i=0;i<rate*.4;i++)melody[start+i]=Math.sin(2*Math.PI*tones[n]*i/rate)*.5*Math.min(i/100,1,(rate*.4-i)/100);}
const pitched=E.analyze(melody,rate,'normal');
assert(pitched.notes.length>=tones.length,'Find musical note attacks');
assert(pitched.notes[0].lane<pitched.notes.at(-1).lane,'Ascending pitches move toward higher lanes');
assert(pitched.notes.every(n=>tones.some((_,i)=>Math.abs(n.time-(.5+i*.6))<.06)),'Match chart timestamps to musical attacks');
let health=100;for(let i=0;i<9;i++)health=E.nextHealth(health,'MISS');assert.equal(health,0);assert.equal(E.nextHealth(99,'PERFECT'),100);assert.equal(E.nextHealth(10,'PERFECT'),12);assert.equal(E.nextHealth(10,'GREAT'),11);assert.equal(E.nextHealth(10,'GOOD'),10);
console.log('PASS: pitched song scanning, pitch-to-lane mapping, wider hit window and life depletion/recovery.');

assert.equal(E.judgement(.115),'PERFECT');assert.equal(E.judgement(.13),'GREAT');assert.equal(E.judgement(.17),'GOOD');assert.throws(()=>E.validateChart({notes:[{time:1,lane:0,kind:'slide',endLane:3,duration:.4}]},5));
