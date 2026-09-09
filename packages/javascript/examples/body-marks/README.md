# Body marks in the browser

This source-checkout starter retains twelve heads that step forward one tick per
frame through a seeded `field.gradient-noise-2d-01` field, while each body's spine
retraces backward from the new head via `paths.gradient-trace-2d`, drawn as a
tapered body outline or a bare centerline. Cross-checked the initial head layout,
one-tick advance, spine sample, and palette phase against a real
`GradientNoise2D01`/`RegularGrid`/`GradientPath2D` Java reference run before writing
the JS model test (byte-identical results).

This starter is not a browser-native conformance or reproduction claim; it is a
scoped port of the accepted BodyMarks composition's mechanism to p5.js.
