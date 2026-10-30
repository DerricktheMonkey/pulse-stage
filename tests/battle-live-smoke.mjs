// Uses the same public project settings as the browser, without creating users,
// database records, or permanent rooms. Run explicitly, not in offline tests.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),T=require('../public/battle-transport.js'),context={window:{}};
vm.runInNewContext(fs.readFileSync('public/backend-config.js','utf8'),context);
const config=context.window.PulseBackendConfig,alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',code=Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>alphabet[n%32]).join('');
let left,right;
const wait=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};},first=wait(),second=wait();
const deadline=setTimeout(()=>{console.error('::error::Live battle realtime check timed out.');left?.close();right?.close();process.exit(1);},25000);
try{
 left=await T.connect(config,code,{participantId:'smoke-left',message:msg=>{if(msg.type==='echo')second.resolve(msg);}});
 right=await T.connect(config,code,{participantId:'smoke-right',message:msg=>{if(msg.type==='hello')first.resolve(msg);}});
 assert(left.send({type:'hello',nonce:code}));assert.equal((await first.promise).nonce,code);
 assert(right.send({type:'echo',nonce:code}));assert.equal((await second.promise).nonce,code);
 console.log('PASS: two live public realtime clients joined the same room and exchanged battle messages in both directions.');
}catch(error){console.error('::error::Live realtime failed: '+String(error.message).replace(/\n/g,' '));process.exitCode=1;}
finally{clearTimeout(deadline);left?.close();right?.close();}
