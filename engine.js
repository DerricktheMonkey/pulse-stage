(function(root){
const HIT_WINDOW=.19;
function spectrum(samples,start,size=1024){
 const real=new Float64Array(size),imag=new Float64Array(size);
 for(let i=0;i<size;i++)real[i]=(samples[start+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/(size-1)));
 for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const t=real[i];real[i]=real[j];real[j]=t;}}
 for(let len=2;len<=size;len<<=1){const angle=-2*Math.PI/len,wr=Math.cos(angle),wi=Math.sin(angle);for(let i=0;i<size;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){const a=i+j,b=a+len/2,vr=real[b]*ur-imag[b]*ui,vi=real[b]*ui+imag[b]*ur;real[b]=real[a]-vr;imag[b]=imag[a]-vi;real[a]+=vr;imag[a]+=vi;const next=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=next;}}}
 return real.slice(0,size/2).map((v,i)=>Math.hypot(v,imag[i])/size);
}
function analyze(samples,rate,difficulty='normal'){
 const insane=difficulty==='insane',hop=insane?128:256,env=[];for(let i=0;i<samples.length;i+=hop){let e=0;for(let j=i;j<Math.min(i+hop,samples.length);j++)e+=samples[j]*samples[j];env.push(Math.sqrt(e/hop));}
 const dt=hop/rate,energyFlux=env.map((e,i)=>Math.max(0,e-(env[i-1]||0))),spectralFlux=[],pitch=[],melodicFlux=[];let prev=new Float64Array(512);
 for(let frame=0;frame<env.length;frame++){
  const mag=spectrum(samples,frame*hop-512);let rise=0,melodyRise=0,peak=0,bin=0;
  for(let k=6;k<Math.min(400,mag.length-1);k++){rise+=Math.max(0,mag[k]-prev[k]);if(k>=12&&k<=185&&mag[k]>=mag[k-1]&&mag[k]>mag[k+1]){const score=mag[k]*Math.pow(k,.3);if(score>peak){peak=score;bin=k;}}}
  for(let k=16;k<=185;k++)melodyRise+=Math.max(0,mag[k]-prev[k]);
  melodicFlux.push(melodyRise);spectralFlux.push(rise);pitch.push(bin*rate/1024);prev=mag;
 }
 const maxEnergy=Math.max(.00001,...energyFlux.slice(0,60000)),maxSpectral=Math.max(.00001,...spectralFlux.slice(0,60000));
 const flux=env.map((_,i)=>.55*energyFlux[i]/maxEnergy+.45*spectralFlux[i]/maxSpectral),raw=[];
 for(let i=2;i<flux.length-2;i++){let sum=0,count=0;for(let j=Math.max(0,i-12);j<=Math.min(flux.length-1,i+12);j++){sum+=flux[j];count++;}if(!(env[Math.min(env.length-1,i+2)]<env[Math.max(0,i-2)]*.65&&energyFlux[i]<maxEnergy*.08)&&env[i]>.002&&flux[i]>.025&&flux[i]>sum/count*1.55&&flux[i]>=flux[i-1]&&flux[i]>flux[i+1]){let snap=i;for(let j=Math.max(0,i-2);j<=Math.min(env.length-1,i+2);j++)if(energyFlux[j]>energyFlux[snap]&&energyFlux[j]>maxEnergy*.08)snap=j;raw.push({time:snap*dt,strength:flux[i],frequency:pitch[Math.min(pitch.length-1,snap+2)]});}}
 // Insane keeps real melodic attacks, including legato pitch changes that
 // don't produce a drum-like energy spike. Never fill a guessed beat grid.
 if(insane){
  const maxMelody=Math.max(.00001,...melodicFlux.slice(0,120000));
  for(let i=4;i<env.length-4;i++){
   let baseline=0;for(let j=i-4;j<=i+4;j++)baseline+=melodicFlux[j]/9;
   const attack=melodicFlux[i]>maxMelody*.035&&melodicFlux[i]>baseline*1.25&&melodicFlux[i]>=melodicFlux[i-1]&&melodicFlux[i]>melodicFlux[i+1];
   const before=pitch[i-3],after=pitch[i+3];
   const changed=before>0&&after>0&&Math.abs(Math.log2(after/before))>.07&&Math.abs(Math.log2(pitch[i+2]/after))<.04&&Math.abs(Math.log2(pitch[i+4]/after))<.04;
   if(env[i]>.004&&env[i+3]>=env[i-3]*.8&&(attack||(changed&&melodicFlux[i]>maxMelody*.015&&melodicFlux[i]>=melodicFlux[i-1]&&melodicFlux[i]>melodicFlux[i+1]))){
    raw.push({time:i*dt,strength:melodicFlux[i]/maxMelody,frequency:after});
   }
  }
 }
 raw.sort((a,b)=>a.time-b.time);const peaks=[];for(const p of raw){const previous=peaks[peaks.length-1];if(previous&&p.time-previous.time<(insane?.055:.075)){if(p.strength>previous.strength)peaks[peaks.length-1]=p;}else peaks.push(p);}
 let bpm=120,best=0;for(let b=75;b<=180;b++){let real=0,imag=0;for(const p of peaks){const phase=2*Math.PI*p.time*b/60;real+=p.strength*Math.cos(phase);imag+=p.strength*Math.sin(phase);}const score=real*real+imag*imag;if(score>best){best=score;bpm=b;}}
 const gap={easy:.34,normal:.24,hard:.15,insane:.065}[difficulty]||.24,selected=[];
 for(const p of peaks){if(p.time<.35)continue;const previous=selected[selected.length-1];if(previous&&p.time-previous.time<gap){if(p.strength>previous.strength)selected[selected.length-1]=p;}else selected.push(p);}
 const frequencies=selected.map(p=>p.frequency).filter(f=>f>0).sort((a,b)=>a-b),low=frequencies[Math.floor(frequencies.length*.1)]||130,high=frequencies[Math.floor(frequencies.length*.9)]||1000;
 const notes=selected.map(p=>({time:+p.time.toFixed(3),lane:p.frequency>0?Math.max(0,Math.min(3,Math.round(3*Math.log2(p.frequency/low)/Math.max(.5,Math.log2(high/low))))):1,duration:0}));
 if(difficulty!=='easy'&&!insane)for(let i=0;i<notes.length-1;i++){const n=notes[i],space=notes[i+1].time-n.time;if(space>.65){const start=Math.floor((n.time+.12)/dt),end=Math.floor(Math.min(n.time+space-.16,n.time+1.3)/dt),slice=env.slice(start,end),freq=selected[i].frequency;if(freq>0&&slice.length&&slice.every(x=>x>.015)&&pitch.slice(start,end).filter(f=>f>0&&Math.abs(Math.log2(f/freq))<.18).length>slice.length*.7)n.duration=+Math.min(space-.18,1.1).toFixed(3);}}
 if(difficulty!=='easy'&&!insane)for(let i=0;i<notes.length-1;i++){const n=notes[i];let space=notes[i+1].time-n.time;if(i%7===3){if(difficulty==='normal'&&space<=.38&&notes[i+2]&&notes[i+2].time-n.time>.38){notes.splice(i+1,1);space=notes[i+1].time-n.time;}if(space>.38){n.duration=+Math.min(.75,space-.08).toFixed(3);}}}
 if(difficulty==='hard'){const extra=[];for(let i=0;i<notes.length;i++){const n=notes[i];if(i%4===1&&!n.duration)extra.push({time:n.time,lane:(n.lane+2)%4,duration:0});}notes.push(...extra);notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);}
 return {notes,bpm,peaks,env,dt,scanVersion:4};
}
function nextHealth(health,result){return Math.max(0,Math.min(100,health+(result==='MISS'?-12:result==='PERFECT'?2:result==='GREAT'?1:0)));}
function validateChart(data,duration){if(!data||!Array.isArray(data.notes)||data.notes.length>30000)throw Error('Choose a chart JSON containing a notes array (up to 30,000 notes).');const notes=data.notes.map(n=>{if(!Number.isFinite(n.time)||n.time<0||n.time>duration||!Number.isInteger(n.lane)||n.lane<0||n.lane>3||!Number.isFinite(n.duration??0)||(n.duration??0)<0||n.time+(n.duration??0)>duration+.01)throw Error('Notes need a valid time, lane 0–3, and duration within the song.');const out={time:n.time,lane:n.lane,duration:n.duration||0};return out;}).sort((a,b)=>a.time-b.time||a.lane-b.lane);const ends=[-1,-1,-1,-1];for(const n of notes){const lanes=[n.lane];if(lanes.some(l=>n.time<ends[l]-.001))throw Error('Notes cannot overlap in the same lane.');for(const l of lanes)ends[l]=n.time+Math.max(.035,n.duration);}return notes;}
function markChords(notes){for(const n of notes)delete n.chord;for(let start=0;start<notes.length;){let end=start+1;while(end<notes.length&&Math.abs(notes[end].time-notes[start].time)<=.001)end++;if(new Set(notes.slice(start,end).map(n=>n.lane)).size>1)for(let i=start;i<end;i++)notes[i].chord=true;start=end;}return notes;}
function rank(counts,total,complete=true){if(!complete)return 'RETRY';if(total>0&&counts.PERFECT===total&&!(counts.GREAT||counts.GOOD||counts.MISS))return 'S';const judged=(counts.PERFECT||0)+(counts.GREAT||0)+(counts.GOOD||0)+(counts.MISS||0),accuracy=judged?100*((counts.PERFECT||0)+.8*(counts.GREAT||0)+.5*(counts.GOOD||0))/judged:0;return accuracy>=90?'A':accuracy>=80?'B':accuracy>=65?'C':'D';}
function holdCue(note,time){if(!note||note.duration<=.05||note.result)return null;const remaining=Math.max(0,note.time+note.duration-time);return {phase:remaining>0?'HOLD':'RELEASE',remaining,progress:Math.min(1,remaining/note.duration)};}
function judgement(delta){delta=Math.abs(delta);return delta<=.12?'PERFECT':delta<=.155?'GREAT':delta<=HIT_WINDOW?'GOOD':null;}
const api={analyze,validateChart,judgement,nextHealth,HIT_WINDOW,markChords,rank,holdCue};if(typeof module!=='undefined')module.exports=api;root.RhythmEngine=api;
})(typeof window!=='undefined'?window:globalThis);
