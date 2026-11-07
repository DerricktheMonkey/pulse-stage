const assert=require('node:assert/strict'),fs=require('node:fs'),E=require('../public/engine.js');
assert.deepEqual(E.DIFFICULTIES,['easy','normal','hard','insane','impossible']);
assert.equal(E.normalizeDifficulty('beginner'),'easy');assert.equal(E.normalizeDifficulty('invalid'),'normal');
for(const name of ['index.html','public/index.html']){const s=fs.readFileSync(name,'utf8');assert(!s.includes('data-diff="beginner"'));assert(!s.includes('value="beginner"'));}
assert.equal(E.beginnerMelody,undefined);assert.equal(E.DENSITY_RATES.beginner,undefined);assert.equal(E.MUSIC_VARIETY.beginner,undefined);
const rate=11025,samples=new Float32Array(rate*3);for(let i=0;i<samples.length;i++)samples[i]=.3*Math.sin(i*.16)*Math.exp(-((i/rate)%.25)*15);
assert.deepEqual(E.analyze(samples,rate,'beginner'),E.analyze(samples,rate,'easy'),'old IDs load through Easy rather than a hidden sixth generator');
assert.equal(E.MAX_LIFE,10);assert.equal(E.scrollTravel([], .65,'easy'),.65);assert.equal(E.nextHealth(7,'PERFECT'),7.2);
console.log('PASS: five selectable modes, no Beginner generator, legacy difficulty compatibility, unchanged gameplay.');
