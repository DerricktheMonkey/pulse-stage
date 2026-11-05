const assert=require('node:assert/strict'),E=require('../public/engine.js');
const rate=11025,times=[.5,.87,1.23,1.91,2.18,2.73,3.04,3.68,4.12,4.37,5.01,5.58],audio=new Float32Array(rate*6.4);
for(let note=0;note<times.length;note++)for(let i=0;i<rate*.22;i++){const t=i/rate;audio[Math.floor(times[note]*rate)+i]+=.4*Math.sin(2*Math.PI*[330,440,660,880][note%4]*t)*Math.min(1,t/.004)*Math.exp(-t*10);}
for(const difficulty of ['easy','normal','hard','insane','impossible']){
 const scan=E.analyze(audio,rate,difficulty),errors=times.map(t=>Math.min(...scan.musicAttacks.map(p=>Math.abs(t-p.time))));
 assert(Math.max(...errors)<.012,'Find irregular attacks within 12ms on '+difficulty);assert(errors.reduce((a,b)=>a+b,0)/errors.length<.006,'Precise onset refinement across all difficulties');assert.equal(scan.notes.length,scan.generation.targetNotes);E.validateChart(scan,6.4);assert.equal(E.scrollTravel(scan.notes,.65,difficulty),.65);
}
// Changing volume within a held sound must not pull rhythmic extra taps off grid.
const env=Array(500).fill(.2);for(let i=0;i<env.length;i++)env[i]*=1+.5*Math.sin(i*.21);
const chart=E.musicChart({env,dt:.01,peaks:[{time:.5,strength:1,frequency:440},{time:1.5,strength:1,frequency:440},{time:2.5,strength:1,frequency:440},{time:3.5,strength:1,frequency:440},{time:4.5,strength:1,frequency:440}]},17);
for(const n of chart)assert(Math.abs((n.time-.5)/.0625-Math.round((n.time-.5)/.0625))<.01,'Extra taps follow local subdivisions rather than the loudest sample');
console.log('PASS: variable musical phrasing, sub-12ms onset coverage across all tiers, consistent counts/speed and rhythmic timing independent of volume swells.');
