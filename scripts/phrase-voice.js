/* Embedded inside engine.js by the repair build; no browser imports are needed. */
function phraseVoice(notes,analysis={},difficulty='normal'){
  const original=notes.map(n=>({...n})).sort((a,b)=>a.time-b.time||a.lane-b.lane);
  if(original.length<3||difficulty==='beginner')return original;
  const bpm=Math.max(40,Number(analysis.bpm)||120),beat=60/bpm,phraseLength=beat*8;
  const templates={stream:[0,2,1,3,0,3,1,2],stairs:[0,1,2,3,2,1],roll:[0,1,3,2,1,0,2,3],trill:[0,2,0,2,1,3,1,3],split:[0,3,1,2,3,0,2,1]};
  const names=Object.keys(templates),groups=[];
  for(const n of original){let g=groups.at(-1);if(!g||Math.abs(g.time-n.time)>.001)groups.push(g={time:n.time,notes:[]});g.notes.push(n);}
  const phrases=new Map();
  for(const g of groups){const p=Math.floor(g.time/phraseLength);if(!phrases.has(p))phrases.set(p,[]);phrases.get(p).push(g);}
  const fingerprint=gs=>gs.slice(1,17).map((g,i)=>Math.min(32,Math.round((g.time-gs[i].time)/beat*8))).join(',')+'|'+gs.slice(1,9).map((g,i)=>Math.sign(g.notes[0].lane-gs[i].notes[0].lane)).join(',');
  const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;};
  const motifMemory=new Map(),ends=[-Infinity,-Infinity,-Infinity,-Infinity],lastHead=[-Infinity,-Infinity,-Infinity,-Infinity];
  const recovery={easy:.20,normal:.14,hard:.11,insane:.085,impossible:.065}[difficulty]||.14;
  let previousLane=-1,previousHand=-1,sameHand=0,previousGroupTime=-Infinity;
  const out=[];
  for(const [phrase,gs] of phrases){
    // A recurring rhythmic phrase recalls its motif instead of a random lane cycle.
    const signature=fingerprint(gs),h=hash(signature),remembered=motifMemory.get(signature);
    const style=remembered||names[h%names.length];if(!remembered)motifMemory.set(signature,style);
    const pattern=templates[style],mirror=(h>>>8)&1;
    for(let gi=0;gi<gs.length;gi++){
      const g=gs[gi],time=g.time,count=g.notes.length;
      let desired=pattern[gi%pattern.length];if(mirror)desired=3-desired;
      if(difficulty==='easy')desired=gi%2?(desired<2?2:1):g.notes[0].lane;
      // Solve a whole chord together; independent reassignment caused overlaps.
      let best=null,bestScore=Infinity;
      function assign(index,used,lanes,score){
        if(index===count){if(score<bestScore){bestScore=score;best=lanes.slice();}return;}
        const note=g.notes[index];
        for(let lane=0;lane<4;lane++){
          if(used.has(lane)||time<ends[lane]-.000001)continue;
          const hand=lane<2?0:1,age=time-lastHead[lane],target=index===0?desired:(desired+2)%4;
          const s=score+(lane===target?0:1.6)+Math.abs(lane-note.lane)*.22+(age<recovery?(recovery-age)*70:0)+(lane===previousLane&&time-previousGroupTime<beat*.6?1.2:0)+(count===1&&hand===previousHand&&sameHand>=2?2.4:0);
          used.add(lane);lanes.push(lane);assign(index+1,used,lanes,s);lanes.pop();used.delete(lane);
        }
      }
      assign(0,new Set(),[],0);
      // Never drop a note or damage a hold to force a pattern.
      if(!best)return original;
      for(let j=0;j<count;j++){const n={...g.notes[j],lane:best[j]};out.push(n);ends[n.lane]=time+Math.max(.035,n.duration);lastHead[n.lane]=time;}
      if(count===1){const hand=best[0]<2?0:1;sameHand=hand===previousHand?sameHand+1:1;previousHand=hand;previousLane=best[0];}else{sameHand=0;previousLane=-1;previousHand=-1;}
      previousGroupTime=time;
    }
  }
  return out.sort((a,b)=>a.time-b.time||a.lane-b.lane);
}
if(typeof module!=='undefined')module.exports=phraseVoice;
