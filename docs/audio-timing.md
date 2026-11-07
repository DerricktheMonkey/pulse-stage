# Music timing and audio edges (assets 112)

Playable difficulties: Easy, Normal, Hard, Insane, Impossible. Old Beginner
chart IDs are interpreted as Easy; authored notes and saved files are retained.
The retired generator is no longer used or offered by any selector.

Automatic charts keep detected attack timestamps and existing difficulty budgets.
Pitch contour influences lane selection; motifs do not retime notes. Optional
subdivision stays between nearby measured attacks in continuously audible audio.
It cannot cross a silent interval just because the midpoint is loud. Long gaps
are not filled to meet a quota. Existing sustain detection controls holds and
strong musical attacks control chord accents. The first audible attack after
trimming is not discarded by the old 350 ms cutoff. Music evidence takes priority
over hitting an impossible note quota in silence; continuous-song density tests
still require the pre-change Normal through Impossible budgets.

Only sufficiently long, near-silent leading/trailing edges are cropped. Analysis
checks every audio channel independently (opposite-phase stereo cannot cancel),
uses a conservative threshold capped at -80 dBFS, and retains 40 ms of attack
padding and 100 ms after the last detected sound. Quiet intros, detected fade
and reverb tails, and every pause inside the song are preserved. A fully silent
file is left valid rather than becoming a zero-frame buffer.

Cropping is non-destructive: the original compressed upload is kept unchanged.
The chart's audioTrim metadata identifies the playback window in that source.
Notes and the first-beat phase are rebased exactly once for legacy charts;
saved cropped charts reuse their window without shifting again. Manual notes,
hold tails, and timing offsets can extend the window so notes are never cut off.
Import the original matching audio with exported JSON. Both library backends
keep the window with uploaded charts. Existing files in the online library are
not overwritten. Playback duration is the trimmed duration.

Countdown, full opening note travel, scroll speed, scoring, SS grading, ten lives,
recovery, and in-song timing remain unchanged. Automated fixtures check silence,
stereo, first attacks, rests, metadata round trips, and chart density. These are
not a claim of perfect transcription or a listening review of every song.

## Musicality takes precedence over quota

The existing difficulty budgets are unchanged upper targets, not a requirement
to manufacture taps. `generation.actualNotes` reports the chart count and
`generation.unfilledBudget` reports any unsupported remainder. Continuous,
attack-rich fixtures retain their prior totals. Isolated held passages may
have fewer filler taps than the old implementation, because a midpoint on
loud audio is no longer sufficient to subdivide a gap crossing a musical rest.
Regression coverage checks each sustained phrase attack, actual holds, and
no notes in its silent gaps, rather than insisting on an artificial quota.
