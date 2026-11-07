/* Visual, four-column beatmap authoring. Gameplay and live recording remain separate. */
'use strict';
const BeatmapStudio = (()=>{
  const M=BeatmapEditing, view=$('editorView');
  const ids=['editorDone','editorUndo','editorClear','editorNoteCount','timeline','editorPosition','editorPositionValue','recordPosition','recordPositionValue','recordTime','recordStatus','recordPreview','recordStop','recordSpeed','recordStart','recordScene','recordOverdub','alignBpm','alignAnchor','alignGrid','alignRange','alignAll','retakeStart','retakeEnd','retakeHere','retakeRun','editTime','editLane','editHold','addNote','applyNote','deleteNote','nudgeEarlier','nudgeLater','editorDifficulty','editorRating','editorSave','editorUpload','editorSaveStatus','chordGlow','exportChart','chartFile'];
  const retained=new Map(ids.map(id=>[id,$(id)]));
  view.innerHTML=`
    <div class="studio-heading"><div><div class="eyebrow">PULSE STAGE / STUDIO 2</div><h2>Beatmap Studio</h2><p>Compose a chart. Every note is yours.</p></div><div class="studio-heading-actions"><button id="studioLibrary" class="secondary">Open saved map</button><button id="studioCurrent" class="secondary">Map selected song</button><span data-mount="editorDone"></span></div></div>
    <div class="studio-toolbar" role="toolbar" aria-label="Beatmap tools"><label>Tool<select id="mapTool"><option value="draw">2 / Tap + drag hold</option><option value="hold">3 / Hold</option><option value="select">1 / Select / move</option><option value="erase">4 / Erase</option></select></label><label>Snap<select id="mapSnap"><option value="0">Free timing</option><option value="1">1/4 note</option><option value="2">1/8 note</option><option value="3">1/12 (triplets)</option><option value="4" selected>1/16 note</option><option value="6">1/24 (triplets)</option><option value="8">1/32 note</option><option value="16">1/64 note</option></select></label><label>Visible time<select id="mapZoom"><option value="2">2 seconds</option><option value="4" selected>4 seconds</option><option value="8">8 seconds</option><option value="12">12 seconds</option><option value="20">20 seconds</option></select></label><span data-mount="editorUndo"></span><button id="mapRedo" class="secondary" disabled>Redo</button><button id="studioCopy" class="secondary">Copy</button><button id="studioPaste" class="secondary">Paste at cursor</button><button id="studioMirror" class="secondary">Mirror</button><span data-mount="editorClear"></span></div>
    <div class="studio-main"><section class="studio-grid-panel" aria-label="Four-lane note composition"><div class="studio-grid-caption"><strong>D / F / J / K</strong><span>Time flows upward. Drag up for a hold.</span><span data-mount="editorNoteCount"></span></div><span data-mount="timeline"></span><div class="studio-overview-label"><span>SONG OVERVIEW / click to seek</span><span data-mount="editorPositionValue"></span></div><canvas id="studioOverview" height="48" aria-label="Song waveform overview. Click to seek."></canvas><label class="studio-scroll">Scroll the grid<span data-mount="editorPosition"></span></label><p class="studio-shortcuts">Wheel: scroll / Ctrl+wheel: zoom / Shift+click: multi-select / Ctrl+C,V: copy, paste / Delete: remove / Arrows: move selection</p></section>
    <aside class="studio-inspector" id="editorRefine"><h3>Timing</h3><label>Tempo / BPM<span data-mount="alignBpm"></span></label><label>First beat / song seconds<span data-mount="alignAnchor"></span></label><label>Chart offset / milliseconds<input id="studioOffset" type="number" min="-1000" max="1000" step="1" value="0"></label><p class="micro">Snap follows the first beat. Changing timing does not move existing notes.</p><hr><h3>Selected note <small id="studioSelectionCount">0 selected</small></h3><label>Column<span data-mount="editLane"></span></label><label>Note time / chart seconds<span data-mount="editTime"></span></label><label>Hold duration / seconds<span data-mount="editHold"></span></label><div class="studio-note-buttons"><span data-mount="applyNote"></span><span data-mount="addNote"></span><span data-mount="deleteNote"></span><span data-mount="nudgeEarlier"></span><span data-mount="nudgeLater"></span></div><hr><h3>Chart details</h3><label>Difficulty<span data-mount="editorDifficulty"></span></label><label>Level rating<span data-mount="editorRating"></span></label><label class="studio-check"><span data-mount="chordGlow"></span> Highlight chords</label><div class="studio-save"><span data-mount="editorSave"></span><span data-mount="editorUpload"></span><span data-mount="exportChart"></span><label class="secondary file-label">Import chart<span data-mount="chartFile"></span></label></div><span data-mount="editorSaveStatus"></span></aside></div>
    <div class="studio-transport"><span data-mount="recordPreview"></span><span data-mount="recordStop"></span><span data-mount="recordTime"></span><label>Preview speed<span data-mount="recordSpeed"></span></label><button id="studioPlaytest" class="primary" disabled>Playtest chart</button></div><div class="studio-song-position"><span data-mount="recordPosition"></span><span data-mount="recordPositionValue"></span></div><div class="studio-status"><span data-mount="recordStatus"></span></div>
    <details class="studio-optional"><summary>Optional / Record notes live</summary><p>Recording is an alternate input method, not a required step.</p><span data-mount="recordStart"></span><label class="studio-check"><span data-mount="recordOverdub"></span> Keep existing notes while recording</label><span data-mount="recordScene"></span><div class="studio-range"><label>From / song seconds<span data-mount="retakeStart"></span></label><label>To / song seconds<span data-mount="retakeEnd"></span></label><span data-mount="retakeHere"></span><span data-mount="retakeRun"></span></div></details>
    <details class="studio-optional"><summary>Optional / Quantize existing notes</summary><p>This moves existing notes. Undo restores them if the result does not fit the music.</p><label>Subdivision<span data-mount="alignGrid"></span></label><span data-mount="alignRange"></span><span data-mount="alignAll"></span></details><div id="noteList" hidden></div>`;
  for(const slot of view.querySelectorAll('[data-mount]')){
    const node=retained.get(slot.dataset.mount);
    if(!node)throw Error('Beatmap Studio is missing required control: '+slot.dataset.mount);
    slot.replaceWith(node);
  }
  $('timeline').removeAttribute('style');$('timeline').tabIndex=0;
  $('timeline').setAttribute('aria-label','Four vertical lanes. Click for notes, drag upward for holds. Use Select to move notes or resize a hold tail.');
  $('recordPreview').textContent='Play / Space';$('recordStop').textContent='Pause';
  $('createRunStart').textContent='Open note grid';
  $('createRunStart').onclick=()=>{$('timeline').scrollIntoView({block:'center',behavior:'smooth'});$('timeline').focus({preventScroll:true});};
  const hints=$('creationSetup').querySelectorAll('.creation-hint');
  if(hints[0])hints[0].textContent='Import music, then draw notes directly on the four-column grid. No recording required.';
  if(hints[1])hints[1].textContent='Preview, playtest, save, or publish your own chart.';
  $('createModeBtn').querySelector('span').textContent='Compose in Beatmap Studio';

  let selection=new Set(),clipboard=[],drag=null,source=null,wave=null,lastMessage='',openingLibrary=false,playtest=null;
  recorder.redo=[];
  const key=n=>n.time.toFixed(6)+':'+n.lane+':'+n.duration.toFixed(6);
  const busy=()=>!state.buffer||state.loading||state.busy||!!recorder.mode;
  function settings(){return M.timing({bpm:$('alignBpm').value,anchor:$('alignAnchor').value,division:$('mapSnap').value,span:$('mapZoom').value});}
  function storeTiming(){state.creatorTiming=settings();state.analysis={...state.analysis,bpm:state.creatorTiming.bpm};}
  function restoreTiming(value){const t=M.timing(value||{bpm:state.analysis?.bpm||120});$('alignBpm').value=t.bpm;$('alignAnchor').value=t.anchor;$('mapSnap').value=t.division;$('mapZoom').value=t.span;$('studioOffset').value=$('offset').value;state.creatorTiming=t;}
  function say(text){lastMessage=text;$('recordStatus').textContent=text;}
  function pick(indices){selection=new Set(indices.filter(i=>state.notes[i]));recorder.selected=selection.size?[...selection][0]:-1;const n=state.notes[recorder.selected];if(n){$('editTime').value=n.time.toFixed(6);$('editLane').value=n.lane;$('editHold').value=n.duration.toFixed(6);}render();}
  function pickKeys(keys){const wanted=new Set(keys);pick(state.notes.map((n,i)=>wanted.has(key(n))?i:-1).filter(i=>i>=0));}
  function history(){recorder.undo.push(M.copy(state.notes));if(recorder.undo.length>100)recorder.undo.shift();recorder.redo=[];}
  function setNotes(notes){state.notes=E.markChords(M.validate(notes,state.buffer.duration));state.customChart=true;selection.clear();recorder.selected=-1;storeTiming();saveChart();}
  function edit(notes,message,selectedKeys=[]){if(busy())return false;try{const valid=M.validate(notes,state.buffer.duration);if(JSON.stringify(M.copy(state.notes))===JSON.stringify(valid))return false;history();setNotes(valid);pickKeys(selectedKeys);say(message);return true;}catch(error){say(error.message);render();return false;}}
  editorSnapshot=history;
  editorCommit=setNotes;
  selectEditorNote=index=>pick(index>=0?[index]:[]);
  editorMessage=say;
  $('editorUndo').onclick=()=>{if(busy()||!recorder.undo.length)return;recorder.redo.push(M.copy(state.notes));setNotes(recorder.undo.pop());say('Undone.');render();};
  $('mapRedo').onclick=()=>{if(busy()||!recorder.redo.length)return;recorder.undo.push(M.copy(state.notes));setNotes(recorder.redo.pop());say('Redone.');render();};
  $('editorClear').onclick=()=>{if(busy()||!state.notes.length)return;if(confirm('Clear this chart? Undo restores its notes.'))edit([],'Chart cleared. Undo restores it.');};
  function remove(){edit(state.notes.filter((_,i)=>!selection.has(i)),'Notes deleted.');}
  $('deleteNote').onclick=remove;
  function copy(){clipboard=[...selection].sort((a,b)=>a-b).map(i=>M.copy([state.notes[i]])[0]);say(clipboard.length+' notes copied. Seek to a position and paste.');render();}
  function paste(){if(busy()||!clipboard.length)return;try{const t=Math.max(0,M.snap(recorder.position,settings(),offset())),first=Math.min(...clipboard.map(n=>n.time)),added=clipboard.map(n=>({...n,time:M.round(t+n.time-first)}));edit(M.paste(state.notes,clipboard,t,state.buffer.duration),'Pattern pasted.',added.map(key));}catch(error){say(error.message);}}
  $('studioCopy').onclick=copy;$('studioPaste').onclick=paste;
  $('studioMirror').onclick=()=>{if(busy())return;try{edit(M.mirror(state.notes,selection,state.buffer.duration),'Selection mirrored.',[...selection].map(i=>key({...state.notes[i],lane:3-state.notes[i].lane})));}catch(error){say(error.message);}};
  function move(dt,dl,base=state.notes,ids=selection){
    const chosen=[...ids].map(i=>base[i]);if(!chosen.length)return;
    const clippedTime=M.clamp(dt,-Math.min(...chosen.map(n=>n.time)),state.buffer.duration-Math.max(...chosen.map(n=>n.time+n.duration)));
    const clippedLane=M.clamp(dl,-Math.min(...chosen.map(n=>n.lane)),3-Math.max(...chosen.map(n=>n.lane)));
    const keys=chosen.map(n=>key({...n,time:M.round(n.time+clippedTime),lane:n.lane+clippedLane}));
    try{edit(M.transform(base,ids,dt,dl,state.buffer.duration),'Selection moved.',keys);}catch(error){say(error.message);}
  }
  function span(){return settings().span;}
  function start(){return Number($('editorPosition').value)||0;}
  function scroll(t){$('editorPosition').max=Math.max(0,(state.buffer?.duration||0)-span());$('editorPosition').value=M.clamp(t,0,Number($('editorPosition').max));render();}
  function seek(t,center=true){if(!state.buffer)return;stopEditorTransport();recorder.position=M.clamp(t,0,state.buffer.duration);if(center)scroll(recorder.position-span()*.2);updateRecorderClock();render();}
  function frame(){if(!recorder.mode)return;const t=editorTime();if(t>=(recorder.takeEnd??state.buffer.duration)){stopEditorTransport(true);render();return;}updateRecorderClock();const video=editorVideo();if(!creationCountdown()&&video?.paused){try{video.currentTime=t%(video.duration||state.buffer.duration);}catch{}video.play().catch(()=>{});}if(t>start()+span()*.85||t<start())$('editorPosition').value=Math.max(0,Math.min(state.buffer.duration-span(),t-span()*.15));drawRecordStage();render();recorder.frame=requestAnimationFrame(frame);}
  editorFrame=frame;
  $('recordPosition').oninput=()=>seek(Number($('recordPosition').value));
  $('editorPosition').oninput=()=>render();
  $('mapZoom').onchange=()=>{storeTiming();scroll(start());saveChart();};
  $('mapSnap').onchange=()=>{storeTiming();saveChart();render();};
  $('alignBpm').onchange=$('alignAnchor').onchange=()=>{if(!state.buffer)return;const bpm=Number($('alignBpm').value),anchor=Number($('alignAnchor').value);if(!Number.isFinite(bpm)||bpm<20||bpm>400||!Number.isFinite(anchor)||anchor<0||anchor>state.buffer.duration){say('Use BPM 20-400 and a first beat within the song.');restoreTiming(state.creatorTiming);return;}storeTiming();saveChart();say('Timing grid updated. Existing notes were not moved.');};
  $('studioOffset').onchange=()=>{$('offset').value=M.clamp(Number($('studioOffset').value)||0,-1000,1000);$('studioOffset').value=$('offset').value;preferences();saveChart();render();};

  const canvas=$('timeline');canvas.onclick=null;
  function geometry(){const r=canvas.getBoundingClientRect(),W=r.width,H=r.height,left=70,right=W-18,top=35,bottom=H-32;return {r,W,H,left,right,top,bottom,h:bottom-top,lw:(right-left)/4};}
  function point(event){const g=geometry(),x=event.clientX-g.r.left,y=event.clientY-g.r.top;return {x,y,songTime:M.yToTime(y-g.top,g.h,start(),span()),lane:M.clamp(Math.floor((x-g.left)/g.lw),0,3),ruler:x<g.left};}
  function hit(p){const g=geometry(),tol=span()/g.h*9;let found=-1,best=Infinity,tail=false;for(let i=0;i<state.notes.length;i++){const n=state.notes[i];if(n.lane!==p.lane)continue;const t=n.time+offset(),end=t+n.duration,d=Math.max(t-p.songTime,p.songTime-end,0);if(d<tol&&d<best){best=d;found=i;tail=n.duration>0&&Math.abs(p.songTime-end)<tol;}}return {index:found,tail};}
  canvas.onpointerdown=event=>{
    if(busy()||event.button===1)return;event.preventDefault();canvas.focus({preventScroll:true});
    const p=point(event);if(p.ruler){seek(p.songTime,false);return;}
    const tool=event.button===2?'erase':$('mapTool').value,target=hit(p);
    if(tool==='erase'){if(target.index>=0){pick([target.index]);remove();}return;}
    if(tool==='select'){
      if(target.index>=0){
        if(event.shiftKey){const next=new Set(selection);next.has(target.index)?next.delete(target.index):next.add(target.index);pick([...next]);return;}
        if(!selection.has(target.index))pick([target.index]);
        drag={type:target.tail&&selection.size===1?'resize':'move',index:target.index,start:p,current:p,base:M.copy(state.notes),ids:new Set(selection)};
      }else{if(!event.shiftKey)pick([]);drag={type:'box',start:p,current:p,ids:new Set(selection)};}
    }else drag={type:'draw',hold:tool==='hold',start:p,current:p};
    canvas.setPointerCapture(event.pointerId);render();
  };
  canvas.onpointermove=event=>{if(!drag)return;drag.current=point(event);render();};
  canvas.onpointerup=event=>{
    if(!drag)return;const d=drag;drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(busy())return;
    const p=point(event);
    try{
      if(d.type==='draw'){
        const end=Math.abs(p.y-d.start.y)<6?d.start.songTime:p.songTime;
        const n=M.draw(d.start.songTime,end,d.start.lane,settings(),offset(),state.buffer.duration,d.hold);
        edit([...state.notes,n],n.duration?'Hold placed.':'Tap placed.',[key(n)]);
      }else if(d.type==='move')move(M.snap(p.songTime,settings(),offset())-M.snap(d.start.songTime,settings(),offset()),p.lane-d.start.lane,d.base,d.ids);
      else if(d.type==='resize'){const n=d.base[d.index],end=M.snap(p.songTime,settings(),offset());const notes=M.resize(d.base,d.index,end,state.buffer.duration);edit(notes,'Hold tail resized.',[key({...n,duration:M.round(Math.max(0,Math.min(state.buffer.duration,end)-n.time))})]);}
      else{
        const from=Math.min(d.start.songTime,p.songTime),to=Math.max(d.start.songTime,p.songTime),l=Math.min(d.start.lane,p.lane),r=Math.max(d.start.lane,p.lane),ids=new Set(d.ids);
        state.notes.forEach((n,i)=>{if(n.lane>=l&&n.lane<=r&&n.time+offset()<=to&&n.time+n.duration+offset()>=from)ids.add(i);});pick([...ids]);
      }
    }catch(error){say(error.message);}render();
  };
  canvas.onpointercancel=()=>{drag=null;render();};canvas.oncontextmenu=event=>event.preventDefault();
  canvas.addEventListener('wheel',event=>{if(!state.editor||!state.buffer||recorder.mode)return;event.preventDefault();if(event.ctrlKey||event.metaKey){const values=[2,4,8,12,20],i=values.indexOf(span());$('mapZoom').value=values[M.clamp(i+Math.sign(event.deltaY),0,values.length-1)];$('mapZoom').onchange();}else scroll(start()+Math.sign(event.deltaY)*M.step(settings())*(event.shiftKey?4:1));},{passive:false});
  $('studioOverview').onpointerdown=event=>{if(!state.buffer)return;const r=event.currentTarget.getBoundingClientRect();seek((event.clientX-r.left)/r.width*state.buffer.duration);};

  function waveform(){if(!state.buffer||wave?.buffer===state.buffer)return;const data=state.buffer.getChannelData(0),bins=4096,stride=Math.max(1,Math.floor(data.length/bins)),peaks=new Float32Array(bins);for(let i=0;i<bins;i++){let v=0;const end=Math.min(data.length,(i+1)*stride);for(let j=i*stride;j<end;j+=Math.max(1,Math.floor(stride/24)))v=Math.max(v,Math.abs(data[j]));peaks[i]=v;}wave={buffer:state.buffer,peaks};}
  function drawOverview(){const c=$('studioOverview'),r=c.getBoundingClientRect();if(!r.width)return;const dpr=Math.min(devicePixelRatio||1,2);c.width=r.width*dpr;c.height=48*dpr;const x=c.getContext('2d');x.scale(dpr,dpr);x.fillStyle='#101827';x.fillRect(0,0,r.width,48);if(!state.buffer)return;waveform();x.fillStyle='#7b91c5';for(let px=0;px<r.width;px+=2){const v=wave.peaks[Math.min(4095,Math.floor(px/r.width*4096))];x.fillRect(px,24-v*21,1,Math.max(1,v*42));}const duration=state.buffer.duration;x.fillStyle='#a99aff33';x.fillRect(start()/duration*r.width,0,span()/duration*r.width,48);x.strokeStyle='#d5c7ff';x.strokeRect(start()/duration*r.width,1,span()/duration*r.width,46);x.fillStyle='#ffe9a1';x.fillRect(editorTime()/duration*r.width,0,2,48);}
  function render(){
    if(!state.editor)return;
    const g=geometry();if(!g.W||!g.H)return;
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=g.W*dpr;canvas.height=g.H*dpr;const x=canvas.getContext('2d');x.scale(dpr,dpr);
    const t=settings(),s=start(),length=t.span,off=offset(),y=time=>g.top+M.timeToY(time,g.h,s,length),beat=60/t.bpm;
    x.fillStyle='#0b1020';x.fillRect(0,0,g.W,g.H);
    for(let lane=0;lane<4;lane++){x.fillStyle=lane%2?'#141a2d':'#101629';x.fillRect(g.left+lane*g.lw,g.top,g.lw,g.h);x.strokeStyle='#ffffff20';x.beginPath();x.moveTo(g.left+lane*g.lw,g.top);x.lineTo(g.left+lane*g.lw,g.bottom);x.stroke();x.fillStyle='#d4d9ed';x.font='bold 14px system-ui';x.textAlign='center';x.fillText('DFJK'[lane],g.left+(lane+.5)*g.lw,22);}
    const subdivision=t.division||4,step=beat/subdivision,first=Math.ceil((s-t.anchor)/step),last=Math.floor((s+length-t.anchor)/step);
    x.font='10px system-ui';x.textAlign='right';
    for(let k=first;k<=last&&k-first<1200;k++){const time=t.anchor+k*step;if(time<0)continue;const yy=y(time),whole=k%subdivision===0,bar=k%(subdivision*4)===0;x.strokeStyle=bar?'#b5a1ff88':whole?'#66799f88':'#ffffff12';x.lineWidth=bar?2:1;x.beginPath();x.moveTo(g.left,yy);x.lineTo(g.right,yy);x.stroke();if(whole){x.fillStyle=bar?'#e0d5ff':'#8c9ab6';x.fillText(bar?String(Math.floor(k/(subdivision*4))+1)+'.1':((time).toFixed(2)),g.left-8,yy+3);}}
    if(state.buffer){waveform();x.fillStyle='#94b5dc55';for(let py=g.top;py<g.bottom;py+=3){const time=M.yToTime(py-g.top,g.h,s,length),index=Math.floor(time/state.buffer.duration*4096);if(index<0||index>=4096)continue;const width=wave.peaks[index]*24;x.fillRect(26-width/2,py,width,2);}}
    const drawNote=(n,selected=false,ghost=false)=>{const head=n.time+off,tail=head+n.duration;if(tail<s||head>s+length)return;const left=g.left+n.lane*g.lw+7,w=g.lw-14,yy=y(head),end=y(tail),color=state.palette[n.lane];x.save();x.beginPath();x.rect(g.left,g.top,g.right-g.left,g.h);x.clip();x.globalAlpha=ghost?.5:1;if(n.duration){x.fillStyle=color+'66';x.fillRect(left+5,end,w-10,yy-end);x.fillStyle=color;x.fillRect(left,end-3,w,6);}x.fillStyle=color;x.fillRect(left,yy-5,w,10);x.fillStyle='#ffffffc0';x.fillRect(left,yy-5,w,2);if(selected){x.strokeStyle='#ffffff';x.lineWidth=2;x.strokeRect(left-2,end-7,w+4,Math.max(14,yy-end+14));x.fillStyle='#fff';if(n.duration)x.fillRect(left+w/2-4,end-4,8,8);}x.restore();};
    state.notes.forEach((n,i)=>drawNote(n,selection.has(i)));
    if(drag){
      try{if(drag.type==='draw')drawNote(M.draw(drag.start.songTime,drag.current.songTime,drag.start.lane,t,off,state.buffer.duration,drag.hold),true,true);
      else if(drag.type==='resize'){const n=drag.base[drag.index],end=M.snap(drag.current.songTime,t,off);drawNote({...n,duration:Math.max(0,end-n.time)},true,true);}
      else if(drag.type==='move'){const dt=M.snap(drag.current.songTime,t,off)-M.snap(drag.start.songTime,t,off),dl=drag.current.lane-drag.start.lane;for(const i of drag.ids){const n=drag.base[i];if(n.lane+dl>=0&&n.lane+dl<4)drawNote({...n,time:n.time+dt,lane:n.lane+dl},true,true);}}
      else{x.fillStyle='#c1adff22';x.strokeStyle='#c1adff';const left=Math.min(drag.start.x,drag.current.x),top=Math.min(drag.start.y,drag.current.y),w=Math.abs(drag.start.x-drag.current.x),h=Math.abs(drag.start.y-drag.current.y);x.fillRect(left,top,w,h);x.strokeRect(left,top,w,h);}}catch{}
    }
    const cursor=y(editorTime());if(cursor>=g.top&&cursor<=g.bottom){x.strokeStyle='#ffe5a3';x.lineWidth=2;x.beginPath();x.moveTo(g.left,cursor);x.lineTo(g.right,cursor);x.stroke();x.fillStyle='#ffe5a3';x.font='10px system-ui';x.textAlign='left';x.fillText('CURSOR',g.left+5,cursor-7);}
    if(!state.buffer){x.fillStyle='#e7eaf8';x.font='bold 17px system-ui';x.textAlign='center';x.fillText('Choose music to start mapping',g.W/2,g.H/2);}
    $('editorPosition').max=Math.max(0,(state.buffer?.duration||0)-length);$('editorPositionValue').textContent=fmt(s)+' - '+fmt(Math.min(s+length,state.buffer?.duration||length));
    $('editorNoteCount').textContent=state.notes.length+' notes';$('studioSelectionCount').textContent=selection.size+' selected';
    $('editorUndo').disabled=busy()||!recorder.undo.length;$('mapRedo').disabled=busy()||!recorder.redo?.length;
    for(const id of ['applyNote','nudgeEarlier','nudgeLater'])$(id).disabled=busy()||selection.size!==1;
    for(const id of ['deleteNote','studioCopy','studioMirror'])$(id).disabled=busy()||!selection.size;
    $('studioPaste').disabled=busy()||!clipboard.length;$('studioPlaytest').disabled=busy()||!state.notes.length;
    for(const id of ['mapTool','mapSnap','mapZoom','alignAnchor','studioOffset'])$(id).disabled=!!recorder.mode;
    drawOverview();
  }
  renderEditor=render;
  const oldRefresh=refreshRecorder;
  refreshRecorder=()=>{
    const changed=state.buffer!==source;oldRefresh();
    if(!state.editor)return;
    if(changed){source=state.buffer;selection.clear();drag=null;wave=null;recorder.redo=[];$('editorPosition').value=0;restoreTiming(state.creatorTiming||{bpm:state.analysis?.bpm||120});}
    if(!recorder.mode&&lastMessage)$('recordStatus').textContent=lastMessage;
    render();
  };
  // Persist exact manual timing; do not silently regenerate or quantize custom maps.
  const originalSaveChart=saveChart;
  saveChart=()=>{if(state.editor)storeTiming();originalSaveChart();save('chart',{name:state.name,difficulty:state.difficulty,rating:state.rating,chordGlow:state.chordGlow!==false,customChart:state.customChart,notes:chartNotes(),bpm:state.analysis?.bpm,creatorTiming:state.creatorTiming});};
  const originalLevel=currentLevel;
  currentLevel=()=>{const level=originalLevel();level.chart.creatorTiming=state.creatorTiming||settings();return level;};
  const originalCapture=captureSongMode;
  captureSongMode=()=>({...originalCapture(),creatorTiming:state.creatorTiming});
  const originalSwitch=switchSongMode;
  switchSongMode=async create=>{await originalSwitch(create);selection.clear();recorder.undo=[];recorder.redo=[];recorder.selected=-1;state.creatorTiming=songModeDrafts[create?'create':'play']?.creatorTiming||null;if(create){restoreTiming(state.creatorTiming||{bpm:state.analysis?.bpm||120});render();}};
  const originalApply=applyLevel;
  applyLevel=async level=>{const editAfter=openingLibrary||state.editor;openingLibrary=false;await originalApply(level);state.creatorTiming=level.chart.creatorTiming||null;if(editAfter){state.customChart=true;setTab(true);restoreTiming(state.creatorTiming||{bpm:level.chart.bpm||120});saveChart();say('Saved map opened for editing.');}render();};
  $('studioLibrary').onclick=()=>{openingLibrary=true;showLocalSongs();};
  $('localSongsDialog').addEventListener('close',()=>{openingLibrary=false;});
  $('studioCurrent').onclick=async()=>{
    const draft=songModeDrafts.play;
    if(!draft?.buffer){say('Choose a song in Play Songs first, or use Choose song on the left.');return;}
    if(state.notes.length&&!confirm('Replace this editor draft with the selected song? Saved maps will not be deleted.'))return;
    stopEditorTransport();for(const k of ['buffer','name','audioBytes','audioType','analysis','difficulty','rating'])state[k]=draft[k];state.notes=[];state.customChart=true;state.creatorTiming=null;$('offset').value=0;resetBackground(false);if(draft.background)await setBackground(draft.background,false);await save('song',{bytes:state.audioBytes||wavBytes(state.buffer),name:state.name,type:state.audioType});restoreTiming({bpm:state.analysis?.bpm||120});saveChart();say('Blank custom chart created for the selected song. Its automatic chart is unchanged.');
  };
  $('exportChart').onclick=()=>{
    if(!state.buffer)return;say('Chart exported.');const blob=new Blob([JSON.stringify({version:2,title:state.name,difficulty:state.difficulty,offsetMs:Number($('offset').value),rating:state.rating,chordGlow:state.chordGlow!==false,customChart:state.customChart,bpm:state.analysis?.bpm,creatorTiming:state.creatorTiming||settings(),notes:chartNotes()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pulse-stage-chart.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('chartFile').onchange=async event=>{try{if(!state.buffer)throw Error('Import the matching audio first.');const file=event.target.files[0];if(!file)return;if(file.size>5e6)throw Error('Chart file is too large.');const chart=JSON.parse(await file.text()),notes=M.validate(chart.notes,state.buffer.duration);stopEditorTransport();history();state.customChart=true;state.notes=E.markChords(notes);state.rating=chart.rating||1;state.chordGlow=chart.chordGlow!==false;if(Number.isFinite(chart.offsetMs))$('offset').value=M.clamp(chart.offsetMs,-1000,1000);restoreTiming(chart.creatorTiming||{bpm:chart.bpm||120});selection.clear();recorder.selected=-1;saveChart();preferences();say('Chart imported with its exact note timing.');}catch(error){say(error.message);}event.target.value='';};

  const back=document.createElement('button');back.id='studioReturn';back.className='primary';back.textContent='Return to editor';back.hidden=true;document.body.append(back);
  async function testChart(){
    if(busy()||!state.notes.length)return;stopEditorTransport();
    playtest={notes:chartNotes(),position:recorder.position,practice:$('practice').checked,rate:$('trainingRate').value};
    $('practice').checked=true;$('trainingRate').value='1';await begin();back.hidden=false;
  }
  function returnFromTest(){if(!playtest)return;const saved=playtest;playtest=null;stopToStudio();state.notes=E.markChords(M.validate(saved.notes,state.buffer.duration));state.customChart=true;$('practice').checked=saved.practice;$('trainingRate').value=saved.rate;setTab(true);recorder.position=saved.position;back.hidden=true;settingsUI();updateRecorderClock();render();say('Back in the editor. Playtest did not change your chart.');}
  back.onclick=returnFromTest;$('studioPlaytest').onclick=testChart;
  document.addEventListener('keydown',event=>{
    if(!state.editor||event.isComposing||event.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||document.querySelector('dialog[open]'))return;
    const mod=event.ctrlKey||event.metaKey,code=event.code;
    const consume=()=>{event.preventDefault();event.stopImmediatePropagation();};
    if(code==='Space'){consume();if(!event.repeat){if(recorder.mode)stopEditorTransport();else startEditorTransport('preview');}return;}
    if(recorder.mode||!state.buffer)return;
    if(mod&&['KeyZ','KeyY','KeyC','KeyV','KeyA'].includes(code)){consume();if(event.repeat)return;if(code==='KeyZ')(event.shiftKey?$('mapRedo'):$('editorUndo')).click();else if(code==='KeyY')$('mapRedo').click();else if(code==='KeyC')copy();else if(code==='KeyV')paste();else pick(state.notes.map((_,i)=>i));return;}
    if(code==='Delete'||code==='Backspace'){consume();if(!event.repeat)remove();return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code)){consume();if(selection.size){const step=M.step(settings())*(event.shiftKey?4:1);move(code==='ArrowUp'?step:code==='ArrowDown'?-step:0,code==='ArrowLeft'?-1:code==='ArrowRight'?1:0);}else scroll(start()+(code==='ArrowDown'?-1:1)*M.step(settings()));return;}
    if(/^Digit[1-4]$/.test(code)){consume();$('mapTool').value=['select','draw','hold','erase'][Number(code.at(-1))-1];return;}
    if(code==='Escape'&&drag){consume();drag=null;render();}
  },true);
  window.addEventListener('resize',()=>render());
  new ResizeObserver(()=>render()).observe(canvas);
  studioReady.then(async()=>{const chart=await read('chart');if(chart?.name===state.name&&chart.customChart){state.creatorTiming=chart.creatorTiming||null;if(chart.bpm)state.analysis={...state.analysis,bpm:chart.bpm};}restoreTiming(state.creatorTiming||{bpm:state.analysis?.bpm||120});render();});
  return {version:2,render,settings,seek,get selection(){return [...selection];},get clipboard(){return M.copy(clipboard);},returnFromTest};
})();
