const assert=require('node:assert/strict'),M=require('../public/media-upload.js');
class Video extends EventTarget{
 constructor(){super();this.callbacks=new Map();this.next=0;this.currentTime=0;this.playing=false;this.cancelled=[];}
 requestVideoFrameCallback(fn){const id=++this.next;this.callbacks.set(id,fn);return id;}
 cancelVideoFrameCallback(id){this.cancelled.push(id);this.callbacks.delete(id);}
 play(){this.playing=true;return Promise.resolve();}
 frame(time){this.currentTime=time;const callbacks=[...this.callbacks];this.callbacks.clear();for(const [,callback] of callbacks)callback(0,{mediaTime:time});}
}
(async()=>{
 const video=new Video();let ready=false;const pending=M.primeVideo(video,{timeout:1000}).then(result=>{ready=true;return result;});await Promise.resolve();assert(!ready,'play() resolving is not proof the compressed video has delivered frames');for(let i=0;i<7;i++){video.frame(i/60);await Promise.resolve();assert(!ready,'Keep warming until a sequence of frames is presented');}video.frame(7/60);const result=await pending;assert.equal(result.frames,8);assert(!result.timedOut);assert.equal(video.callbacks.size,0,'No warmup callbacks remain during gameplay');
 const preroll=new Video();let warmed=false;const uninterrupted=M.primeVideo(preroll,{frames:Infinity,seconds:1,timeout:1000}).then(()=>warmed=true);for(let i=0;i<60;i++)preroll.frame(i/60);await Promise.resolve();assert(!warmed,'A full second of video advances before opening the chart');preroll.frame(1);await uninterrupted;assert(preroll.playing,'Priming leaves native playback running');assert.equal(preroll.callbacks.size,0);
 const slow=new Video(),timed=await M.primeVideo(slow,{timeout:5});assert(timed.timedOut);assert.equal(slow.callbacks.size,0,'A damaged/slow clip has a bounded wait with no late callback');
 const cancelled=new Video(),abort=new AbortController(),aborted=M.primeVideo(cancelled,{signal:abort.signal});abort.abort();await assert.rejects(aborted,e=>e.name==='AbortError');assert.equal(cancelled.callbacks.size,0);
 const failed=new Video();failed.play=()=>Promise.reject(Error('decode failed'));await assert.rejects(M.primeVideo(failed),/decode failed/);assert.equal(failed.callbacks.size,0);
 const fallback=new EventTarget();fallback.currentTime=0;fallback.play=()=>Promise.resolve();const legacy=M.primeVideo(fallback,{timeout:1000});fallback.currentTime=.3;fallback.dispatchEvent(new Event('timeupdate'));assert(!(await legacy).timedOut,'Older browsers wait for actual video progress');
 const supported=types=>({MediaRecorder:{isTypeSupported:type=>types.includes(type)}});assert.equal(M.chooseMime(supported(['video/mp4;codecs=avc1','video/webm;codecs=vp9'])),'video/mp4;codecs=avc1');assert.equal(M.chooseMime(supported(['video/webm;codecs=vp8','video/webm;codecs=vp9'])),'video/webm;codecs=vp8');assert.equal(M.chooseMime(supported(['video/webm;codecs=vp9'])),'video/webm;codecs=vp9','Retain a supported fallback');
 console.log('PASS: compressed-video warmup requires presented frames, handles timeout/failure/cancellation and old browsers, and prefers AVC/MP4 or VP8 over VP9 when supported.');
})();
