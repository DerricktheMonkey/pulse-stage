# Pulse Stage

## [▶ Play Game](https://derrickthemonkey.github.io/pulse-stage/)

> **Vibecoded with ChatGPT/Codex.** Derrick Chu provided the concept, feature requests, and design direction; ChatGPT/Codex generated and revised the implementation.

A browser rhythm game with custom songs, automatic audio scanning, scene-matched backgrounds and tiles, hold notes, simultaneous chords, a life bar, and a chart editor.

## How to play

- Press **D, F, J, K** or tap the four lanes. Hold keys for long notes.
- Play requests browser fullscreen and fills the viewport. Press **Escape** to pause, then **Escape again** for the main menu or **R** to restart. Use Resume to continue the run. Holding Escape does not count as two presses.
- Normal charts include long hold notes: keep the same lane pressed as the ring shrinks. The bright tail cap reaches the hit line and a **RELEASE** cue shows when to let go.
- Hard charts include simultaneous notes: matching warm glows show which lanes to press together.
- **S rank** requires every note to be Perfect. A full combo with any Great or Good earns a lower rank.\n- Perfect hits allow up to **120 ms** early or late. Misses drain life; Practice mode disables failure.
- Older slide charts automatically load as same-lane holds. Click **Scan song & rebuild** to regenerate a chart.

## Song selector

Use **Change Song** in the game bar or pause menu to choose a saved level or import a new song. **Saved Songs** at the top left of the studio opens the same selector. The selected song title appears in the preview and game bar.

## Save and upload songs

After importing a song and optional background, use the buttons directly below the imports:

- **Save Song** keeps the audio, background, chart, and timing settings on this device. Open the prominent **Saved Songs** button to load or delete them. Saving the same song and difficulty again updates its copy.
- **Upload Song** opens the on-page upload popup with the current song, background, and chart attached. Uploads and the library stay in the game tab on both GitHub Pages and the hosted game. If sign-in is needed, the pending level is kept in browser storage and restored after sign-in in the same tab. Choose your creator name before uploading.

Local saves require browser storage and are removed if you clear site data. Online uploads still require access to the hosted library.

## Online song library

**Song library opens in an on-page popup**, including on GitHub Pages. Use **On this device**, **Community**, or **My saved songs**. Online requests use the hosted backend with your existing sign-in; account or connection errors leave the popup and device saves usable. If sign-in is needed, the sign-in link uses the current tab.

The [hosted song library](https://pulse-stage-derrick.utexas.chatgpt.site/?library=1) stores audio, charts, and optional backgrounds in a database-backed service. Sign in to save tracks privately, publish them to other authorized visitors, copy links, or delete your own uploads. Audio uploads are limited to 25 MB and background images to 40 MB (videos to 20 MB). Only publish music you created or have permission to share.

**Access limitation:** this workspace currently blocks public Site publication. The GitHub Pages game is public, but the hosted library is restricted to accounts granted access. Anonymous public song sharing is not enabled.

## Play locally

Serve this folder over HTTP (the audio scanner uses a Web Worker):

```sh
python -m http.server 8000 --directory public
```

Open http://localhost:8000. Import audio or choose Play the demo, then Play Track. Use D, F, J, K or tap lanes. Escape pauses; a second Escape returns to the main menu. Esc then R restarts. Hold keys for long notes.

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

## Song Creation mode

Choose **Song Creation** in the left sidebar. Choose a song and optional background, then **Play & Create Notes**. Empty lanes play your music while D/F/J/K presses create visible notes; holding a key creates a long note. Creation starts with a new song selection and keeps a separate draft while switching between modes. Existing songs have no Edit button.

After **Finish** or Escape, fine-tune timing, lane, and hold length in the timeline. **Align this range** or **Align whole song** snaps notes to the chosen BPM, first-beat offset, and quarter/eighth/sixteenth-note grid. Notes aligned to the same time receive the simultaneous-note glow when **Glow for simultaneous notes** is enabled. Preview shows the same glow as gameplay. Alignment rejects overlapping notes without discarding them; Undo restores the previous timings.

For a retake, set **From / To** song times and press **Retake this section**. Recording starts at From and stops at To, replacing only notes in that interval. Notes outside it remain intact. Holds crossing either boundary must be kept outside the interval by adjusting its bounds. Undo restores the previous take. **Use current position + 10s** sets a quick range; scrub to any position first.

Choose **Easy / Normal / Hard** and a **level rating from 1 to 40**, then **Save Song** or **Upload Song**. Both paths preserve your chart, scene, rating, and glow setting. Difficulty changes preserve recorded notes. Back to songs returns to the separate Play Songs mode.

Song Creation recording and section retakes show a **3–2–1 countdown** before audio and note recording begin. The count-in lasts three real seconds at every playback speed. Escape or Finish during the count-in cancels it and preserves the previous chart. Preview starts immediately.

## 4K scenes and visible holds

Import a 4K image such as 3840 × 2160 PNG, JPEG, or WebP. The playfield displays the original file directly and the background picker shows its dimensions. Local saves, online uploads, and downloads preserve the original bytes; palette matching uses a separate tiny sample. Online background images can be up to **40 MB**, videos up to **20 MB**, and audio up to **25 MB**. Resolution on screen depends on the display and playfield size; smaller images are not converted into 4K.

Hold notes use an opaque colored ribbon with a dark outline, white rails, crossbars, a **HOLD** label, and a wide **END** cap. While held, the hit-line head stays lit, with a larger countdown/release cue. Creation recording and chart previews use the same ribbon renderer as gameplay.
