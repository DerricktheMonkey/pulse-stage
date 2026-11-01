(function(root){'use strict';
function cover(sourceWidth,sourceHeight,width,height){const scale=Math.max(width/sourceWidth,height/sourceHeight),sw=width/scale,sh=height/scale;return [(sourceWidth-sw)/2,(sourceHeight-sh)/2,sw,sh,0,0,width,height];}
function create(video,canvas,deps={}){
 const frame=deps.requestAnimationFrame||root.requestAnimationFrame.bind(root),cancel=deps.cancelAnimationFrame||root.cancelAnimationFrame.bind(root),now=deps.now||(()=>root.performance.now()),ratio=deps.pixelRatio||(()=>(root.devicePixelRatio||1));
 let context=null,enabled=false,failed=false,raf=null,vfc=null,lastMarker=null,lastCallback=-Infinity,width=0,height=0,painted=0,worstDrawMs=0;const listeners=[],warmups=new Set();
 const listen=(name,fn)=>{video.addEventListener(name,fn);listeners.push([name,fn]);};
 function stop(){if(raf!==null)cancel(raf);if(vfc!==null)video.cancelVideoFrameCallback?.(vfc);raf=vfc=null;}
 function useNative(){context=null;for(const finish of [...warmups])finish(false);stop();enabled=false;failed=true;canvas.hidden=true;video.classList.remove('video-canvas-source');deps.onFallback?.();}
 function paint(marker,force=false){if(!enabled||video.readyState<2||!video.videoWidth||!video.videoHeight||!width||!height)return;if(!force&&marker===lastMarker)return;
  try{if(context.isContextLost?.()){useNative();return;}const began=now();context.fillStyle='#030710';context.fillRect(0,0,width,height);context.drawImage(video,...cover(video.videoWidth,video.videoHeight,width,height));worstDrawMs=Math.max(worstDrawMs,now()-began);lastMarker=marker;painted++;for(const notify of [...warmups])notify();}catch{useNative();}
 }
 function resize(){if(!enabled)return;const box=canvas.getBoundingClientRect(),dpr=ratio();if(!box.width||!box.height)return;const w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);if(w===width&&h===height)return;width=w;height=h;canvas.width=w;canvas.height=h;lastMarker=null;paint('resize',true);}
 function marker(){try{const quality=video.getVideoPlaybackQuality?.();if(quality?.totalVideoFrames)return 'frames:'+quality.totalVideoFrames;}catch{}return 'time:'+Math.floor(video.currentTime*60);}
 function watch(){raf=null;if(!enabled||video.paused)return;if(now()-lastCallback>100)paint(marker());if(enabled&&!video.paused)raf=frame(watch);}
 function nextVideoFrame(){if(!enabled||video.paused||!video.requestVideoFrameCallback||vfc!==null)return;vfc=video.requestVideoFrameCallback((time,metadata)=>{vfc=null;if(!enabled)return;lastCallback=now();paint('pts:'+metadata.mediaTime);nextVideoFrame();});}
 function start(){if(!enabled)return;resize();if(raf===null&&!video.paused)raf=frame(watch);nextVideoFrame();}
 function configure(on){if(!on){for(const finish of [...warmups])finish(false);stop();failed=false;enabled=false;canvas.hidden=true;video.classList.remove('video-canvas-source');return;}if(enabled){resize();return;}
  try{context||=canvas.getContext('2d',{alpha:false,desynchronized:true});}catch{}if(!context){useNative();return;}
  failed=false;enabled=true;painted=0;worstDrawMs=0;lastMarker=null;lastCallback=-Infinity;canvas.hidden=false;video.classList.add('video-canvas-source');resize();paint('configured',true);start();
 }
 listen('play',start);listen('pause',stop);listen('ended',stop);listen('emptied',()=>{stop();lastMarker=null;});listen('loadeddata',()=>{resize();paint('loaded',true);start();});listen('seeked',()=>{paint('seeked',true);start();});
 function prime({frames=8,timeout=1800}={}){if(!enabled)return Promise.resolve({ready:false});const initial=painted;return new Promise(resolve=>{let timer,done=false;const finish=ready=>{if(done)return;if(ready!==false&&painted-initial<frames)return;done=true;clearTimeout(timer);warmups.delete(finish);resolve({ready:ready!==false,frames:painted-initial});};warmups.add(finish);timer=setTimeout(()=>finish(false),timeout);try{Promise.resolve(video.play()).catch(()=>finish(false));}catch{finish(false);}});}
 const contextLost=()=>useNative();canvas.addEventListener('contextlost',contextLost);
 return {configure,resize,prime,paint:()=>paint('manual',true),mode:()=>enabled?'compatibility':failed?'native-fallback':'native',stats:()=>({painted,width,height,worstDrawMs}),dispose(){configure(false);for(const [name,fn] of listeners)video.removeEventListener(name,fn);canvas.removeEventListener('contextlost',contextLost);canvas.width=canvas.height=1;}};
}
const api={cover,create};if(typeof module!=='undefined')module.exports=api;root.PulseVideoSurface=api;
})(typeof globalThis!=='undefined'?globalThis:this);
