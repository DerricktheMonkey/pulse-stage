const assert=require('node:assert/strict'),E=require('../public/engine.js');
const dt=.01;
function voice(end=4.2){const energy=Array(1000).fill(0),pitch=Array(1000).fill(0),tonality=Array(1000).fill(0),flux=Array(1000).fill(0);for(let f=50;f<end/dt;f++){energy[f]=.1;pitch[f]=440;tonality[f]=.9;}flux[50]=.1;return {energy,pitch,tonality,flux};}
const notes=[{time:.5,lane:0,duration:0},...Array.from({length:12},(_,i)=>({time:.9+i*.24,lane:1+i%3,duration:0})),{time:4.5,lane:0,duration:0}],before=JSON.stringify(notes);
const held=E.impossibleHolds(notes,[voice()],dt,10);
assert(held[0].duration>3,'A sparse hold lane can sustain for several seconds');
assert.deepEqual(held.map(n=>({time:n.time,lane:n.lane})),notes.map(n=>({time:n.time,lane:n.lane})),'No added heads, forced chords, shifted rhythms, or rerouted melody lanes');
assert.deepEqual(held.slice(1),notes.slice(1),'All independent melody notes are unchanged while the bass is held');
assert.equal(JSON.stringify(notes),before,'Input chart is untouched');E.validateChart({notes:held},10);
const crowded=[...notes,{time:1.1,lane:0,duration:0}].sort((a,b)=>a.time-b.time||a.lane-b.lane),short=E.impossibleHolds(crowded,[voice()],dt,10);
assert(short[0].duration<held[0].duration,'A free sparse lane supports longer holds than a busy lane');assert(short[0].time+short[0].duration<=1.1-.104,'Release before the next same-lane head');E.validateChart({notes:short},10);
const quiet=E.impossibleHolds(notes,[voice(.8)],dt,10);assert.equal(quiet[0].duration,0,'Short sounds cannot become long holds');
const changed=voice();for(let f=200;f<420;f++)changed.pitch[f]=660;
assert(E.impossibleHolds(notes,[changed],dt,10)[0].duration<1.51,'Release at a change of the sustained voice');
const repeated=voice();for(let f=150;f<420;f++)repeated.energy[f]=.3;repeated.flux[150]=.2;
assert(E.impossibleHolds(notes,[repeated],dt,10)[0].duration<1.01,'A fresh same-pitch attack ends the sustain');
const veryLong=E.impossibleHolds([{time:.5,lane:0,duration:0}],[voice(9)],dt,10);assert.equal(veryLong[0].duration,6,'Hold duration remains bounded');
const silence={energy:Array(1000).fill(0),pitch:Array(1000).fill(0),tonality:Array(1000).fill(0),flux:Array(1000).fill(0)};assert.deepEqual(E.impossibleHolds(notes,[silence],dt,10),notes,'Silence adds neither holds nor filler');
// Exercise the full analyzer using a long audible sustained tone.
const rate=11025,samples=new Float32Array(rate*5);for(let i=Math.floor(.5*rate);i<4.2*rate;i++){const t=i/rate;samples[i]=.4*Math.sin(2*Math.PI*440*t)*Math.min(1,(t-.5)/.01,(4.2-t)/.02);}
const chart=E.analyze(samples,rate,'impossible');assert(chart.notes.some(n=>n.duration>2),'Full scanning creates long holds from sparse sustained audio');assert(chart.notes.length<5,'A lone sustained tone does not spawn filler melodies');E.validateChart(chart,5);
console.log('PASS: multi-second sparse holds, unchanged concurrent melody heads/lanes, same-lane release safety, silence/pitch/reattack boundaries, six-second cap, and real-audio scanning without hold filler.');
