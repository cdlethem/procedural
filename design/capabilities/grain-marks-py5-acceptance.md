# GrainMarks py5 native acceptance plan

Execute the actual GrainMarksSketch subclass in pinned py5/JDK17 JAVA2D at640x640,
density1. First require six actual Java/Python complete composition comparisons for
uniform and both concentrated distributions, seed/density changes and quadrant transfer.
Caller-side Java Random sequence remains example code, separate from library xoshiro.

Use the established callback observer and existing py5 environment/Xvfb under the shared
machine lock, at most240 seconds including startup/cleanup. Do not instantiate a mock
renderer or replace drawing calls. The observer counts actual forwarded point/line calls.
Exercise nine paints: baseline15680 points, M strokes, C palette (both retain geometry),
B first-vertex concentration, B edge concentration, N density31360, R seed43,
X transfer26 triangles/81920 points, 0 baseline reset. Every state checks all settings,
composition identity and geometry, correct native primitive/count, revision and dimensions.
Capture baseline, strokes, colour, both concentrations, transfer and reset.

Baseline non-background raster bounds must lie within2px of retained-point extrema,
allowing1px mark/raster rounding and detecting the cutoff seen in the separate p5 port.
Use Java/py5's native point primitive unless actual evidence requires a target correction.
Reset RGBA must equal baseline; unknown Q and S save retain geometry/revision9/pixels;
saved PNG decoding must equal the displayed canvas. Exactly9 paints are required.
These callbacks execute on the actual sketch, not physical keyboard input or a timed
lifecycle exercise. No post-exit or asynchronous quiet-period claim is made.

Bind source, fixtures, observer and runtime hashes before/after. Fail on exceptions and
preserve every attempt. Root inspects five representative images before native acceptance.
No Java pixel identity, original-source recreation, registry release or package acceptance
is inferred. The accepted geometry and visibly distinct concentration mechanisms are the
scope; no new parameter defaults/ranges or performance matrix is added.
