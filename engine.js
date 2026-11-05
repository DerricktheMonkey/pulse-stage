(function(root){
const HIT_WINDOW=.19;
const CHORD_WINDOW=.04;
function simultaneousHeads(a,b){return a.lane!==b.lane&&Math.abs(a.time-b.time)<=CHORD_WINDOW+1e-9;}
const ATTACK_BANDS=[[8,28],[28,74],[74,205],[205,400]];
function attackLookup(events,gap){const buckets=new Map();const add=event=>{const key=Math.floor(event.time/gap);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(event.time);};for(const event of events)add(event);return {add,hasNear(time){const key=Math.floor(time/gap);for(let k=key-1;k<=key+1;k++)for(const prior of buckets.get(k)||[])if(Math.abs(prior-time)<gap)return true;return false;}};}
function spectrum(samples,start,size=1024){
 const real=new Float64Array(size),imag=new Float64Array(size);
 for(let i=0;i<size;i++)real[i]=(samples[start+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/(size-1)));
 for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const t=real[i];real[i]=real[j];real[j]=t;}}
 for(let len=2;len<=size;len<<=1){const angle=-2*Math.PI/len,wr=Math.cos(angle),wi=Math.sin(angle);for(let i=0;i<size;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){const a=i+j,b=a+len/2,vr=real[b]*ur-imag[b]*ui,vi=real[b]*ui+imag[b]*ur;real[b]=real[a]-vr;imag[b]=imag[a]-vi;real[a]+=vr;imag[a]+=vi;const next=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=next;}}}
 return real.slice(0,size/2).map((v,i)=>Math.hypot(v,imag[i])/size);
}
// Refine the existing events with short, pitch-focused windows. Selection is
// already complete: this moves timestamps only, without changing chart density.
function alignAttacks(samples,rate,events){
 const size=256,step=32,weights=new Map();
 return events.map((event,index)=>{
  if(!(event.frequency>0))return {...event};
  const midi=Math.round(69+12*Math.log2(event.frequency/440));
  if(!weights.has(midi)){
   const hz=440*Math.pow(2,(midi-69)/12),real=new Float64Array(size),imag=new Float64Array(size);
   for(let k=0;k<size;k++){const window=.5-.5*Math.cos(2*Math.PI*k/(size-1)),phase=2*Math.PI*hz*k/rate;real[k]=window*Math.cos(phase);imag[k]=window*Math.sin(phase);}
   weights.set(midi,{real,imag});
  }
  const {real,imag}=weights.get(midi),start=Math.max(0,Math.floor((event.time-.032)*rate)),end=Math.min(samples.length-1,Math.ceil((event.time+.04)*rate));
  let previous=0,bestRise=0,bestSample=Math.round(event.time*rate),maxAmplitude=0;
  for(let center=start-step;center<=end;center+=step){
   let re=0,im=0;for(let k=0;k<size;k++){const sample=samples[center-(size>>1)+k]||0;re+=sample*real[k];im+=sample*imag[k];}
   const amplitude=Math.hypot(re,im),rise=amplitude-previous;
   if(center>=start&&rise>bestRise){bestRise=rise;bestSample=center-step/2;}
   maxAmplitude=Math.max(maxAmplitude,amplitude);previous=amplitude;
  }
  const lower=index?(events[index-1].time+event.time)/2+.005:0,upper=index+1<events.length?(event.time+events[index+1].time)/2-.005:samples.length/rate;
  const refined=bestRise>maxAmplitude*.025?bestSample/rate:event.time;
  return {...event,time:Math.max(lower,Math.min(upper,refined))};
 });
}
// Preserve pitches as a preference, but give each finger recovery time.
function spreadLanes(notes){
 const last=[-Infinity,-Infinity,-Infinity,-Infinity],recent=[];let previous=null;
 return notes.map(note=>{
  const preferred=note.lane;
  const score=lane=>{
   const recovery=note.time-last[lane],sameHand=previous&&Math.floor(lane/2)===Math.floor(previous.lane/2)&&note.time-previous.time<.22;
   return (recovery<.18?100:0)+(previous?.lane===lane?20:0)+(sameHand?4:0)+recent.filter(n=>n.lane===lane).length*1.5+Math.max(0,.5-recovery)*8+Math.abs(lane-preferred)*.25;
  };
  let lane=preferred;for(let candidate=0;candidate<4;candidate++)if(score(candidate)<score(lane))lane=candidate;
  const mapped={...note,lane};last[lane]=note.time+(note.duration||0);previous=mapped;recent.push(mapped);if(recent.length>8)recent.shift();return mapped;
 });
}
// Add accents at existing musical timestamps: two-note chords and brief jacks.
function insanePatterns(notes,events=[]){
 const out=notes.map(n=>({...n})),bursts=new Set();let lastBurst=-Infinity,lastBurstIndex=-24;
 for(let i=8;i<out.length-3;i++){
  const a=out[i+1].time-out[i].time,b=out[i+2].time-out[i+1].time;
  if(out[i].time-lastBurst<4||i-lastBurstIndex<24||a<.1||a>.18||b<.1||b>.18||Math.abs(a-b)>.025)continue;
  const forbidden=new Set([out[i-1].lane,out[i+3].lane]);
  const lane=[out[i].lane,0,1,2,3].find(l=>!forbidden.has(l));
  for(let j=i;j<i+3;j++){out[j].lane=lane;bursts.add(j);}
  lastBurst=out[i+2].time;lastBurstIndex=i;i+=2;
 }
 const last=[-Infinity,-Infinity,-Infinity,-Infinity],extra=[];let lastChord=-Infinity,lastChordIndex=-8;
 for(let i=0;i<out.length;i++){
  const n=out[i];last[n.lane]=n.time+(n.duration||0);
  if(i<2||i-lastChordIndex<8||n.time-lastChord<.9||n.duration||out[i-1]&&n.time-out[i-1].time<.085||out[i+1]&&out[i+1].time-n.time<.085)continue;
  if([...bursts].some(j=>Math.abs(out[j].time-n.time)<.25))continue;
  const local=events.slice(Math.max(0,i-4),i+5).map(e=>e.strength||0).sort((a,b)=>a-b);
  if(local.length&&(events[i]?.strength||0)<local[Math.floor(local.length*.65)])continue;
  const candidates=[0,1,2,3].filter(l=>l!==n.lane&&n.time-last[l]>=.16&&!out.slice(i+1,i+9).some(next=>next.lane===l&&next.time-n.time<.16));
  candidates.sort((a,b)=>(Math.floor(a/2)===Math.floor(n.lane/2))-(Math.floor(b/2)===Math.floor(n.lane/2))||last[a]-last[b]);
  if(candidates.length){const lane=candidates[0];extra.push({time:n.time,lane,duration:0});last[lane]=n.time;lastChord=n.time;lastChordIndex=i;}
 }
 return [...out,...extra].sort((a,b)=>a.time-b.time||a.lane-b.lane);
}
// Track independent frequency bands so a quiet, fast part is not hidden by a
// loud, slow instrument. Change the preferred band as the arrangement changes.
function busiestAttacks(bands,dt){
 const tracks=bands.map(band=>{
  const found=[],max=band.flux.reduce((a,b)=>Math.max(a,b),.00001);
  for(let i=3;i<band.flux.length-3;i++){
   const rise=band.flux[i];if(rise<max*.008||rise<band.energy[i]*.055||rise<band.flux[i-1]||rise<=band.flux[i+1])continue;
   let average=0;for(let j=i-3;j<=i+3;j++)average+=band.flux[j]/7;
   if(rise<average*1.45||Math.min(band.tonality[i+1],band.tonality[i+2])<.42||band.energy[i+2]<band.energy[i-2]*.65)continue;
   const event={time:i*dt,frequency:band.pitch[i+2],strength:rise/max,source:'busy'};
   if(!found.length||event.time-found.at(-1).time>=.04)found.push(event);
  }
  return found;
 });
 const windows=new Map();for(let band=0;band<tracks.length;band++)for(const event of tracks[band]){
  const key=Math.floor(event.time/.8);for(let window=key-1;window<=key+1;window++){if(!windows.has(window))windows.set(window,[0,0,0,0]);windows.get(window)[band]++;}
 }
 return tracks.flatMap((track,band)=>track.filter(event=>{const counts=windows.get(Math.floor(event.time/.8));return counts[band]===Math.max(...counts);}));
}
// Slow sections still get demanding rhythm: alternating triplet eighths and
// straight sixteenths, anchored to detected beats and only while audio sounds.
function slowRhythm(events,bpm,env,dt){
 const beat=60/bpm,extra=[];let supported=0,total=0,phrase=0;
 for(let i=0;i<events.length-1;i++){const gap=events[i+1].time-events[i].time;if(gap<beat*.8||gap>beat*4.1)continue;total++;if(Math.abs(gap/beat-Math.round(gap/beat))<.09)supported++;}
 if(supported<3||supported<total*.65)return events;
 for(let i=0;i<events.length-1;i++){
  const a=events[i],gap=events[i+1].time-a.time,beats=Math.round(gap/beat);
  if(gap<.36||beats<1||beats>4||Math.abs(gap/beat-beats)>.09)continue;
  const section=phrase++%4;if(section===3)continue; // leave a phrase for holds
  const parts=section===2?4:3,step=beat/parts;if(step<.075)continue;
  for(let j=1;j<beats*parts;j++){
   const time=a.time+j*step;if(events[i+1].time-time<.07)continue;
   const frame=Math.round(time/dt),energy=env[frame]||0;
   if(energy<.004||energy<(env[Math.round(a.time/dt)+2]||0)*.04)continue;
   extra.push({...a,time,strength:a.strength*.6,subdivision:parts===3?'triplet':'sixteenth'});
  }
 }
 return [...events,...extra].sort((a,b)=>a.time-b.time);
}
// Revoice attacks and beat subdivisions into bounded expert patterns.
// Rhythmic triplets are successive notes; triple chords are separate accents.
function impossiblePatterns(notes,events=[],bpm=120){
 const out=notes.map(n=>({...n})),reserved=new Set();let lastTrill=-Infinity,lastJack=-Infinity,lastTriplet=-Infinity;
 function assign(indices,lanes){
  const replacements=new Map(indices.map((index,j)=>[index,lanes[j]])),last=[-Infinity,-Infinity,-Infinity,-Infinity];let previousLane=-1,repeats=0;
  for(let i=Math.max(0,indices[0]-8);i<Math.min(out.length,indices.at(-1)+9);i++){
   const n=out[i],lane=replacements.get(i)??n.lane;
   if(n.time-last[lane]<.105-1e-6)return false;last[lane]=n.time+(n.duration||0);repeats=lane===previousLane?repeats+1:1;previousLane=lane;if(repeats>3)return false;
  }
  indices.forEach((index,j)=>{out[index].lane=lanes[j];reserved.add(index);});return true;
 }
 for(let i=2;i<out.length-2;i++){
  if(out[i].duration||reserved.has(i))continue;
  const step=out[i+1].time-out[i].time;
  // Three attacks at a detected beat's thirds become a compact three-finger roll.
  const third=60/bpm/3,triplet=Math.abs(step-third)<.025&&Math.abs(out[i+2].time-out[i+1].time-step)<.022;
  if(triplet&&out[i].time-lastTriplet>=1.3&&step>=.07&&step<=.23&&!out.slice(i,i+3).some((n,j)=>n.duration||reserved.has(i+j))){
   const start=out[i].lane,rolls=[[start,(start+2)%4,(start+1)%4],[0,2,1],[3,1,2]];
   if(rolls.some(lanes=>assign([i,i+1,i+2],lanes))){lastTriplet=out[i+2].time;i+=2;continue;}
  }
  // Six to eight hits on two fingers, then a recovery section on four lanes.
  if(step>=.065&&step<=.16&&out[i].time-lastTrill>=1.8){
   let end=i+1;while(end+1<out.length&&end-i<7&&!out[end+1].duration&&!reserved.has(end+1)&&Math.abs(out[end+1].time-out[end].time-step)<.022)end++;
   if(end-i>=5){const indices=Array.from({length:end-i+1},(_,j)=>i+j),pairs=[[0,2],[1,3],[0,3],[1,2]];
    if(pairs.some(pair=>assign(indices,indices.map((_,j)=>pair[j%2])))){lastTrill=out[end].time;i=end;continue;}
   }
  }
  // Keep the previous tier's short single-finger bursts, with strict recovery.
  if(step>=.11&&step<=.17&&Math.abs(out[i+2].time-out[i+1].time-step)<.02&&out[i].time-lastJack>=4&&!out.slice(i,i+3).some((n,j)=>n.duration||reserved.has(i+j))){
   if([0,1,2,3].some(lane=>assign([i,i+1,i+2],[lane,lane,lane]))){lastJack=out[i+2].time;i+=2;}
  }
 }
 const last=[-Infinity,-Infinity,-Infinity,-Infinity],extra=[];let chordAt=-Infinity,chordIndex=-4,chords=0,tripleAt=-Infinity;
 for(let i=0;i<out.length;i++){
  const n=out[i];last[n.lane]=n.time+(n.duration||0);
  if(i<2||n.duration||reserved.has(i)||i-chordIndex<4||n.time-chordAt<.4||out[i-1]&&n.time-out[i-1].time<.075||out[i+1]&&out[i+1].time-n.time<.075)continue;
  const local=events.slice(Math.max(0,i-4),i+5).map(e=>e.strength||0).sort((a,b)=>a-b);
  if(local.length&&(events[i]?.strength||0)<local[Math.floor(local.length*.5)])continue;
  const candidates=[0,1,2,3].filter(l=>l!==n.lane&&n.time-last[l]>=.14&&!out.slice(i+1,i+9).some(next=>next.lane===l&&next.time-n.time<.14));
  candidates.sort((a,b)=>(Math.floor(a/2)===Math.floor(n.lane/2))-(Math.floor(b/2)===Math.floor(n.lane/2))||last[a]-last[b]);
  const count=chords%12===11&&n.time-tripleAt>=12?2:1;let added=0;
  for(const lane of candidates.slice(0,count)){extra.push({time:n.time,lane,duration:0});last[lane]=n.time;added++;}
  if(added){if(added===2)tripleAt=n.time;chords++;chordAt=n.time;chordIndex=i;}
 }
 return [...out,...extra].sort((a,b)=>a.time-b.time||a.lane-b.lane);
}
// A sustained voice can coexist with attacks in other frequency bands. Extend
// an existing head only into free space on its own lane; never add, move or
// suppress the independent melody notes to manufacture a hold pattern.
function impossibleHolds(notes,tracks,dt,duration){
 const out=notes.map(n=>({...n})),next=new Array(out.length),last=[null,null,null,null];
 for(let i=out.length-1;i>=0;i--){next[i]=last[out[i].lane];last[out[i].lane]=out[i].time;}
 let heldUntil=-Infinity;
 for(let i=0;i<out.length;i++){
  const n=out[i];if(n.time<heldUntil+.18)continue;
  const limit=Math.min(duration,n.time+6,next[i]===null?Infinity:next[i]-.105);
  if(limit-n.time<.45)continue;
  const start=Math.round((n.time+.07)/dt),stop=Math.min(Math.floor(limit/dt),...tracks.map(t=>t.energy.length-1));let best=n.duration||0;
  for(const track of tracks){
   const frequency=track.pitch[start],energy=track.energy[start];
   if(!(frequency>0&&energy>.002&&track.tonality[start]>.35))continue;
   const onsetStart=Math.max(0,Math.floor((n.time-.06)/dt)),onsetEnd=Math.min(start,Math.ceil((n.time+.06)/dt));
   let onset=false;for(let f=onsetStart;f<=onsetEnd;f++)if(track.flux[f]>Math.max(.0001,track.energy[f]*.025)){onset=true;break;}
   if(!onset)continue;
   let good=start,bad=0;
   for(let f=start;f<=stop;f++){
    const reattack=f>start+Math.ceil(.12/dt)&&track.energy[f]>track.energy[f-1]*1.6&&track.flux[f]>track.energy[f]*.18;
    if(reattack)break;
    const sustained=track.energy[f]>Math.max(.0015,energy*.1)&&track.tonality[f]>.35&&track.pitch[f]>0&&Math.abs(Math.log2(track.pitch[f]/frequency))<.07;
    if(sustained){good=f;bad=0;}else if(++bad*dt>.06)break;
   }
   best=Math.max(best,Math.min(limit-n.time,good*dt-n.time));
  }
  if(best>=.45){n.duration=+best.toFixed(3);heldUntil=n.time+n.duration;}
 }
 return out;
}
// A shared head-count budget for each difficulty keeps different song lengths
// comparable. Silence and a single sustained tone are not extra note sources.
const DENSITY_RATES={easy:1.8,normal:2.6,hard:3.8,insane:7,impossible:9};
// Drum transients need no settled pitch: kicks can sit below the melody bands,
// while snares/hats are broadband. Compare local flux and reject release edges.
function percussionAttacks(tracks,dt){
 const found=[];
 for(let band=0;band<tracks.length;band++){
  const track=tracks[band],max=track.flux.reduce((a,b)=>Math.max(a,b),0);let last=-Infinity;
  for(let i=3;i<track.flux.length-3;i++){
   const rise=track.flux[i],energy=track.energy[i];if(rise<.0004||rise<max*.025||energy<.002||rise<energy*.10||rise<track.flux[i-1]||rise<=track.flux[i+1]||band===0&&(track.tonality?.[i+2]??1)<.45)continue;
   let sum=0,count=0;for(let j=Math.max(0,i-8);j<=Math.min(track.flux.length-1,i+8);j++)if(Math.abs(j-i)>1){sum+=track.flux[j];count++;}
   let before=0,beforeCount=0,after=0;for(let j=Math.max(0,i-6);j<=i-2;j++){before+=track.energy[j];beforeCount++;}for(let j=i+1;j<=i+3;j++)after+=track.energy[j]/3;
   if(rise<(sum/Math.max(1,count))*(band===0?1.9:1.65)||after<before/Math.max(1,beforeCount)*1.45||track.energy[i+2]<track.energy[i-2]*1.05)continue;
   const time=+(i*dt).toFixed(3);if(time-last<.055)continue;
   found.push({time,strength:rise/Math.max(.00001,max),lane:[0,2,3][band],source:'drum'});last=time;
  }
 }
 found.sort((a,b)=>a.time-b.time||b.strength-a.strength);const out=[];
 for(const event of found){const previous=out.at(-1);if(previous&&event.time-previous.time<.035){if(event.strength>previous.strength)out[out.length-1]=event;}else out.push(event);}
 return out;
}
function balanceDensity(notes,attacks,duration,difficulty='normal'){
 const rate=DENSITY_RATES[difficulty]||DENSITY_RATES.normal,target=Math.round(Math.max(0,duration)*rate),lower=Math.floor(target*.85),upper=Math.ceil(target*1.25);
 let out=notes.map(n=>({...n}));
 if(!out.length||!target)return out;
 const groups=[];for(const n of out){let group=groups.at(-1);if(!group||Math.abs(group[0].time-n.time)>.001)groups.push(group=[]);group.push(n);}
 if(out.length>upper){
  const windows=new Map();for(const group of groups){const key=Math.floor(group[0].time/8);if(!windows.has(key))windows.set(key,[]);windows.get(key).push(group);}
  const kept=[];let spent=0,processed=0;
  for(const window of windows.values()){
   const count=window.reduce((sum,g)=>sum+g.length,0);processed+=count;
   const budget=Math.round(target*processed/out.length)-spent,chosen=new Set();let cost=0;
   // Preserve sustained voices, then cover the whole phrase rather than taking
   // only its beginning or stripping every quiet section.
   for(let i=0;i<window.length;i++)if(window[i].some(n=>n.duration>.05)){chosen.add(i);cost+=window[i].length;}
   const average=count/window.length,slots=Math.max(1,Math.floor((budget-cost)/average));
   for(let j=0;j<slots;j++){const i=Math.min(window.length-1,Math.floor((j+.5)*window.length/slots));if(!chosen.has(i)&&cost+window[i].length<=budget){chosen.add(i);cost+=window[i].length;}}
   for(let i=0;i<window.length&&cost<budget;i++)if(!chosen.has(i)&&cost+window[i].length<=budget){chosen.add(i);cost+=window[i].length;}
   for(const i of [...chosen].sort((a,b)=>a-b))kept.push(...window[i]);spent+=cost;
  }
  out=kept;
 }
 if(out.length>=lower||groups.length<8)return out;
 const recovery={easy:.22,normal:.18,hard:.14,insane:.105,impossible:.105}[difficulty]||.18;
 // Keep every added attack outside the 40ms chord-snap window, including on
 // Impossible, so it remains an independent rhythmic press after saving.
 const headGap={easy:.30,normal:.20,hard:.12,insane:.065,impossible:.055}[difficulty]||.20;
 const lanes=Array.from({length:4},(_,lane)=>out.filter(n=>n.lane===lane)),heads=out.map(n=>n.time).sort((a,b)=>a-b);
 const index=(list,time,get=n=>n.time)=>{let a=0,b=list.length;while(a<b){const m=(a+b)>>>1;if(get(list[m])<time)a=m+1;else b=m;}return a;};
 function free(lane,time){const list=lanes[lane],i=index(list,time),before=list[i-1],after=list[i];return (!before||time>=before.time+Math.max(.035,before.duration||0)+recovery-1e-9)&&(!after||time+recovery<=after.time+1e-9);}
 function add(time,lane){const n={time,lane,duration:0};lanes[lane].splice(index(lanes[lane],time),0,n);heads.splice(index(heads,time,n=>n),0,time);out.push(n);}
 const queues=new Map();for(const a of attacks)if(a.time>=.35&&a.time<=duration){const key=Math.floor(a.time/8);if(!queues.has(key))queues.set(key,[]);queues.get(key).push(a);}
 for(const list of queues.values())list.sort((a,b)=>(b.strength||0)-(a.strength||0)||a.time-b.time);
 const candidates=[];for(let i=0,remaining=true;remaining;i++){remaining=false;for(const list of queues.values())if(i<list.length){candidates.push(list[i]);remaining=true;}}
 for(const a of candidates){
  if(out.length>=target)break;
  const at=index(heads,a.time,n=>n);if(at&&a.time-heads[at-1]<headGap||at<heads.length&&heads[at]-a.time<headGap)continue;
  const lane=[a.lane,0,1,2,3].find(l=>Number.isInteger(l)&&l>=0&&l<4&&free(l,a.time));if(lane!==undefined)add(a.time,lane);
 }
 // An unsupported density target stays underfilled. Adding a second lane at
 // an existing head increases chord size rather than rhythmic complexity.
 return out.sort((a,b)=>a.time-b.time||a.lane-b.lane);
}
// Add-only Impossible gap filling. Existing timing, lanes, chords and hold
// releases are immutable; activity is measured locally, not by song totals.
function fillImpossibleGaps(notes,analysis){
 const out=notes.map(n=>({...n}));if(!out.length&&!analysis?.percussion?.length)return out;
 const {env=[],dt=0,bpm=120,peaks=[],percussion=[],offset=0}=analysis||{},duration=Number(analysis?.duration)||env.length*dt;
 if(!(dt>0&&duration>0&&env.length))return out;
 const tempo=Math.max(45,Math.min(220,Number(bpm)||120)),beat=60/tempo,slow=tempo<=115,lanes=Array.from({length:4},(_,lane)=>out.filter(n=>n.lane===lane).sort((a,b)=>a.time-b.time)),heads=[...new Set(out.map(n=>n.time))].sort((a,b)=>a-b);
 const index=(list,t,get=n=>n.time)=>{let a=0,b=list.length;while(a<b){const m=(a+b)>>>1;if(get(list[m])<t)a=m+1;else b=m;}return a;};
 const maxEnergy=env.reduce((a,b)=>Math.max(a,b),0),floor=Math.max(.003,maxEnergy*.015);
 const audible=t=>{const frame=Math.round((t+offset)/dt);let energy=0,count=0;for(let f=Math.max(0,frame-1);f<=Math.min(env.length-1,frame+1);f++){energy+=env[f];count++;}return count&&energy/count>=floor;};
 const free=(lane,t)=>{const list=lanes[lane],at=index(list,t),before=list[at-1],after=list[at];return (!before||t>=before.time+Math.max(.035,before.duration||0)+.105-1e-9)&&(!after||t+.105<=after.time+1e-9);};
 let previousLane=-1;
 function add(t,preferred,source,activity=5){
  t=+t.toFixed(3);if(t<.35||t>duration-.05||out.length>=30000||!audible(t))return;
  const at=index(heads,t,n=>n),before=heads[at-1],after=heads[at];
  const separation=source==='drum'?.045:.055;
  if(before!==undefined&&t-before<separation||after!==undefined&&after-t<separation)return;
  const local=index(heads,t+.35,n=>n)-index(heads,t-.35,n=>n);
  if(source!=='drum'&&local>=activity&&before!==undefined&&after!==undefined&&after-before<=(slow?.14:.22))return;
  const choices=[0,1,2,3].filter(l=>free(l,t));choices.sort((a,b)=>(a===previousLane?8:0)+(Math.floor(a/2)===Math.floor(previousLane/2)?2:0)+Math.abs(a-preferred)*.1-((b===previousLane?8:0)+(Math.floor(b/2)===Math.floor(previousLane/2)?2:0)+Math.abs(b-preferred)*.1));
  if(!choices.length)return;const lane=choices[0],n={time:t,lane,duration:0,fillSource:source};out.push(n);lanes[lane].splice(index(lanes[lane],t),0,n);heads.splice(at,0,t);previousLane=lane;
 }
 // Preserve important drum moments even when melody density is already high.
 for(const p of percussion)add(p.time-offset,p.lane,'drum');
 for(const p of peaks)add(p.time-offset,Number.isInteger(p.lane)?p.lane:1,'attack',slow?8:5);
 const anchors=[...peaks,...percussion].filter(p=>Number.isFinite(p.time)&&p.time>=.35).map(p=>p.time-offset).sort((a,b)=>a-b);
 if(anchors.length>=6&&anchors.at(-1)-anchors[0]>=beat*2){
  const sample=Array.from({length:Math.min(256,anchors.length)},(_,i)=>anchors[Math.floor(i*anchors.length/Math.min(256,anchors.length))]);let fit={score:0,phase:0,parts:4};
  for(const parts of [4,3])for(const phase of sample.slice(0,12)){
   const step=beat/parts,tolerance=Math.min(.028,step*.22),score=sample.filter(t=>Math.abs((t-phase)/step-Math.round((t-phase)/step))*step<=tolerance).length/sample.length;
   if(score>fit.score)fit={score,phase,parts};
  }
  if(fit.score>=.65){
   const roll=[0,2,1,3],firstBar=Math.floor((.35-fit.phase)/(beat*4)),lastBar=Math.floor((duration-.05-fit.phase)/(beat*4));
   for(let bar=firstBar;bar<=lastBar;bar++){
    const triplet=fit.parts===3||slow&&((bar%4)+4)%4===3;
    let parts=triplet?6:slow?8:4;
    if(slow&&!triplet&&((bar%4)+4)%4===1&&beat/(parts*2)>=.06)parts*=2;
    while(beat/parts>.14)parts*=2;if(triplet&&slow&&beat/12>=.06)parts=12;
    const step=beat/parts,start=fit.phase+bar*beat*4,activity=slow?Math.max(7,Math.ceil(.7/step)):5;
    for(let tick=0;tick<parts*4;tick++)add(start+tick*step,roll[tick%4],triplet?'triplet':slow?'double-time':'sixteenth',activity);
   }
  }
 }
 return out.sort((a,b)=>a.time-b.time||a.lane-b.lane);
}
// Collapse only a compact group of distinct lanes; never chain an entire run.
function snapCloseNotes(notes){
 const out=notes.map(n=>({...n})),ends=[-Infinity,-Infinity,-Infinity,-Infinity];
 for(let start=0;start<out.length;){
  const anchor=out[start].time,lanes=new Set([out[start].lane]);let end=start+1;
  while(end<out.length&&out[end].time-anchor<=CHORD_WINDOW+1e-9&&!lanes.has(out[end].lane)){lanes.add(out[end].lane);end++;}
  const merged=[];let shifted=false;
  for(let i=start;i<end;i++){
   const n=out[i];
   if(anchor>=ends[n.lane]-.001&&(!n.softChord||Math.abs(n.time-anchor)<=1e-9)){
    const delta=n.time-anchor;
    if(delta>1e-9){if(n.duration>.05)n.duration+=delta;n.time=anchor;shifted=true;}
    merged.push(n);
   }
   ends[n.lane]=n.time+Math.max(.035,n.duration||0);
  }
  if(shifted&&merged.length>1)for(const n of merged)n.softChord=true;
  start=end;
 }
 return out.sort((a,b)=>a.time-b.time||a.lane-b.lane);
}
function analyzeLegacy(samples,rate,difficulty='normal',{densityMultiplier=2}={}){
 const impossible=difficulty==='impossible',insane=difficulty==='insane'||impossible,hop=insane?128:256,env=[];for(let i=0;i<samples.length;i+=hop){let e=0;for(let j=i;j<Math.min(i+hop,samples.length);j++)e+=samples[j]*samples[j];env.push(Math.sqrt(e/hop));}
 const dt=hop/rate,energyFlux=env.map((e,i)=>Math.max(0,e-(env[i-1]||0))),spectralFlux=[],pitch=[],melodicFlux=[],tonality=[],melodicEnergy=[],bands=impossible?Array.from({length:4},()=>({flux:[],energy:[],pitch:[],tonality:[]})):[],drums=impossible?Array.from({length:3},()=>({flux:[],energy:[],tonality:[]})):[];let prev=new Float64Array(512);
 for(let frame=0;frame<env.length;frame++){
  const mag=spectrum(samples,frame*hop-512);let rise=0,melodyRise=0,peak=0,bin=0;
  for(let k=6;k<Math.min(400,mag.length-1);k++){rise+=Math.max(0,mag[k]-prev[k]);if(k>=12&&k<=185&&mag[k]>=mag[k-1]&&mag[k]>mag[k+1]){const score=mag[k]*Math.pow(k,.3);if(score>peak){peak=score;bin=k;}}}
  let bandEnergy=0;for(let k=12;k<=185;k++){
   bandEnergy+=mag[k];
   // Tolerate small frequency drift: vibrato is not a new note attack.
   melodyRise+=Math.max(0,mag[k]-Math.max(prev[k-1],prev[k],prev[k+1]));
  }
  let tonalEnergy=0;for(let k=Math.max(12,bin-1);k<=Math.min(185,bin+1);k++)tonalEnergy+=mag[k];
  tonality.push(tonalEnergy/Math.max(.00001,bandEnergy));melodicEnergy.push(bandEnergy);
  let frequency=bin*rate/1024;if(bin>0){const a=mag[bin-1],b=mag[bin],c=mag[bin+1],den=a-2*b+c;if(den)frequency=(bin+Math.max(-.5,Math.min(.5,.5*(a-c)/den)))*rate/1024;}
  let tonalRise=0;for(let k=Math.max(12,bin-1);k<=Math.min(185,bin+1);k++)tonalRise+=Math.max(0,mag[k]-Math.max(prev[k-1],prev[k],prev[k+1]));
  if(impossible)for(let band=0;band<4;band++){
   const [lo,hi]=ATTACK_BANDS[band];let energy=0,rise=0,peakBin=lo;
   for(let k=lo;k<hi;k++){energy+=mag[k];rise+=Math.max(0,mag[k]-Math.max(prev[k-1]||0,prev[k],prev[k+1]||0));if(mag[k]>mag[peakBin])peakBin=k;}
   const track=bands[band];track.flux.push(rise);track.energy.push(energy);track.pitch.push(peakBin*rate/1024);track.tonality.push((mag[peakBin-1]+mag[peakBin]+mag[peakBin+1])/Math.max(.00001,energy));
  }
  if(impossible)for(let band=0;band<3;band++){
   const [lo,hi]=[[2,22],[22,120],[120,500]][band];let energy=0,rise=0,peakBin=lo;
   for(let k=lo;k<Math.min(hi,mag.length);k++){energy+=mag[k];rise+=Math.max(0,mag[k]-prev[k]);if(mag[k]>mag[peakBin])peakBin=k;}
   drums[band].energy.push(energy);drums[band].flux.push(rise);drums[band].tonality.push((mag[peakBin-1]+mag[peakBin]+mag[peakBin+1])/Math.max(.00001,energy));
  }
  melodicFlux.push(insane?tonalRise:melodyRise);spectralFlux.push(rise);pitch.push(insane?frequency:bin*rate/1024);prev=mag;
 }
 const maxEnergy=Math.max(.00001,...energyFlux.slice(0,60000)),maxSpectral=Math.max(.00001,...spectralFlux.slice(0,60000));
 const flux=env.map((_,i)=>.55*energyFlux[i]/maxEnergy+.45*spectralFlux[i]/maxSpectral),raw=[];
 for(let i=2;i<flux.length-2;i++){let sum=0,count=0;for(let j=Math.max(0,i-12);j<=Math.min(flux.length-1,i+12);j++){sum+=flux[j];count++;}if(!(env[Math.min(env.length-1,i+2)]<env[Math.max(0,i-2)]*.65&&energyFlux[i]<maxEnergy*.08)&&env[i]>.002&&flux[i]>.025&&flux[i]>sum/count*1.55&&flux[i]>=flux[i-1]&&flux[i]>flux[i+1]){let snap=i;for(let j=Math.max(0,i-2);j<=Math.min(env.length-1,i+2);j++)if(energyFlux[j]>energyFlux[snap]&&energyFlux[j]>maxEnergy*.08)snap=j;raw.push({time:snap*dt,strength:flux[i],frequency:pitch[Math.min(pitch.length-1,snap+2)]});}}
 // Follow audible attacks even when several instruments obscure the pitch.
 // Only pitch-change-only events require a settled tone.
 if(insane){
  const rhythmAttacks=raw.slice();raw.length=0;
  const maxMelody=melodicFlux.reduce((a,b)=>Math.max(a,b),.00001);
  const stable=(a,b)=>a>0&&b>0&&Math.abs(Math.log2(a/b))<.045;
  for(let i=5;i<env.length-5;i++){
   if(env[i+2]<.004||env[i+3]<env[i-3]*.8)continue;
   let baseline=0;for(let j=i-5;j<=i+5;j++)baseline+=melodicFlux[j]/11;
   const novelty=melodicFlux[i],after=pitch[i+4],before=pitch[i-3];
   const tonal=tonality[i+3]>.055&&tonality[i+4]>.055;
   const settled=stable(pitch[i+3],after)&&stable(pitch[i+5],after);
   const changed=stable(pitch[i-4],before)&&stable(pitch[i-2],before)&&before>0&&after>0&&Math.abs(Math.log2(after/before))>.09;
   const peak=novelty>=melodicFlux[i-1]&&novelty>melodicFlux[i+1];
   const attack=novelty>maxMelody*.012&&novelty>baseline*1.6&&novelty/Math.max(.00001,melodicEnergy[i])>.05;
   if(tonal&&peak&&(attack||(settled&&changed&&novelty>maxMelody*.012&&novelty>baseline*1.4))){
    // Anchor to the audible attack, not to a guessed BPM subdivision.
    let frame=i;
    if(energyFlux[i]>maxEnergy*.08){for(let j=i-1;j<=i+1;j++)if(energyFlux[j]>energyFlux[frame])frame=j;}
    raw.push({time:frame*dt,strength:novelty/maxMelody,frequency:after});
   }
  }
  // Strong volume attacks remain playable when chords mask any one pitch.
  // This adds detected music events, never notes on an invented beat grid.
  const attackGap=impossible?.045:.065,lookup=attackLookup(raw,attackGap);
  for(const p of rhythmAttacks){
   const frame=Math.round(p.time/dt),rise=energyFlux[frame];
   if(rise>Math.max(.003,env[Math.max(0,frame-1)]*.35)&&!lookup.hasNear(p.time)){raw.push(p);lookup.add(p);}
  }

 }
 if(impossible){const busy=busiestAttacks(bands,dt),lookup=attackLookup(raw,.05);for(const p of busy)if(!lookup.hasNear(p.time))raw.push(p);}
 raw.sort((a,b)=>a.time-b.time);const peaks=[];for(const p of raw){const previous=peaks[peaks.length-1];if(previous&&p.time-previous.time<(impossible?.032:insane?.055:.075)){if(p.strength>previous.strength)peaks[peaks.length-1]=p;}else peaks.push(p);}
 let bpm=120,best=0;for(let b=75;b<=180;b++){let real=0,imag=0;for(const p of peaks){const phase=2*Math.PI*p.time*b/60;real+=p.strength*Math.cos(phase);imag+=p.strength*Math.sin(phase);}const score=real*real+imag*imag;if(score>best){best=score;bpm=b;}}
 const gap={easy:.34,normal:.24,hard:.15,insane:.065,impossible:.04}[difficulty]||.24,selected=[];
 for(const p of peaks){if(p.time<.35)continue;const previous=selected[selected.length-1];if(previous&&p.time-previous.time<gap){if(p.strength>previous.strength)selected[selected.length-1]=p;}else selected.push(p);}
 const frequencies=selected.map(p=>p.frequency).filter(f=>f>0).sort((a,b)=>a-b),low=frequencies[Math.floor(frequencies.length*.1)]||130,high=frequencies[Math.floor(frequencies.length*.9)]||1000;
 const aligned=insane?alignAttacks(samples,rate,selected):selected;
 const timed=impossible?slowRhythm(aligned,bpm,env,dt):aligned;
 let notes=timed.map(p=>({time:+p.time.toFixed(3),lane:p.frequency>0?Math.max(0,Math.min(3,Math.round(3*Math.log2(p.frequency/low)/Math.max(.5,Math.log2(high/low))))):1,duration:0}));
 if(insane&&!impossible)notes=insanePatterns(spreadLanes(notes),timed);
 if(difficulty!=='easy'&&!insane)for(let i=0;i<notes.length-1;i++){const n=notes[i],space=notes[i+1].time-n.time;if(space>.65){const start=Math.floor((n.time+.12)/dt),end=Math.floor(Math.min(n.time+space-.16,n.time+1.3)/dt),slice=env.slice(start,end),freq=timed[i].frequency;if(freq>0&&slice.length&&slice.every(x=>x>.015)&&pitch.slice(start,end).filter(f=>f>0&&Math.abs(Math.log2(f/freq))<.18).length>slice.length*.7)n.duration=+Math.min(space-.18,1.1).toFixed(3);}}
 if(difficulty!=='easy'&&!insane)for(let i=0;i<notes.length-1;i++){const n=notes[i];let space=notes[i+1].time-n.time;if(i%7===3){if(difficulty==='normal'&&space<=.38&&notes[i+2]&&notes[i+2].time-n.time>.38){notes.splice(i+1,1);space=notes[i+1].time-n.time;}if(space>.38){n.duration=+Math.min(.75,space-.08).toFixed(3);}}}
 if(impossible)notes=impossiblePatterns(spreadLanes(notes),timed,bpm);
 if(difficulty==='hard'){const extra=[];for(let i=0;i<notes.length;i++){const n=notes[i];if(i%4===1&&!n.duration)extra.push({time:n.time,lane:(n.lane+2)%4,duration:0});}notes.push(...extra);notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);}
 // The lower tiers retain their existing midpoint tap. Impossible's other
 // voices are already mapped above and receive no hold-triggered filler.
 if(difficulty!=='easy'&&!impossible){
  const extra=[],original=[...notes];
  const all=()=>[...original,...extra];
  const free=(lane,time)=>all().every(n=>{
   if(n.lane!==lane)return true;
   const end=n.time+Math.max(.035,n.duration||0);
   return time>=end+.105||time+.105<=n.time;
  });
  for(const hold of original){
   if(!(hold.duration>=.42))continue;
   const times=[];
   times.push(+(hold.time+hold.duration*.52).toFixed(3));
   const lanes=[(hold.lane+2)%4,(hold.lane+1)%4,(hold.lane+3)%4];
   for(let j=0;j<times.length;j++){
    const at=times[j],choices=[...lanes.slice(j%3),...lanes.slice(0,j%3)];
    const lane=choices.find(l=>free(l,at));
    if(lane!==undefined)extra.push({time:at,lane,duration:0});
   }
  }
  if(extra.length){notes.push(...extra);notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);}
 }
 const densityAttacks=peaks.map(p=>({time:+p.time.toFixed(3),lane:p.frequency>0?Math.max(0,Math.min(3,Math.round(3*Math.log2(p.frequency/low)/Math.max(.5,Math.log2(high/low))))):1,strength:p.strength}));
 notes=balanceDensity(notes,densityAttacks,samples.length/rate,difficulty);
 if(impossible)notes=impossibleHolds(notes,bands,dt,samples.length/rate);
 notes=snapCloseNotes(notes);
 const percussion=impossible?percussionAttacks(drums,dt):[];
 if(impossible)notes=fillImpossibleGaps(notes,{bpm,peaks,percussion,env,dt,duration:samples.length/rate});
 const musicEvents=[];
 for(let i=3;i<env.length-3;i++)if(env[i]>.003&&env[i+2]>=env[i-2]*.7&&spectralFlux[i]>=spectralFlux[i-1]&&spectralFlux[i]>spectralFlux[i+1]&&spectralFlux[i]>maxSpectral*.008){
  let mean=0;for(let j=i-3;j<=i+3;j++)mean+=spectralFlux[j]/7;
  if(spectralFlux[i]>mean*1.15)musicEvents.push({time:+(i*dt).toFixed(3),frequency:pitch[i],strength:spectralFlux[i]/maxSpectral*.45});
 }
 const originalCount=notes.length;if(densityMultiplier===2)notes=doubleGeneratedNotes(notes,{bpm,peaks,percussion,env,dt,duration:samples.length/rate},difficulty);
 return {notes,bpm,peaks,percussion,env,dt,musicEvents,scanVersion:17,generation:{baseNotes:originalCount,targetNotes:originalCount*densityMultiplier,addedTaps:notes.length-originalCount},density:{targetPerSecond:(DENSITY_RATES[difficulty]||2.6)*densityMultiplier,actualPerSecond:notes.length/(samples.length/rate||1)},rhythmSubdivisions:impossible?[...timed.filter(p=>p.subdivision).map(p=>({time:p.time,type:p.subdivision})),...notes.filter(n=>['triplet','sixteenth','double-time'].includes(n.fillSource)).map(n=>({time:n.time,type:n.fillSource}))]:[]};
}
// Keep the previous chart's count as a budget only. Its hold, chord, BPM-fill
// and difficulty patterns do not supply any timing or lanes to the new chart.
function musicChart(analysis,target){
 const {env=[],dt=0,peaks=[],percussion=[],musicEvents=[]}=analysis,ceiling=env.reduce((a,b)=>Math.max(a,b),0),floor=Math.max(.0025,ceiling*.015),duration=env.length*dt;
 target=Math.max(0,Math.min(30000,Math.round(target)));if(!target||!dt||!ceiling)return [];
 const pool=[...peaks,...percussion,...musicEvents].map(p=>{
  const frame=Math.floor(p.time/dt);if((env[frame]||0)>floor)return p;
  // FFT windows can report a short transient just before its audible onset.
  for(let i=frame+1;i<=frame+Math.ceil(.04/dt);i++)if((env[i]||0)>floor)return {...p,time:+(i*dt).toFixed(3)};
  return p;
 }).filter(p=>p.time>=.35&&p.time<duration&&env[Math.floor(p.time/dt)]>floor);
 const heads=[],gap=.044;
 const index=t=>{let lo=0,hi=heads.length;while(lo<hi){const mid=(lo+hi)>>>1;if(heads[mid].time<t)lo=mid+1;else hi=mid;}return lo;};
 function add(p){const time=+p.time.toFixed(3),i=index(time);if(i&&time-heads[i-1].time<gap||i<heads.length&&heads[i].time-time<gap)return false;heads.splice(i,0,{...p,time});return true;}
 // First cover audible phrases with their strongest attacks, then their details.
 const phrases=new Map();for(const p of pool){const key=Math.floor(p.time/4);if(!phrases.has(key))phrases.set(key,[]);phrases.get(key).push(p);}
 for(const list of phrases.values())list.sort((a,b)=>(b.strength||0)-(a.strength||0)||a.time-b.time);
 for(let i=0,remaining=true;remaining&&heads.length<target;i++){remaining=false;for(const list of phrases.values())if(i<list.length){remaining=true;if(heads.length<target)add(list[i]);}}
 // Subdivide the measured gaps between attacks, following their local spacing
 // and audio envelope. There is no global beat grid or compulsory triplet fill.
 const heap=[];
 function offer(left,right){
  if(right.time-left.time<gap*2)return;
  let best=null;for(let i=Math.ceil((left.time+gap)/dt);i*dt<=right.time-gap;i++){
   const energy=env[i]||0;if(energy<=floor||(env[i-1]||0)<=floor||(env[i+1]||0)<=floor)continue;
   const time=i*dt,room=Math.min(time-left.time,right.time-time),score=room*Math.sqrt(energy/ceiling);
   if(!best||score>best.score)best={time:+time.toFixed(3),frequency:(left.frequency||right.frequency||440),strength:0,score,left,right};
  }
  if(!best)return;let i=heap.length;heap.push(best);while(i){const parent=(i-1)>>>1;if(heap[parent].score>=best.score)break;heap[i]=heap[parent];i=parent;}heap[i]=best;
 }
 function pop(){const best=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].score>heap[child].score)child++;if(heap[child].score<=last.score)break;heap[i]=heap[child];i=child;}heap[i]=last;}return best;}
 if(heads.length<target){for(let i=1;i<heads.length;i++)offer(heads[i-1],heads[i]);while(heap.length&&heads.length<target){const p=pop();if(add(p)){offer(p.left,p);offer(p,p.right);}}}
 const frequencies=heads.map(p=>p.frequency).filter(f=>f>0).sort((a,b)=>a-b),low=frequencies[Math.floor(frequencies.length*.1)]||130,high=frequencies[Math.floor(frequencies.length*.9)]||1000;
 const notes=heads.map(p=>({time:p.time,lane:p.frequency>0?Math.max(0,Math.min(3,Math.round(3*Math.log2(p.frequency/low)/Math.max(.5,Math.log2(high/low))))):1,duration:0}));
 const mapped=spreadLanes(notes);
 // A short isolated drum hit may have no audible room for a second timing.
 // Preserve the total with a two-note accent on that actual attack instead
 // of placing a filler note in the following silence. Never build larger chords.
 if(mapped.length<target){
  const accents=heads.map((p,i)=>({p,n:mapped[i]})).filter(x=>x.p.strength>0).sort((a,b)=>b.p.strength-a.p.strength||a.p.time-b.p.time);
  const laneNotes=Array.from({length:4},(_,lane)=>mapped.filter(n=>n.lane===lane));
  for(const {n} of accents){if(mapped.length>=target)break;
   const lane=[(n.lane+2)%4,(n.lane+3)%4,(n.lane+1)%4].find(l=>laneNotes[l].every(other=>Math.abs(other.time-n.time)>=.16));
   if(lane!==undefined){const accent={time:n.time,lane,duration:0};mapped.push(accent);laneNotes[lane].push(accent);}
  }
 }
 return mapped.sort((a,b)=>a.time-b.time||a.lane-b.lane);
}
function analyze(samples,rate,difficulty='normal',options={}){
 const analysis=analyzeLegacy(samples,rate,difficulty,options),target=analysis.notes.length;
 const notes=musicChart(analysis,target);
 return {...analysis,notes,scanVersion:18,patternStyle:'music',generation:{targetNotes:target,actualNotes:notes.length},rhythmSubdivisions:[],density:{...analysis.density,actualPerSecond:notes.length/(samples.length/rate||1)}};
}
// Expand only after the original holds/chords have been finalized. Every new
// head is a single tap outside the chord window; existing notes are immutable.
function doubleGeneratedNotes(notes,{peaks=[],percussion=[],env=[],dt,bpm=120,duration=0}={},difficulty='normal'){
 const out=notes.map(n=>({...n})),target=Math.min(30000,notes.length*2);
 if(!notes.length||!(dt>0)||!env.length)return out;
 const index=(list,time,get=n=>n.time)=>{let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>>1;if(get(list[mid])<time)lo=mid+1;else hi=mid;}return lo;};
 const heads=out.map(n=>n.time).sort((a,b)=>a-b),lanes=Array.from({length:4},(_,lane)=>out.filter(n=>n.lane===lane).sort((a,b)=>a.time-b.time));
 const recovery={easy:.14,normal:.12,hard:.10,insane:.085,impossible:.075}[difficulty]||.12;
 const ceiling=env.reduce((a,b)=>Math.max(a,b),0),floor=Math.max(.003,ceiling*.02),beat=60/Math.max(40,Math.min(240,bpm));
 const audible=time=>{const i=Math.floor(time/dt);return time>=.35&&time<duration-.03&&(env[i]||0)>floor;};
 const free=(lane,time)=>{const list=lanes[lane],i=index(list,time),a=list[i-1],b=list[i];return (!a||time>=a.time+Math.max(.035,a.duration||0)+recovery)&&(!b||time+recovery<=b.time);};
 function add(time,preferred=0){
  time=+time.toFixed(3);if(!audible(time)||out.length>=target)return;
  const i=index(heads,time,n=>n);if(i&&time-heads[i-1]<=CHORD_WINDOW+.002||i<heads.length&&heads[i]-time<=CHORD_WINDOW+.002)return;
  const choices=[0,1,2,3].filter(l=>free(l,time));
  // Rotate hands and give the busiest finger recovery time.
  choices.sort((a,b)=>{const score=l=>{const list=lanes[l],j=index(list,time),previous=list[j-1];return (previous?previous.time:-10)+(l===preferred?-.025:0);};return score(a)-score(b);});
  const lane=choices[0];if(lane===undefined)return;
  const n={time,lane,duration:0};lanes[lane].splice(index(lanes[lane],time),0,n);heads.splice(i,0,time);out.push(n);
 }
 // Spread selections across phrases rather than spending the quota at the start.
 function distribute(pool){const groups=new Map();for(const p of pool){const key=Math.floor(p.time/4);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}for(const list of groups.values())list.sort((a,b)=>(b.strength||0)-(a.strength||0)||a.time-b.time);for(let i=0,remaining=true;remaining&&out.length<target;i++){remaining=false;for(const list of groups.values())if(i<list.length){remaining=true;add(list[i].time,list[i].lane);}}}
 distribute([...peaks,...percussion]);
 // Extra rhythmic subdivisions are supported only inside active musical phrases.
 // A lone held tone or silent section cannot become a generated stream.
 const events=peaks.map(p=>p.time).sort((a,b)=>a-b),anchor=peaks.reduce((a,b)=>(b.strength||0)>(a.strength||0)?b:a,peaks[0]||{time:0}).time;
 for(const division of [2,4,3,6,8]){
  const step=beat/division;if(step<=CHORD_WINDOW+.002)continue;
  const pool=[];for(let t=anchor+Math.ceil((.35-anchor)/step)*step;t<duration;t+=step){
   const left=index(events,t-beat*2,n=>n),right=index(events,t+beat*2,n=>n);if(right-left<4||!audible(t))continue;
   // Require surrounding activity, not just a transient's fading release.
   const i=Math.floor(t/dt),radius=Math.max(1,Math.floor(Math.min(.08,step*.4)/dt));
   if((env[i-radius]||0)<=floor||(env[i+radius]||0)<=floor)continue;
   pool.push({time:t,strength:env[i]||0});
  }
  distribute(pool);if(out.length>=target)break;
 }
 return out.sort((a,b)=>a.time-b.time||a.lane-b.lane);
}
// The speed setting is shared by every difficulty and chart. Density and
// same-lane spacing must never override the player's chosen travel time.
function scrollTravel(notes,requested=1.8,difficulty='normal'){
 return Number.isFinite(requested)&&requested>0?requested:1.8;
}
function missDamage(difficulty='normal'){return {easy:8,normal:12,hard:20,insane:34,impossible:50}[difficulty]||12;}
function nextHealth(health,result,difficulty='normal',maxHealth=100){return Math.max(0,Math.min(maxHealth,health+(result==='MISS'?-missDamage(difficulty):result==='PERFECT'?2:result==='GREAT'?1:0)));}
function validateChart(data,duration,{snap=true}={}){if(!data||!Array.isArray(data.notes)||data.notes.length>30000)throw Error('Choose a chart JSON containing a notes array (up to 30,000 notes).');const notes=data.notes.map(n=>{if(!Number.isFinite(n.time)||n.time<0||n.time>duration||!Number.isInteger(n.lane)||n.lane<0||n.lane>3||!Number.isFinite(n.duration??0)||(n.duration??0)<0||n.time+(n.duration??0)>duration+.01)throw Error('Notes need a valid time, lane 0–3, and duration within the song.');const out={time:n.time,lane:n.lane,duration:n.duration||0};if(n.softChord===true)out.softChord=true;return out;}).sort((a,b)=>a.time-b.time||a.lane-b.lane);const ends=[-1,-1,-1,-1];for(const n of notes){const lanes=[n.lane];if(lanes.some(l=>n.time<ends[l]-.001))throw Error('Notes cannot overlap in the same lane.');for(const l of lanes)ends[l]=n.time+Math.max(.035,n.duration);}return snap?snapCloseNotes(notes):notes;}
// All simultaneous chart notes, including snapped heads, share chord glow.
function markChords(notes){for(const n of notes)delete n.chord;for(let start=0;start<notes.length;){let end=start+1;while(end<notes.length&&Math.abs(notes[end].time-notes[start].time)<=.001)end++;if(new Set(notes.slice(start,end).map(n=>n.lane)).size>1)for(let i=start;i<end;i++)notes[i].chord=true;start=end;}return notes;}
function rank(counts,total,complete=true){if(!complete)return 'RETRY';if(total>0&&counts.PERFECT===total&&!(counts.GREAT||counts.GOOD||counts.MISS))return 'S';const judged=(counts.PERFECT||0)+(counts.GREAT||0)+(counts.GOOD||0)+(counts.MISS||0),accuracy=judged?100*((counts.PERFECT||0)+.8*(counts.GREAT||0)+.5*(counts.GOOD||0))/judged:0;return accuracy>=90?'A':accuracy>=80?'B':accuracy>=65?'C':'D';}
function holdCue(note,time){if(!note||note.duration<=.05||note.result)return null;const remaining=Math.max(0,note.time+note.duration-time);return {phase:remaining>0?'HOLD':'RELEASE',remaining,progress:Math.min(1,remaining/note.duration)};}
function noteIndex(notes,time){let lo=0,hi=notes.length;while(lo<hi){const mid=(lo+hi)>>>1;if(notes[mid].time<time)lo=mid+1;else hi=mid;}return lo;}
function pendingIndex(notes,start=0){while(start<notes.length&&(notes[start].result||notes[start].started))start++;return start;}
function nextPlayable(notes,lane,time,start=0){
 let best=null,bestDelta=Infinity,before=start,previousTime=-Infinity;
 for(let i=start;i<notes.length;i++){
  const candidate=notes[i];if(candidate.time>time+HIT_WINDOW)break;if(candidate.result||candidate.started)continue;
  if(candidate.lane!==lane)continue;
  const delta=Math.abs(candidate.time-time);if(delta>HIT_WINDOW||delta>=bestDelta)continue;
  while(before<i&&notes[before].time<candidate.time-.001){const earlier=notes[before++];if(earlier.lane===lane&&!earlier.result&&!earlier.started)previousTime=earlier.time;}
  if(previousTime>=time||time-previousTime<=delta+1e-9)continue;
  best=candidate;bestDelta=delta;
 }
 return best;
}
function judgement(delta){delta=Math.abs(delta);return delta<=.12?'PERFECT':delta<=.155?'GREAT':delta<=HIT_WINDOW?'GOOD':null;}
const api={MAX_LIFE:200,doubleGeneratedNotes,attackLookup,noteIndex,pendingIndex,nextPlayable,missDamage,busiestAttacks,slowRhythm,impossiblePatterns,impossibleHolds,balanceDensity,fillImpossibleGaps,percussionAttacks,DENSITY_RATES,insanePatterns,alignAttacks,spreadLanes,scrollTravel,musicChart,analyzeLegacy,analyze,validateChart,snapCloseNotes,judgement,nextHealth,HIT_WINDOW,CHORD_WINDOW,simultaneousHeads,markChords,rank,holdCue};if(typeof module!=='undefined')module.exports=api;root.RhythmEngine=api;
})(typeof window!=='undefined'?window:globalThis);
