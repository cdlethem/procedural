# Contact marks in the browser

This source-checkout starter draws ten query segments from authored start
points toward the canvas center and connects each to its nearest contact
point on a four-edge obstacle quadrilateral, using
`geometry.nearest-segment-contact-2d` (exact rational selection, single
binary64 rounding). Cross-checked all ten contacts in both obstacle states
against a real `NearestSegmentContact2D` Java reference run before writing
the JS model test (byte-identical results, including obstacle indices).

N shifts one obstacle corner and rebuilds the contacts; C swaps the
display palette without touching the query; 0 resets (rebuilding only when
the geometry actually changes), matching the Java sketch.

This starter is not a browser-native conformance or reproduction claim; it
is a scoped port of the ContactMarks composition's mechanism to p5.js. The
Java source is marked a candidate workflow; nearest-segment-contact-2d is
the accepted operation it demonstrates.
