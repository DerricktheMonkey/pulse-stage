const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=require('../public/engine.js');

for(const path of ['index.html','public/index.html']){
 const html=fs.readFileSync(path,'utf8');
 const speed=html.match(/<input\b[^>]*\bid="speed"[^>]*>/)?.[0];
 assert.ok(speed,path+' has a note travel slider');
 const attr=name=>Number(speed.match(new RegExp('\\b'+name+'="([^"]+)"'))?.[1]);
 assert.equal(attr('min'),0.2,path+' allows faster notes for dense charts');
 assert.equal(attr('max'),3,path+' keeps the existing slow end');
 assert.equal(attr('step'),0.05,path+' keeps fine speed control');
 assert.equal(attr('value'),0.65,path+' keeps the existing default');
}
for(const difficulty of ['easy','normal','hard','insane','impossible']){
 assert.equal(engine.scrollTravel([{time:1,lane:0}],0.2,difficulty),0.2,difficulty+' respects the faster setting');
 assert.equal(engine.scrollTravel([{time:1,lane:0}],0.65,difficulty),0.65,difficulty+' preserves the default');
}
console.log('PASS: both deployments expose 0.20s note travel across all difficulties without altering defaults.');
