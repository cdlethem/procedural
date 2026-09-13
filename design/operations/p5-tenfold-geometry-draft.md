# Geometry and layout contracts for the p5 expansion

Root specification draft, 2026-09-13. These boundaries are selected for the
maintainer's expanded p5 gallery assignment. Implementation starts only after the
corresponding catalog contract and analytical fixtures are frozen. Native studies
are original design demonstrations; no new corpus recreation is claimed.

## Common rules

Each function takes one plain object with exactly its listed required fields.
Numbers are finite binary64, counts and maxWork are nonnegative safe integers.
No implicit RNG, noise, clock, renderer, mutation or retained input references.
Return detached ordinary arrays/objects; canonicalize exposed -0 to 0. Reject
malformed input with INVALID_INPUT, nonfinite computed arithmetic with
NUMERIC_OVERFLOW, insufficient work/allocation-count budget with WORK_LIMIT.
Validate the complete input before algorithm work. An error returns no partial
result. Work counts are conservative preflights where specified, independent of
native timing; they are not recommended UI limits. Output array lengths may not
exceed 4294967295. Geometry uses exact binary64 comparisons without epsilon;
there is no robust-predicate promise near degeneracy. General numeric comparison
allows absolute 1e-9 plus relative 1e-12; topology, indices and analytical fixtures
compare exactly. Coordinates are caller units with no built-in canvas convention.

## 1. chaikin-polyline-2d / chaikinPolyline2D

Input: points (at least two xy points), closed (boolean), iterations (integer),
maxWork. Output: {points}. Retain coincident supplied points. Zero iterations
returns a detached copy. For each directed edge A->B emit Q=0.75*A+0.25*B and
R=0.25*A+0.75*B, in that order. Closed edges include last->first and no appended
seam. Open output prepends the original first point and appends the original
last point on every iteration. Thus both modes double the point count per pass.
Require N + sum(N*2^j,j=1..iterations) <= maxWork before allocating pass output;
safe multiplication failure is WORK_LIMIT. No smoothing strength or alternate
scheme: another corner-cutting rule is outside this operation.

Analytical: open [[0,0],[4,0]], one pass -> [[0,0],[1,0],[3,0],[4,0]].
Closed same input -> [[1,0],[3,0],[3,0],[1,0]]. Budget 5 fails for that pass;
budget 6 succeeds. Zero passes preserves duplicates and requires N work.
Studies: rounded panel outlines; flowing open brush paths. Iterations changes
corner refinement; closed/open geometry can be replaced independently of marks.

## 2. simplify-polyline-2d / simplifyPolyline2D

Input: points (at least one xy point), tolerance (nonnegative), maxWork.
Output: {points,sourceIndices}. This operation is explicitly open; callers choose
a seam before simplifying a loop. Retain endpoints. For each endpoint interval,
measure each interior point's Euclidean distance to the finite segment, using
clamped projection; coincident segment endpoints use distance to the endpoint.
Choose the earliest source index among equal maximum distances. Split only when
maximum distance > tolerance. Process left interval before right, avoiding host
recursion limits. Return retained indices in ascending order. A one-point input
returns that point/index. Preflight N*N <= maxWork, safe integer arithmetic.
This conservative quadratic bound removes input-dependent budget surprises.

Analytical: [[0,0],[1,1],[2,0]], tolerance 1 -> endpoints indices [0,2];
tolerance 0 -> all indices. [[0,0],[2,0],[1,0]], tolerance 0 -> all indices:
the middle point is outside the endpoint segment, so line-distance is wrong.
[[3,4],[3,4],[3,4]], tolerance 0 -> indices [0,2]. Budget N*N-1 fails.
Studies: contour abstraction; reduced gesture skeletons. Tolerance changes
which original corners remain; output indices preserve per-point attributes.

## 3. offset-polyline-2d / offsetPolyline2D

Input: points (at least two xy points), closed (boolean), distance (finite),
miterLimit (finite >=1), maxWork. Output: {points}. Adjacent coincidences are
INVALID_INPUT, including a repeated closing point. Closed input requires at
least three points. Unit left normal of edge dx,dy is [-dy/length,dx/length].
Distance is signed in this coordinate convention. Open endpoints use the single
adjacent normal. At an interior corner with incoming/outgoing unit directions,
cross==0 and dot<0 is INVALID_INPUT (exact reversal), including distance==0.
Same-direction parallel edges emit the vertex plus distance*incoming normal.
Otherwise intersect the two offset infinite lines; use that miter if its distance
from the original vertex <= abs(distance)*miterLimit. A longer miter emits two
bevel endpoints, incoming then outgoing. Zero distance returns the source vertex
once after validating direction/reversal constraints. No caps, thickness region,
self-intersection cleanup or polygon Boolean behavior is implied. Preflight
4*N <= maxWork. Closed output begins at the join of source vertex zero; it does
not append its initial point. Output order follows source traversal.

Analytical: open [[0,0],[2,0],[2,2]], distance 1, miterLimit 2 ->
[[0,1],[1,1],[1,2]]. Limit 1 -> [[0,1],[2,1],[1,0],[1,2]].
[[0,0],[1,0],[0,0]] is a reversal error. Straight segment distance -1 moves
to y=-1. Studies: road margins; nested contour strokes. Signed distance changes
placement; limit changes sharp joins without changing the source route.

## 4. convex-hull-2d / convexHull2D

Input: points (possibly empty xy array), maxWork. Output: {points,sourceIndices}.
Deduplicate exact coordinates, retaining earliest source index. Sort x then y,
using comparisons rather than overflowing subtraction. Monotone chain removes
the last point while cross <=0, so collinear interior points are omitted. Return
positive signed-area traversal starting at lexicographically smallest point,
without repeated endpoint. Empty -> empty arrays; singleton -> one point; all
collinear -> two extrema (or singleton after deduplication). Preflight N*N+N
<= maxWork; stable deterministic sorting and chain scans must stay within the
specified conservative bound. Source indices follow returned points.

Analytical: [[1,1],[0,0],[1,0],[0,1],[0,0],[0.5,0.5]] ->
points [[0,0],[1,0],[1,1],[0,1]], indices [1,2,0,3].
Collinear [[2,0],[0,0],[1,0]] -> indices [1,0]. Empty budget0 passes.
Studies: scatter envelopes; nested terraced islands. Change sites or select
different subsets, then reuse the envelope as fill or contour geometry.

## 5. triangulate-simple-polygon-2d / triangulateSimplePolygon2D

Input: points (at least three xy vertices, no repeated seam), maxWork.
Output: {points,triangles}. points is a detached unchanged vertex list; triangles
contains triples of original vertex indices. Require distinct vertices, nonzero
signed shoelace area, no intersecting/touching nonadjacent edges, and no collinear
consecutive triple. These intentionally strict simple polygons exclude holes and
degenerate boundary runs. INVALID_TOPOLOGY for these violations. Normalize only
the working index ring to positive winding (positive input [0..N-1], negative
input [N-1..0]); never reorder output points. Ear candidates are scanned from
ring position zero each pass. A candidate is a strict positive turn and its
closed triangle contains no other remaining vertex (edges included). Emit
[previous,current,next], remove current, restart scan. Final ring emits its
three indices in ring order. No ear -> INVALID_TOPOLOGY. Preflight N*N*N + N*N
<= maxWork; reject unsafe count before geometric allocations. General binary64
orientation, not adaptive predicates; near-degenerate classifications may fail.

Analytical: square [[0,0],[2,0],[2,2],[0,2]] ->
triangles [[3,0,1],[1,2,3]]. Positive triangle -> [[0,1,2]].
Bow tie and collinear boundary run fail. Concave polygon fixture must prove no
triangle covers the notch and total triangle area equals polygon area.
Studies: faceted silhouettes; grain inside concave regions. Move the notch,
then use returned triangles for fills or compose area-weighted point sampling.

## 6. assemble-segment-chains-2d / assembleSegmentChains2D

Input: segments (array of two-xy-point edges), maxWork.
Output: {chains}, each chain {points,segmentIndices,closed}. Exact coordinate
identity only, no proximity welding. Zero-length edge, duplicate undirected edge,
or vertex degree >2 is INVALID_TOPOLOGY. A component is therefore an open chain
or simple cycle. Components are emitted by ascending smallest original edge
index. An open chain starts at its lexicographically smaller degree-one vertex.
A cycle starts at its lexicographically smallest vertex and selects the
lexicographically smaller neighboring vertex first. Trace until the endpoint or
initial vertex; closed points omit the repeated initial point. segmentIndices
lists original edges in traversal order, independent of supplied edge direction.
Empty input returns no chains. Preflight 8*N*N+4*N <= maxWork. Vertex coordinate
keys must not merge distinct finite binary64 values; -0 and +0 are identical.

Analytical: edges [[[1,0],[2,0]],[[1,0],[0,0]]] -> single open chain points
[[0,0],[1,0],[2,0]], indices [1,0]. Triangle edges in canonical direction gives
closed points [[0,0],[0,1],[1,0]], with corresponding source indices.
Three edges sharing one endpoint fail. Studies: stitch marching-square output;
reconstruct fragmented drawings. Source edge IDs can preserve independent colors.

## 7. poisson-disc-2d / poissonDisc2D

Input: bounds [minX,minY,maxX,maxY] with strict positive finite width/height,
radius (>0), attemptsPerActive (positive integer), maxPoints (nonnegative integer),
rngState (uint32), maxWork. Output: {points,rngState,exhausted}. Own local LCG32:
state=(1664525*state+1013904223) mod 2^32, each unit draw advances then divides
by 2^32. MaxPoints0 returns empty points, unchanged state, exhausted=false.
Otherwise first point consumes x then y draws and lies in the closed bounds (endpoint rounding is retained).
Maintain insertion-ordered points and active indices. Each active iteration
consumes one draw to select floor(u*active.length). Try candidates in order:
radius draw first, angle draw second; rho=radius*sqrt(1+3*u), angle=2*pi*v.
Candidate=activePoint+rho*[cos(angle),sin(angle)]. Reject outside closed
bounds or distance < radius from any point. Accept the first passing candidate,
append it to points and active list, then restart active selection. After all k
fail, remove selected active entry by swapping with last then popping. Stop at
maxPoints or empty active list. exhausted is true exactly when active is empty.

Use sparse uniform grid cells of radius/sqrt(2), searching dx/dy offsets -2..2
in y-major order. This is an acceleration only; candidate acceptance is identical
to a complete existing-point distance test. Reject cell-size underflow, or unsafe
integer cell coordinates with NUMERIC_OVERFLOW; no dense domain-sized allocation.
Charge one work unit per RNG draw, one per candidate, and one per actual existing
point distance comparison, before each event; maxWork exhaustion throws atomically.
Input validation/storage setup is O(N) in accepted points. Representation/finite
checks precede appending. Budget is explicit algorithm events, not time guarantee.

Analytical: state0 first draws are 1013904223 and 1196435762. With unit bounds,
maxPoints1 output is [[1013904223/4294967296,1196435762/4294967296]], final state
1196435762, exhausted=false, exactly2 work. maxPoints0 budget0 consumes nothing.
Property checks: pair separation, bounds, deterministic state, exhaustion in a
domain smaller than radius, rejection draw count and grid/brute-force agreement.
Studies: blue-noise stipple; spaced symbols. Change separation independently of
the marks. Primary algorithm reference: Bridson SIGGRAPH 2007, with the specific
sampling, RNG, active-removal and budget choices above owned by this design.

## 8. lloyd-relaxation-2d / lloydRelaxation2D

Input: sites (xy array), bounds (existing Voronoi bounds schema), iterations
(nonnegative integer), strength ([0,1]), maxWork. Output: {sites}. This compound
operation must call existing voronoiCells2D each pass, preserving one output
site per source index. Zero passes copies input, still validating all sites and
bounds according to Voronoi's domains. For nonempty polygon, compute signed-area
centroid by shoelace: Cx=sum((xi+xj)*cross)/(3*sum(cross)), likewise y. Empty or
zero-area cells leave the site unchanged. Replace each coordinate by
old+strength*(centroid-old); strength0 returns exact old coordinate after cell
work, strength1 exact centroid. Every pass is synchronous from prior sites.
No random jitter or duplicate-site repair. Output cell generation remains a
substitution point: caller can use final sites in the existing Voronoi operation.

Budget: reserve N+iterations first (safe arithmetic), then for iterations>0 let
passBudget=floor((maxWork-N-iterations)/iterations). Each Voronoi call receives
floor(passBudget/2); the other half is a separate centroid allowance. Charge one
centroid unit per returned polygon vertex and one per site update, including
empty cells. Insufficient allowance throws WORK_LIMIT; unused allowances are
not transferred between phases or passes. Zero iterations only requires N and
returns copied sites; empty input may return immediately after budget validation.
This deliberately conservative composition does not guess the child operation's
actual spent work. Validate finite sites and ordered finite bounds independently
before the zero-pass early return. Bounds match the Voronoi array schema.

Analytical: one site [0,0] inside bounds [0,0]..[2,2], one pass strength1 ->
[1,1]; strength0.5 -> [0.5,0.5]. Two sites [0.25,1],[1.75,1] -> [0.5,1],[1.5,1].
Studies: relaxed stone tessellation; centroid migration trails. Reuse each
iteration's state for animation/trails, independently of final cell styling.

## 9. skyline-pack-2d / skylinePack2D

Input: width,height (>0), rectangles (array {width,height} both >0), maxWork.
Output: {placements,unplaced}; placement {index,x,y,width,height}, unplaced is
ascending original indices. Process rectangles in supplied order, no rotation,
padding or implicit sorting. Skyline initially one horizontal span [0,width] at
y=0. Candidate x positions are each current span's start. Candidate y is maximum
height of skyline spans with left < x+rect.width and right > x (positive-width overlap only). Reject right/bottom
overflow. Select smallest y+rect.height, then smallest x. Insert the new top
height across its width, retaining left/right fragments, and merge adjacent
equal-height spans. Failure places nothing and preserves skyline; continue.
Coordinates at touching boundaries count as fitting. Returned placement order
is input processing order with failures omitted. Preflight 8*N*N*N+N <= maxWork, covering the naive candidate/span scan.
This is a deterministic heuristic, not globally optimal bin packing.

Analytical: bin4x3 rectangles3x2,2x2,1x3,1x1 -> placements index0 at0,0 size3x2;
index2 at3,0 size1x3; index3 at0,2 size1x1; unplaced[1]. Empty budget0 passes.
Studies: packed poster blocks; varied-aspect contact sheets. Change input
dimensions/order, retain original IDs to substitute image or typographic content.

## 10. cost-grid-paths-2d / costGridPaths2D

Input: columns,rows (positive integers), costs (row-major columns*rows array of
nonnegative finite numbers or null obstacles), start (index of non-obstacle cell),
maxWork. Output: {distances,predecessors}; distances are finite or null for
unreachable cells, predecessors indices or null. Start distance0/predecessornull.
Four-neighbor Dijkstra: edge cost is cost of destination cell, no diagonal moves.
Select unsettled reachable cell with smallest distance then smallest row-major
index. Visit neighbors up,right,down,left. Relax only strict improvement; equal
cost retains first predecessor. Never rewrite settled cells, so zero-cost paths
cannot form predecessor cycles. Return all distances/predecessors, caller chooses
destination/traces. A heap may accelerate exact selection order; no negative
weights or heuristic A* mode. Preflight N*N+5*N <= maxWork, safe integer N.
Overflow in a reachable candidate sum is NUMERIC_OVERFLOW even if not improving.

Analytical: width2 height2 all costs1, start0 -> distances[0,1,1,2],
predecessors[null,0,0,1]. Obstacle costs[1,null,null,1] -> distances[0,null,null,null]
and all-null predecessors. All-zero2x2 -> distances all0, predecessors[null,0,0,1].
Studies: roads around obstacles; arrival-time contours via existing marching squares.
