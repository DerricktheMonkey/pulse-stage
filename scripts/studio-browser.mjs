import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
await mkdir('.repair-results',{recursive:true});
const root=path.resolve(process.env.STUDIO_ROOT||'public');
const server=createServer(async(req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));const target=(await stat(file)).isDirectory()?path.join(file,'index.html'):file;if(!target.startsWith(root+path.sep))throw Error('Invalid path');const data=await readFile(target);res.setHeader('Content-Type',target.endsWith('.html')?'text/html':target.endsWith('.css')?'text/css':'text/javascript');res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const chrome=['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
const browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],passed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const noteState=()=>page.evaluate(()=>state.notes.map(({time,lane,duration})=>({time,lane,duration})));
function wav(){const rate=11025,length=rate*12,b=Buffer.alloc(44+length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(length*2,40);for(let i=0;i<length;i++){const t=i/rate,hz=[220,330,440,660][Math.floor(t*4)%4],v=Math.sin(2*Math.PI*hz*t)*Math.exp(-(t%.25)*12)*.35;b.writeInt16LE(Math.round(v*32767),44+i*2);}return b;}
async function position(time,lane){const r=await page.locator('#timeline').boundingBox();const view=await page.evaluate(()=>({start:Number(document.getElementById('editorPosition').value),span:Number(document.getElementById('mapZoom').value)}));return {x:r.x+70+(lane+.5)*(r.width-88)/4,y:r.y+35+(1-(time-view.start)/view.span)*(r.height-67)};}
async function clickNote(time,lane){await page.locator('#timeline').scrollIntoViewIfNeeded();const p=await position(time,lane);await page.mouse.click(p.x,p.y);}
async function dragNote(a,b,l1,l2=l1){await page.locator('#timeline').scrollIntoViewIfNeeded();const p=await position(a,l1),q=await position(b,l2);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:8});await page.mouse.up();}
try{
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>typeof BeatmapStudio!=='undefined');await page.evaluate(()=>studioReady);
 await page.click('#createModeBtn');await page.waitForFunction(()=>state.editor);
 assert.equal(await page.locator('#editorView h2').innerText(),'Beatmap Studio');
 assert.equal(await page.locator('.studio-optional').first().getAttribute('open'),null);passed.push('new vertical creator is primary; recording is optional');
 await page.setInputFiles('#songFile',{name:'Studio Test.wav',mimeType:'audio/wav',buffer:wav()});
 await page.waitForFunction(()=>state.buffer&&!state.loading&&!state.busy,{},{timeout:90000});
 await page.locator('#alignBpm').fill('120');await page.locator('#alignBpm').press('Tab');await page.locator('#alignAnchor').fill('0');await page.locator('#alignAnchor').press('Tab');
 await clickNote(1,0);assert.equal((await noteState()).length,1);
 await dragNote(1.5,2.5,2);let notes=await noteState();assert.equal(notes.length,2);assert.equal(notes[1].duration,1);passed.push('mouse placement and drag-created hold');
 await page.selectOption('#mapTool','select');await dragNote(1,1.25,0,1);notes=await noteState();assert.deepEqual(notes[0],{time:1.25,lane:1,duration:0});
 await dragNote(2.5,3,2);assert.equal((await noteState())[1].duration,1.5);passed.push('move notes across columns and resize hold tails');
 await page.selectOption('#mapTool','draw');await clickNote(1.25,3);assert.equal((await noteState()).length,3);
 await page.click('#editorUndo');assert.equal((await noteState()).length,2);await page.click('#mapRedo');assert.equal((await noteState()).length,3);passed.push('chords and undo/redo');
 await page.locator('#timeline').focus();await page.keyboard.press('Control+a');await page.keyboard.press('Control+c');assert.equal(await page.evaluate(()=>BeatmapStudio.clipboard.length),3);
 await page.locator('#studioOverview').scrollIntoViewIfNeeded();const overview=await page.locator('#studioOverview').boundingBox();await page.mouse.click(overview.x+overview.width*4.5/12,overview.y+24);assert(Math.abs(await page.evaluate(()=>recorder.position)-4.5)<.02,'Overview click moves the cursor to the paste position');await page.click('#studioPaste');assert.equal((await noteState()).length,6);
 await page.click('#studioPaste');assert.equal((await noteState()).length,6);assert.match(await page.locator('#recordStatus').innerText(),/overlap/);passed.push('multi-select/copy/paste and overlap rejection');
 await page.locator('#alignBpm').fill('135');await page.locator('#alignBpm').press('Tab');await page.locator('#alignAnchor').fill('0.1');await page.locator('#alignAnchor').press('Tab');
 const expected=await noteState();
 const downloadPromise=page.waitForEvent('download');await page.click('#exportChart');const download=await downloadPromise;await download.saveAs('.repair-results/export.json');const exported=JSON.parse(await readFile('.repair-results/export.json','utf8'));assert.deepEqual(exported.notes,expected);assert.equal(exported.creatorTiming.bpm,135);assert.equal(exported.creatorTiming.anchor,.1);
 await page.click('#editorClear');assert.equal((await noteState()).length,0);await page.setInputFiles('#chartFile',{name:'chart.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.waitForFunction(()=>state.notes.length===6);assert.deepEqual(await noteState(),expected);passed.push('lossless export/import including BPM and first beat');
 await page.click('#editorSave');await page.waitForFunction(async()=>((await read('localLevels'))||[]).length>0);const saved=await page.evaluate(async()=>read('localLevel:'+(await read('localLevels'))[0].id));assert.equal(saved.chart.creatorTiming.bpm,135);assert.deepEqual(saved.chart.notes,expected);
 await page.reload();await page.waitForFunction(()=>typeof BeatmapStudio!=='undefined'&&state.buffer&&!state.loading,{},{timeout:90000});assert.deepEqual(await noteState(),expected);
 await page.click('#createModeBtn');await page.click('#studioLibrary');await page.locator('#localSongCards button').filter({hasText:'Load song'}).first().click();await page.waitForFunction(()=>state.editor&&state.buffer&&state.notes.length===6);assert.equal(await page.inputValue('#alignBpm'),'135');assert.deepEqual(await noteState(),expected);passed.push('local save, reload, and reopen saved map for editing');
 await page.click('#studioPlaytest');await page.waitForFunction(()=>state.playing,{},{timeout:20000});assert.equal(await page.evaluate(()=>state.trainingRun),true);await page.click('#studioReturn');await page.waitForFunction(()=>state.editor&&!state.playing);assert.deepEqual(await noteState(),expected);passed.push('real gameplay playtest returns to exact draft without ranked scoring');
 await page.locator('#editorView').screenshot({path:'.repair-results/studio-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert((await page.locator('#timeline').boundingBox()).width>200);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'mobile layout must not overflow horizontally');
 await page.screenshot({path:'.repair-results/studio-mobile.png',fullPage:true});passed.push('responsive mobile layout');
 assert.deepEqual(errors,[],'No uncaught browser errors');
 await writeFile('.repair-results/browser.json',JSON.stringify({passed,errors},null,2));console.log('BROWSER_PASS',JSON.stringify(passed));
}catch(error){await writeFile('.repair-results/browser.json',JSON.stringify({passed,errors,failure:error.stack},null,2));await page.screenshot({path:'.repair-results/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
