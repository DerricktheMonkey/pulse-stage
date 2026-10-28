# Restore point before immersive camera

The stable flat 2D version is preserved on GitHub branch [`backup/pre-immersive-2d`](https://github.com/DerricktheMonkey/pulse-stage/tree/backup/pre-immersive-2d), commit `81505e1cd3adcbba97ca419fc6ca610d5db3f5fe`.

The matching Sites source commit is `b51b67d07dbaacb35f0005dbe7cec4d1179efa46`. Its deployed version is `appgprj_6ae0eed5fdbc8191869c092237b9a344~appgver_dda96a62a3f4819184aeafe91c55a423`.

Turn off **Immersive camera** to use the flat view immediately. For a full rollback, restore the backup branch files onto main in a new commit and redeploy; preserve subsequent work and do not force-reset main. Song files and database content are not part of this code snapshot and must not be cleared during rollback.

## Immersive camera behavior

During gameplay the camera shifts about every six seconds, easing between viewpoints over 2.2 seconds. The existing image or video is rendered on a deeper 3D plane behind the note canvas. Both rotate together; HUD and feedback remain upright. This is a perspective/depth effect on imported media, not a generated 3D reconstruction or an inferred view of unseen scenery. Recording and editing stay flat.

The camera is enabled by default, can be disabled in settings, and respects reduced motion. Song time drives the camera so it freezes while paused and restarts consistently. Canvas resolution uses its layout dimensions, and touch input is inversely projected back onto the note plane. Geometry checks cover mobile, tablet, desktop, and wide viewports; a browser visual check remains necessary in this environment.
