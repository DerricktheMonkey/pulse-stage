# Battle Mode

Open Battle Mode, enter a player name and create a room. Send the invite link or 10-character room code to one friend. The host must keep the room open. Public community charts remain in the existing Supabase song library; rooms are temporary Supabase Realtime broadcast/presence channels and need no SQL migration.

Each of the three rounds offers four randomly shuffled, distinct published community charts. Both players vote. Matching votes select that chart; different votes are randomly resolved between the two votes. Previously played charts are excluded when at least four other choices remain. Both players load the audio, chart and background, compare hashes, then click Ready. A shared five-second countdown follows clock synchronization. The same uploaded chart is used on both devices; it is not regenerated separately.

A miss costs the chart difficulty's normal damage when both players miss that note, or double damage when only one player misses. Perfect, Great and Good all count as hits for comparison. Existing hit recovery still applies. Chords resolve as a simultaneous group; simultaneous knockouts draw. The host compares each indexed note once, waits for delayed judgements and ignores duplicates and impossible early/future reports. Holds resolve at completion or early release.

A knockout wins the round. If both players survive the song, higher weighted accuracy wins; equal accuracy draws. Both players continue to a new pick after each round. All three rounds are played; most round wins wins the match, with equal round wins drawing. Leaving a live match forfeits it. Detected connection loss stops the match rather than awarding a networking win. Practice mode does not bypass battle damage. Solo records are not updated by battle results.

## Implementation and validation

`public/battle-rules.js` owns deterministic voting/scoring. `public/battle-transport.js` implements the documented Supabase realtime protocol. `public/battle.js` coordinates the two browser clients, indexed judgement batches, clock samples, readiness, synchronized audio, round results, and the UI. The host coordinates a casual match; this is not a server-verified ranked or anti-cheat system.

Automated tests cover rule outcomes, duplicate and delayed reports, hold completion, chord knockouts, the wire format, and two simulated browsers through all three rounds with matching results and a rejected third player. GitHub's Battle Mode checks also run an explicitly invoked two-client live realtime smoke test using the already-public browser settings; no users, permanent rooms or database records are created. Browser audio/fullscreen behavior and a full two-device playthrough remain manual checks.

## Round difficulty

The host can choose Original map, Easy, Normal, Hard or Insane while in the lobby, voting or loading. The setting applies to both players and carries into the next round. Original map keeps the uploaded notes; choosing a difficulty analyzes the same audio on both clients and uses that difficulty's miss damage. Changing it clears both Ready states and rebuilds both charts. Revision keys reject stale Ready messages; chart/audio hashes still have to agree. Difficulty is locked during countdown and play.

Each player starts every round with 200 life (double the solo pool). Recovery caps at 200. Miss damage and recovery amounts are unchanged; both life bars scale to the 200-life maximum.
