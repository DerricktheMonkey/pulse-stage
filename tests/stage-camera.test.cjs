const fs=require('node:fs'),assert=require('node:assert/strict'),C=require('../public/stage-camera.js');
for(const [w,h] of [[320,600],[768,700],[1920,1080],[1920,300]]){
 for(let time=0;time<=48;time+=.137){const pose=C.fit(C.pose(time),w,h);
  for(const x of [0,w])for(const y of [0,h]){const q=C.project(x,y,w,h,pose);assert(q.x>=-1e-6&&q.x<=w+1e-6&&q.y>=-1e-6&&q.y<=h+1e-6,'Camera keeps the playfield inside the viewport');}
  for(let lane=0;lane<4;lane++)for(const y of [28,h/2,h-42]){const original={x:w*(.045+.91*(lane+.5)/4),y},screen=C.project(original.x,original.y,w,h,pose),back=C.unproject(screen.x,screen.y,w,h,pose);assert(Math.abs(original.x-back.x)<1e-7);assert(Math.abs(original.y-back.y)<1e-7);const hit=Math.floor((back.x-w*.045)/(w*.91)*4);assert.equal(hit,lane,'Touch maps to its visually rotated lane');}
 }
}
for(const time of [0,2,5,6,10,25]){assert.deepEqual(C.pose(time,false),{x:0,y:0,z:0,scale:1});const a=C.pose(time),b=C.pose(time);assert.deepEqual(a,b,'Paused song time freezes camera');}
for(let time=6;time<43;time+=6){const a=C.pose(time-1e-6),b=C.pose(time+1e-6);for(const key of ['x','y','z','scale'])assert(Math.abs(a[key]-b[key])<1e-6,'No jumps at camera boundaries');}
const app=fs.readFileSync('public/app.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
assert(html.indexOf('stage-camera.js')<html.indexOf('app.js'));
assert(html.includes('id="cameraScene"'));assert(html.includes('id="immersiveCamera"'));assert(app.includes('!reducedCameraMotion?.matches'));assert(app.includes('StageCamera.unproject'));assert(app.includes('width:canvas.clientWidth,height:canvas.clientHeight'),'Canvas backing resolution uses untransformed layout size');
console.log('PASS: smooth deterministic 3D camera, flat-mode fallback, pause freeze, precise inverse touch mapping across lanes/sizes/poses and original-resolution canvas sizing.');
