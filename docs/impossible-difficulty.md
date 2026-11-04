# Impossible difficulty

Impossible is the fifth tier, available in solo play, the chart editor and Battle Mode. It keeps the same judgement windows and recovery controls. A solo miss costs 50 life; Battle Mode retains its 200-life pool and matched-note damage rules.

## Busy musical parts

In addition to Insane's pitch-focused attack detection, Impossible analyzes novelty in four frequency ranges independently. It compares their attack counts in local windows so a quieter but faster part can contribute notes under a loud, slow part, and changes the preferred range as the arrangement changes. Nearby duplicates are merged before short-window timing refinement. This is frequency-band analysis of a mix, not instrument stem separation or exact transcription.

## Rhythmic triplets and slow sections

Triplets mean three successive notes spaced at one-third of a beat. They do not mean three notes pressed together. Slow sections with at least three consistent intervals get demanding triplet-eighth and straight-sixteenth patterns between detected beat anchors. Additions require audio energy at their timestamps and are limited to gaps consistent with the estimated tempo. One phrase out of four stays open for sustained holds. Uncertain tempo, silent gaps and isolated sustained sounds do not receive a fabricated stream.

Two-finger alternating bursts last six to eight attacks, followed by a recovery section. Short single-finger bursts retain a maximum of three hits with a four-second cooldown. Finger-pattern changes require at least 105ms of recovery per finger. Chord lanes require 140ms of space. Double chords remain common; triple chords are limited to every twelfth eligible chord accent and at least twelve seconds apart. Chords stay out of reserved trill/triplet/jack groups.

The Note travel time slider applies to every difficulty, including Impossible. Dense charts use thinner note heads and hold caps instead of forcing a faster scroll; chart timestamps and hit windows stay unchanged. Generated charts can be refined in the editor. Regenerate a saved non-custom chart on Impossible to apply updated mapping.

## Verification

`tests/impossible-rhythm.test.cjs` verifies actual beat thirds, sixteenths, increased slow-section density, silent-gap safeguards, rare triple chords and a quiet rapid voice that switches frequency ranges under a louder slow voice. The synthetic mixed-audio fixture maps over 75% of the quiet rapid attacks within 40ms and has over 20% more notes than Insane. This fixture does not establish accuracy on all real songs.

`tests/impossible.test.cjs` covers lane patterns, finger recovery, bounded chords, holds, real synthesized attacks, silence/noise/vibrato, life and UI options. Other tests cover local saves, uploads, hosted APIs and synchronized battle difficulty changes. Browser visual/gameplay QA is unavailable in the current environment.
