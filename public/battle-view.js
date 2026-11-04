(function(root){'use strict';
const grades=new Set(['PERFECT','GREAT','GOOD','MISS']);
function createModel(notes){return {notes:notes.map(n=>({time:n.time,lane:n.lane,duration:n.duration||0,chord:!!n.chord})),pressed:[false,false,false,false],holds:[null,null,null,null],flashes:[-Infinity,-Infinity,-Infinity,-Infinity],feedback:'',feedbackAt:-Infinity};}
function applyVisual(model,packet,now){
 if(!packet||!Array.isArray(packet.pressed)||packet.pressed.length!==4||packet.pressed.some(x=>typeof x!=='boolean')||!Array.isArray(packet.holds)||packet.holds.length!==4||!Array.isArray(packet.hits)||packet.hits.length>64)return false;
 for(const hit of packet.hits){if(!hit||!Number.isInteger(hit.index)||!grades.has(hit.grade))continue;const n=model.notes[hit.index];if(!n||n.result)continue;n.result=hit.grade;n.started=false;model.feedback=hit.grade;model.feedbackAt=now;model.flashes[n.lane]=now;}
 for(let lane=0;lane<4;lane++){
  if(packet.pressed[lane]&&!model.pressed[lane])model.flashes[lane]=now;
  model.pressed[lane]=packet.pressed[lane];const old=model.holds[lane];if(old&&!old.result)old.started=false;
  const index=packet.holds[lane],note=Number.isInteger(index)?model.notes[index]:null;
  model.holds[lane]=note&&note.lane===lane&&note.duration>.05&&!note.result?note:null;
  if(model.holds[lane])model.holds[lane].started=true;
 }
 return true;
}
const api={createModel,applyVisual};if(typeof module!=='undefined')module.exports=api;
if(typeof document==='undefined')return;
const B=id=>document.getElementById(id),canvas=B('opponentGame'),g=canvas.getContext('2d');let live=false,model=null,width=0,height=0,dpr=1;
const cache=typeof PulseNoteSprites!=='undefined'?PulseNoteSprites.createCache(document):null;
function text(id,value){const node=B(id);if(node.textContent!==value)node.textContent=value;}
function fit(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;width=r.width;height=r.height;dpr=Math.min(root.devicePixelRatio||1,2);const w=Math.round(width*dpr),h=Math.round(height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;g?.setTransform(dpr,0,0,dpr,0,0);}}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(fit).observe(canvas);
function begin({notes,selfName='You',opponentName='Opponent'}){model=createModel(notes);live=true;document.body.classList.add('battle-split');for(const id of ['opponentGame','battleFieldHeads','battleCenterLife'])B(id).hidden=false;text('battleLocalName',selfName+' · YOU');text('battleRemoteName',opponentName);text('battleLocalAccuracy','100.00%');text('battleRemoteAccuracy','100.00%');fit();if(typeof resize==='function')resize();}
function end(){live=false;model=null;for(const id of ['opponentGame','battleFieldHeads','battleCenterLife'])B(id).hidden=true;document.body.classList.remove('battle-split');g?.clearRect(0,0,width,height);if(typeof resize==='function')resize();}
function receive(packet){return live&&model?applyVisual(model,packet,performance.now()):false;}
function updateStats(self,other){if(!live)return;for(const [prefix,player] of [['Local',self],['Remote',other]]){const health=Math.max(0,Math.min(200,Number(player.health)||0)),bar=B('battle'+prefix+'LifeBar');B('battle'+prefix+'LifeFill').style.height=(health/2)+'%';bar.setAttribute('aria-valuenow',String(health));bar.classList.toggle('low',health<=60);text('battle'+prefix+'LifeValue',String(health));}text('battleRemoteAccuracy',Number(other.accuracy||0).toFixed(2)+'%');}
function draw(time,now,{travel=.65,offset=0,colors=['#8affdc','#f98cc9','#8affdc','#f98cc9'],chordGlow=true,noteScale=1,accuracy=100}={}){
 if(!live||!model||!g)return;if(!width||!height)fit();if(!width||height<=70)return;text('battleLocalAccuracy',accuracy.toFixed(2)+'%');g.clearRect(0,0,width,height);
 const point=(lane,p)=>({x:width/2+(lane/4-.5)*width*.91,y:28+(height-70)*p});
 function quad(lane,a,b,color,inset=1){const x=point(lane,a),y=point(lane+1,b);g.fillStyle=color;g.fillRect(x.x+inset,x.y,Math.max(0,y.x-x.x-2*inset),y.y-x.y);}
 const gradient=g.createLinearGradient(0,25,0,height);gradient.addColorStop(0,'#080e1808');gradient.addColorStop(1,'#172a35bb');for(let lane=0;lane<4;lane++)quad(lane,0,1,gradient);
 for(let lane=0;lane<=4;lane++){const a=point(lane,0),b=point(lane,1.08);g.strokeStyle=lane===0||lane===4?colors[0]+'77':'#ffffff30';g.lineWidth=1;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();}
 for(let lane=0;lane<4;lane++){if(model.pressed[lane]||now-model.flashes[lane]<140)quad(lane,.05,1,colors[lane]+'33');quad(lane,.99,1.025,colors[lane],3);}
 const chartTime=time-offset,sprites=cache?.prepare(width,height,dpr,colors,noteScale);
 function note(n){if(n.result)return;const p=1-(n.time-chartTime)/travel,tail=Math.max(0,1-(n.time+n.duration-chartTime)/travel);if(p<-.2||n.time+n.duration<chartTime-.2)return;
  if(n.duration){quad(n.lane,tail,Math.min(p,1.07),colors[n.lane]+(n.started?'bb':'88'),5);if(tail<=1.05){const at=point(n.lane,tail);if(sprites)sprites.cap(g,n.lane,at.x,at.y);else quad(n.lane,tail-.009*noteScale,tail+.009*noteScale,'#fff9df',7);}}
  if(!n.started){const at=point(n.lane,p);if(sprites)sprites.head(g,n.lane,at.x,at.y,n.chord&&chordGlow);else{quad(n.lane,p-.03*noteScale,p+.03*noteScale,n.chord&&chordGlow?'#fff7d9':colors[n.lane],4);quad(n.lane,p-.03*noteScale,p-.02*noteScale,'#ffffffbb',5);}}
 }
 if(time>=0){const start=RhythmEngine.noteIndex(model.notes,chartTime-.2);for(let i=start;i<model.notes.length;i++){const n=model.notes[i];if(n.time>chartTime+travel+.5)break;if(!n.started)note(n);}for(const held of model.holds)if(held)note(held);}
 if(time<0||now-model.feedbackAt<400){g.font='bold '+(time<0?60:Math.max(12,Math.min(18,width*.04)))+'px sans-serif';g.textAlign='center';g.fillStyle=time<0?'#ffffff':model.feedback==='MISS'?'#ff859f':'#ffffff';g.fillText(time<0?String(Math.ceil(-time)):model.feedback,width/2,height*(time<0?.35:.5));}
}
root.BattleView={...api,begin,end,receive,updateStats,draw};
})(typeof window!=='undefined'?window:globalThis);
