# Impossible difficulty

Impossible is the fifth tier, available in solo play, the chart editor and Battle Mode. It keeps the same judgement windows and recovery controls. A solo miss costs 50 life; Battle Mode retains its 200-life pool and matched-note damage rules.

## Busy musical parts

In addition to Insane's pitch-focused attack detection, Impossible analyzes novelty in four frequency ranges independently. It compares their attack counts in local windows so a quieter but faster part can contribute notes under a loud, slow part, and changes the preferred range as the arrangement changes. Nearby duplicates are merged before short-window timing refinement. This is frequency-band analysis of a mix, not instrument stem separation or exact transcription.

## Rhythmic triplets and slow sections

Triplets mean three successive notes spaced at one-third of a beat. They do not mean three notes pressed together. Slow sections with at least three consistent intervals get demanding triplet-eighth and straight-sixteenth patterns between detected beat anchors. Additions require audio energy at their timestamps and are limited to gaps consistent with the estimated tempo. One phrase out of four stays open for sustained holds. Uncertain tempo, silent gaps and isolated sustained sounds do not receive a fabricated stream.

Two-finger alternating bursts last six to eight attacks, followed by a recovery section. Short single-finger bursts retain a maximum of three hits with a four-second cooldown. Finger-pattern changes require at least 105ms of recovery per finger. Chord lanes require 140ms of space. Double chords remain common; triple chords are limited to every twelfth eligible chord accent and at least twelve seconds apart. Chords stay out of reserved trill/triplet/jack groups.

## Independent sustained holds

Impossible detects sustained pitched audio in each frequency band after mapping its attack patterns. An existing head can become a hold for up to six seconds when its own lane is free, with 105ms recovery before that lane's next head. Sparse sections can therefore support longer holds while the other lanes continue their independently generated melodies. Holds stop at silence, pitch changes, or a new attack in the sustained voice. At most one generated hold is active at a time.

Hold detection does not add notes, force chords, move attack timestamps, or change the other lanes. The old fixed-interval filler passes during scanning and solo playback have been removed for Impossible. Existing authored or saved charts keep their stored heads; regenerate an automatic Impossible chart to apply the new hold mapping.

Automatic scrolling adapts to spacing without moving timestamps. Generated charts can be refined in the editor. Regenerate a saved non-custom chart on Impossible to apply updated mapping.

## Continuous rhythm in sparse sections

Impossible now runs a local gap-filling pass after its existing notes and holds are finalized. It first recovers unused detected attacks, then fills sparse audible sections with sixteenth-note or triplet subdivisions when detected attacks establish a sufficiently consistent beat. The local pass can add notes even when the whole song has reached its density target. Dense runs are left alone; silence and sounds without an established rhythm are not padded.

Every existing head, lane, chord, and hold release is preserved. Added presses stay outside the close-note chord window and respect held-lane occupancy and finger recovery. They do not create extra simultaneous notes or change scroll speed, note size, or the animation clock.

Select Impossible and use **Fill sparse sections** to extend the currently loaded chart without rebuilding it. The action reuses cached audio analysis when available and saves the extended chart locally. Pressing it again does not accumulate another layer of filler. New automatic Impossible scans also include this local pass; other difficulties retain their previous generation behavior.

## Slow tempo and drum transients

At detected tempos of 115 BPM or lower, sparse-section filling uses double-time subdivisions rather than stopping at the former fixed activity level. Four-beat phrases alternate straight runs, short denser bursts when finger spacing permits, and triplet fills. The music playback rate, existing note timestamps, hold releases, scroll speed, and note dimensions are preserved. Saved BPM values down to 45 BPM are supported by this pass.

A separate percussion detector examines low kick frequencies, midrange attacks, and broadband snare or hat transients. It requires a local spectral-flux peak and sustained energy rise, rejects release edges, and checks low-frequency resonance to avoid treating continuous hiss as kicks. Percussion recovery does not depend on a settled melodic pitch and is not skipped merely because the melody already meets its local density target. Added drum presses remain outside the chord-snap window and use only free lanes.

The tests include synthetic 55 Hz kicks and broadband snares under a louder continuous lead, plus steady-noise rejection. The exact user Blue Bird audio and missed timestamps were unavailable during this update; this fixture verifies the detection mechanism, not coverage of that particular song. Use Fill sparse sections to rescan an older cached analysis and extend its current chart.

## Verification

`tests/impossible-rhythm.test.cjs` verifies actual beat thirds, sixteenths, increased slow-section density, silent-gap safeguards, rare triple chords and a quiet rapid voice that switches frequency ranges under a louder slow voice. The synthetic mixed-audio fixture maps over 75% of the quiet rapid attacks within 40ms and has over 20% more notes than Insane. This fixture does not establish accuracy on all real songs.

`tests/impossible.test.cjs` covers lane patterns, finger recovery, bounded chords, holds, real synthesized attacks, silence/noise/vibrato, life and UI options. Other tests cover local saves, uploads, hosted APIs and synchronized battle difficulty changes. Browser visual/gameplay QA is unavailable in the current environment.
