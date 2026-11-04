# Note density across songs

Automatic charts use a shared note-head target for each difficulty, scaled by the full audio duration. A 90-second song therefore has roughly three times the note budget of a 30-second song at the same difficulty. Chord heads count separately; a hold counts once at its head.

| Difficulty | Target notes per second |
| --- | --- |
| Easy | 1.8 |
| Normal | 2.6 |
| Hard | 3.8 |
| Insane | 7 |
| Impossible | 9 |

The budget is approximate. Charts between 85 and 125 percent of the target can retain their natural variation. Larger charts are trimmed in complete timestamp groups across the song, preserving held voices and their release times. Smaller charts draw from unused detected attacks, distributed across musical phrases. Hard and above can add a limited number of double accents at existing heads; this never creates triple chords or injects filler because a hold exists.

Insufficient musical material remains sparse. Silence, isolated sustained tones, and passages without enough independent attacks do not receive random notes to meet a quota. Impossible holds are detected after density balancing, so hold detection still leaves the other melody heads unchanged. Existing saved and authored charts are not rewritten; regenerate an automatic chart to use the new balance.

The scroll-speed calculation, note sizes, hit windows, playback rate, and animation clock are unchanged by this update.
