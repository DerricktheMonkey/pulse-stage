/* Conservative, non-destructive edge trimming. Chart times use the cropped timeline;
   uploaded audio stays byte-for-byte original, with an explicit source window. */
(function(root){'use strict';
const VERSION=1;
function detect(buffer){
 const rate=buffer.sampleRate,length=buffer.length,channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 if(!(rate>0)||!length||!channels.length)return {start:0,end:buffer.duration||0};
 const hop=Math.max(1,Math.round(rate*.005)),bins=Math.ceil(length/hop),rms=new Float64Array(bins),peaks=new Float64Array(bins);let peak=0;
 for(let b=0;b<bins;b++){const a=b*hop,z=Math.min(length,a+hop);let maxRms=0,p=0;for(const ch of channels){let sum=0;for(let i=a;i<z;i++){const x=Number.isFinite(ch[i])?ch[i]:0;sum+=x*x;p=Math.max(p,Math.abs(x));}maxRms=Math.max(maxRms,Math.sqrt(sum/(z-a)));}rms[b]=maxRms;peaks[b]=p;peak=Math.max(peak,p);}
 // At most -80 dBFS, usually lower. Do not gate quiet music or phase-cancel stereo.
 const threshold=Math.max(1e-7,Math.min(1e-4,peak*1e-4));let first=-1,last=-1;
 for(let b=0;b<bins;b++)if(rms[b]>threshold||peaks[b]>threshold*4){if(first<0)first=b;last=b;}
 if(first<0)return {start:0,end:length/rate,silent:true};
 const start=first*hop/rate>.25?Math.max(0,first*hop/rate-.04):0;
 const edge=Math.min(length,(last+1)*hop)/rate,end=length/rate-edge>.25?Math.min(length/rate,edge+.10):length/rate;
 return {start,end,silent:false};
}
function checkedWindow(value,duration){
 if(!value)return null;
 if(value.version!==VERSION||!Number.isFinite(value.start)||!Number.isFinite(value.end)||!Number.isFinite(value.sourceDuration)||value.start<0||value.end<=value.start||value.end>duration+.05||Math.abs(value.sourceDuration-duration)>.05)throw Error('This chart needs its original audio file; its saved audio trim does not match.');
 return {start:value.start,end:Math.min(duration,value.end)};
}
function phase(anchor,shift,bpm){const beat=60/(Number(bpm)||120),raw=(Number(anchor)||0)-shift;return raw>=0?raw:((raw%beat)+beat)%beat;}
function prepare(buffer,chart={},createBuffer){
 const duration=buffer.duration,rate=buffer.sampleRate,sourceNotes=Array.isArray(chart.notes)?chart.notes:[];
 const saved=checkedWindow(chart.audioTrim,duration),edges=saved||detect(buffer);let {start,end}=edges;
 if(!saved&&sourceNotes.length){let first=Infinity,last=0;for(const n of sourceNotes){if(!Number.isFinite(n.time)||!Number.isFinite(n.duration||0))throw Error('Invalid chart timing.');first=Math.min(first,n.time);last=Math.max(last,n.time+(n.duration||0));}const offset=(Number(chart.offsetMs)||0)/1000;
  // Keep manual heads, hold tails and offset padding, even if authored in silence.
  start=Math.max(0,Math.min(start,first+Math.min(0,offset)-.04));end=Math.min(duration,Math.max(end,last+Math.max(0,offset)+.10));
 }
 const a=Math.max(0,Math.round(start*rate)),b=Math.min(buffer.length,Math.round(end*rate));
 if(b<=a)throw Error('Audio trim has no playable samples.');
 const actualStart=a/rate,actualEnd=b/rate,shift=saved?0:actualStart;
 const notes=sourceNotes.map(n=>({...n,time:Math.max(0,n.time-shift)}));
 let creatorTiming=chart.creatorTiming?{...chart.creatorTiming}:undefined;
 if(creatorTiming&&shift)creatorTiming.anchor=phase(creatorTiming.anchor,shift,creatorTiming.bpm||chart.bpm);
 const audioTrim={version:VERSION,start:actualStart,end:actualEnd,sourceDuration:duration};
 let cropped=buffer;
 if(a!==0||b!==buffer.length){if(typeof createBuffer!=='function')throw Error('Audio buffer factory is required.');cropped=createBuffer(buffer.numberOfChannels,b-a,rate);for(let ch=0;ch<buffer.numberOfChannels;ch++)cropped.getChannelData(ch).set(buffer.getChannelData(ch).subarray(a,b));}
 return {buffer:cropped,chart:{...chart,notes,...(creatorTiming?{creatorTiming}:{}),audioTrim},audioTrim,shift,removed:duration-cropped.duration,silent:!!edges.silent};
}
const api={VERSION,detect,prepare,checkedWindow,phase};if(typeof module!=='undefined')module.exports=api;root.PulseAudioTrim=api;
})(typeof globalThis!=='undefined'?globalThis:this);
