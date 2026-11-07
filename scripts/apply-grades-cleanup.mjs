import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=async path=>readFile(path,'utf8');
function replace(text,before,after,count=1){const found=text.split(before).length-1;assert.equal(found,count,'Expected '+count+' occurrences of '+before.slice(0,100)+', found '+found);return text.split(before).join(after);}
async function pair(name,transform){const a=await source(name),b=await source('public/'+name);assert.equal(a,b,'Root/public mismatch before editing '+name);const updated=transform(a);await writeFile(name,updated);await writeFile('public/'+name,updated);}
await pair('engine.js',s=>{
 const old=s.match(/^function rank\(counts,total,complete=true\)\{[^\n]+\}$/m);assert(old,'Original rank function not found');
 return replace(s,old[0],`// Grades use the same weighted accuracy as the HUD: Perfect=1, Great=.8, Good=.5.
// An incomplete or empty chart cannot earn a completion grade, even at 100% so far.
function rank(counts={},total,complete=true){
 if(!complete)return 'F';
 if(!Number.isInteger(total)||total<=0)return '\u2014';
 const values=['PERFECT','GREAT','GOOD','MISS'].map(key=>counts[key]??0);
 if(values.some(value=>!Number.isInteger(value)||value<0))return '\u2014';
 const [perfect,great,good,miss]=values,judged=perfect+great+good+miss;
 if(judged!==total)return '\u2014';
 if(perfect===total)return 'SS';
 // Integer cross-products keep exact thresholds stable and never promote a
// rounded 99.999% display to an all-Perfect SS.
 const points=10*perfect+8*great+5*good;
 for(const [grade,threshold] of [['S',95],['A',90],['B',80],['C',70]])
  if(points*100>=threshold*10*total)return grade;
 return 'D';
}`);
});
await pair('app.js',s=>{
 s=replace(s,"rank==='S'","rank==='SS'",2);
 s=replace(s,"'All Perfect!'","'All Perfect'");
 s=replace(s,"'No misses!'","'No misses'");
 s=replace(s,"'Nice flow.'","'Results'");
 s=replace(s,"'Your next run starts here.'","'No saved score.'");
 return replace(s,"analysis-worker.js?v=110","analysis-worker.js?v=111");
});
await pair('analysis-worker.js',s=>replace(s,'engine.js?v=110','engine.js?v=111'));
await pair('index.html',s=>{
 const changes=[
 ['FIND YOUR FLOW <span>\u2726</span>','SETTINGS'],
 ['\u2727 MAKE IT YOURS','CHARTS'],
 ['Your next run starts here.','No saved score.'],
 ['WELCOME TO YOUR STAGE','CONTROLS'],
 ['Feel the beat.','How to play'],
 ['YOUR MUSIC, TOGETHER','LIBRARY'],
 ['Nice flow.','Results'],
 ['SET THE SCENE','BACKGROUND'],
 ['YOUR SETLIST','SONGS'],
 ['Just exploring? Play the demo \u2192','Play demo'],
 ['Let\u2019s play','Close'],
 ['Choose music. Play your own notes.','Create a custom chart'],
 ['<h2>Create your song</h2>','<h2>Chart editor</h2>'],
 ['Rate &amp; keep your chart','Chart details'],
 ['Finish with every note Perfect to earn S rank.','Finish with every note Perfect to earn SS. Otherwise, completed charts earn S at 95% accuracy, A at 90%, B at 80%, C at 70%, or D below 70%. Failed attempts receive F; ending early leaves the grade unassigned.'],
 ['Misses cost more life at higher difficulties: Easy 8, Normal 12, Hard 20, Insane 34, Impossible 50. Accurate hits restore a little.','Every difficulty starts with 10 lives. A miss costs 1 life; Perfect restores 0.2 and Great restores 0.1, up to 10.'],
 ['<div class="result-grade" id="grade">S</div>','<div class="result-grade" id="grade">\u2014</div><p id="gradeRules" class="micro">Completed charts: SS = all Perfect; S \u2265 95%; A \u2265 90%; B \u2265 80%; C \u2265 70%; D &lt; 70%. F = failed. Early exit = no grade.</p>']
 ];for(const [a,b] of changes)s=replace(s,a,b);
 return s.replaceAll('?v=110','?v=111');
});
await pair('studio.js',s=>{
 s=replace(s,'<p>Compose a chart. Every note is yours.</p>','');
 return replace(s,"'Compose in Beatmap Studio'","'Create a custom chart'");
});
let readme=await source('README.md');
readme=replace(readme,'> **Vibecoded with ChatGPT/Codex.** Derrick Chu provided the concept, feature requests, and design direction; ChatGPT/Codex generated and revised the implementation.\n\n','');
readme=replace(readme,'- **S rank** requires every note to be Perfect. A full combo with any Great or Good earns a lower rank.','- **SS** requires a completed, nonempty chart with every note Perfect. Other completed runs earn **S** at 95% accuracy, **A** at 90%, **B** at 80%, **C** at 70%, or **D** below 70%. Failed runs receive **F**; early exits have no grade. Accuracy uses Perfect = 100%, Great = 80%, Good = 50%, Miss = 0%. Grades use unrounded accuracy.');
await writeFile('README.md',readme);
let pkg=await source('package.json');pkg=replace(pkg,'A vibecoded rhythm game with custom songs and a shared library','A four-lane rhythm game with custom songs and a shared library');await writeFile('package.json',pkg);
let polish=await source('tests/polish.test.cjs');
polish=replace(polish,"E.rank({PERFECT:10,GREAT:0,GOOD:0,MISS:0},10),'S'","E.rank({PERFECT:10,GREAT:0,GOOD:0,MISS:0},10),'SS'");
polish=replace(polish,"E.rank({PERFECT:9,GREAT:1,GOOD:0,MISS:0},10),'A'","E.rank({PERFECT:9,GREAT:1,GOOD:0,MISS:0},10),'S'");
polish=replace(polish,"E.rank({PERFECT:9},10),'S'","E.rank({PERFECT:9},10),'SS'");
polish=replace(polish,"E.rank({PERFECT:0},0),'S'","E.rank({PERFECT:0},0),'SS'");
polish=replace(polish,"E.rank({PERFECT:10},10,false),'RETRY'","E.rank({PERFECT:10},10,false),'F'");
polish=replace(polish,'strict all-Perfect S rank','strict all-Perfect SS rank');await writeFile('tests/polish.test.cjs',polish);
let game=await source('tests/gameplay.test.cjs');
game=replace(game,"finishEls.grade.textContent,'S'","finishEls.grade.textContent,'SS'");
game=replace(game,"finishEls.resultTitle.textContent,'All Perfect!'","finishEls.resultTitle.textContent,'All Perfect'");
game=replace(game,"stopped.state.best.track.rank,'S'","stopped.state.best.track.rank,'SS'");
game=replace(game,'or award S.','or award SS.');game=replace(game,'awards earned S and saves bests','awards earned SS and saves bests');await writeFile('tests/gameplay.test.cjs',game);
console.log('Applied SS/S/A/B/C/D/F grading, neutral UI copy, consistent help, and asset version 111.');
