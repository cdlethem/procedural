# Clip marks in the browser

This source-checkout starter clips one of three authored source sets (dense
diagonal hatch, sparse hatch, supplied polylines) against a notched octagon
with `geometry.segment-clip-2d` (exact rational clipping, single binary64
rounding). All 205 clipped segments across the six geometry states
(dense/sparse/supplied x normal/shallow floor) were cross-checked against a
real `SegmentClip2D` Java reference run before writing the JS model test
(byte-identical results, including source indices).

H switches the hatch density (inert while the supplied source is active,
matching the Java sketch), N moves the notch floor, T selects the source
set, C/M/O are display-only toggles, 0 resets (rebuilding only when a
geometry flag was set), and S saves the cached frame without redraw.

This starter is not a browser-native conformance or reproduction claim; it
is a scoped port of the ClipMarks composition's mechanism to p5.js. The
Java source is marked a candidate workflow; segment-clip-2d is the
accepted operation it demonstrates.
