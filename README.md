# Pulse Stage

A browser rhythm game with local song imports, automatic audio scanning, four-key gameplay, custom image/video backgrounds, scene-matched tile colors, hit effects, a life bar, and a chart editor.

## Play locally

Serve this folder over HTTP (the audio scanner uses a Web Worker):

```sh
python -m http.server 8000
```

Open http://localhost:8000. Import audio or choose Play the demo, then Play Track. Use D, F, J, K or tap lanes. Escape pauses. Hold keys for long notes.

## Publish with GitHub Pages

In repository Settings > Pages, choose Deploy from a branch, main, and / (root), then Save. GitHub will show your game URL after deployment. Repository visibility and plan affect Pages availability.

## Files

- index.html: studio and gameplay interface.
- style.css: responsive layout and styling.
- app.js: playback, input, scoring, animations, life, editor, and local saving.
- engine.js: automatic spectral/rhythm/pitch analysis and gameplay rules.
- analysis-worker.js: background audio scanning.
- palette.js: colors sampled from imported backgrounds.
- tests/: Node.js checks.

## Checks

From this folder, run:

```sh
node tests/engine.test.cjs
node tests/palette.test.cjs
node tests/gameplay.test.cjs
```

## Notes

Songs and backgrounds are selected by each player and stored locally in their browser, not uploaded to the game server. They are not included in this repository and do not transfer between site origins. Automatic charts approximate musical attacks and pitch; they are not exact multi-instrument transcriptions. Use Scan song & rebuild to regenerate an imported track. Practice mode disables failure. External Google Fonts are optional; system fonts serve as fallback.
