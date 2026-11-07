# Beatmap Studio 2

Song Creation opens a vertical four-column editor. Live recording is optional.
Choose audio, set BPM and first-beat time, and place notes directly. The global
chart offset is applied once when displaying and snapping notes; chart files
store the original timestamps. The editor never auto-generates a manual chart.

## Editing

Click in Draw mode for a tap; drag vertically for a hold. Hold mode creates at
least one grid step. In Select mode drag a note to move it, or drag its tail to
resize. Shift-click or drag a selection box to select several notes. Right-click
or Erase removes notes. Overlapping notes in one lane are rejected atomically.

Use the wheel to scroll, Ctrl+wheel to zoom, and the waveform overview to seek.
Space toggles audio preview. Ctrl/Cmd+A selects all, C/V copies/pastes at the
cursor, Z undoes and Shift+Z or Y redoes. Arrow keys move a selection by one grid
step or column. The toolbar also exposes these operations without shortcuts.

Playtest runs the actual game in unranked practice mode. Return to editor
restores the exact draft. Save Song stores audio, notes and timing on the device;
Open saved map reopens it for editing. Import/export preserve exact timestamps,
BPM, first beat, offset and editor zoom/snap. Upload still uses the existing
library and requires its normal authentication/storage configuration.

## Generation

Generation keeps the existing per-song density budget, including the doubled
Normal/Hard/Insane/Impossible budget. Beginner retains melody-led solo holds.
The automatic chart is a separate draft from the custom editor.

Musically stronger, busier phrases receive more detail without filling silence.
Lane voicing uses recurring rhythmic/pitch-contour motifs, streams, stairs,
rolls, trills and split-hand patterns. Chords are assigned together so they do
not collapse into the same lane. No heads, timestamps or holds are deleted by
lane voicing. Existing audio-backed accent and sustain detection remains in
charge of chords and holds. Scroll speed, ten lives and replenishment are not
changed. This remains heuristic analysis of a mix, not isolated vocal or
instrument transcription.

Design references:
- osu!mania mapping guide: https://osu.ppy.sh/wiki/en/Guides/osu!mania_mapping_guide
- osu!mania modding guide: https://osu.ppy.sh/wiki/en/Guides/osu!mania_modding_guide
- Etterna/ArrowVortex authoring guide: https://knowledge.etternaonline.com/en/etterna/creating-your-first-chart

These sources distinguish rhythm/pitch representation from comfortable
patterning, use chords for emphasis and long notes for sustained sounds, and
stress timing the grid against the waveform. The implementation uses those
principles rather than copying charts or increasing difficulty with scroll-speed
changes.

## Verification

Run `npm run build` and `npm test`. Browser interaction coverage is in
`scripts/studio-browser.mjs` (requires Playwright and Chromium). Tests cover
pointer placement, move/resize, multi-selection, copy/paste, collision rejection,
undo/redo, JSON round trips, device saves/reloads, gameplay playtesting and mobile
layout. Generator regressions assert unchanged budgets, valid chords/holds,
determinism, silence handling, phrase contrast and unchanged gameplay settings.
