# Ordered convex polygon filter 0.1.0 — normative semantics

Operation/decision cluster `sampling.ordered-convex-polygon-filter-2d`. Root approves this
contract for Java-first implementation after CP20 private study and dependency-admission
gate. Catalog owns schemas. No public implementation, workflow or distribution acceptance.

## One responsibility

Filter supplied strictly convex polygon proposals in their original order. Keep a proposal
only when its closed filled region is disjoint from every earlier retained region. Edge or
vertex contact, identical polygons, crossing edges and either-direction containment reject
the later proposal. This deliberately differs from the source's asymmetric containment bug.

Exactly `{polygons}` is required. Each polygon is a vertex cycle, each vertex exactly `[x,y]`.
All coordinates are finite binary64 values in caller units; convert native numeric carriers
to binary64 before geometric decisions. Normalize exposed negative zero to positive zero.
At least three distinct vertices per polygon; do not repeat the first vertex to close it.
Every nonincident vertex must lie strictly on the same interior side of every directed edge.
Either winding is valid and preserved, as is the first vertex. Reject repeated vertices,
collinear vertices, zero area, concavity and self-intersections including star traversal.
Do not compute a convex hull, delete vertices, reorder or repair invalid input.

Empty proposal list produces an empty result. Duplicate polygons are valid proposals; only
the first is retained. No RNG, time, renderer, asset, noise, clip boundary, coordinate system
conversion, shape generation, separation distance, fallback or hidden tolerance is consumed.
Origin/axes follow caller coordinates; no angle input. No defaults or encouraged ranges.
The source's measured thickness edit changes caller shape construction and is not a scalar
parameter of this filter. The private study's0.8/0.2 ratios remain example configurations.

## Validation, exactness and order

Interchange uses exact Map keys and List containers. Only Byte, Short, Integer, Long, Float,
and Double carriers in Java; reject Boolean/null/string/other Number, BigInteger/BigDecimal
and Java arrays within the interchange route. The typed route is `double[][][]` with the
same shape, finite-value and geometry rules. Stable inputs during a call are required.

Validate top-level object/container and proposal count first. Then visit each proposal in
order: polygon container/count, each vertex pair and x then y, then that polygon's geometry.
Complete validation of ALL proposals before filtering, even polygons that would be rejected.
Malformed containers, unsupported/nonfinite coordinates and count limits give INVALID_INPUT.
A structurally valid finite polygon violating strict convexity gives INVALID_POLYGON.
`candidateIndex` is the zero-based proposal for proposal-local errors, or-1 for top-level/count
errors. Coordinate-shape validation takes precedence over geometry within the same proposal.
Failures return no result; inputs remain unchanged. Allocation/resource exhaustion remains
an ordinary runtime failure, never partial geometric success.

The total vertex count across proposals must not exceed1073741823; proposal count must not
exceed357913941. These derive from packed2V signed32 coordinate storage and minimum3 vertices,
not a promised workload or memory availability. An excess total count discovered while
visiting a proposal is INVALID_INPUT at that proposal. Zero proposals require no geometry.

Treat normalized binary64 coordinates as exact dyadic real values for all orientation and
intersection decisions. The determinant `(bx-ax)*(cy-ay)-(by-ay)*(cx-ax)` has its exact sign,
including subnormal values and differences/products outside binary64's finite range. No
rounded-zero/overflow approximation or epsilon may change a sign. Certified floating-point
filters may avoid exact arithmetic only when they prove the same sign; uncertain cases
must fall back to exact arithmetic. The existing Delaunay predicate mechanism is precedent,
not a mandate to change the accepted triangulator. Outputs copy input coordinates exactly
apart from zero normalization; coordinates are not projected or transformed.

Visit proposals in order. Retained polygons and original indices preserve that order;
source indices are strictly increasing. Later proposals never remove earlier survivors.
AABB rejection, separating axes or edge tests may optimize intersection without changing
this result. Extending a valid proposal sequence preserves the previous retained prefix.
This is greedy filtering, not optimal packing; changing proposal order can change the result.

## Output, ownership and Java surface

Output is exactly `{attempts, polygons, sourceIndices}`. `attempts` is input proposal count;
`polygons` contains owned normalized survivors; `sourceIndices` joins them to caller metadata.
Result size equals both output list lengths. No rejected geometry is retained publicly.
`toValues()` materializes fresh mutable Map/Lists; editing any returned container cannot alter
the immutable result, another materialization or supplied input. No serialization method
pretends to reconstruct rejected proposals; replay uses the original caller input.

Final immutable `org.procedurals.sampling.ConvexPolygonPlacements2D` provides:

- `filter(Object config)` and `filter(double[][][] polygons)` using one geometric kernel;
- `size()` and `attempts()` returning int;
- `sourceIndexAt(long polygonIndex)` and `vertexCountAt(long polygonIndex)` returning int;
- `xAt(long polygonIndex,long vertexIndex)` and `yAt(long polygonIndex,long vertexIndex)`
  returning double without allocation;
- `toValues()` returning a detached Map<String,Object>.

Access checks polygon index first, then vertex index. Negative/out-of-range indices give
INDEX_OUT_OF_RANGE, with candidateIndex=-1 (these are result indices, not proposals).
Do not narrow a long before checking its range. No mutable internal array or host object is
exposed. Nested final `PlacementException extends IllegalArgumentException` exposes public
final `String code` and public final `int candidateIndex`. No native-only public collision
predicate, geometry builder or seeded convenience is introduced by this operation.

Storage O(V+N), with compact survivor storage after construction. Strict validation may cost
O(sum m_i²). Pair work has worst-case O(sum over compared pairs m_i*m_j); broad-phase bounds
should be cached per polygon, not rebuilt for every pair. Primitive access is O(1); output
materialization is O(retained vertices). Exact fallback allocation must be measured separately
from the certified common path. Finite counts bound work but do not imply interactivity.

## Verification and delivery

Shared exact fixtures distinguish both containment orders, thin crossing polygons without
contained vertices, shared edges/vertices, separated collinear edges, reversed winding,
identical proposals, order-dependent selection and prefix retention. They include malformed
shapes, unsupported carriers in native tests, collinear/concave/bowtie/consistent-turn stars,
subnormal geometry, MAX_VALUE differences, signed zero and late-invalid proposals. Independent
Python Fraction/separating-axis expectations must not import the Java/private implementation.
Ownership, all accessors, index/error precedence and typed/interchange equivalence require
native checks. Bind source/catalog/fixtures/runtime/class hashes using established runners.

Measure separated and genuinely intersecting4/12-vertex proposal workloads and a larger
bounded source-like workload with a consumed result. Avoid a benchmark consisting only of
AABB misses. Do not add a giant matrix. A complete native workflow then demonstrates aspect
edits, retained recoloring, diamond transfer, reset and cached save before packaging. Private
CP20 rendering is design evidence only. All other targets are deferred; source-perfect
celular/celular2 recreation and a general polygon toolkit are not claimed.
