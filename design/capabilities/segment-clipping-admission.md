# Segment clipping capability admission

Root admits independently specified simple-polygon segment clipping for contract preparation.
This is architectural admission, not a frozen contract, implementation acceptance or release.

## Artist task and reusable boundary

Clip a supplied line drawing to a concave region, change the region without regenerating
that drawing, and use the resulting segments for independent color, endpoint decoration
or later geometry. The private native study demonstrates hatch spacing, changed notch
geometry and a five-stroke input yielding eight clipped pieces. Source identity survives
splitting; order follows input strokes and progress along each stroke.

Input is one simple polygon and a batch of finite segments in the same caller-defined
coordinate system, plus explicit work and output budgets. Output owns packed segment
coordinates, original source indices and start/end parameters. Supply indexed getters,
allocation-free Into copies and detached exports using established package conventions.
No renderer, font, random state, seed, style or coordinate transform is implicit.

The region includes its boundary; retain positive-length boundary strokes and omit isolated
point contacts/zero-length sources. Support concavity, either winding and straight-through
collinear vertices. Use implicit closure; reject duplicate vertices, backtracking,
self-crossing, self-touch and zero area. Holes/multiple rings need separate semantics and
are outside this admission. Clipping concerns centerlines; thick rendered strokes may
still need the existing raster mask to constrain their visible footprint.

## Alternatives and evidence

Java2DRegions and masks constrain pixels, not retained geometry. Delaunay changes topology;
convex placement filters whole shapes. Neither substitutes for this algorithm. A standalone
intersection point helper leaves sorting, vertex deduplication, concavity and boundary
handling with the artist. Do not expose that lower-level helper merely because it exists
inside the clipper. Hatch layout remains a caller choice; a reusable convenience can follow
only if the complete artist example demonstrates excessive wiring.

Motivation: forms1 #0 (clipHatch) and #1 (segmentIntersection), bound individually in the
ledger. Root read full report and pinned source. Its exactly-two-hit rule and missing y
bounds are deliberately corrected. Hatch layout, blueprint annotations, palette, random
polygon generation and endpoint beads remain drawing/composition. No source code copied.
No full forms1 recreation is claimed. plasma007 nearest-hit rays are a related workload,
but ordered two-pass mutation is not polygon clipping and is not admitted here.

Evidence: vector-clipping-source-review.json, vector-clipping-native-study.json,
vector-clipping-polygon-study.json, vector-clipping-rounding-study.json and
vector-clipping-exact-study.json in this directory. Only the moderate double study has
been rendered; exact Java coordinates were separately compared to the independent oracle.
The production exact workflow still requires native validation.

## Numeric and resource decisions for the contract

Use exact rational topology over the supplied binary64 values: exact intersection cuts,
ordering, deduplication and midpoint containment. Round output parameters and coordinates
once, nearest-even, canonicalizing zero. The mathematical source endpoints at t=0/1 are
preserved apart from zero normalization. No epsilon or silently snapped topology.

Raise an explicit representation error rather than return a positive-length interval whose
rounded parameters or endpoints collapse. Also reject a positive exterior gap whose
rounded parameter endpoints collapse between two returned intervals of the same source;
otherwise exported intervals could appear contiguous despite different topology. Exact
rational endpoints can round slightly off the mathematical polygon edge; do not claim
strict real-coordinate containment for the rounded output.

Require caller work and retained-output limits, validated before geometry processing.
Use a conservative preflight cost derived from input sizes to bound the quadratic
validation and midpoint algorithm; define its exact formula and integer arithmetic in
the catalog before implementation. This is an engineering work allowance, not a timing
promise or artistic parameter. A separate retained-segment limit rejects overflow with
no returned partial result. Do not inherit the private 256/2048 diagnostic caps as public
recommended ranges. Measure production allocation and representative sizes before release.

Exact Fraction/Java checks distinguish tiny/large coordinates and narrow representational
collapse. The preliminary ~10ms 100-stroke study supports proceeding, not a latency promise.
No new public artistic parameter or range is being inferred from the four-to-ten-pixel
source hatch-spacing experiment; that setting belongs to the consumer.

## Delivery

Freeze one language-neutral contract and discriminating fixtures, then implement the Java
core. Reuse the project exact-arithmetic principle without altering accepted triangulation
or convex-placement semantics. Root owns catalog, shared fixtures, review and acceptance.
Native workflow must demonstrate region change, source substitution and retained styling;
include exact-core output and extracted-package execution. Ports remain deferred. The
original five Java completion requirements remain unchanged.
