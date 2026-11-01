(function(root){'use strict';
function createMonitor(){
 let current=null,history=[];
 const bucket=()=>({frames:0,totalMs:0,worstMs:0,slowFrames:0,maxClockErrorMs:0,maxDrawMs:0});
 function begin(metadata={}){if(current)history=[current,...history].slice(0,1);current={metadata:{...metadata},countdown:bucket(),opening:bucket(),following:bucket(),last:null,done:false};}
 function sample(now,songTime,drawMs=0){
  if(!current||current.done||!Number.isFinite(now)||!Number.isFinite(songTime))return;
  const phase=songTime<0?'countdown':songTime<1?'opening':'following',prior=current.last;current.last={now,songTime,phase};
  if(!prior){if(songTime>=3)current.done=true;return;}
  const dt=now-prior.now;if(dt<=0)return;
  for(const name of new Set([prior.phase,phase])){const b=current[name];b.frames++;b.totalMs+=dt;b.worstMs=Math.max(b.worstMs,dt);if(dt>25)b.slowFrames++;b.maxClockErrorMs=Math.max(b.maxClockErrorMs,Math.abs((songTime-prior.songTime)*1000-dt));b.maxDrawMs=Math.max(b.maxDrawMs,drawMs);}
  if(songTime>=3)current.done=true;
 }
 function motionChanged(){if(current&&!current.done)current.metadata.motionChanges=(current.metadata.motionChanges||0)+1;}
 function pause(){if(current)current.last=null;}
 function snapshots(){return [current,...history].filter(Boolean).map(run=>({metadata:{...run.metadata},complete:run.done,...Object.fromEntries(['countdown','opening','following'].map(phase=>{const b=run[phase];return [phase,{...b,fps:b.totalMs?1000*b.frames/b.totalMs:0}];}))}));}
 function report(){const runs=snapshots();if(!runs.length)return 'Play a level for at least three seconds, then pause to see its opening performance.';return runs.map((run,i)=>{
  const m=run.metadata,lines=['Pulse Stage · opening report · build '+(m.build||'unknown')+(i?' · previous run':''),'Level: '+(m.level||'unknown')+' · '+(m.difficulty||'unknown'),'Background motion: '+(m.motion?'ON':'OFF')+' · '+(m.background||'none'),'Rendering: '+(m.efficient===false?'full refresh':'efficient'),'Canvas: '+(m.canvas||'unknown'),'Browser: '+(m.browser||'unknown')];
  for(const [phase,label] of [['countdown','Count-in'],['opening','First second'],['following','Seconds 1–3']]){const b=run[phase];lines.push(label+': '+(b.frames?b.fps.toFixed(1)+' fps, worst '+b.worstMs.toFixed(1)+'ms, '+b.slowFrames+' slow frames, clock gap '+b.maxClockErrorMs.toFixed(1)+'ms, draw '+b.maxDrawMs.toFixed(1)+'ms':'not enough frames'));}if(m.motionChanges)lines.push('Background motion changed during this run — restart for a clean comparison.');if(!run.complete)lines.push('Partial sample — play through the first three seconds for a full comparison.');return lines.join('\n');}).join('\n\n');}
 return {begin,sample,pause,motionChanged,snapshots,report};
}
const api={createMonitor,...createMonitor()};if(typeof module!=='undefined')module.exports=api;root.PulsePerformance=api;
})(typeof globalThis!=='undefined'?globalThis:this);
