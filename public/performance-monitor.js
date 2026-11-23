(function(root){'use strict';
// Reduce gameplay raster work after sustained slow frames. One stall cannot
// trigger a resize, and a recovering frame rate keeps its scale until run end.
function createPlayfieldBudget(){
 // Limit high-DPI canvas pixels before the first note, preventing the 2D
 // playfield from competing excessively with full-resolution video decode.
 // Never resize the backing canvas mid-song; it causes a display-frame hitch.
 let previous=null,slowMs=0,healthyMs=0,cadence=null,active=false,activeLimited=false,nextLimited=false;
 function update(now,playing,paused){
  if(!playing){previous=null;if(!paused)active=false;return false;}
  if(previous===null||now<=previous){if(!active){active=true;activeLimited=nextLimited;}previous=now;slowMs=0;healthyMs=0;cadence=null;return false;}
  const interval=now-previous;previous=now;
  // Missed refreshes on 120-240Hz screens can be only 8-17ms, below the
  // old 25ms threshold. Compare with the fastest stable delivered cadence.
  if(interval>=3&&interval<100&&(cadence===null||interval<cadence*.96))cadence=interval;
  const skipped=cadence!==null&&interval>Math.max(cadence*1.6,cadence+3);
  if(interval>=25||skipped){slowMs+=Math.min(100,interval);healthyMs=0;}
  else{slowMs=Math.max(0,slowMs-interval*.1);healthyMs+=interval;}
  if(slowMs>=1000)nextLimited=true;
  if(healthyMs>=3000)nextLimited=false;
  return false;
 }
 function pixelRatio(width,height,nativeRatio,movingBackground=false){
  if(!(width>0&&height>0))return nativeRatio;
  // Spend less GPU bandwidth on the transparent note surface when it must
  // be composited over a moving video/GIF. This does not rescale the source.
  const pixelBudget=((active?activeLimited:nextLimited)||movingBackground)?1200000:2400000;
  return Math.min(nativeRatio,Math.sqrt(pixelBudget/(width*height)));
 }
 return {update,pixelRatio};
}
// Animate note positions from display-frame timestamps, not callback dispatch time.
// The audio presentation clock remains authoritative for hit judgement.  Only
// bounded, gradual corrections reach the visual clock, so timestamp jitter
// cannot make notes visually stall and then surge ahead on adjacent frames.
function createNoteMotionClock(){
 let lastFrame=null,lastTime=0,lastRate=1;
 function reset(){lastFrame=null;}
 function sample(frameMs,audioTime,sampleWallMs,playbackRate=1){
  if(!Number.isFinite(frameMs)||!Number.isFinite(audioTime))return audioTime;
  const rate=Number.isFinite(playbackRate)&&playbackRate>0?playbackRate:1;
  // rAF's timestamp is the start of the display frame; performance.now() is
  // later if other work delayed this callback. Never animate from that delay.
  const late=Number.isFinite(sampleWallMs)?Math.max(0,Math.min(250,sampleWallMs-frameMs)):0;
  const atFrame=audioTime-late*rate/1000;
  if(lastFrame===null||frameMs<lastFrame||frameMs-lastFrame>2000||rate!==lastRate){
   lastFrame=frameMs;lastTime=atFrame;lastRate=rate;return lastTime;
  }
  const elapsed=(frameMs-lastFrame)/1000*rate;
  if(elapsed<=0)return lastTime;
  const predicted=lastTime+elapsed;
  const error=atFrame-predicted;
  // Corrections cannot reverse motion or change its speed by more than 4%.
  // A genuine skipped frame still advances by its full elapsed duration.
  const limit=elapsed*.04,correction=Math.max(-limit,Math.min(limit,error*.12));
  lastTime=Math.max(lastTime,predicted+correction);
  lastFrame=frameMs;
  return lastTime;
 }
 return {sample,reset};
}
function createMonitor(){
 let current=null,history=[];
 const bucket=()=>({frames:0,totalMs:0,worstMs:0,slowFrames:0,maxClockErrorMs:0,maxDrawMs:0});
 function begin(metadata={}){if(current)history=[current,...history].slice(0,1);current={metadata:{...metadata},countdown:bucket(),opening:bucket(),following:bucket(),whole:bucket(),recent:[],cursor:0,last:null,done:false,videoStart:null,videoLast:null};}
 function captureVideoQuality(video){
  if(!current||!video?.src||typeof video.getVideoPlaybackQuality!=='function')return;
  try{
   const q=video.getVideoPlaybackQuality(),total=q?.totalVideoFrames,dropped=q?.droppedVideoFrames;
   if(!Number.isFinite(total)||!Number.isFinite(dropped))return;
   const sample={total,dropped};if(!current.videoStart||total<current.videoStart.total)current.videoStart=sample;
   current.videoLast=sample;
  }catch{}
 }
 function add(b,dt,error,drawMs){b.frames++;b.totalMs+=dt;b.worstMs=Math.max(b.worstMs,dt);if(dt>25)b.slowFrames++;b.maxClockErrorMs=Math.max(b.maxClockErrorMs,error);b.maxDrawMs=Math.max(b.maxDrawMs,drawMs);}
 function sample(now,songTime,drawMs=0){
  if(!current||!Number.isFinite(now)||!Number.isFinite(songTime))return;
  const phase=songTime<0?'countdown':songTime<1?'opening':'following',prior=current.last;current.last={now,songTime,phase};
  if(!prior){if(songTime>=3)current.done=true;return;}
  const dt=now-prior.now;if(dt<=0)return;
  const rate=current.metadata.rate||1,error=Math.abs((songTime-prior.songTime)*1000/rate-dt);
  if(!current.done)for(const name of new Set([prior.phase,phase]))add(current[name],dt,error,drawMs);
  if(songTime>=0){add(current.whole,dt,error,drawMs);current.recent[current.cursor]={at:now,dt,error,drawMs,songTime};current.cursor=(current.cursor+1)%2400;}
  if(songTime>=3)current.done=true;
 }
 function motionChanged(){if(current)current.metadata.motionChanges=(current.metadata.motionChanges||0)+1;}
 function pause(){if(current)current.last=null;}
 function snapshots(){return [current,...history].filter(Boolean).map(run=>{
  const latest=Math.max(0,...run.recent.map(r=>r.at)),recent=run.recent.filter(r=>latest-r.at<=5000),b=bucket();for(const r of recent)add(b,r.dt,r.error,r.drawMs);
  const intervals=recent.map(r=>r.dt).sort((a,b)=>a-b),cadence=intervals[Math.floor(intervals.length*.1)]||0;
  const missed=cadence?recent.reduce((sum,r)=>sum+(r.dt>cadence*1.5?Math.max(0,Math.round(r.dt/cadence)-1):0),0):0;
  return {metadata:{...run.metadata},video:run.videoStart&&run.videoLast?{total:Math.max(0,run.videoLast.total-run.videoStart.total),dropped:Math.max(0,run.videoLast.dropped-run.videoStart.dropped)}:null,complete:run.done,position:recent.length?recent[recent.length-1].songTime:0,recent:{...b,fps:b.totalMs?1000*b.frames/b.totalMs:0,cadenceMs:cadence,estimatedMissed:missed},...Object.fromEntries(['countdown','opening','following','whole'].map(phase=>{const b=run[phase];return [phase,{...b,fps:b.totalMs?1000*b.frames/b.totalMs:0}];}))};
 });}
 function report(){const runs=snapshots();if(!runs.length)return 'Play a level for at least three seconds, then pause to see its opening performance.';return runs.map((run,i)=>{
  const m=run.metadata,lines=['Pulse Stage · performance report · build '+(m.build||'unknown')+(i?' · previous run':''),'Level: '+(m.level||'unknown')+' · '+(m.difficulty||'unknown'),'Background motion: '+(m.motion?'ON':'OFF')+' · '+(m.background||'none'),'Canvas: '+(m.canvas||'unknown'),'Browser: '+(m.browser||'unknown')];
  for(const [phase,label] of [['countdown','Count-in'],['opening','First second'],['following','Seconds 1–3'],['whole','Full run'],['recent','Last 5 seconds']]){const b=run[phase];lines.push(label+': '+(b.frames?b.fps.toFixed(1)+' fps, worst '+b.worstMs.toFixed(1)+'ms, '+b.slowFrames+' slow frames, clock gap '+b.maxClockErrorMs.toFixed(1)+'ms, draw '+b.maxDrawMs.toFixed(1)+'ms':'not enough frames'));}
  if(run.recent.frames)lines.push('Recent cadence: '+(1000/run.recent.cadenceMs).toFixed(1)+' Hz; estimated missed refreshes: '+run.recent.estimatedMissed+'. Browser callbacks measured; GPU/display presentation is not measured.');
  if(run.video)lines.push('Background video frames since start: '+run.video.total+', dropped '+run.video.dropped+(run.video.total?' ('+(100*run.video.dropped/run.video.total).toFixed(1)+'%)':'')+'.');
  if(run.recent.frames&&run.recent.estimatedMissed>0&&run.recent.maxDrawMs<run.recent.cadenceMs*.75)lines.push('Display callbacks skipped while canvas draw time stayed short; investigate video decoding/compositing or browser scheduling.');
  if(m.motionChanges)lines.push('Background motion changed during this run — restart for a clean comparison.');if(!run.complete)lines.push('Partial sample — play through the first three seconds for a full comparison.');return lines.join('\n');}).join('\n\n');}
 return {begin,sample,pause,motionChanged,captureVideoQuality,snapshots,report};
}
const api={createMonitor,...createMonitor(),createPlayfieldBudget,playfield:createPlayfieldBudget(),createNoteMotionClock,noteMotion:createNoteMotionClock()};if(typeof module!=='undefined')module.exports=api;root.PulsePerformance=api;
})(typeof globalThis!=='undefined'?globalThis:this);
