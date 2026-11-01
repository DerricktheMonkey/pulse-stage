# Compressed background playback

Compression keeps original pixel dimensions. Moving backgrounds are captured at a target 30 fps. The encoder now prefers supported AVC/MP4, then MP4, then VP8 WebM, with VP9 WebM retained as a fallback. A one-second keyframe interval is requested where accepted; unsupported recorder options are retried without that hint.

The source video decoder is primed before recording, and the source timeline begins after the recorder's start event. This avoids spending the encoder startup period recording a cold or stalled source. Compression metadata includes the codec/container, requested frame rate, keyframe hint and compression version 2.

The player uses `primeVideo` before the countdown for all moving backgrounds, including existing compressed clips. A resolved `play()` promise alone is insufficient: it waits for up to eight presented frame callbacks or 250ms of presented media progress. Older browsers use media progress events. The wait is bounded, cancellation and failed playback clean up callbacks, and the video is rewound before music/note scheduling. No audio, note density or chart timestamps are changed.

New encoding preferences apply when compressing a new upload. Already uploaded bytes are unchanged. Frame-based priming can help cold decoding of those files, but cannot recover frames lost or unevenly recorded in an old compressed file. Such a file needs a new encode from the original source; re-encoding an already damaged copy cannot restore missing source frames.

Tests cover codec preferences, encoder/source start ordering, keyframe-option fallback, dimensions, priming callbacks, cancellation, timeouts, and the player's scheduling barrier. Browser codecs are mocked in this environment; actual decoding smoothness on the affected device remains unverified.
