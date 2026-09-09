# Path clip marks in the browser

This source-checkout starter traces six seeded `field.gradient-noise-2d-01`-driven
paths into 960 short segments, then clips them against a notched polygon
(`geometry.clip-segments-simple-polygon-2d`). The notch depth toggle rebuilds the
retained clip; per-path palette and the unclipped-source overlay are redraw-only
treatments, matching the Java example's own reclip/redraw separation. Cross-checked
the full trace+clip pipeline against a real `GradientPath2D` + `SegmentClip2D` Java
reference run before writing the JS model test (960 sources, 405 clipped pieces,
byte-identical first clipped segment and its source index).

This starter is not a browser-native conformance or reproduction claim; it is a
scoped port of the accepted PathClipMarks composition's mechanism to p5.js.
