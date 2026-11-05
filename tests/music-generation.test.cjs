const assert=require('node:assert/strict'),E=require('../public/engine.js');
const dt=.01,duration=12,env=Array(duration/dt).fill(.25);for(let i=450;i<650;i++)env[i]=0;
const times=[.5,.81,1.06,1.49,1.71,2.13,2.6,2.91,3.37,3.81,4.1,6.8,7.12,7.39,7.83,8.21,8.51,8.89,9.31,9.72,10.01,10.43,10.86,11.25];
const analysis={env,dt,bpm:83,peaks:times.map((time,i)=>({time,frequency:[220,330,440,660][i%4],strength:1})),percussion:[],musicEvents:[],notes:[{time:5,lane:0,duration:4}]};
const out=E.musicChart(analysis,80);assert.equal(out.length,80,'Keep the current note budget');
assert(times.every(t=>out.some(n=>Math.abs(n.time-t)<.001)),'Every strong irregular musical attack survives');assert(out.every(n=>n.time<4.5||n.time>=6.5),'Do not fill a real musical rest');
assert.deepEqual(E.musicChart({...analysis,bpm:172,notes:[{time:0,lane:3,duration:10}]},80),out,'Neither old chart patterns nor an imposed BPM grid determine the output');
for(let i=0;i<out.length;i++){assert.equal(out[i].duration,0);if(i)assert(out[i].time-out[i-1].time>=.043,'No artificial simultaneous presses');}
assert.deepEqual(E.snapCloseNotes(out),out,'Saving cannot turn the pattern into chords');E.validateChart({notes:out},duration);
const last=[-Infinity,-Infinity,-Infinity,-Infinity];for(const n of out){assert(n.time-last[n.lane]>=.16,'Give fingers recovery time');last[n.lane]=n.time;}
// Full scans retain build 91 totals while replacing its actual pattern rules.
const rate=11025,audio=new Float32Array(rate*16);for(let i=0;i<audio.length;i++){const t=i/rate;if(t<.5||t>15.5)continue;const p=(t-.5)%.25,hz=[220,330,440,660][Math.floor((t-.5)/.25)%4];audio[i]=.3*Math.sin(2*Math.PI*hz*t)*(.5+.5*Math.exp(-p*35));}
for(const difficulty of ['easy','normal','hard','insane','impossible']){
 const old=E.analyzeLegacy(audio,rate,difficulty),next=E.analyze(audio,rate,difficulty);assert.equal(next.notes.length,old.notes.length,difficulty+' keeps its total');assert.equal(next.generation.targetNotes,old.notes.length);assert.equal(next.patternStyle,'music');assert.equal(next.scanVersion,19);assert(next.notes.filter(n=>n.duration).length<=Math.max(1,Math.floor(next.notes.length*.03)));assert(next.notes.length-new Set(next.notes.map(n=>n.time)).size<=Math.floor(next.notes.length*.025));E.validateChart(next,16);
 assert.deepEqual(E.analyze(new Float32Array(rate*2),rate,difficulty).notes,[],'Silence stays empty');
}
assert.deepEqual(E.musicChart({...analysis,env:env.map(()=>0)},80),[],'No quota can fill silence');
console.log('PASS: same per-song totals across all tiers, strong irregular musical accents, silent rests, BPM-grid independence, no inherited holds/chords, hand recovery and full audio generation.');
// Isolated staccato hits retain their count without taps in silent gaps.
const clicks=new Float32Array(rate*7);for(let t=.5;t<6.5;t+=.5)for(let i=0;i<rate*.045;i++)clicks[Math.floor(t*rate)+i]=.35*Math.sin(i*.14)*Math.exp(-i/100);
for(const difficulty of ['easy','normal','hard','insane','impossible']){const next=E.analyze(clicks,rate,difficulty);assert.equal(next.notes.length,next.generation.targetNotes,'Retain isolated drum-hit totals');const groups=new Map();for(const n of next.notes){assert(Math.abs(n.time/.5-Math.round(n.time/.5))<.07,'Only actual staccato attacks, no silent filler');groups.set(n.time,(groups.get(n.time)||0)+1);}assert([...groups.values()].every(n=>n<=2),'At most two notes on an accent');E.validateChart(next,7);}
