# Browser CP1 edit-transfer decision

Root inspected all four 640×640 browser outputs on 2026-09-07. The initial four-image
run passed; no correction is needed. See `evidence/conformance/p5js-adapter-cp1.json`.

The actual browser retains 25,600 marks per case and matches Java's recorded model,
binary32 geometry and colour hashes exactly for all four edits. This fixture-specific
result is stronger than the allowed geometry tolerance, but does not promise universal
cross-language trigonometric identity or cross-host pixel identity.

The base has the same directional arrangement of separate short marks seen in JAVA2D.
The length edit makes denser overlaps; the palette edit preserves those arrangements
with purple, pink, cyan and yellow; the bar edit makes broader rectangular coverage.
All three edits change measured pixels, and all images remain opaque and nonempty.
No unexpected blank region or lost composition was apparent in the inspected images.

Accept this as scoped p5 2.3.2 / Chromium 153.0.8010.12 CP1 edit-transfer evidence.
The browser pixel report predates the exception-classification correction; its native
drawing path is unchanged. The expanded 18-case lifecycle result proves the changed
failure paths, and `p5js-adapter-transfer.json` supplements still-live output ownership.
Final independent support review/catalog integration remain separate; py5, Android,
installation and broader capability work are unfinished. Images remain outside Git.
