from pathlib import Path
p=Path('scripts/apply-music.py');s=p.read_text()
a="s=once(s,'state.notes=E.validateChart(chart,state.buffer.duration);state.analysis=await scanSong', 'state.notes=E.validateChart(restored.chart,state.buffer.duration,{snap:false});state.creatorTiming=restored.chart.creatorTiming||null;state.analysis=await scanSong')"
b="s=once(s,'state.notes=E.validateChart(chart,state.buffer.duration,{snap:!chart.customChart});', 'state.notes=E.validateChart(restored.chart,state.buffer.duration,{snap:!chart.customChart});')\ns=s.replace('state.creatorTiming=chart.creatorTiming||null;', 'state.creatorTiming=restored.chart.creatorTiming||null;')"
if a in s:s=s.replace(a,b)
else:assert b in s
s=s.replace("s=s.replace('E.validateChart(level.chart,buffer.duration)', 'E.validateChart(preparedChart,buffer.duration,{snap:false})')", "s=once(s,'E.validateChart(level.chart,buffer.duration,{snap:!level.chart.customChart})', 'E.validateChart(preparedChart,buffer.duration,{snap:!preparedChart.customChart})')")
p.write_text(s)
