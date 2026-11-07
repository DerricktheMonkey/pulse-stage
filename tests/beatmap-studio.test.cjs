const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../public/studio-model.js');
const settings={bpm:120,anchor:.1,division:4,span:4};
test('snapping uses song seconds, first beat, and chart offset exactly once',()=>{
 assert.equal(M.snap(1.13,settings,.05),1.05);
 assert.equal(M.snap(1.17,{...settings,division:0},.05),1.12);
 assert.equal(M.snap(.1,settings,-.1),.2);
});
test('tap and drag-hold placement are exact',()=>{
 assert.deepEqual(M.draw(1.1,1.1,2,settings,.1,10),{time:1,lane:2,duration:0});
 assert.deepEqual(M.draw(1.1,2.1,2,settings,.1,10),{time:1,lane:2,duration:1});
 assert.deepEqual(M.draw(2.1,1.1,2,settings,.1,10),{time:1,lane:2,duration:1});
});
test('moving a selection clamps as one group and preserves holds',()=>{
 const notes=[{time:1,lane:0,duration:1},{time:1,lane:2,duration:0}];
 assert.deepEqual(M.transform(notes,[0,1],-3,-2,10),[{time:0,lane:0,duration:1},{time:0,lane:2,duration:0}]);
 assert.deepEqual(M.transform(notes,[0,1],1,1,10),[{time:2,lane:1,duration:1},{time:2,lane:3,duration:0}]);
 assert.equal(notes[0].time,1);
});
test('hold resize, paste, mirror reject collisions without modifying the source',()=>{
 const notes=[{time:1,lane:0,duration:1},{time:3,lane:0,duration:0}];
 assert.throws(()=>M.resize(notes,0,3.2,10),/overlap/);
 assert.equal(M.resize(notes,0,2.5,10)[0].duration,1.5);
 assert.equal(M.paste(notes,[notes[0]],5,10).length,3);
 assert.throws(()=>M.paste(notes,[notes[0]],1,10),/overlap/);
 assert.equal(M.mirror(notes,[0],10)[0].lane,3);
 assert.deepEqual(notes,[{time:1,lane:0,duration:1},{time:3,lane:0,duration:0}]);
});
test('vertical grid coordinates increase upward',()=>{
 assert.equal(M.yToTime(500,500,2,4),2);
 assert.equal(M.yToTime(0,500,2,4),6);
 assert.equal(M.timeToY(3,500,2,4),375);
});
