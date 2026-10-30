const assert=require('node:assert/strict');
const E=require('../public/engine.js');
const rate=11025,samples=new Float32Array(rate*12);
for(let beat=1;beat<24;beat++){let start=Math.floor(beat*.5*rate);for(let i=0;i<500;i++)samples[start+i]=Math.sin(i*.14)*Math.exp(-i/100);}
for(const difficulty of ['easy','normal','hard']){
 const chart=E.analyze(samples,rate,difficulty);
 assert.equal(chart.bpm,120);assert(chart.notes.length>=23);if(difficulty==='normal')assert(chart.notes.some(n=>n.duration>0));if(difficulty==='hard')assert(chart.notes.some((n,i)=>i&&n.time===chart.notes[i-1].time));
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

assert.equal(E.judgement(.115),'PERFECT');assert.equal(E.judgement(.13),'GREAT');assert.equal(E.judgement(.17),'GOOD');const legacy=E.validateChart({notes:[{time:1,lane:0,kind:'slide',endLane:1,duration:.4}]},5);assert.equal(legacy[0].duration,.4);assert(!('kind' in legacy[0]));assert(!('endLane' in legacy[0]));

// Fast melodic run: keep every real 90ms attack without release/noise filler.
const fast=new Float32Array(rate*6),attacks=[];
for(let n=0;n<48;n++){const time=.5+n*.09;attacks.push(time);const hz=[330,440,660,880,550,1100][n%6];for(let i=0;i<rate*.085;i++)fast[Math.floor(time*rate)+i]+=Math.sin(2*Math.PI*hz*i/rate)*.5*Math.min(i/35,1,(rate*.085-i)/35);}
const insane=E.analyze(fast,rate,'insane'),hard=E.analyze(fast,rate,'hard');
assert(insane.notes.length>hard.notes.length*1.8);
assert(attacks.every(t=>insane.notes.some(n=>Math.abs(n.time-t)<.035)),'Every fast melodic attack has a note within 35ms');
assert(insane.notes.every(n=>attacks.some(t=>Math.abs(n.time-t)<.035)),'No fabricated notes between attacks or on releases');
assert(insane.notes.every((n,i)=>!i||n.time-insane.notes[i-1].time>=.064),'Readable minimum spacing');
E.validateChart(insane,6);assert.equal(E.analyze(new Float32Array(rate*2),rate,'insane').notes.length,0);
const steady=new Float32Array(rate*3);for(let i=rate/2|0;i<rate*2.5;i++)steady[i]=.4*Math.sin(2*Math.PI*440*i/rate);
assert(E.analyze(steady,rate,'insane').notes.length<=2,'A sustained pitch is not turned into a random stream');
console.log('PASS: Insane melodic density, 35ms timing, spacing, no release filler, silence and sustained tones.');

const legato=new Float32Array(rate*5),legatoTimes=Array.from({length:32},(_,i)=>.5+i*.125);let phase=0;
for(let i=0;i<legato.length;i++){const t=i/rate;if(t<.5||t>=4.5)continue;const hz=[330,440,660,880,550,1100][Math.floor((t-.5)/.125)%6];phase+=2*Math.PI*hz/rate;legato[i]=.4*Math.sin(phase);}
const legatoChart=E.analyze(legato,rate,'insane');
assert(legatoTimes.every(t=>legatoChart.notes.some(n=>Math.abs(n.time-t)<.035)),'Constant-volume legato pitch changes are mapped');
assert(legatoChart.notes.every(n=>legatoTimes.some(t=>Math.abs(n.time-t)<.035)),'Legato contains no filler');
E.validateChart(legatoChart,5);

// A melody over independent hats and bass: do not turn hats into melody notes.
const mixed=new Float32Array(rate*6),mixedTimes=Array.from({length:24},(_,i)=>.5+i*.2);let seed=7;
for(let i=0;i<mixed.length;i++){const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)|0;const noise=seed/2147483648;if(t>=.5&&t<5.3){const n=Math.floor((t-.5)/.2),p=(t-.5)%.2,hz=[330,440,660,880,550,1100][n%6];mixed[i]=.45*Math.sin(2*Math.PI*hz*p)*Math.min(1,p*300,(.2-p)*300);}mixed[i]+=.07*Math.sin(2*Math.PI*80*t)+.1*noise*Math.exp(-(t%.125)*100);}
const mixChart=E.analyze(mixed,rate,'insane');
assert(mixedTimes.every(t=>mixChart.notes.some(n=>Math.abs(n.time-t)<.035)),'Every melodic attack survives accompaniment');
assert(mixChart.notes.every(n=>mixedTimes.some(t=>Math.abs(n.time-t)<.035)),'Independent hi-hats do not add unrelated melody notes');
const hiss=new Float32Array(rate*4),vibrato=new Float32Array(rate*4);let vibratoPhase=0;
for(let i=0;i<hiss.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;hiss[i]=seed/2147483648*.4;const t=i/rate;if(t>.5&&t<3.5){vibratoPhase+=2*Math.PI*440*Math.pow(2,.025*Math.sin(2*Math.PI*6*t))/rate;vibrato[i]=.4*Math.sin(vibratoPhase);}}
assert.equal(E.analyze(hiss,rate,'insane').notes.length,0,'Broadband noise is not music');
assert(E.analyze(vibrato,rate,'insane').notes.length<=2,'Vibrato is not a rapid melodic run');
// Spacing is guaranteed by travel speed, without moving note timestamps.
for(const notes of [insane.notes,legatoChart.notes,mixChart.notes,[{time:1,lane:0,duration:.5},{time:1.535,lane:0,duration:0},{time:1.57,lane:0,duration:0}]]){
 const original=JSON.stringify(notes),travel=E.scrollTravel(notes,3,'insane'),ends=[null,null,null,null];
 for(const n of notes){const prev=ends[n.lane];if(prev){const gap=n.time-prev.time-(prev.duration||0);assert(gap/travel>=(prev.duration>.05?.065:.1)-1e-9,'Note heads/tails stay visually separate in each lane');}ends[n.lane]=n;}
 assert.equal(JSON.stringify(notes),original,'Changing scroll speed never changes rhythm');assert(travel<=.8);
}
console.log('PASS: melody over bass/hi-hats, noise/vibrato rejection, visual spacing for taps/holds, unchanged audio timestamps.');
