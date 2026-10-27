# Pulse Stage

## [▶ Play Game](https://derrickthemonkey.github.io/pulse-stage/)

> **Vibecoded with ChatGPT/Codex.** Derrick Chu provided the concept, feature requests, and design direction; ChatGPT/Codex generated and revised the implementation.

A browser rhythm game with custom songs, automatic audio scanning, scene-matched backgrounds and tiles, hold notes, simultaneous chords, a life bar, and a chart editor.

## How to play

- Press **D, F, J, K** or tap the four lanes. Hold keys for long notes.
- Press **Escape** for Resume, Restart Song, or Return to Menu.
- Normal charts include long hold notes: keep the same lane pressed until the note ends.
- Hard charts include simultaneous notes: press both lanes together.
- Perfect hits allow up to **120 ms** early or late. Misses drain life; Practice mode disables failure.
- Older slide charts automatically load as same-lane holds. Click **Scan song & rebuild** to regenerate a chart.

## Save and upload songs

After importing a song and optional background, use the buttons directly below the imports:

- **Save Song** keeps the audio, background, chart, and timing settings on this device. Open **saved songs on this device** to load or delete them. Saving the same song and difficulty again updates its copy.
- **Upload Song** opens the hosted upload form with the current song, background, and chart attached. From GitHub Pages it transfers those files to the upload tab so you do not need to import them again. Sign in and choose your creator name before uploading.

Local saves require browser storage and are removed if you clear site data. Online uploads still require access to the hosted library.

## Online song library

The [hosted song library](https://pulse-stage-derrick.utexas.chatgpt.site/?library=1) stores audio, charts, and optional backgrounds in a database-backed service. Sign in to save tracks privately, publish them to other authorized visitors, copy links, or delete your own uploads. Audio uploads are limited to 25 MB and backgrounds to 20 MB. Only publish music you created or have permission to share.

**Access limitation:** this workspace currently blocks public Site publication. The GitHub Pages game is public, but the hosted library is restricted to accounts granted access. Anonymous public song sharing is not enabled.

## Play locally

Serve this folder over HTTP (the audio scanner uses a Web Worker):

```sh
python -m http.server 8000 --directory public
```

Open http://localhost:8000. Import audio or choose Play the demo, then Play Track. Use D, F, J, K or tap lanes. Escape pauses. Hold keys for long notes.

## Files

- `public/`: browser game, chart generation, controls, and library client.
- Root HTML/CSS/JS files: the same game for GitHub Pages.
- `worker/api.js`: authenticated save/share API with D1 records and R2 media.
- `drizzle/`: database schema migration.
- `scripts/build.mjs`: bundles browser assets and API into the hosted Worker.
- `tests/`: gameplay, scanning, hold controls, palette, and API permission checks.

The shared library requires the hosted backend; a static local server provides local gameplay only.

## Checks

From this folder, run:

```sh
npm run build
npm test
```

## Notes

Imports stay in the player’s browser until they choose Save in the song library. Saving uploads the selected audio, chart, and optional background to their account. They are not included in this repository and do not transfer between site origins. Automatic charts approximate musical attacks and pitch; they are not exact multi-instrument transcriptions. Use Scan song & rebuild to regenerate an imported track. Practice mode disables failure. External Google Fonts are optional; system fonts serve as fallback.
