# Compatibility video playback (build 51)

The reported compressed-WebM opening hitch was visible despite approximately 144 JavaScript frames/second and sub-millisecond first-second draw submission in the user's report. Disabling motion removed it. A 60Hz monitor test and the broad optimization pass did not help. Those observations do not identify a GPU driver bug, but justify testing a different video presentation path while keeping the original media.

Automatic mode uses a dedicated background canvas for WebM. Compatibility can also be selected for other video files; Standard restores the native visible video element. The decoder keeps the original Blob URL, encoded frames, intrinsic dimensions, currentTime timeline and playback rate. No re-encoding, alternate-size asset or chart changes are performed.

The canvas matches the actual viewport at its full device-pixel ratio and uses the same centered object-fit-cover crop. It draws from the original decoder on video-frame callbacks. A watchdog handles browsers that suppress callbacks for offscreen video, using decoded-frame counts where available to avoid duplicating paints. This bypasses the native visible-video layer rather than changing the note renderer or the user's monitor settings.

Compatibility preparation waits for frames painted on this path before the countdown. Timeouts are bounded. Pausing, resetting or selecting Standard cancels its callbacks. Canvas creation failure, context loss or drawing errors fall back to standard video playback. Motion off continues to pause decoding without deleting the background.

The opening report records Background renderer: compatibility/native/native-fallback so device testing can verify which path was actually used. This is an alternative playback path, not a confirmed fix on the user's PC. Browser hardware/compositor behavior cannot be reproduced in this environment.

Tests cover cover-crop geometry, viewport pixel density, unchanged source/playback rate, per-video-frame painting, duplicate skipping, paused seeking, preparation barriers, timeouts, cleanup and native fallback. Existing gameplay, audio, difficulty, storage, compression and battle tests remain required.
