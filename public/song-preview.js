(function(root){'use strict';
function matchesSong(song,query){const haystack=[song.name,song.title,song.creator,song.difficulty,song.rating?'level '+song.rating:''].filter(Boolean).join(' ').toLowerCase();return String(query||'').trim().toLowerCase().split(/\s+/).every(word=>haystack.includes(word));}
function createController(deps={}){
 const doc=deps.document||root.document,urls=deps.URL||root.URL,timer=deps.setTimeout||root.setTimeout.bind(root),clear=deps.clearTimeout||root.clearTimeout.bind(root),Abort=deps.AbortController||root.AbortController;
 let active=null;
 function stop(){const old=active;active=null;if(!old)return;old.abort.abort();clear(old.timer);if(old.audio){old.audio.pause();old.audio.removeAttribute('src');old.audio.load();}if(old.url)urls.revokeObjectURL(old.url);old.view.button.setAttribute('aria-pressed','false');old.card.classList.remove('previewing');old.view.button.textContent='▶ Preview';old.view.status.textContent='';}
 function play(owner){if(active!==owner||!owner.audio)return;const player=owner.audio;Promise.resolve(player.play()).then(()=>{if(active!==owner){player.pause();return;}owner.view.status.textContent='Song preview · 10 seconds';owner.view.button.textContent='■ Stop preview';clear(owner.timer);owner.timer=timer(stop,10000);}).catch(()=>{if(active===owner){owner.view.status.textContent='Press Play preview to hear the song.';owner.view.button.textContent='▶ Play preview';}});}
 async function start(card,load,view){
  stop();const owner={card,view,abort:new Abort()};active=owner;view.button.setAttribute('aria-pressed','true');card.classList.add('previewing');view.status.textContent='Loading preview…';view.button.textContent='■ Stop preview';
  try{
   const payload=await load(owner.abort.signal);if(active!==owner)return;if(!payload.audio?.size)throw Error('Audio preview unavailable.');
   const player=doc.createElement('audio');owner.audio=player;player.preload='auto';player.volume=.25;owner.url=urls.createObjectURL(payload.audio);player.src=owner.url;
   player.onloadedmetadata=()=>{if(active===owner)player.currentTime=Number.isFinite(player.duration)&&player.duration>2?Math.min(30,player.duration*.25):0;};
   player.onended=()=>{if(active===owner)stop();};player.onerror=()=>{if(active===owner){view.status.textContent='This audio format cannot be previewed in this browser.';view.button.textContent='▶ Retry preview';}};
   play(owner);
  }catch(error){if(active===owner){view.status.textContent=error.name==='AbortError'?'Preview cancelled.':error.message||'Preview unavailable.';view.button.textContent='▶ Retry preview';}}
 }
 function attach(card,load){
  const status=doc.createElement('span'),button=doc.createElement('button');status.className='preview-status';status.setAttribute('role','status');button.type='button';button.className='secondary preview-toggle';button.textContent='▶ Preview';button.setAttribute('aria-label','Preview song');button.setAttribute('aria-pressed','false');(card.querySelector('.song-actions')||card).append(button,status);const view={status,button};
  button.onclick=event=>{event?.stopPropagation();if(active?.card===card){if(active.audio&&button.textContent.includes('Play preview'))play(active);else if(button.textContent.includes('Retry'))start(card,load,view);else stop();}else start(card,load,view);};return view;
 }
 function selectable(card,button){
  card.classList.add('song-selectable');card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label','Song: '+(card.querySelector('strong')?.textContent||'select song')+'. Press Enter to select.');
  button.addEventListener('click',stop);const select=()=>{if(button.disabled)return;button.click();};
  card.addEventListener('click',event=>{if(event.defaultPrevented||event.target.closest('button,a,input,select,textarea'))return;select();});
  card.addEventListener('keydown',event=>{if(event.target!==card||!['Enter',' '].includes(event.key))return;event.preventDefault();select();});
 }
 return {attach,selectable,stop};
}
const api={matchesSong,createController};if(root.document){Object.assign(api,createController());for(const dialog of root.document.querySelectorAll('dialog'))dialog.addEventListener('close',api.stop);root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)api.stop();});}
if(typeof module!=='undefined')module.exports=api;root.SongPreview=api;
})(typeof window!=='undefined'?window:globalThis);
