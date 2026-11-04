const assert=require('node:assert/strict'),E=require('../public/engine.js'),S=require('../public/note-sprites.js');
const notes=[{time:1,lane:0,duration:.5},{time:1.535,lane:0,duration:0},{time:1.57,lane:0,duration:0},...Array.from({length:60},(_,i)=>({time:2+i*.04,lane:i%4,duration:0}))];
const before=JSON.stringify(notes);
for(const difficulty of ['easy','normal','hard','insane','impossible'])for(const requested of [.6,1.2,1.8,3]){
 const travel=E.scrollTravel(notes,requested,difficulty),scale=E.noteScale(notes,travel);
 assert.equal(travel,requested,'Difficulty and a tight pair must not override chosen travel time');
 const last=[null,null,null,null];
 for(const note of notes){const previous=last[note.lane];if(previous){const gap=note.time-previous.time-previous.duration;assert(gap/travel>=(previous.duration>.05?.065:.1)*scale-1e-9,'Thinner heads/caps preserve spacing at slower speeds');}last[note.lane]=note;}
}
assert.equal(JSON.stringify(notes),before,'Visual readability preserves all note times, holds, lanes and density');
assert.equal(E.noteScale([],1.8),1);
const canvasRows=[],doc={createElement(){const rows=[],context={setTransform(){},fillRect(x,y,w,h){rows.push({y,h});}},canvas={getContext:()=>context};canvasRows.push(rows);return canvas;}},cache=S.createCache(doc),colors=['#8affdc','#f98cc9','#8affdc','#f98cc9'];
const full=cache.prepare(1000,970,2,colors),fullHeadHeight=canvasRows[0][0].h,scaled=cache.prepare(1000,970,2,colors,.4);
assert.notEqual(full,scaled,'A new thickness creates matching cached textures');assert(Math.abs(canvasRows[6][0].h-fullHeadHeight*.4)<1e-9);
let draw;scaled.head({drawImage(...args){draw=args;}},0,45,400,false);
assert(Math.abs(draw[2]+56+.041*900*.4-400)<1e-9,'Resizing note heads keeps their center on the exact timing position');
assert.equal(cache.prepare(1000,970,2,colors,.4),scaled,'Dense charts reuse their thinner cached textures');
const oldStep=900/.65/60,newStep=900/E.scrollTravel(notes,1.8,'impossible')/60;
assert(newStep<oldStep*.4,'Default Impossible eye-tracking has under 40% of the old per-frame displacement');
console.log('PASS: chosen travel time for every difficulty, dense taps/holds without overlap, unchanged chart, thin texture cache, unchanged centers and default 60Hz displacement '+newStep.toFixed(1)+'px instead of '+oldStep.toFixed(1)+'px.');
