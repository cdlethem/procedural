# Vector clipping investigation

Root source review; not a frozen contract or accepted implementation.
Pinned source/note hashes and analytic defect witnesses are in
`vector-clipping-source-review.json`. Copies remain ignored under `.work/`.
Implement independently; preserve upstream MIT/provenance if any source is copied.

## Artist task and boundary

Take retained strokes from a hatch pattern, path, or larger line drawing and keep the
portions inside a supplied polygon. Return segments, rather than just masked pixels, so
artists can recolor, transform, place endpoint marks, or feed later geometric operations.
Changing the region should not regenerate the input drawing. Changing decoration should
reuse the clipped output. This complements Java2DRegions and raster masks; it does not
replace image placement or make paths bend around obstacles.

Proposed architectural direction: segment-set clipping against one supplied simple polygon,
with potentially multiple retained intervals for a concave region. Preserve source segment
identity and order and increasing position along each segment. Keep hatch layout and style
outside this computation. A straight hatch family is one consumer; an existing retained
polyline broken into supplied segments is the transfer consumer. A public convenience for
hatching is justified only if the complete example exposes meaningful repetitive wiring.
No public signature, tolerance, range, or validity domain is frozen here.

## Evidence and corrections

forms1 candidates #0/#1 motivate polygon hatching and segment intersections. Root read the
complete note and pinned source. The source accepts exactly two collected intersections;
it does not sort/pair multiple intervals or deduplicate vertex crossings. Its helper checks
only x extents, so vertical segments can report intersections beyond their endpoints.
A generic clipper must deliberately correct this rather than promise source equivalence.
The 4→10 pixel spacing experiment demonstrates a hatch density edit, not clipping tolerance
or a generally recommended spacing range. Generated four/six-vertex outlines do not justify
restricting the reusable clipper to rectangles or strictly convex polygons.

plasma007 candidate #2 motivates a related intersection workload, but its actual pass tests
only later list entries, drops rays without a first-pass hit, then re-extends/mutates the
surviving list. Strict x/y extent comparisons reject axis-aligned crossings. A generic
nearest-hit ray operation would be a different contract, not an alias for polygon clipping.
Keep it out of the first clipper and do not count plasma007 as covered by that addition.

## Resolve before admission

- Simple polygon validation: winding independence, concavity, repeated closure vertex,
  collinear adjacent edges, invalid self-intersections and zero-area input.
- Boundary ownership: coincident edges, vertex tangencies, zero-length strokes and whether
  point-only contacts are omitted. Multiple interior intervals must not become one bridge
  across an exterior notch.
- Numeric robustness: distinguish topology predicates from rounded output coordinates;
  inspect existing exact predicate infrastructure before selecting arithmetic. Do not add
  an arbitrary epsilon that changes with canvas scale.
- Bounded work and output: polygon validation, segment-edge pairs and worst-case interval
  growth; explicit overflow/failure before returning partial results.
- Output ownership and provenance: retained segment index and parametric interval values,
  no invented persistent IDs or implicit drawing state.

First private study should include a concave notch, a through-vertex line, a coincident
boundary stroke, and reversed winding, then actual hatch and retained-path compositions.
Root reviews the visual edit/transfer and freezes the smallest useful contract afterward.
Use established operation/parameter/performance workflows at admission; current evidence
is sufficient to justify investigation, not public support or full-original recreation.
