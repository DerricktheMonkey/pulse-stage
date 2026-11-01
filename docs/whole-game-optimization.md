# Whole-game optimization (build 49)

The user confirmed that Motion off removes the opening note hitch and wants to retain original moving-background quality. The per-note cache alone did not resolve it on their device. Build 49 reduces competing game workload without changing background bytes, resolution, playback rate, chart density, judgement windows, life or scoring rules. Real-device confirmation is still required.

## Rendering

Efficient rendering is enabled by default and can be turned off in settings. It estimates the display cadence while idle, then uses a fixed whole-frame divisor during play to avoid uneven timer-based caps. Common examples: 60Hz → 60 FPS, 120Hz → 60, 144Hz → 72, 165Hz → 82.5 and 240Hz → 60. Input timing remains tied to the audio clock, independent of draw cadence. Idle scenes use less work; hidden/editor playfields skip drawing.

Full-DPR note heads/caps and hit-effect halos are cached. Transparent padding scales with device pixel density, reducing cached texture area while keeping the painted geometry and colors. Particle effects avoid repeated live blur passes, and expired effects are compacted without replacing their array. HUD changes are marked dirty and written once per rendered frame; unchanged score, accuracy, combo, elapsed time and countdown text are not rewritten.

Native video and image opacity stays at one. A separate scene-colored shade provides equivalent dimming, avoiding per-video opacity blending. Original video content and frame rate are untouched.

## Loading and memory

Audio analysis remains in a worker and returns only notes, BPM and version instead of unused envelope/peak arrays. Restoring custom, Community and already-current generated charts does not repeat analysis; outdated generated Insane/Impossible charts are upgraded once. Saved chart metadata records the analyzer version.

Battle difficulty generation reuses the buffer it decoded for analysis when applying the chart, instead of decoding the same song a second time. Device loads retain normal audio decoding. Battle text is only rewritten when it changes, and battle health updates share the frame-batched HUD.

## Validation

Tests cover frame divisors and the full-refresh override, hidden/editor rendering suppression, HUD batching, in-place effect cleanup, cache geometry/texture bounds, compact worker messages, restore policies and shared battle decoding. Existing gameplay, analyzer, local/cloud save, startup, codec, realtime and three-round battle tests remain in the suite.

The Opening report shows whether efficient rendering was enabled and compares the first second with later frames. JavaScript draw metrics are not a full GPU or decoder profile. If the original video's decode load alone exceeds the device's capability, these optimizations cannot guarantee smooth playback; obtain the user's report and exact level/browser before claiming a root fix.
