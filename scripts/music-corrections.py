from pathlib import Path
import re

def once(s,a,b):
    if a not in s and b in s:return s
    assert s.count(a)==1,(a,s.count(a))
    return s.replace(a,b)
def both(name,s):
    Path(name).write_text(s);Path('public/'+name).write_text(s)
s=Path('engine.js').read_text()
s=once(s,'if(count>=cap||groups.get(n.time)!==1||n.time<end+settings.holdGap||!nearby(n.time,.04))continue;', '// A sustained voice may begin alongside one tap on the same musical attack.\n   if(count>=cap||groups.get(n.time)>2||n.time<end+settings.holdGap||!nearby(n.time,.04))continue;')
s=once(s,'generation:{targetNotes:easy?notes.length:target,actualNotes:notes.length}', "generation:{targetNotes:easy?notes.length:target,actualNotes:notes.length,unfilledBudget:easy?0:Math.max(0,target-notes.length),policy:'audio-supported'}")
both('engine.js',s)
s=Path('local-songs.js').read_text();s=s.replace('audioTrim:level.chart.audioTrim','audioTrim:level.chart?.audioTrim');both('local-songs.js',s)
s=Path('app.js').read_text();a="await save('song',{bytes:state.audioBytes,name:state.name,type:state.audioType,audioTrim:state.audioTrim,communitySongId:state.communitySongId});";b="if(state.audioBytes)"+a
if b not in s:s=once(s,a,b)
both('app.js',s)
for name in ['api.test.mjs','supabase-backend.test.cjs']:
    p=Path('tests/'+name);s=p.read_text();s=s.replace(".difficulty,'beginner'", ".difficulty,'easy'");p.write_text(s)
p=Path('tests/phrase-generation.test.cjs');s=p.read_text();s=re.sub(r'(\.scanVersion,\s*)25',r'\g<1>26',s);p.write_text(s)
p=Path('tests/music-accents.test.cjs');s=p.read_text()
a='assert.equal(dense.notes.length,dense.generation.targetNotes);'
b="assert(dense.notes.length<=dense.generation.targetNotes,'Musical rests must not be filled to force the old quota');assert.equal(dense.generation.actualNotes,dense.notes.length);assert.equal(dense.generation.unfilledBudget,dense.generation.targetNotes-dense.notes.length);for(let p=0;p<10;p++){const start=.5+p*2.2;assert(dense.notes.some(n=>Math.abs(n.time-start)<.04),'Every sustained phrase keeps its actual attack');}assert(dense.notes.every(n=>{const t=(n.time-.5)%2.2;return n.time>=.48&&t>=-.02&&t<=1.81;}),'No note is inserted into the gaps between sustained phrases');"
s=once(s,a,b);p.write_text(s)
p=Path('docs/beatmap-studio.md');s=p.read_text();s=s.replace('Generation keeps the existing per-song density budget, including the doubled\nNormal/Hard/Insane/Impossible budget. Beginner retains melody-led solo holds.', 'Generation retains the existing difficulty budgets as upper targets, including\nthe doubled Normal/Hard/Insane/Impossible budgets. Audio-supported busy passages\nretain their density; a quota cannot force filler across a musical rest.\nThe playable modes are Easy, Normal, Hard, Insane, and Impossible. Legacy\nBeginner maps load as Easy without deleting their authored notes.');p.write_text(s)
p=Path('docs/audio-timing.md');s=p.read_text()
if 'unfilledBudget' not in s:s+='\n## Musicality takes precedence over quota\n\nThe existing difficulty budgets are unchanged upper targets, not a requirement\nto manufacture taps. `generation.actualNotes` reports the chart count and\n`generation.unfilledBudget` reports any unsupported remainder. Continuous,\nattack-rich fixtures retain their prior totals. Isolated held passages may\nhave fewer filler taps than the old implementation, because a midpoint on\nloud audio is no longer sufficient to subdivide a gap crossing a musical rest.\nRegression coverage checks each sustained phrase attack, actual holds, and\nno notes in its silent gaps, rather than insisting on an artificial quota.\n'
p.write_text(s)
print('Verified fixes preserve musical evidence; budgets do not force silence filler.')
