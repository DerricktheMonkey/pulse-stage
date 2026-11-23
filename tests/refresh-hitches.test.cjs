const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../public/performance-monitor.js');
const normal=P.createPlayfieldBudget(),video=P.createPlayfieldBudget();
const high=normal.pixelRatio(1920,1080,2);
const moving=video.pixelRatio(1920,1080,2,true);
assert(moving<high,'Video/GIF backgrounds should reduce note-canvas raster cost from the first frame');
assert.equal(video.pixelRatio(600,400,1,true),1,'Small, standard-DPI playfields retain native resolution');
// Simulate 120Hz callbacks that occasionally skip a refresh but never take 25ms.
// Previously these were invisible to the adaptive quality budget.
let now=0;
video.update(now,true,false);
for(let i=0;i<400;i++){now+=i%3===0?1000/60:1000/120;assert.equal(video.update(now,true,false),false,'No mid-song canvas rebuilds');}
assert.equal(video.pixelRatio(1920,1080,2),high,'Adaptive quality must not change mid-song');
video.update(now+20,false,false);
assert(video.pixelRatio(1920,1080,2)<high,'High-refresh skipped frames trigger a lower next-run budget');
const monitor=P.createMonitor();
const clip={src:'blob:background',value:{totalVideoFrames:120,droppedVideoFrames:8},getVideoPlaybackQuality(){return this.value;}};
monitor.begin({motion:true,background:'video/mp4'});
monitor.captureVideoQuality(clip);
monitor.sample(0,0,1);
monitor.sample(16.7,.0167,1);
clip.value={totalVideoFrames:360,droppedVideoFrames:29};
monitor.captureVideoQuality(clip);
const snap=monitor.snapshots()[0];
assert.equal(snap.video.total,240);
assert.equal(snap.video.dropped,21);
assert.match(monitor.report(),/Background video frames since start: 240, dropped 21/);
monitor.begin();
assert.equal(monitor.snapshots()[0].video,null,'No video readings means no made-up decoder metric');
assert.doesNotThrow(()=>monitor.captureVideoQuality({getVideoPlaybackQuality(){throw Error('blocked');}}));
const app=fs.readFileSync('public/app.js','utf8');
assert.match(app,/pixelRatio\(w,h,dpr,movingBackground\)/,'The actual renderer uses background-aware quality');
assert.match(app,/captureVideoQuality\?\.\(\$\('bgVideo'\)\)/,'The live app collects video frame counts');
console.log('PASS: high-refresh missed-frame detection, moving-scene canvas budget, no mid-song reallocations, dropped video diagnostics and safe fallback.');
