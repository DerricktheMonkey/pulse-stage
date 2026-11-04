const assert=require('node:assert/strict'),E=require('../public/engine.js');
for(const bpm of [60,75,90,110]){
 const duration=24,dt=.01,beat=60/bpm,env=Array(2400).fill(.1),peaks=Array.from({length:Math.floor(22/beat)},(_,i)=>({time:.5+i*beat,strength:1})),notes=peaks.map((p,i)=>({time:p.time,lane:i%4,duration:0,id:i})),before=JSON.stringify(notes);
 const filled=E.fillImpossibleGaps(notes,{duration,dt,bpm,env,peaks}),added=filled.filter(n=>n.fillSource);
 assert(filled.length/duration>=10,'Slow '+bpm+' BPM remains challenging instead of inheriting the old low fixed activity cap');
 assert(added.filter(n=>n.fillSource==='double-time').length>30,'Double-time passages add independent notes');assert(added.filter(n=>n.fillSource==='triplet').length>=12,'Slow sections receive short triplet phrases');
 for(const original of notes)assert.deepEqual(filled.find(n=>n.id===original.id),original,'Tempo-aware additions preserve every original note');assert.equal(JSON.stringify(notes),before);E.validateChart({notes:filled},duration);
 for(const n of added)assert(filled.every(other=>other===n||Math.abs(other.time-n.time)>=.0549),'Tempo fills stay individual presses');
 const again=E.fillImpossibleGaps(filled,{duration,dt,bpm,env,peaks});assert.deepEqual(again,filled,'Repeated filling cannot keep doubling the chart');
}
// An important drum can be recovered in a passage that already meets the
// general local density target, using a free lane without moving any heads.
const busy=Array.from({length:60},(_,i)=>({time:+(.5+i*.11).toFixed(3),lane:i%4,duration:0,id:i})),hit=1.435;
const recovered=E.fillImpossibleGaps(busy,{duration:8,dt:.01,bpm:140,env:Array(800).fill(.1),peaks:[],percussion:[{time:hit,lane:0,strength:1}]});assert(recovered.some(n=>n.fillSource==='drum'&&n.time===hit),'Drum detection is not suppressed by melody density');for(const n of busy)assert.deepEqual(recovered.find(x=>x.id===n.id),n);E.validateChart({notes:recovered},8);
// Real samples: quiet low kicks and broadband snares underneath a much louder
// steady pitched lead. Their timings cannot depend on a pitch-change gate.
const rate=11025,duration=10,mix=new Float32Array(rate*duration),kicks=[.7,1.2,2.3,3.2,4.4,5.3,6.7,7.8],snares=[1.6,2.8,3.8,4.9,6.1,7.3,8.6];let seed=27;
for(let i=0;i<mix.length;i++)mix[i]=.35*Math.sin(2*Math.PI*440*i/rate);
for(const start of kicks)for(let k=0;k<.15*rate;k++){const t=k/rate;mix[Math.floor(start*rate)+k]+=.18*Math.sin(2*Math.PI*55*t)*Math.min(1,t/.002)*Math.exp(-t*35);}
for(const start of snares)for(let k=0;k<.065*rate;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=k/rate;mix[Math.floor(start*rate)+k]+=.16*(seed/4294967296*2-1)*Math.min(1,t/.001)*Math.exp(-t*45);}
const chart=E.analyze(mix,rate,'impossible');
for(const hits of [kicks,snares]){const covered=hits.filter(t=>chart.percussion.some(p=>Math.abs(p.time-t)<.035));assert(covered.length/hits.length>=.85,'Detect masked kick/snare transients at their actual attack times');}
const missedByMelody=[...kicks,...snares].filter(t=>!chart.peaks.some(p=>Math.abs(p.time-t)<.04));assert(missedByMelody.length>=3,'Fixture exercises hits the melody detector misses');assert(missedByMelody.filter(t=>chart.notes.some(n=>Math.abs(n.time-t)<.05)).length/missedByMelody.length>=.8,'Missed melodic-detector hits become playable drum notes');E.validateChart(chart,duration);
const noise=new Float32Array(rate*3);for(let i=0;i<noise.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=(seed/4294967296*2-1)*.04;}assert.equal(E.analyze(noise,rate,'impossible').notes.length,0,'Steady broadband noise does not create a percussion chart');
console.log('PASS: 60/75/90/110 BPM challenge, double-time/triplet phrases, exact note preservation, no chord inflation, idempotence, high-density drum recovery, masked 55Hz kicks/broadband snares and steady-noise rejection.');
