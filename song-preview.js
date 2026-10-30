(function(root){'use strict';
function matchesSong(song,query){const haystack=[song.name,song.title,song.creator,song.difficulty,song.rating?'level '+song.rating:''].filter(Boolean).join(' ').toLowerCase();return String(query||'').trim().toLowerCase().split(/\s+/).every(word=>haystack.includes(word));}
function previewPlacement(anchor,width,height=236,viewport={width:1024,height:768}){
 const margin=12,gap=12,available=Math.max(1,viewport.width-margin*2),right=viewport.width-anchor.right-gap-margin,left=anchor.left-gap-margin;
 width=Math.min(width,available);let x,y;
 if(Math.max(right,left)>=240){width=Math.min(width,Math.max(right,left));x=right>=width?anchor.right+gap:anchor.left-gap-width;y=anchor.top;}
 else{x=viewport.width-width-margin;y=anchor.bottom+gap;if(y+height>viewport.height-margin)y=anchor.top-height-gap;}
 return {left:Math.max(margin,Math.min(viewport.width-width-margin,x)),top:Math.max(margin,Math.min(viewport.height-height-margin,y)),width};
}
function createController(deps={}){
 const doc=deps.document||root.document,urls=deps.URL||root.URL,timer=deps.setTimeout||root.setTimeout.bind(root),clear=deps.clearTimeout||root.clearTimeout.bind(root),Abort=deps.AbortController||root.AbortController;
 let active=null,pending=null;
 function stop(){if(pending){clear(pending.timer);pending=null;}const old=active;active=null;if(!old)return;old.abort.abort();clear(old.timer);for(const media of old.media){media.pause();media.removeAttribute('src');media.load();}for(const url of old.urls)urls.revokeObjectURL(url);try{old.view.panel.hidePopover?.();}catch{}old.view.panel.hidden=true;old.view.button.setAttribute('aria-expanded','false');old.card.classList.remove('previewing');old.view.button.textContent='▶ Preview';}
 function play(owner){if(active!==owner||!owner.audio)return;const player=owner.audio;const result=player.play();Promise.resolve(result).then(()=>{if(active!==owner){player.pause();return;}owner.view.status.textContent='Song preview · 10 seconds';owner.view.button.textContent='■ Stop preview';clear(owner.timer);owner.timer=timer(stop,10000);}).catch(()=>{if(active===owner){owner.view.status.textContent='Click Play preview to hear the song.';owner.view.button.textContent='▶ Play preview';}});}
 async function start(card,load,view){
  stop();const owner={card,view,abort:new Abort(),media:[],urls:[]};active=owner;view.panel.hidden=false;view.button.setAttribute('aria-expanded','true');
  try{view.panel.showPopover?.();}catch{}
  const viewport=deps.viewport||{width:root.innerWidth||1024,height:root.innerHeight||768},anchor=card.getBoundingClientRect?.()||{left:12,right:300,top:100,bottom:160};
  const placed=previewPlacement(anchor,340,236,viewport);Object.assign(view.panel.style,{position:'fixed',left:placed.left+'px',top:placed.top+'px',width:placed.width+'px'});
  card.classList.add('previewing');view.status.textContent='Loading preview…';view.button.textContent='■ Stop preview';view.frame.replaceChildren();
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
  const panel=doc.createElement('div'),frame=doc.createElement('div'),status=doc.createElement('span'),button=doc.createElement('button');panel.className='song-preview';panel.setAttribute('popover','manual');panel.hidden=true;frame.className='preview-frame';status.className='preview-status';status.setAttribute('role','status');button.type='button';button.className='secondary preview-toggle';button.textContent='▶ Preview';button.setAttribute('aria-label','Preview song and background');const heading=doc.createElement('div'),title=doc.createElement('strong'),closeButton=doc.createElement('button');heading.className='preview-heading';title.textContent=card.querySelector('strong')?.textContent||'Song preview';closeButton.type='button';closeButton.className='preview-close';closeButton.textContent='×';closeButton.setAttribute('aria-label','Close song preview');closeButton.onclick=stop;heading.append(title,closeButton);panel.append(heading,frame,status);card.append(panel);(card.querySelector('.song-actions')||card).append(button);button.setAttribute('aria-expanded','false');const view={panel,frame,status,button,closeButton};
  const schedule=()=>{if(active?.card===card||pending?.card===card)return;stop();pending={card,timer:timer(()=>{pending=null;start(card,load,view);},250)};};
  const leave=()=>{if(active?.card===card||pending?.card===card)stop();};
  card.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')schedule();});card.addEventListener('pointerleave',event=>{if(!panel.contains(event.relatedTarget))leave();});card.addEventListener('focusin',schedule);card.addEventListener('focusout',event=>{if(!card.contains(event.relatedTarget))leave();});
  card.addEventListener('click',event=>{if(event.target.closest('button')!==button)leave();});
  button.onclick=()=>{if(active?.card===card){if(active.audio&&button.textContent.includes('Play preview'))play(active);else if(button.textContent.includes('Retry'))start(card,load,view);else stop();}else start(card,load,view);};return view;
 }
 return {attach,stop};
}
const api={matchesSong,previewPlacement,createController};if(root.document){Object.assign(api,createController());for(const dialog of root.document.querySelectorAll('dialog'))dialog.addEventListener('close',api.stop);root.addEventListener('resize',api.stop);root.addEventListener('scroll',event=>{if(!event.target.closest?.('.song-preview'))api.stop();},true);root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)api.stop();});}
if(typeof module!=='undefined')module.exports=api;root.SongPreview=api;
})(typeof window!=='undefined'?window:globalThis);
