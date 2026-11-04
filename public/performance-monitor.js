(function(root){'use strict';
function createMonitor(){
 let current=null,history=[];
 const bucket=()=>({frames:0,totalMs:0,worstMs:0,slowFrames:0,maxClockErrorMs:0,maxDrawMs:0});
 function begin(metadata={}){if(current)history=[current,...history].slice(0,1);current={metadata:{...metadata},countdown:bucket(),opening:bucket(),following:bucket(),whole:bucket(),recent:[],cursor:0,last:null,done:false};}
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
  return {metadata:{...run.metadata},complete:run.done,position:recent.length?recent[recent.length-1].songTime:0,recent:{...b,fps:b.totalMs?1000*b.frames/b.totalMs:0,cadenceMs:cadence,estimatedMissed:missed},...Object.fromEntries(['countdown','opening','following','whole'].map(phase=>{const b=run[phase];return [phase,{...b,fps:b.totalMs?1000*b.frames/b.totalMs:0}];}))};
 });}
 function report(){const runs=snapshots();if(!runs.length)return 'Play a level for at least three seconds, then pause to see its opening performance.';return runs.map((run,i)=>{
  const m=run.metadata,lines=['Pulse Stage · performance report · build '+(m.build||'unknown')+(i?' · previous run':''),'Level: '+(m.level||'unknown')+' · '+(m.difficulty||'unknown'),'Background motion: '+(m.motion?'ON':'OFF')+' · '+(m.background||'none'),'Canvas: '+(m.canvas||'unknown'),'Browser: '+(m.browser||'unknown')];
  for(const [phase,label] of [['countdown','Count-in'],['opening','First second'],['following','Seconds 1–3'],['whole','Full run'],['recent','Last 5 seconds']]){const b=run[phase];lines.push(label+': '+(b.frames?b.fps.toFixed(1)+' fps, worst '+b.worstMs.toFixed(1)+'ms, '+b.slowFrames+' slow frames, clock gap '+b.maxClockErrorMs.toFixed(1)+'ms, draw '+b.maxDrawMs.toFixed(1)+'ms':'not enough frames'));}
  if(run.recent.frames)lines.push('Recent cadence: '+(1000/run.recent.cadenceMs).toFixed(1)+' Hz; estimated missed refreshes: '+run.recent.estimatedMissed+'. Browser callbacks measured; GPU/display presentation is not measured.');
  if(m.motionChanges)lines.push('Background motion changed during this run — restart for a clean comparison.');if(!run.complete)lines.push('Partial sample — play through the first three seconds for a full comparison.');return lines.join('\n');}).join('\n\n');}
 return {begin,sample,pause,motionChanged,snapshots,report};
}
const api={createMonitor,...createMonitor()};if(typeof module!=='undefined')module.exports=api;root.PulsePerformance=api;
})(typeof globalThis!=='undefined'?globalThis:this);
