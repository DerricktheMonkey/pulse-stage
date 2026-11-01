# Opening performance diagnosis

The cause of the user's device-specific first-second note hitch is not yet verified. Earlier optimizations and decoder changes did not resolve the reported symptom. Do not claim it is fixed based only on mocked tests.

Build 47 adds a reversible Background motion checkbox and a Motion on/off button beside Pause. Turning motion off pauses the background video and prevents video seeks, warm-up playback and automatic playback requests. The background asset and original resolution are retained. Restart the same song after changing this setting for a clean comparison.

The pause menu and battle menu contain Performance report and Copy report controls. The report compares count-in, first second and seconds 1–3; includes frame rate, worst frame interval, slow frames, clock-versus-frame gap and CPU draw duration; and records level, difficulty, background type, motion setting, browser and canvas dimensions. Two runs are kept in memory for comparison. No report is uploaded or sent. Copy requires an explicit user click. Real GPU/compositor output is not measured by requestAnimationFrame timing alone.

A useful test is to play the first four seconds with motion on, then restart with motion off and copy the report after pausing. A hitch that crosses a phase boundary remains included; paused time is excluded. Toggling motion mid-run is marked so the report is not mistaken for a clean comparison.

The user has said music remains smooth and suspects video/GIF backgrounds that required compression. Exact level, device data and this controlled comparison are still missing. Use those observations to choose the next fix rather than changing note generation, timing or difficulty again.
