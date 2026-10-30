(function(root){'use strict';
function matchesSong(song,query){const haystack=[song.name,song.title,song.creator,song.difficulty,song.rating?'level '+song.rating:''].filter(Boolean).join(' ').toLowerCase();return String(query||'').trim().toLowerCase().split(/\s+/).every(word=>haystack.includes(word));}
function createController(deps={}){
 const doc=deps.document||root.document,urls=deps.URL||root.URL,timer=deps.setTimeout||root.setTimeout.bind(root),clear=deps.clearTimeout||root.clearTimeout.bind(root),Abort=deps.AbortController||root.AbortController;
 let active=null,pending=null;
 function stop(){if(pending){clear(pending.timer);pending=null;}const old=active;active=null;if(!old)return;old.abort.abort();clear(old.timer);for(const media of old.media){media.pause();media.removeAttribute('src');media.load();}for(const url of old.urls)urls.revokeObjectURL(url);old.view.panel.hidden=true;old.card.classList.remove('previewing');old.view.button.textContent='▶ Preview';}
 function play(owner){if(active!==owner||!owner.audio)return;const player=owner.audio;const result=player.play();Promise.resolve(result).then(()=>{if(active!==owner){player.pause();return;}owner.view.status.textContent='Song preview · 10 seconds';owner.view.button.textContent='■ Stop preview';clear(owner.timer);owner.timer=timer(stop,10000);}).catch(()=>{if(active===owner){owner.view.status.textContent='Click Play preview to hear the song.';owner.view.button.textContent='▶ Play preview';}});}
 async function start(card,load,view){
  stop();const owner={card,view,abort:new Abort(),media:[],urls:[]};active=owner;view.panel.hidden=false;card.classList.add('previewing');view.status.textContent='Loading preview…';view.button.textContent='■ Stop preview';view.frame.replaceChildren();
  try{
   const payload=await load(owner.abort.signal);if(active!==owner)return;if(!payload.audio||!payload.audio.size)throw Error('Audio preview unavailable.');
   const source=blob=>{const url=urls.createObjectURL(blob);owner.urls.push(url);return url;};
   const player=doc.createElement('audio');owner.audio=player;owner.media.push(player);player.preload='auto';player.volume=.25;player.src=source(payload.audio);
   const previewStart=duration=>Number.isFinite(duration)&&duration>2?Math.min(30,duration*.25):0;
   player.onloadedmetadata=()=>{if(active===owner)player.currentTime=previewStart(player.duration);};
   player.onended=()=>{if(active===owner)stop();};player.onerror=()=>{if(active===owner){view.status.textContent='This audio format cannot be previewed in this browser.';view.button.textContent='▶ Retry preview';}};
   if(payload.background&&payload.background.size){
    const isVideo=payload.background.type.startsWith('video/'),media=doc.createElement(isVideo?'video':'img');media.src=source(payload.background);media.className='preview-background';
    if(isVideo){owner.media.push(media);media.muted=true;media.loop=true;media.playsInline=true;media.preload='metadata';media.onloadedmetadata=()=>{if(active!==owner)return;media.currentTime=media.duration?previewStart(player.duration||payload.duration)%media.duration:0;Promise.resolve(media.play()).catch(()=>{});};}
    else media.alt='Background preview';view.frame.append(media);
   }else{const placeholder=doc.createElement('span');placeholder.textContent='♫  Song preview · no background';view.frame.append(placeholder);}
   play(owner);
  }catch(error){if(active===owner){view.status.textContent=error.name==='AbortError'?'Preview cancelled.':error.message||'Preview unavailable.';view.button.textContent='▶ Retry preview';}}
 }
 function attach(card,load){
  const panel=doc.createElement('div'),frame=doc.createElement('div'),status=doc.createElement('span'),button=doc.createElement('button');panel.className='song-preview';panel.hidden=true;frame.className='preview-frame';status.className='preview-status';status.setAttribute('role','status');button.type='button';button.className='secondary preview-toggle';button.textContent='▶ Preview';button.setAttribute('aria-label','Preview song and background');panel.append(frame,status);card.append(panel);(card.querySelector('.song-actions')||card).append(button);const view={panel,frame,status,button};
  const schedule=()=>{if(active?.card===card||pending?.card===card)return;stop();pending={card,timer:timer(()=>{pending=null;start(card,load,view);},250)};};
  const leave=()=>{if(active?.card===card||pending?.card===card)stop();};
  card.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')schedule();});card.addEventListener('pointerleave',leave);card.addEventListener('focusin',schedule);card.addEventListener('focusout',event=>{if(!card.contains(event.relatedTarget))leave();});
  card.addEventListener('click',event=>{if(event.target.closest('button')!==button)leave();});
  button.onclick=()=>{if(active?.card===card){if(active.audio&&button.textContent.includes('Play preview'))play(active);else if(button.textContent.includes('Retry'))start(card,load,view);else stop();}else start(card,load,view);};return view;
 }
 return {attach,stop};
}
const api={matchesSong,createController};if(root.document){Object.assign(api,createController());for(const dialog of root.document.querySelectorAll('dialog'))dialog.addEventListener('close',api.stop);root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)api.stop();});}
if(typeof module!=='undefined')module.exports=api;root.SongPreview=api;
})(typeof window!=='undefined'?window:globalThis);
