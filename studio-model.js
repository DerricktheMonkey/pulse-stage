/* Pure operations shared by the visual editor and its regression tests. */
(function(root){
  'use strict';
  const copy = notes => notes.map(({time,lane,duration=0})=>({time,lane,duration}));
  const round = n => Math.round(n*1e6)/1e6;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  function timing(value={}) {
    const bpm=Number(value.bpm),anchor=Number(value.anchor),division=Number(value.division),span=Number(value.span);
    return {bpm:Number.isFinite(bpm)&&bpm>=20&&bpm<=400?bpm:120,
      anchor:Number.isFinite(anchor)&&anchor>=0?anchor:0,
      division:[0,1,2,3,4,6,8,12,16].includes(division)?division:4,
      span:[2,4,8,12,20].includes(span)?span:4};
  }
  function snap(songTime,settings,offset=0) {
    const {bpm,anchor,division}=timing(settings);
    const t=division?anchor+Math.round((songTime-anchor)/(60/bpm/division))*(60/bpm/division):songTime;
    return round(t-offset);
  }
  function step(settings){const t=timing(settings);return 60/t.bpm/(t.division||4);}
  function validate(notes,duration){
    if(!Array.isArray(notes)||notes.length>30000)throw Error('A chart can contain up to 30,000 notes.');
    const out=copy(notes).sort((a,b)=>a.time-b.time||a.lane-b.lane),ends=Array(4).fill(-Infinity);
    for(const n of out){
      if(!Number.isFinite(n.time)||!Number.isFinite(n.duration)||!Number.isInteger(n.lane)||n.lane<0||n.lane>3||n.time<0||n.duration<0||n.time+n.duration>duration+1e-6)throw Error('Keep notes and hold tails inside the song and its four lanes.');
      if(n.time<ends[n.lane]-.000001)throw Error('Notes cannot overlap in the same lane.');
      ends[n.lane]=n.time+Math.max(.035,n.duration);
    }
    return out;
  }
  function transform(notes,indices,deltaTime,deltaLane,duration){
    const ids=new Set(indices),selected=notes.filter((_,i)=>ids.has(i));
    if(!selected.length)return copy(notes);
    // Bound the whole selection, not each note independently: keep its shape.
    const lo=Math.min(...selected.map(n=>n.time)),hi=Math.max(...selected.map(n=>n.time+n.duration));
    const left=Math.min(...selected.map(n=>n.lane)),right=Math.max(...selected.map(n=>n.lane));
    const dt=clamp(deltaTime,-lo,duration-hi),dl=clamp(deltaLane,-left,3-right);
    return validate(notes.map((n,i)=>ids.has(i)?{...n,time:round(n.time+dt),lane:n.lane+dl}:n),duration);
  }
  function paste(notes,clipboard,at,duration){
    if(!clipboard.length)return copy(notes);
    const first=Math.min(...clipboard.map(n=>n.time));
    return validate([...notes,...clipboard.map(n=>({...n,time:round(at+n.time-first)}))],duration);
  }
  function resize(notes,index,end,duration){
    if(!notes[index])return copy(notes);
    const out=copy(notes),n=out[index];
    n.duration=round(Math.max(0,Math.min(duration,end)-n.time));
    return validate(out,duration);
  }
  function mirror(notes,indices,duration){
    const ids=new Set(indices);
    return validate(notes.map((n,i)=>ids.has(i)?{...n,lane:3-n.lane}:n),duration);
  }
  function draw(a,b,lane,settings,offset,duration,forceHold=false){
    const t1=snap(a,settings,offset),t2=snap(b,settings,offset);
    const time=Math.max(0,Math.min(t1,t2));
    const length=Math.abs(t2-t1);
    const hold=forceHold?Math.max(step(settings),length):length;
    return validate([{time:round(time),lane,duration:round(Math.min(Math.max(0,duration-time),hold))}],duration)[0];
  }
  function yToTime(y,height,start,span){return start+(1-clamp(y/height,0,1))*span;}
  function timeToY(t,height,start,span){return (1-(t-start)/span)*height;}
  const api={copy,round,clamp,timing,snap,step,validate,transform,paste,resize,mirror,draw,yToTime,timeToY};
  if(typeof module!=='undefined')module.exports=api;
  root.BeatmapEditing=api;
})(typeof window!=='undefined'?window:globalThis);
