import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.env.STUDIO_ROOT||'public');
const label=root===process.cwd()?'root':'public';
await mkdir('.repair-results',{recursive:true});
const report={build:label,checks:[],errors:[]};
const server=createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep))throw Error('Invalid path');const target=(await stat(file)).isDirectory()?path.join(file,'index.html'):file;res.setHeader('Content-Type',target.endsWith('.html')?'text/html':target.endsWith('.css')?'text/css':target.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(await readFile(target));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const executablePath=['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1080}});
page.on('pageerror',error=>report.errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof BeatmapStudio!=='undefined');
 await page.evaluate(()=>studioReady);
 await page.evaluate(()=>document.fonts.ready);
 const expected=['Easy','Normal','Hard','Insane','Impossible'];
 for(const fallback of [false,true]){
  const override=fallback?await page.addStyleTag({content:'#difficulties button{font-family:system-ui,sans-serif!important}'}):null;
  for(const width of [280,320,360,390,480,680,681,768,1024,1150,1151,1280,1440,1920]){
   await page.setViewportSize({width,height:1080});
   await page.locator('#difficulties').scrollIntoViewIfNeeded();
   const result=await page.locator('#difficulties').evaluate(bar=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    return {bar:rect(bar),parent:rect(bar.parentElement),client:bar.clientWidth,scroll:bar.scrollWidth,buttons:[...bar.querySelectorAll('button')].map(button=>{const range=document.createRange();range.selectNodeContents(button);const r=range.getBoundingClientRect();return {label:button.textContent.trim(),...rect(button),text:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},font:getComputedStyle(button).font,fontSize:parseFloat(getComputedStyle(button).fontSize)};})};
   });
   assert.deepEqual(result.buttons.map(b=>b.label),expected);
   assert(result.scroll<=result.client+1,'difficulty bar scroll overflow at '+width);
   assert(result.bar.right<=result.parent.right+.5,'bar outside sidebar at '+width);
   for(const b of result.buttons){
    assert(Math.abs(b.top-result.buttons[0].top)<.5,'difficulty wrapped at '+width);
    assert(b.left>=result.bar.left&&b.right<=result.bar.right+.5&&b.bottom<=result.bar.bottom+.5,b.label+' button outside bar at '+width);
    assert(b.text.left>=b.left-.25&&b.text.right<=b.right+.25&&b.text.top>=b.top-.25&&b.text.bottom<=b.bottom+.25,b.label+' text outside button at '+width+' '+JSON.stringify(b));
    assert(b.fontSize>=11,'labels must not be made smaller');
   }
   report.checks.push({width,fallback,barWidth:result.bar.width,impossibleWidth:result.buttons[4].width,font:result.buttons[4].font});
  }
  if(override)await override.evaluate(el=>el.remove());
 }
 for(const diff of ['easy','normal','hard','insane','impossible']){
  await page.click('#difficulties [data-diff="'+diff+'"]');
  assert.equal(await page.evaluate(()=>state.difficulty),diff);
  assert.equal(await page.locator('#difficulties button.selected').count(),1);
 }
 await page.locator('#difficulties [data-diff="impossible"]').focus();
 await page.keyboard.press('ArrowLeft');
 await page.setViewportSize({width:1024,height:1080});
 await page.locator('#difficulties').screenshot({path:'.repair-results/difficulty-'+label+'-narrow.png'});
 await page.setViewportSize({width:1440,height:1080});
 await page.locator('.setup').screenshot({path:'.repair-results/difficulty-'+label+'-desktop.png'});
 assert.deepEqual(report.errors,[]);
 report.passed=true;
 console.log('PASS: all five full labels fit one row at 14 viewport widths, with default and fallback fonts; all selection controls work.');
}catch(error){report.failure=String(error.stack);throw error;}finally{await writeFile('.repair-results/difficulty-layout-'+label+'.json',JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
