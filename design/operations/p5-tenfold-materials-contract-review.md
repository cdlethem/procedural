# Raster, color and mesh contract review

Root approves the ten corresponding catalog entries for p5 implementation.
Approval follows the architecture challenge, complete draft, schema review and
independent checking of analytical outputs. Catalog entries are normative and
supersede the preparation draft; support acceptance remains pending execution.

Floyd–Steinberg is a binary grayscale operation, with scan-order error diffusion;
color application remains a study choice. Root corrected the 2x2 all-0.4 fixture
to [0,1,0,0] and its exact ten-unit work boundary. Bayer uses the established
recursive screen orientation, computed from bits rather than allocating a matrix.
Root corrected the order-two screen and added a position-sensitive fixture.
Signed convolution reverses the kernel; the asymmetric zero/clamp cases distinguish
it from correlation. Morphology requires a nonempty active structuring element,
reflects offsets for dilation and uses the opposite convention for erosion.

The distance transform uses exact integer envelope transitions and smallest
row-major feature identity, including tie cases. Binary64 parabola intersections
could misclassify large integer grids; root replaced them with exact floor-division
transitions. JavaScript BigInt stays internal. Returned distances convert the exact
squared integer to binary64 before square root, and no-feature results use JSON
null. The implementation must remain separable and linear in grid entries rather
than perform an all-pairs distance search.

OKLab uses Ottosson's published linear-sRGB matrices with explicit encoded-sRGB
decoding/encoding, exact copied endpoints and component clipping before encoding.
This is not a perceptual gamut-mapping algorithm. Median cut specifies box selection,
replacement order, split ties, source-order means and nearest-palette ties; root
added a three-box ordering fixture. General color-interior vectors remain a required
tolerance-based implementation check, since exact endpoint fixtures alone do not
establish the interpolation algorithm.

Extrusion must call the reviewed simple-polygon triangulator, preserving original
vertex indices, positive caps and outward walls for either input winding. Root
added full clockwise triangle geometry and exact dependency/total budget cases.
Ribbon widths mean full width; endpoint frames remain independent even if the path
returns to its initial coordinate. Parallel/reversal and frame-failure behavior is
explicit. Loop subdivision accepts manifold boundaries, checks vertex links and
preserves deterministic edge/face order. Root replaced an ambiguous work schedule
with one conservative recurrence, including validation for zero refinement levels.

These independently designed operations add no original corpus recreation credit.
The studies will show meaningful parameter changes and retained-output reuse under
bounded p5 workloads. Native image, control, reset/replay/save and packaging evidence
remain separate gates. Other ports, arbitrary solids, holes, seam correction,
non-manifold repair, crease rules and accelerated shader execution are excluded.
