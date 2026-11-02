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
function analyze(samples,rate,difficulty='normal'){
 const impossible=difficulty==='impossible',insane=difficulty==='insane'||impossible,hop=insane?128:256,env=[];for(let i=0;i<samples.length;i+=hop){let e=0;for(let j=i;j<Math.min(i+hop,samples.length);j++)e+=samples[j]*samples[j];env.push(Math.sqrt(e/hop));}
 const dt=hop/rate,energyFlux=env.map((e,i)=>Math.max(0,e-(env[i-1]||0))),spectralFlux=[],pitch=[],melodicFlux=[],tonality=[],melodicEnergy=[],bands=impossible?Array.from({length:4},()=>({flux:[],energy:[],pitch:[],tonality:[]})):[];let prev=new Float64Array(512);
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
 if(difficulty!=='easy'&&(!insane||impossible))for(let i=0;i<notes.length-1;i++){const n=notes[i],space=notes[i+1].time-n.time;if(space>.65){const start=Math.floor((n.time+.12)/dt),end=Math.floor(Math.min(n.time+space-.16,n.time+1.3)/dt),slice=env.slice(start,end),freq=timed[i].frequency;if(freq>0&&slice.length&&slice.every(x=>x>.015)&&pitch.slice(start,end).filter(f=>f>0&&Math.abs(Math.log2(f/freq))<.18).length>slice.length*.7)n.duration=+Math.min(space-.18,1.1).toFixed(3);}}
 if(difficulty!=='easy'&&!insane)for(let i=0;i<notes.length-1;i++){const n=notes[i];let space=notes[i+1].time-n.time;if(i%7===3){if(difficulty==='normal'&&space<=.38&&notes[i+2]&&notes[i+2].time-n.time>.38){notes.splice(i+1,1);space=notes[i+1].time-n.time;}if(space>.38){n.duration=+Math.min(.75,space-.08).toFixed(3);}}}
 if(impossible)notes=impossiblePatterns(spreadLanes(notes),timed,bpm);
 if(difficulty==='hard'){const extra=[];for(let i=0;i<notes.length;i++){const n=notes[i];if(i%4===1&&!n.duration)extra.push({time:n.time,lane:(n.lane+2)%4,duration:0});}notes.push(...extra);notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);}
 // Add taps on free lanes during holds. Impossible frequently requires
 // multiple independent hits throughout a hold, not just one midpoint tap.
 if(difficulty!=='easy'){
  const extra=[],original=[...notes];
  const all=()=>[...original,...extra];
  const free=(lane,time)=>all().every(n=>{
   if(n.lane!==lane)return true;
   const end=n.time+Math.max(.035,n.duration||0);
   return time>=end+.105||time+.105<=n.time;
  });
  for(const hold of original){
   if(!(hold.duration>=(impossible?.30:.42)))continue;
   const times=[];
   if(impossible){
    // Fit repeated taps inside the hold, leaving room at both ends.
    for(let t=hold.time+.16;t<=hold.time+hold.duration-.12;t+=.17)times.push(+t.toFixed(3));
    if(!times.length)times.push(+(hold.time+hold.duration*.5).toFixed(3));
   }else times.push(+(hold.time+hold.duration*.52).toFixed(3));
   const lanes=[(hold.lane+2)%4,(hold.lane+1)%4,(hold.lane+3)%4];
   for(let j=0;j<times.length;j++){
    const at=times[j],choices=[...lanes.slice(j%3),...lanes.slice(0,j%3)];
    const lane=choices.find(l=>free(l,at));
    if(lane!==undefined)extra.push({time:at,lane,duration:0});
   }
  }
  if(extra.length){notes.push(...extra);notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);}
 }
 notes=snapCloseNotes(notes);
 return {notes,bpm,peaks,env,dt,scanVersion:11,rhythmSubdivisions:impossible?timed.filter(p=>p.subdivision).map(p=>({time:p.time,type:p.subdivision})):[]};
}
// Note heads occupy at most .082 of the lane height, plus a visible gap.
// Speed changes travel distance only; chart timestamps never change.
function scrollTravel(notes,requested=1.8,difficulty='normal'){
 let travel=difficulty==='impossible'?Math.min(requested,.65):difficulty==='insane'?Math.min(requested,.8):requested;
 const ends=[null,null,null,null];
 for(const n of notes){const prev=ends[n.lane];if(prev){const gap=n.time-prev.time-(prev.duration||0);if(gap>0)travel=Math.min(travel,gap/(prev.duration>.05?.065:.1));}ends[n.lane]=n;}
 return Math.max(.05,travel);
}
function missDamage(difficulty='normal'){return {easy:8,normal:12,hard:20,insane:34,impossible:50}[difficulty]||12;}
function nextHealth(health,result,difficulty='normal'){return Math.max(0,Math.min(100,health+(result==='MISS'?-missDamage(difficulty):result==='PERFECT'?2:result==='GREAT'?1:0)));}
function validateChart(data,duration,{snap=true}={}){if(!data||!Array.isArray(data.notes)||data.notes.length>30000)throw Error('Choose a chart JSON containing a notes array (up to 30,000 notes).');const notes=data.notes.map(n=>{if(!Number.isFinite(n.time)||n.time<0||n.time>duration||!Number.isInteger(n.lane)||n.lane<0||n.lane>3||!Number.isFinite(n.duration??0)||(n.duration??0)<0||n.time+(n.duration??0)>duration+.01)throw Error('Notes need a valid time, lane 0–3, and duration within the song.');const out={time:n.time,lane:n.lane,duration:n.duration||0};if(n.softChord===true)out.softChord=true;return out;}).sort((a,b)=>a.time-b.time||a.lane-b.lane);const ends=[-1,-1,-1,-1];for(const n of notes){const lanes=[n.lane];if(lanes.some(l=>n.time<ends[l]-.001))throw Error('Notes cannot overlap in the same lane.');for(const l of lanes)ends[l]=n.time+Math.max(.035,n.duration);}return snap?snapCloseNotes(notes):notes;}
function enrichImpossibleHolds(notes){
 const out=notes.map(n=>({...n})),base=[...out],extras=[];
 const occupied=(lane,t)=>[...base,...extras].some(n=>n.lane===lane&&t<n.time+Math.max(.035,n.duration||0)+.09&&t+.09>n.time);
 for(const hold of base){
  if(!(hold.duration>=.30))continue;
  let j=0;
  for(let t=hold.time+.13;t<=hold.time+hold.duration-.10;t+=.17){
   const time=+t.toFixed(3);
   const lanes=[(hold.lane+1+j)%4,(hold.lane+2+j)%4,(hold.lane+3+j)%4].filter(l=>l!==hold.lane);
   const lane=lanes.find(l=>!occupied(l,time));
   if(lane!==undefined)extras.push({time,lane,duration:0});
   j++;
  }
 }
 if(!extras.length)return notes;
 out.push(...extras);out.sort((a,b)=>a.time-b.time||a.lane-b.lane);return snapCloseNotes(out);
}
// Only actual simultaneous chart notes receive chord glow. Input leniency is separate.
function markChords(notes){for(const n of notes)delete n.chord;for(let start=0;start<notes.length;){let end=start+1;while(end<notes.length&&Math.abs(notes[end].time-notes[start].time)<=.001)end++;if(!notes.slice(start,end).some(n=>n.softChord)&&new Set(notes.slice(start,end).map(n=>n.lane)).size>1)for(let i=start;i<end;i++)notes[i].chord=true;start=end;}return notes;}
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
const api={attackLookup,noteIndex,pendingIndex,nextPlayable,missDamage,busiestAttacks,slowRhythm,impossiblePatterns,insanePatterns,alignAttacks,spreadLanes,scrollTravel,analyze,validateChart,snapCloseNotes,enrichImpossibleHolds,judgement,nextHealth,HIT_WINDOW,CHORD_WINDOW,simultaneousHeads,markChords,rank,holdCue};if(typeof module!=='undefined')module.exports=api;root.RhythmEngine=api;
})(typeof window!=='undefined'?window:globalThis);
