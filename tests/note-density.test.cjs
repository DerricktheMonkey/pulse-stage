const assert=require('node:assert/strict'),E=require('../public/engine.js');
const difficulties=['easy','normal','hard','insane','impossible'];
function chart(duration,step){return Array.from({length:Math.floor((duration-.5)/step)},(_,i)=>({time:+(.5+i*step).toFixed(3),lane:i%4,duration:0}));}
function attacks(duration){return chart(duration,.04).map(n=>({...n,strength:1}));}
for(const difficulty of difficulties){
 const rates=[];
 for(const duration of [30,90])for(const step of [.07,.12,.24]){
  const notes=chart(duration,step),before=JSON.stringify(notes),pool=attacks(duration),out=E.balanceDensity(notes,pool,duration,difficulty),rate=out.length/duration,target=E.DENSITY_RATES[difficulty];rates.push(rate);
  assert(rate>=target*.84&&rate<=target*1.26,'Comparable per-second density for '+difficulty+' / '+duration+'s / '+step+'s source');
  assert.equal(JSON.stringify(notes),before,'Balancing does not mutate a source chart');E.validateChart({notes:out},duration);
  const possible=new Set([...notes,...pool].map(n=>n.time));assert(out.every(n=>possible.has(n.time)),'All output heads occur at existing musical opportunities');
 }
 assert(Math.max(...rates)/Math.min(...rates)<1.27,'Same difficulty stays comparable across song lengths and source densities');
 const short=E.balanceDensity(chart(30,.07),attacks(30),30,difficulty),long=E.balanceDensity(chart(90,.07),attacks(90),90,difficulty);
 assert(Math.abs(long.length/short.length-3)<.1,'A three-times-longer song gets proportionally more notes');
 const early=short.filter(n=>n.time<10).length,late=short.filter(n=>n.time>=20).length;assert(early&&late,'Trimming retains the whole song');
}
const hold={time:.5,lane:0,duration:3},busy=[hold,...chart(12,.045).filter(n=>n.lane!==0)],pruned=E.balanceDensity(busy,[],12,'hard');assert(pruned.some(n=>n.lane===0&&n.time===.5&&n.duration===3),'Density pruning preserves holds and their release times');E.validateChart({notes:pruned},12);
const sparse=[hold,{time:1,lane:1,duration:0},{time:1.5,lane:2,duration:0}];assert.deepEqual(E.balanceDensity(sparse,[],10,'impossible'),sparse,'A sustained voice is not padded with hold-triggered filler');assert.deepEqual(E.balanceDensity([],attacks(10),10,'impossible'),[],'Silence cannot become a full chart');
const original=[{time:1,lane:0,duration:0},{time:1,lane:1,duration:0},{time:2,lane:2,duration:0}],unchanged=E.balanceDensity(original,[],1,'impossible');assert.deepEqual(unchanged,original,'Sparse authored chord groups are preserved');
// Density accents are at most doubles and do not fill held passages.
const melody=chart(20,.4),accents=E.balanceDensity(melody,[],20,'impossible'),groups=new Map();for(const n of accents){if(!groups.has(n.time))groups.set(n.time,[]);groups.get(n.time).push(n);}assert([...groups.values()].every(g=>g.length<=2));
console.log('PASS: difficulty budgets, comparable density across source rates, proportional 30/90-second totals, real musical timestamps, full-song coverage, unchanged sources, intact holds/chords and no silence/hold filler.');
