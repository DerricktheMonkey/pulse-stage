from pathlib import Path
# Wait for the actual UI save completion, not an async predicate whose Promise
# is truthy before its IndexedDB read finishes.
a="await page.click('#editorSave');await page.waitForFunction(async()=>((await read('localLevels'))||[]).length>0);"
b="await page.evaluate(()=>{document.getElementById('editorSaveStatus').textContent='';});await page.click('#editorSave');await page.waitForFunction(()=>document.getElementById('editorSaveStatus').textContent.startsWith('Saved'),{}, {timeout:15000});"
for name in ['scripts/music-browser.mjs','scripts/studio-browser.mjs']:
 p=Path(name);s=p.read_text()
 if a in s:
  assert s.count(a)==1;s=s.replace(a,b)
 else:assert b in s
 p.write_text(s)
print('Browser checks now wait for confirmed completion of the Save action.')
