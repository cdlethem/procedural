# Glyph marks in the browser

This editable p5.js starter repeats glyphs along 48 seeded
`path.gradient-path-2d` results. The core traces each evolving path; this
example owns the fixed composition metadata (JDK17 `java.util.Random` starts,
sizes, and symbol indices), stamp-before-move rule, text/dot transfer, and
style controls. `glyph-marks.js` was cross-checked against a real
`GlyphComposition.create(42, 0.75, 0.006)` Java run: six early paths, final
path, their metadata, pre-advance anchors, step 80 and final stamped anchors,
and the changed-distance/changed-field-scale trajectories.

The adapter loads only `assets/GlyphMarks.ttf`, hashes it before registering a
`FontFace`, and fails visibly when it is absent, corrupt, or not the reviewed
asset. Its SHA-256 is
`b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c`.
It is DejaVu Sans, the same explicit asset and `0123456789ABCDEFGHIJ` coverage
accepted for the Java workflow; see `assets/FONT-LICENSE.txt`.

Run the model check:

```sh
node tests/native/glyph-marks-model.mjs
```

Run the browser example with its pinned repository-local p5 runtime:

```sh
node tools/serve_glyph_marks.mjs
```

Open the reported address. N shows 80 instead of 160 marks per path; D stamps
every fourth retained anchor; G switches digits to letters; M switches glyphs
to dots; C switches the ramp to color; V changes integration distance; F
changes field scale; R advances the seed; 0 resets; S saves the displayed frame
without redraw.

This is a scoped browser workflow port, not a browser-native font conformance
or pixel-reproduction claim. Browser text rasterization, hinting, and alpha
compositing differ from Processing JAVA2D. No glyph outlines, kerning, shaping,
paragraph layout, or arbitrary user-font support is claimed.
