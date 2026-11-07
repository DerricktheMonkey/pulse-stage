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
both('engine.js',s)
s=Path('local-songs.js').read_text();s=s.replace('audioTrim:level.chart.audioTrim','audioTrim:level.chart?.audioTrim');both('local-songs.js',s)
s=Path('app.js').read_text();s=s.replace("await save('song',{bytes:state.audioBytes,name:state.name,type:state.audioType,audioTrim:state.audioTrim,communitySongId:state.communitySongId});", "if(state.audioBytes)await save('song',{bytes:state.audioBytes,name:state.name,type:state.audioType,audioTrim:state.audioTrim,communitySongId:state.communitySongId});");both('app.js',s)
for name in ['api.test.mjs','supabase-backend.test.cjs']:
    p=Path('tests/'+name);s=p.read_text();s=s.replace(".difficulty,'beginner'", ".difficulty,'easy'");p.write_text(s)
p=Path('tests/phrase-generation.test.cjs');s=p.read_text();s=re.sub(r'(\.scanVersion,\s*)25',r'\g<1>26',s);p.write_text(s)
print('Corrected chord-supported sustains, old preview compatibility and retired difficulty assertions.')
