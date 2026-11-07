import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.env.STUDIO_ROOT||'public'),report={root:process.env.STUDIO_ROOT||'public',passed:[],errors:[]};
await mkdir('.grade-results',{recursive:true});
const server=createServer(async(req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.join(root,relative);const target=(await stat(file)).isDirectory()?path.join(file,'index.html'):file;if(!target.startsWith(root+path.sep))throw Error('Invalid path');const bytes=await readFile(target);res.setHeader('Content-Type',target.endsWith('.html')?'text/html':target.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(4174,'127.0.0.1',resolve));
const executablePath=['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:4174');await page.waitForFunction(()=>typeof BeatmapStudio!=='undefined');await page.evaluate(()=>studioReady);
 assert.equal(await page.locator('.settings .panel-title').innerText(),'SETTINGS');
 assert.equal(await page.locator('#bestDetail').innerText(),'No saved score.');
 await page.click('#helpBtn');assert.equal(await page.locator('#help h2').innerText(),'How to play');assert((await page.locator('#help').innerText()).includes('earn SS'));await page.click('#closeHelp');
 await page.click('#createModeBtn');assert.equal(await page.locator('#editorView h2').innerText(),'Beatmap Studio');assert.equal(await page.locator('.studio-heading p').count(),0);await page.click('#editorDone');
 report.passed.push('neutral menu/help/results/editor copy and existing creation navigation');
 const cases=[[100,0,0,0,'SS'],[75,25,0,0,'S'],[74,26,0,0,'A'],[90,0,0,10,'A'],[80,0,0,20,'B'],[70,0,0,30,'C'],[69,0,0,31,'D']];
 for(const [p,g,good,m,grade] of cases){
  await page.evaluate(({p,g,good,m})=>{
   if($('results').open)$('results').close();stopToStudio();
   const buffer=audio().createBuffer(1,11025*12,11025),grades=[...Array(p).fill('PERFECT'),...Array(g).fill('GREAT'),...Array(good).fill('GOOD'),...Array(m).fill('MISS')];
   Object.assign(state,{buffer,name:'Grade test',notes:grades.map((result,i)=>({time:i*.1,lane:i%4,duration:0,result})),counts:{PERFECT:p,GREAT:g,GOOD:good,MISS:m},judged:grades.length,weight:p+.8*g+.5*good,maxCombo:p,score:p*1000+g*800+good*500,health:10,position:11,finished:false,trainingRun:true,best:{}});$('practice').checked=true;finish(true);
  },{p,g,good,m});
  assert.equal(await page.locator('#grade').innerText(),grade);assert.equal(await page.locator('#grade').evaluate(el=>el.classList.contains('all-perfect')),grade==='SS');assert((await page.locator('#gradeRules').innerText()).includes('SS = all Perfect'));
 }
 report.passed.push('SS/S/A/B/C/D visible in the actual results dialog; SS styling exclusive');
 await page.evaluate(()=>{$('results').close();state.finished=false;finish(false);});assert.equal(await page.locator('#grade').innerText(),'F');
 await page.evaluate(()=>{$('results').close();state.finished=false;state.judged=1;state.notes[1].result=null;finish(true,true);});assert.equal(await page.locator('#grade').innerText(),'\u2014');
 report.passed.push('failed attempts show F; early exit has no completion grade');
 const text=await page.locator('body').textContent();for(const phrase of ['FIND YOUR FLOW','MAKE IT YOURS','Feel the beat.','Nice flow.','Compose a chart. Every note is yours.','YOUR MUSIC, TOGETHER'])assert(!text.includes(phrase));
 assert.deepEqual(report.errors,[]);report.passed.push('no browser exceptions or remaining targeted slogans');
 await page.evaluate(()=>{$('results').close();state.finished=false;state.judged=state.notes.length;state.notes.forEach(n=>n.result='PERFECT');state.counts={PERFECT:state.notes.length,GREAT:0,GOOD:0,MISS:0};state.weight=state.notes.length;finish(true);});
 await page.screenshot({path:'.grade-results/results-'+(process.env.STUDIO_ROOT==='.'?'root':'public')+'.png',fullPage:false});
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{await writeFile('.grade-results/browser-'+(process.env.STUDIO_ROOT==='.'?'root':'public')+'.json',JSON.stringify(report,null,2));await browser.close();server.close();}
