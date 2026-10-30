'use strict';
const BattleMode=(()=>{
 const R=BattleRules,me={id:crypto.randomUUID(),name:'Player'};
 let link=null,isHost=false,hostId=null,seat=null,code='',model=null,pool=[],rules=null,prepared=null,loadKey='',session=0,seq=0,revision=0,lastRevision=-1,lastPeerAt=0,connectedAt=0,clockOffset=0,clockSamples=[],joined=false,roundLive=false,localDone=false,roundEndHandled=false,lastSend=0,lastPing=0,lastSnapshot=0,lastHits=0;
 let loop=null,loadingAbort=null;const pending=new Map(),seen=new Map(),reports=[];
 const B=id=>document.getElementById(id),now=()=>Date.now()+(isHost?0:clockOffset),active=()=>!!link;
 function text(id,value){B(id).textContent=value;}
 function send(type,data={},reliable=false,to=null){if(!link)return;const message={v:1,from:me.id,type,seq:++seq,...data,...(to?{to}:{}),reliable};link.send(message);if(reliable)pending.set(message.seq,{message,at:Date.now(),tries:0});}
 function publish(){if(!isHost||!model)return;model.revision=++revision;model.hostTime=Date.now();send('state',{model});render();}
 function statusBattle(message){text('battleStatus',message);}
 function safeName(value){return String(value||'Player').trim().slice(0,24)||'Player';}
 function summary(){return rules?{players:rules.players.map(p=>({...p,counts:{...p.counts},accuracy:R.accuracy(p)})),cursor:rules.cursor,total:rules.notes.length}:null;}
 function fail(message){if(!active())return;stopRound();if(loadingAbort)loadingAbort.abort();pending.clear();link.close();link=null;clearInterval(loop);loop=null;model={...(model||{}),phase:'error',error:message};if(B('battleLeaveDialog').open)B('battleLeaveDialog').close();if(!B('battleDialog').open)B('battleDialog').showModal();render();}
 async function open(){if(active()&&roundLive){pause();return;}if(state.playing||state.paused)stopToStudio();SongPreview.stop();if(!B('battleDialog').open)B('battleDialog').showModal();if(!active()){text('battleStatus','Create a room or enter your friend’s code. Both players use the same community chart.');B('battleName').value=localStorage.getItem('pulse-creator')||'Player';}render();}
 async function connectRoom(host){
  if(active())return;const ticket=++session;isHost=host;me.name=safeName(B('battleName').value);code=host?Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join(''):B('battleCodeInput').value.toUpperCase().replace(/\s/g,'');
  B('battleCreate').disabled=B('battleJoin').disabled=true;statusBattle(host?'Loading community charts…':'Connecting to your friend’s room…');
  try{
   if(host){const data=await requestAPI('/api/songs?mine=0&q=');pool=data.songs.filter(s=>!s.incomplete);R.options(pool);}
   if(ticket!==session)return;
   const connection=await BattleTransport.connect(PulseBackendConfig,code,{message:receive,participantId:me.id,peerLeft:id=>{const opponent=isHost?model?.players?.[1]?.id:hostId;if(id===opponent&&!['complete','error'].includes(model?.phase))fail('Your opponent disconnected. This match was stopped.');},disconnect:()=>fail('Connection lost. This match was stopped so network loss does not count as missed notes.')});
   if(ticket!==session){connection.close();return;}link=connection;connectedAt=Date.now();lastPeerAt=0;clockOffset=0;clockSamples=[];pending.clear();seen.clear();prepared=null;loadKey='';rules=null;roundLive=false;seat=host?0:null;hostId=host?me.id:null;joined=host;lastRevision=-1;revision=0;
   model=host?{hostId:me.id,players:[{...me},null],phase:'lobby',round:1,choices:R.options(pool),votes:[null,null],ready:[false,false],hashes:[null,null],next:[false,false],results:[],used:[],startAt:null,selected:null,stats:null}:null;
   loop=setInterval(tick,60);if(host)publish();else send('hello',{name:me.name});render();
  }catch(error){if(ticket!==session)return;statusBattle(error.message);B('battleCreate').disabled=B('battleJoin').disabled=false;}
 }
 function receive(message){
  if(!link||message?.v!==1||message.from===me.id||message.to&&message.to!==me.id||typeof message.from!=='string'||!Number.isInteger(message.seq))return;
  if(message.type==='ack'){pending.delete(message.ack);return;}
  if(message.reliable)send('ack',{ack:message.seq},false,message.from);
  let ids=seen.get(message.from);if(!ids){ids=new Set();seen.set(message.from,ids);}if(ids.has(message.seq))return;ids.add(message.seq);if(ids.size>1500)ids.delete(ids.values().next().value);
  if(isHost){
   if(message.type==='hello'){
    if(!model.players[1]){model.players[1]={id:message.from,name:safeName(message.name)};model.phase='picking';lastPeerAt=Date.now();publish();}
    if(model.players[1].id!==message.from){send('reject',{reason:'This room already has two players.'},false,message.from);return;}
    lastPeerAt=Date.now();send('welcome',{model},true,message.from);return;
   }
   if(message.from!==model.players[1]?.id)return;lastPeerAt=Date.now();
   if(message.type==='ping'){send('pong',{sent:message.sent,hostTime:Date.now()},false,message.from);return;}
   command(1,message);
  }else{
   if(message.type==='reject'&&!joined){fail(message.reason||'Could not join this room.');return;}
   if(!['state','welcome','pong'].includes(message.type))return;
   if(message.type==='pong'){if(message.from!==hostId||!Number.isFinite(message.sent)||!Number.isFinite(message.hostTime))return;lastPeerAt=Date.now();const rtt=Date.now()-message.sent;if(rtt>=0&&rtt<2000){clockSamples.push({rtt,offset:message.hostTime-(message.sent+Date.now())/2});if(clockSamples.length>10)clockSamples.shift();clockOffset=clockSamples.reduce((a,b)=>a.rtt<b.rtt?a:b).offset;render();}return;}
   const incoming=message.model;if(!incoming||incoming.hostId!==message.from||incoming.players?.[1]?.id!==me.id||incoming.players[0]?.id!==message.from)return;
   hostId=message.from;seat=1;joined=true;lastPeerAt=Date.now();if(incoming.revision<=lastRevision)return;lastRevision=incoming.revision;model=incoming;applyModel();
  }
 }
 function command(player,message){
  if(!model)return;
  if(message.type==='forfeit'){if(['complete','error'].includes(model.phase))return;if(model.phase==='lobby'||model.round===1&&['picking','loading'].includes(model.phase)){model.players[1]=null;model.phase='lobby';model.votes=[null,null];model.ready=[false,false];model.hashes=[null,null];publish();return;}model.phase='complete';model.forfeitWinner=1-player;model.error=model.players[player].name+' left the match.';stopRound();publish();return;}
  if(message.round!==model.round)return;
  if(message.type==='vote'&&model.phase==='picking'&&model.choices.some(s=>s.id===message.songId)&&!model.votes[player]){model.votes[player]=message.songId;publish();if(model.votes.every(Boolean)){const id=R.choose(model.choices,model.votes,secureRandom);model.selected=model.choices.find(s=>s.id===id);model.phase='loading';model.ready=[false,false];model.hashes=[null,null];publish();prepare();}}
  if(message.type==='ready'&&model.phase==='loading'&&/^[a-f0-9]{64}$/.test(message.hash||'')){model.hashes[player]=message.hash;model.ready[player]=true;publish();if(model.ready.every(Boolean)){if(model.hashes[0]!==model.hashes[1]){model.error='The chart changed while loading. Both players should reload the round.';model.ready=[false,false];model.hashes=[null,null];publish();return;}rules=R.round(state.notes,state.difficulty,state.buffer.duration,offset());model.startAt=Date.now()+5000;model.phase='countdown';model.stats=summary();model.error=null;publish();startRound();}}
  if(message.type==='hits'&&['countdown','playing'].includes(model.phase)&&Array.isArray(message.hits)&&message.hits.length<=64&&rules){const elapsed=(Date.now()-model.startAt)/1000;for(const hit of message.hits)if(hit&&typeof hit==='object')R.report(rules,player,hit.index,hit.grade,elapsed);}
  if(message.type==='next'&&model.phase==='result'&&!model.next[player]){model.next[player]=true;publish();if(model.next.every(Boolean))nextRound();}
 }
 const secureRandom=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
 function action(type,data={}){const message={type,round:model?.round,...data};if(isHost)command(0,message);else send(type,message,true,hostId);}
 async function prepare(force=false){
  if(!model?.selected||model.phase!=='loading')return;SongPreview.stop();const key=model.round+':'+model.selected.id;if(loadKey===key&&!force)return;loadKey=key;prepared=null;if(loadingAbort)loadingAbort.abort();const abort=loadingAbort=new AbortController(),ticket=session;B('battleReady').disabled=true;statusBattle('Downloading the same audio, background, and chart for both players…');
  try{
   const id=encodeURIComponent(model.selected.id),info=await requestAPI('/api/songs/'+id);if(!info.shared)throw Error('This chart is no longer in the Community library.');
   const get=async asset=>{const response=await libraryFetch('/api/songs/'+id+'/'+asset,{signal:abort.signal});if(!response.ok)throw Error('Could not load the '+asset+'. Try reloading this round.');return response;};
   const [audioResponse,backgroundResponse]=await Promise.all([get('audio'),info.hasBackground?get('background'):null]);const [bytes,background]=await Promise.all([audioResponse.arrayBuffer(),backgroundResponse?backgroundResponse.blob():null]);
   if(abort.signal.aborted||ticket!==session||model?.round+':'+model?.selected?.id!==key)return;
   const audioHash=await crypto.subtle.digest('SHA-256',bytes),signature=JSON.stringify({audio:Array.from(new Uint8Array(audioHash)),chart:info.chart,difficulty:info.difficulty,duration:info.duration});const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature))),n=>n.toString(16).padStart(2,'0')).join('');
   const level={name:info.title,duration:info.duration,audioBytes:bytes,audioType:audioResponse.headers.get('Content-Type')||'audio/mpeg',background:background?new File([background],'Battle background',{type:background.type}):null,chart:info.chart,difficulty:info.difficulty,speed:+B('speed').value};
   await applyLevel(level);if(abort.signal.aborted||ticket!==session||model?.round+':'+model?.selected?.id!==key)return;prepared={key,hash};render();
  }catch(error){if(!abort.signal.aborted&&ticket===session){prepared={key,error:error.message};render();}}
 }
 async function ready(){if(!prepared?.hash||model?.phase!=='loading'||model.ready[seat])return;try{await audio().resume();requestGameFullscreen();action('ready',{hash:prepared.hash});}catch(error){statusBattle(error.message);}}
 function applyModel(){
  if(model.phase==='loading')prepare();
  if(['countdown','playing'].includes(model.phase)&&!roundLive&&prepared?.key===model.round+':'+model.selected?.id)startRound();
  if(['result','complete'].includes(model.phase)){stopRound();if(!B('battleDialog').open)B('battleDialog').showModal();}
  render();
 }
 function startRound(){
  if(roundLive||!prepared?.hash||!state.buffer)return;SongPreview.stop();if(B('results').open)B('results').close();if(B('pauseMenu').open)B('pauseMenu').close();if(B('battleDialog').open)B('battleDialog').close();setTab(false);resetRun();state.notes.forEach((note,index)=>note.battleIndex=index);reports.length=0;roundLive=true;localDone=false;roundEndHandled=false;document.body.classList.add('running');state.position=-5;
  const delay=(model.startAt-now())/1000;if(delay<.2){fail('The synchronized start arrived too late. Rejoin the room to keep the round fair.');return;}
  const outputDelay=Math.max(0,audio().currentTime-audibleContextTime());startSource(-Math.max(0,delay-outputDelay));B('stageMessage').hidden=true;B('pauseBtn').disabled=false;B('pauseBtn').textContent='Ⅱ Battle menu';B('playBtn').disabled=true;B('restartBtn').disabled=true;B('battleHud').hidden=false;B('game').scrollIntoView({block:'center',behavior:'instant'});render();
 }
 function stopRound(){if(!roundLive)return;roundLive=false;reports.length=0;stopSource();state.playing=false;state.paused=false;state.finished=true;clearInput();B('bgVideo').pause();document.body.classList.remove('running');B('battleHud').hidden=true;leaveFullscreen();}
 function localEnded(){if(!roundLive||localDone)return;localDone=true;state.position=Math.min(state.buffer.duration,songTime());stopSource();state.playing=false;state.paused=false;state.finished=true;clearInput();B('bgVideo').pause();status('Waiting for synchronized battle results…');}
 function onJudge(note,grade){if(!roundLive)return;reports.push({index:note.battleIndex,grade});}
 async function nextRound(){
  if(model.phase!=='result'||model.round>=3)return;model.round++;model.phase='picking';model.choices=[];model.votes=[null,null];model.ready=[false,false];model.hashes=[null,null];model.next=[false,false];model.selected=null;model.stats=null;model.startAt=null;prepared=null;loadKey='';rules=null;publish();
  try{const data=await requestAPI('/api/songs?mine=0&q=');pool=data.songs.filter(s=>!s.incomplete);}catch{}
  if(!active()||!isHost||model.phase!=='picking')return;try{model.choices=R.options(pool,model.used,secureRandom);publish();}catch(error){fail(error.message);}
 }
 function finishRound(){if(roundEndHandled||!rules||rules.status!=='finished')return;roundEndHandled=true;model.stats=summary();model.results.push({round:model.round,song:model.selected.title,winner:rules.winner,reason:rules.reason,players:summary().players});model.used.push(model.selected.id);model.next=[false,false];model.phase=model.round===3?'complete':'result';stopRound();publish();if(!B('battleDialog').open)B('battleDialog').showModal();}
 function tick(){if(!link)return;const time=Date.now();for(const [key,item] of pending){if(time-item.at>500){if(++item.tries>20){fail('The other player stopped responding. The match was stopped.');return;}item.at=time;link.send(item.message);}}
  if(!isHost&&!joined&&time-lastSend>1000){lastSend=time;send('hello',{name:me.name});}
  if(!isHost&&joined&&time-lastPing>1000){lastPing=time;send('ping',{sent:time},false,hostId);}
  if((joined&&!isHost||model?.players?.[1])&&lastPeerAt&&time-lastPeerAt>20000&&!['complete','error'].includes(model?.phase)){fail('Your opponent disconnected. This match was stopped.');return;}
  if(!isHost&&!joined&&time-connectedAt>15000){fail('No host responded to this room code. Check the code and ask your friend to keep their room open.');return;}
  if(roundLive&&reports.length&&time-lastHits>=120){lastHits=time;const hits=reports.splice(0,64);action('hits',{hits});}
  if(isHost&&rules&&['countdown','playing'].includes(model.phase)){const elapsed=(time-model.startAt)/1000;if(elapsed>=0)model.phase='playing';R.advance(rules,elapsed,RhythmEngine);model.stats=summary();if(rules.status==='finished'){finishRound();return;}}
  if(isHost&&time-lastSnapshot>700){lastSnapshot=time;publish();}
 }
 function render(){
  const connected=active();B('battleSetup').hidden=connected;B('battleRoom').hidden=!connected&&model?.phase!=='error';B('battleCreate').disabled=B('battleJoin').disabled=connected;
  if(!connected&&model?.phase==='error'){statusBattle(model.error);B('battleChoices').replaceChildren();B('battleReady').hidden=true;B('battleReload').hidden=true;B('battleNext').hidden=true;return;}
  if(!connected)return;text('battleRoomCode',code);text('battleRoundLabel','ROUND '+(model?.round||1)+' / 3');text('battlePlayers',(model?.players?.[0]?.name||'Host')+'  vs  '+(model?.players?.[1]?.name||'Waiting for a friend…'));
  const phase=model?.phase||'joining';B('battleSelected').hidden=phase!=='loading';B('battleReady').hidden=phase!=='loading';B('battleReload').hidden=phase!=='loading';B('battleNext').hidden=phase!=='result';B('battleChoices').hidden=!['picking','lobby'].includes(phase);B('battleResults').hidden=!['result','complete'].includes(phase);
  if(['picking','lobby'].includes(phase)){
   statusBattle(phase==='lobby'?'Share the code or invite link. The host must keep this page open.':'Pick one of four community charts. Matching votes win; different votes are randomly tie-broken.');
   const key=JSON.stringify([model.choices.map(s=>s.id),model.votes,phase]);if(B('battleChoices').dataset.key!==key){SongPreview.stop();B('battleChoices').dataset.key=key;B('battleChoices').replaceChildren();for(const song of model.choices){const card=document.createElement('div');card.className='song-card battle-choice';const detail=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('small'),actions=document.createElement('div'),pick=document.createElement('button');title.textContent=song.title;meta.textContent=song.difficulty+' · '+fmt(song.duration)+' · '+song.noteCount+' notes';detail.append(title,meta);actions.className='song-actions';pick.className='secondary';pick.textContent=model.votes[seat]===song.id?'✓ Your pick':model.votes.some(v=>v===song.id)?'Opponent’s pick · Choose':'Choose chart';pick.disabled=phase!=='picking'||!!model.votes[seat];pick.onclick=()=>action('vote',{songId:song.id});actions.append(pick);card.append(detail,actions);B('battleChoices').append(card);SongPreview.attach(card,async signal=>{const get=async asset=>{const response=await libraryFetch('/api/songs/'+encodeURIComponent(song.id)+'/'+asset,{signal});if(!response.ok)throw Error('Preview unavailable.');return response.blob();};const [audio,background]=await Promise.all([get('audio'),song.hasBackground?get('background'):null]);return {audio,background,duration:song.duration};});}}
  }else if(phase==='loading'){
   const clockReady=isHost||clockSamples.length>0;B('battleReady').disabled=!prepared?.hash||!!model.ready[seat]||!clockReady;B('battleReady').textContent=model.ready[seat]?'✓ Ready · waiting for opponent':'Ready for round '+model.round;text('battleSelected',model.selected.title);statusBattle(model.error||prepared?.error||(prepared?.hash?(clockReady?'Chart loaded. Click Ready to enable audio. Both players must be ready.':'Synchronizing the start clock…'):'Loading the same chart and background for both players…'));
  }else if(['result','complete'].includes(phase)){
   SongPreview.stop();const wins=model.results.reduce((a,r)=>{if(r.winner===0||r.winner===1)a[r.winner]++;return a;},[0,0]);text('battleScoreline',model.players[0].name+' '+wins[0]+' — '+wins[1]+' '+model.players[1].name);B('battleResultRows').replaceChildren();for(const result of model.results){const row=document.createElement('p');row.textContent='Round '+result.round+' · '+result.song+' · '+(result.winner===null?'Draw':model.players[result.winner].name+' wins')+' · '+result.players.map(p=>p.accuracy.toFixed(2)+'%').join(' / ');B('battleResultRows').append(row);}if(phase==='complete'){const winner=model.forfeitWinner!==undefined?model.forfeitWinner:model.results.length===3?R.matchWinner(model.results).winner:null;statusBattle(model.error||(winner===null?'Match drawn.':model.players[winner].name+' wins the match!'));}else{const result=model.results.at(-1);statusBattle((result.reason==='knockout'?'Knockout! ':'Song complete. ')+(result.winner===null?'Round drawn.':model.players[result.winner].name+' wins this round.'));B('battleNext').disabled=!!model.next[seat];B('battleNext').textContent=model.next[seat]?'Waiting for opponent…':'Choose song for round '+(model.round+1);}
  }
  if(model.stats&&seat!==null){const self=model.stats.players[seat],other=model.stats.players[1-seat];state.health=self.health;updateHUD();text('battleHudRound','BATTLE · ROUND '+model.round+' / 3');text('battleOpponent',model.players[1-seat]?.name||'Opponent');B('battleOpponentLife').style.width=other.health+'%';text('battleOpponentStats',other.health+' LIFE · '+other.accuracy.toFixed(2)+'%');text('battleSelfStats',self.health+' LIFE · '+self.accuracy.toFixed(2)+'%');}
 }
 function pause(){if(!roundLive)return;if(B('battleLeaveDialog').open)B('battleLeaveDialog').close();else B('battleLeaveDialog').showModal();}
 function leave(){
  if(link){if(isHost&&model.players[1]&&!['complete','error'].includes(model.phase)){model.phase='complete';model.forfeitWinner=1;model.error=me.name+' left the match.';publish();}else if(!isHost)send('forfeit',{round:model?.round},false,hostId);const old=link;link=null;setTimeout(()=>old.close(),200);}
  session++;clearInterval(loop);loop=null;if(loadingAbort)loadingAbort.abort();stopRound();pending.clear();prepared=null;loadKey='';rules=null;model=null;joined=false;hostId=null;seat=null;SongPreview.stop();if(B('battleDialog').open)B('battleDialog').close();if(B('battleLeaveDialog').open)B('battleLeaveDialog').close();stopToStudio();updateMeta();B('battleHud').hidden=true;status('Back to solo play.');
 }
 B('battleBtn').onclick=open;B('battleCreate').onclick=()=>connectRoom(true);B('battleJoin').onclick=()=>connectRoom(false);B('battleReady').onclick=ready;B('battleReload').onclick=()=>{if(model?.ready[seat])return;prepare(true);};B('battleNext').onclick=()=>action('next');B('battleLeave').onclick=leave;B('battleForfeit').onclick=leave;B('battleContinue').onclick=()=>B('battleLeaveDialog').close();B('battleDialog').addEventListener('cancel',event=>{if(active()){event.preventDefault();if(roundLive)pause();else leave();}});B('battleCopy').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname+'?battle='+code);statusBattle('Invite link copied. Send it to your opponent.');}catch{statusBattle('Share room code '+code+' with your opponent.');}};
 const invite=new URLSearchParams(location.search).get('battle');if(invite){B('battleCodeInput').value=invite.toUpperCase().slice(0,10);open();}
 return {active,isRunning:()=>roundLive,onJudge,localEnded,pause,leave};
})();
