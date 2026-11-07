const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../public/engine.js');
test('phrase voicing preserves every note head and hold, including chords',()=>{
 const source=[];for(let i=0;i<120;i++){source.push({time:.5+i*.125,lane:i%4,duration:0});if(i%12===0)source.push({time:.5+i*.125,lane:(i+2)%4,duration:0});}
 const before=JSON.stringify(source),out=E.phraseVoice(source,{bpm:120},'impossible');
 assert.equal(out.length,source.length);assert.deepEqual(out.map(n=>n.time),source.map(n=>n.time));assert.equal(JSON.stringify(source),before);
 E.validateChart({notes:out},20,{snap:false});
 assert(new Set(out.slice(1).map((n,i)=>out[i].lane+','+n.lane)).size>=7,'Use more than one repeating lane cycle');
 assert.deepEqual(E.phraseVoice(source,{bpm:120},'impossible'),out,'Generation is deterministic');
 const holds=[{time:1,lane:0,duration:2},{time:1,lane:2,duration:0},{time:1.5,lane:1,duration:0},{time:2,lane:3,duration:0},{time:4,lane:0,duration:1}];
 const voiced=E.phraseVoice(holds,{bpm:120},'hard');assert.equal(voiced.length,holds.length);E.validateChart({notes:voiced},6,{snap:false});assert.equal(voiced.reduce((s,n)=>s+n.duration,0),3);
});
test('louder musical phrases get more detail while the global budget stays fixed',()=>{
 const dt=.01,env=Array.from({length:800},(_,i)=>i<400?.08:.8),musicAttacks=[];
 for(let t=.5;t<7.9;t+=.125)musicAttacks.push({time:t,frequency:220+Math.round(t*8)%5*80,strength:t<4?.2:1});
 const chart=E.musicChart({env,dt,musicAttacks,bpm:120},32);
 assert.equal(chart.length,32);const quiet=chart.filter(n=>n.time<4).length,loud=chart.length-quiet;assert(loud>quiet*1.4,`Expected contrast, got quiet=${quiet}, loud=${loud}`);
 assert(chart.every(n=>musicAttacks.some(p=>Math.abs(p.time-n.time)<.001)),'Use actual attacks when enough exist');
});
test('all automatic tiers run and retain the pre-overhaul density budget',()=>{
 const rate=11025,samples=new Float32Array(rate*12);
 for(let i=0;i<samples.length;i++){const t=i/rate;if(t<.5||t>11.5)continue;const phase=(t-.5)%.125,hz=[220,330,440,660,550,440][Math.floor((t-.5)/.125)%6];samples[i]=.3*Math.sin(2*Math.PI*hz*t)*(.5+.5*Math.exp(-phase*35));}
 const counts={};
 for(const difficulty of ['easy','normal','hard','insane','impossible']){
  const chart=E.analyze(samples,rate,difficulty),prior=E.analyzeLegacy(samples,rate,difficulty);
  assert(chart.notes.length>0);assert.equal(chart.scanVersion,26);assert.equal(chart.patternStyle,'phrase-aware');E.validateChart(chart,12,{snap:false});
  if(difficulty!=='easy'){assert.equal(chart.generation.targetNotes,prior.notes.length);assert.equal(chart.notes.length,prior.notes.length, difficulty+' must not silently halve its density');}
  counts[difficulty]=chart.notes.length;
 }
 assert(counts.impossible>=counts.insane&&counts.insane>=counts.hard&&counts.hard>=counts.normal&&counts.normal>counts.easy,JSON.stringify(counts));
 console.log('VERIFIED_DENSITIES',JSON.stringify(counts));
 assert.equal(E.scrollTravel([], .65,'easy'),E.scrollTravel([], .65,'impossible'));assert.equal(E.MAX_LIFE,10);assert.equal(E.nextHealth(5,'PERFECT'),5.2);
});
