# Pulse Stage

## [▶ Play Game](https://derrickthemonkey.github.io/pulse-stage/)

> **Vibecoded with ChatGPT/Codex.** Derrick Chu provided the concept, feature requests, and design direction; ChatGPT/Codex generated and revised the implementation.

A browser rhythm game with custom songs, automatic audio scanning, scene-matched backgrounds and tiles, hold notes, simultaneous chords, a life bar, and a chart editor.

## Online uploads: project configured

The supplied Supabase Project URL and public publishable key are configured. **SQL installation and anonymous sign-in still need confirmation in the project.** Gameplay and local saves work. Follow [the Supabase setup guide](supabase/README.md), run [setup.sql](supabase/setup.sql) in your new project, enable device/anonymous sign-ins, and verify the connection settings in `public/backend-config.js` (and the root GitHub Pages copy). Do not put a secret/service-role key in the game.

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
- **Upload Song** opens the on-page upload popup with the song, background, and chart attached. After Supabase is connected, choose Sign in → Continue on this device to upload; optional email-code accounts can also be configured. No ChatGPT login cookie or new tab is needed. Choose your creator name before uploading.

Local saves require browser storage and are removed if you clear site data. Online uploads require completing the Supabase setup. Device-account upload controls remain tied to that browser's stored session.

## Online song library

Song Library opens in an on-page popup on GitHub Pages and on the hosted game. The new client talks directly to your Supabase project for authentication, song metadata, and original media files. Its connection settings are supplied; live database and authentication setup still need confirmation. Community lists show completed shared songs; account lists also expose unfinished uploads so the owner can clean up failed attempts.

The setup creates a private media bucket and database ownership rules. Local tests exercise the client, not a real Supabase database; live authorization and file uploads must be checked in the project. See [the setup and validation guide](supabase/README.md). Existing records in the old Sites database are retained and have not been migrated. The original Worker API is retained for an explicit `provider: 'legacy'` configuration and its regression tests; it is not the selected frontend backend.

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
- `scripts/build.mjs`: validates public backend configuration and bundles browser assets plus the retained Worker API.
- `supabase/`: new backend SQL, setup instructions, and required live validation.
- `public/backend-config.js`: public project connection settings only; configured with the supplied URL and publishable key.
- `tests/`: gameplay, scanning, hold controls, palette, and API permission checks.

With a configured Supabase project, the library works from the static game as well. Without connection settings, local gameplay and device saves remain available.

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

Import a 4K image such as 3840 × 2160 PNG, JPEG, or WebP. The playfield displays the original file directly and the background picker shows its dimensions. Local saves, online uploads, and downloads preserve the original bytes; palette matching uses a separate tiny sample. Online background images and videos can be up to **50 MB**, and audio up to **25 MB**. Resolution on screen depends on the display and playfield size; smaller images are not converted into 4K.

Hold notes use the original ribbon and end-marker design, with a slightly more opaque body for readability. The original hold countdown and release cue remain.

## Background upload limit update

Background images and videos now accept up to **50 MiB per file**; audio stays at **25 MiB**. For the existing Supabase project, run [increase-background-limit.sql](supabase/increase-background-limit.sql) once in SQL Editor, and ensure the **Storage Settings → Global file size limit** is at least 50 MB. This updates the private bucket and upload-finalization check without deleting songs or files. Supabase Free projects have a 50 MB maximum; this change does not upgrade or charge the project. Refresh the game after applying the patch. Oversize errors now show the actual background size and the limit.
