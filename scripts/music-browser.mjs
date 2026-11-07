import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
await mkdir('.music-results',{recursive:true});
const root=path.resolve(process.env.STUDIO_ROOT||'public');
const server=createServer(async(req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname)),target=(await stat(file)).isDirectory()?path.join(file,'index.html'):file;if(!target.startsWith(root+path.sep))throw Error('path');const b=await readFile(target);res.setHeader('Content-Type',target.endsWith('.html')?'text/html':target.endsWith('.css')?'text/css':'text/javascript');res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(4174,'127.0.0.1',r));
const exe=['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync),browser=await chromium.launch({headless:true,...(exe?{executablePath:exe}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],passed=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
function wav(){const rate=11025,len=rate*16,b=Buffer.alloc(44+len*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(len*4,40);for(let i=0;i<len;i++){const t=i/rate,p=t-2,hz=[220,330,440,660][Math.max(0,Math.floor(p*4))%4],v=t>=2&&t<14&&!(t>=7&&t<8)?.3*Math.sin(2*Math.PI*hz*p)*(.4+.6*Math.exp(-(p%.25)*15)):0;b.writeInt16LE(Math.round(v*32767),44+i*4);b.writeInt16LE(Math.round(v*.8*32767),46+i*4);}return b;}
try{
 await page.goto('http://127.0.0.1:4174');await page.evaluate(()=>studioReady);
 assert.equal(await page.locator('[data-diff]').count(),5);assert.equal(await page.locator('[data-diff="beginner"],option[value="beginner"]').count(),0);passed.push('Beginner removed from play, creation and battle controls');
 const bytes=wav();await page.setInputFiles('#songFile',{name:'Padded song.wav',mimeType:'audio/wav',buffer:bytes});await page.waitForFunction(()=>state.buffer&&!state.loading&&!state.busy,{}, {timeout:90000});
 const audio=await page.evaluate(()=>({duration:state.buffer.duration,trim:state.audioTrim,byteLength:state.audioBytes.byteLength,channels:state.buffer.numberOfChannels,notes:state.notes.length,internal:state.buffer.getChannelData(0)[Math.floor((7.5-state.audioTrim.start)*state.buffer.sampleRate)]}));
 assert(audio.duration>12&&audio.duration<12.3);assert(audio.trim.start>1.9&&audio.trim.start<2);assert(audio.trim.end>14&&audio.trim.end<14.2);assert.equal(audio.byteLength,bytes.length);assert.equal(audio.channels,2);assert.equal(audio.internal,0);assert(audio.notes>0);passed.push('real decoded stereo trims both edges, preserves original bytes and inner silence');
 const counts={};for(const diff of ['easy','normal','hard','insane','impossible']){counts[diff]=await page.evaluate(async diff=>{state.difficulty=diff;await generate();if(!state.notes.length)throw Error('empty '+diff);RhythmEngine.validateChart({notes:state.notes},state.buffer.duration);return state.notes.length;},diff);}assert(counts.impossible>counts.normal);passed.push('all five difficulties scan in the real worker with valid notes');
 const trim=audio.trim;
 await page.click('#createModeBtn');await page.waitForFunction(()=>state.editor);await page.click('#studioCurrent');
 const custom={version:2,title:'Padded song',difficulty:'beginner',customChart:true,bpm:120,offsetMs:35,creatorTiming:{bpm:120,anchor:.1,division:4,span:4},audioTrim:trim,notes:[{time:.5,lane:0,duration:0},{time:1.25,lane:2,duration:.5}]};
 await page.setInputFiles('#chartFile',{name:'chart.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(custom))});await page.waitForFunction(()=>state.notes.length===2&&state.customChart);
 assert.equal(await page.evaluate(()=>state.difficulty),'easy');assert.deepEqual(await page.evaluate(()=>chartNotes()),custom.notes);passed.push('legacy difficulty imports as Easy without changing authored notes');
 await page.click('#editorSave');await page.waitForFunction(async()=>((await read('localLevels'))||[]).length>0);
 const before=await page.evaluate(async()=>{const item=(await read('localLevels'))[0],level=await read('localLevel:'+item.id);return {duration:state.buffer.duration,trim:level.chart.audioTrim,notes:chartNotes(),bytes:level.audioBytes.byteLength,anchor:level.chart.creatorTiming.anchor};});
 await page.reload();await page.evaluate(()=>studioReady);const after=await page.evaluate(()=>({duration:state.buffer.duration,notes:chartNotes(),trim:state.audioTrim}));assert.deepEqual(after.notes,before.notes);assert(Math.abs(after.duration-before.duration)<1e-6);assert.deepEqual(after.trim,before.trim);assert.equal(before.bytes,bytes.length);passed.push('save/reload keeps timing exact and does not trim the same song twice');
 await page.evaluate(async()=>{const item=(await read('localLevels'))[0],level=await read('localLevel:'+item.id);await applyLevel(level);});assert.deepEqual(await page.evaluate(()=>chartNotes()),custom.notes);assert.equal(await page.evaluate(()=>state.difficulty),'easy');passed.push('saved level loader restores cropped playback against original audio');
 // Exercise old charts that lack trim metadata. Protect manual timing and offsets.
 const legacy=await page.evaluate(async()=>{const item=(await read('localLevels'))[0],level=await read('localLevel:'+item.id);delete level.chart.audioTrim;level.difficulty='beginner';level.chart.notes=[{time:2.5,lane:1,duration:.75},{time:10,lane:2,duration:0}];level.chart.creatorTiming={bpm:120,anchor:.125,division:4,span:4};await applyLevel(level);return {trim:state.audioTrim,notes:chartNotes(),difficulty:state.difficulty,anchor:state.creatorTiming.anchor};});
 assert.equal(legacy.difficulty,'easy');assert(Math.abs(legacy.notes[0].time+legacy.trim.start-2.5)<1e-6);assert.equal(legacy.notes[0].duration,.75);passed.push('old saved charts rebase once, preserving hold lengths and source alignment');
 assert.deepEqual(errors,[]);await writeFile('.music-results/browser.json',JSON.stringify({passed,errors,counts,audio},null,2));console.log('PASS',passed);
}catch(error){await writeFile('.music-results/browser.json',JSON.stringify({passed,errors,failure:String(error.stack)},null,2));throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
