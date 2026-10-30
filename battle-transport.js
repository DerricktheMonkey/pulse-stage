(function(root){'use strict';
function connect(config,code,{message=()=>{},disconnect=()=>{},peerLeft=()=>{},participantId='',WebSocket:Socket=root.WebSocket,timeout=10000}={}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config?.url||'')||!config.publishableKey)throw Error('The realtime library connection is unavailable.');if(!/^[A-Z2-9]{10}$/.test(code))throw Error('Enter the 10-character room code.');
 return new Promise((resolve,reject)=>{const topic='realtime:pulse-battle-v1-'+code,ws=new Socket(config.url.replace('https:','wss:')+'/realtime/v1/websocket?apikey='+encodeURIComponent(config.publishableKey)+'&vsn=1.0.0');let ref=0,joined=false,closed=false,heartbeat;
 const send=(event,payload={},target=topic)=>{if(ws.readyState!==1)return false;ws.send(JSON.stringify({topic:target,event,payload,ref:String(++ref),...(target===topic?{join_ref:'1'}:{})}));return true;};
 const timer=setTimeout(()=>{reject(Error('Realtime connection timed out. Try again.'));close();},timeout);
 function close(){if(closed)return;closed=true;clearTimeout(timer);clearInterval(heartbeat);try{send('phx_leave');ws.close();}catch{}}
 ws.onopen=()=>send('phx_join',{config:{broadcast:{ack:true,self:false},presence:{enabled:!!participantId,key:participantId},private:false}});
 ws.onmessage=event=>{let data;try{data=JSON.parse(event.data);}catch{return;}if(data.event==='phx_reply'&&data.ref==='1'){clearTimeout(timer);if(data.payload?.status!=='ok'){reject(Error('Could not join realtime room: '+String(data.payload?.response?.reason||'connection rejected')));close();return;}joined=true;if(participantId)send('presence',{type:'presence',event:'track',payload:{id:participantId}});heartbeat=setInterval(()=>send('heartbeat',{},'phoenix'),25000);resolve({send:payload=>send('broadcast',{type:'broadcast',event:'battle',payload}),close});}else if(data.topic===topic&&data.event==='broadcast'&&data.payload?.event==='battle'){const payload=data.payload.payload;if(payload&&typeof payload==='object')message(payload);}else if(data.topic===topic&&data.event==='presence_diff'){for(const [key,entry] of Object.entries(data.payload?.leaves||{}))for(const meta of entry.metas||[])peerLeft(meta.id||key);}else if(['phx_error','phx_close'].includes(data.event)){if(!joined)reject(Error('Realtime channel closed.'));else disconnect();close();}};
 ws.onerror=()=>{if(!joined){reject(Error('Could not connect to realtime. Check your connection.'));close();}};
 ws.onclose=()=>{clearTimeout(timer);clearInterval(heartbeat);if(!closed){closed=true;if(joined)disconnect();else reject(Error('Realtime connection closed.'));}};
 });
}
const api={connect};if(typeof module!=='undefined')module.exports=api;root.BattleTransport=api;
})(typeof window!=='undefined'?window:globalThis);
