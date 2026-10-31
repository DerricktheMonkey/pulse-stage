# Level leaderboards

The Leaderboard buttons on the stage, results screen and song cards open a board for that exact chart and difficulty. Device scores save in IndexedDB automatically after completed solo runs with Practice disabled. Failed, unfinished and Battle runs do not rank. One best run per browser player is retained; the name can be edited in the leaderboard dialog.

Board identity includes the source audio (or published song ID), difficulty and SHA-256 of the ordered note tuples in microseconds. Rule version `ordered-perfect-v1` separates these scores from earlier gameplay. Perfect/Great/Good/Miss award 1000/800/500/0 points. Only consecutive Perfect judgements build combo. Rank uses score, Perfect combo, then earlier completion.

## Activate Community boards

Device boards are available immediately. Shared boards require running `supabase/level-leaderboards.sql` once in the existing project's Supabase SQL editor. No service-role credential belongs in client configuration. Management access was unavailable when this release was prepared; this migration has not been applied or verified against production.

The migration creates a separate score table with RLS, no direct client writes, an authenticated submission RPC and a read RPC restricted to published ready songs. Submission requires a matching fingerprint for the original published chart. Scores and Perfect combos are calculated from bounded judgement arrays inside the RPC. Results are client-reported; this is a casual leaderboard, not an anti-cheat system.

After migration, complete an unchanged Community chart in solo mode, open its leaderboard, choose Community and Submit this run. Explicit submission uses the existing signed-in account or creates the configured device account. Each account has one best run per song/chart. Editing or regenerating a chart gives it a device board; shared submission requires the published original. Private/deleted songs are not readable through the Community RPC. Clearing browser storage removes device scores and device-account access.

Verification: `npm test` covers real leaderboard-controller persistence/rendering with mocked storage and API, ranking helpers, order enforcement and battle changes. The migration still needs application and live database verification by someone with project access.
