# Impossible difficulty

Impossible is the fifth tier, available in solo play, the chart editor and Battle Mode. It keeps the same judgement windows and miss recovery rules. It costs 50 life per solo miss (two misses from full life without recovery); Battle Mode retains its 200-life pool and matched-note damage rules.

The analyzer uses the same pitch-focused attack detection and short-window timing refinement as Insane, with a shorter 45ms event-selection gap to retain faster audible runs. It does not insert notes on a fabricated beat grid. Silence, vibrato and noise are not turned into streams.

Pattern changes use existing attack times:

- Two-finger alternating bursts last six to eight attacks, on one finger per hand. The gap between attacks is 65–160ms, with a recovery section before the next burst.
- Triplet rolls use three detected attacks near one-third of the estimated beat. The three-note roll varies fingers and does not respace the music.
- Short single-finger bursts retain a maximum of three hits with a four-second cooldown.
- Strong accents receive more frequent two-note chords and occasional three-note chords, with lane recovery checks.
- Sustained audible pitches can become holds in the gaps between runs.

Changes to finger patterns require at least 105ms of recovery per finger. Chord lanes require 140ms of space. Chords are kept out of reserved trill/triplet/jack groups. Automatic scrolling is faster and still adapts to lane spacing without moving any note timestamps.

Audio analysis remains an estimate of the mix. Songs only receive triplets or holds when supported by detected rhythm and sustain. Generated charts can be refined in the editor.

Verification: `tests/impossible.test.cjs` covers patterns, timestamp preservation, finger recovery, bounded chords, holds, real synthesized attacks, silence/noise/vibrato, life and UI options. Existing tests also cover Impossible in local saves, cloud upload/list/load, the hosted API and synchronized battle difficulty changes. Browser visual/gameplay QA is unavailable in the current environment.
