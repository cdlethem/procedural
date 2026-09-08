# CP9 triangulation contract decisions

Root draft for catalog transcription and fixture review. Architecture admission
`topology.delaunay-2d` passed the prerequisite checker. This file is not a second
authoritative schema: the forthcoming catalog entry owns the frozen contract.
Do not implement the public core before catalog/fixture review.

## Input and output

Required input keys exactly `points` and `maxWork`. `points` is an ordered list
of finite binary64 `[x,y]` pairs, length 0…357913943. `maxWork` is an integer
0…9007199254740991. No implicit defaults. Booleans are not numbers. Validate all
static input—including every point—before checking budget or copying topology.
Any static violation raises `INVALID_INPUT` with no partial result.

Normalize negative zero to positive zero. Unique points sort by numeric X then
Y. Equal coordinates collapse, without tolerance. Output has exactly:

- `points`: canonical unique `[x,y]` pairs;
- `inputToVertex`: one canonical vertex index per original input record;
- `sourceIndices`: first original input index for each canonical vertex;
- `triangles`: canonical positive-orientation index triples;
- `edges`: unique lexsorted `[lowerVertex,upperVertex]` pairs;
- `edgeFaces`: parallel pairs of increasing final face indices, or `[face,-1]`
  for a boundary edge;
- `workUsed`: integer count from the schedule below.

For U<3 or all-collinear sites, retain points and mappings, return empty
triangles/edges/edgeFaces. No chain edges or artificial dimension field.
For two-dimensional sets, every unique site participates. Faces cover the convex
hull with no crossings, overlaps or zero-area faces. No boundary clipping.

`357913943` is a conservative input representation ceiling so even N distinct
sites fit packed signed-int-indexed arrays: F≤2U−5 implies 3F≤2147483647, and
E≤3U−6 implies 2E≤2147483647. It is not an artistic recommendation or heap
guarantee. The independent arithmetic review in
`cp9-capacity-and-numeric-fixtures.md` confirms these lengths and the overflow
at N+1. No such large allocation
has been tested. Resource observations and caller work budget are separate.

## Exact predicates and canonical faces

Use exact dyadic values represented by input binary64 bits for orientation and
incircle determinant signs. No floating-point subtraction/product, epsilon,
rescaling with information loss, FMA, jitter or supertriangle affects topology.
An implementation may use a proved exact-sign fast path, with identical results.

Orientation(a,b,c) is sign((bx−ax)(cy−ay)−(by−ay)(cx−ax)). Incircle uses the
translated determinant in cp9-predicate-feasibility.md; for positive a,b,c,
positive means d is strictly inside, zero cocircular, negative outside. Its
meaning on a collinear first triple is not used as a circle test.

To create a face from any ordered triple, reverse its final two vertices if
orientation is negative, then cyclically rotate so the smallest index is first.
Zero orientation is never a face. New faces from one mutation are sorted
lexicographically before appending to the active face sequence. The sequence
records creation order; removal preserves the relative order of surviving faces.
No numeric creation ID is exposed or required.

Output faces are sorted lexicographically after all legalization. Build edges
and their incident final face indices from this final order. Mathematical
positive orientation appears clockwise on a screen with Y down.

## Observable work schedule

`workUsed` starts at zero. Before a charged step with cost c, if
c>maxWork−workUsed, raise `WORK_LIMIT_EXCEEDED` with `workUsed` and `stage`.
The rejected step is not performed or charged; no partial mesh escapes.
Stages are `canonicalize`, `hull_lower`, `hull_upper`, `locate`, `legalize`.

1. After complete static validation, charge N units atomically at stage
   `canonicalize`, before owned point/map buffers and canonical sorting. Empty
   input costs zero. A budget smaller than N therefore fails with workUsed=0.
   This accounts for input-sized preprocessing; sorting itself is not charged
   per comparison and must be O(N log N), not quadratic.
2. If U<3, finish immediately. Otherwise build lower and upper monotone hull
   chains, respectively visiting canonical vertex indices ascending and
   descending. While a chain has at least two vertices, charge one at its hull
   stage and test orientation(lastButOne,last,new). If sign≤0, pop last and
   continue; otherwise stop. Append new. Form strict CCW hull by concatenating
   lower without its last vertex and upper without its last vertex. Collinear
   sites are excluded from this corner hull, not discarded from input. If hull
   has fewer than three corners, finish with empty faces/edges.
3. Form the positive corner fan from the first hull vertex to each consecutive
   pair of later hull vertices. Canonicalize/sort these initial faces to form
   the initial active sequence. This linear construction adds no separate charge.
4. Visit all unique non-corner sites in canonical order. Scan active faces in
   creation order. For EACH visited face charge one at `locate`, then evaluate
   all three oriented-edge signs against the site. A containing face has all
   signs≥0. Stop at the first containing face. Do not inspect every later face.
   If all signs>0, replace this face by its three site-connected faces. If one
   sign is zero, use the incidence map for that edge to replace its one or two
   faces by two or four faces respectively. Distinct sites cannot equal an
   existing vertex; two zero signs therefore cannot occur here. Remove old
   faces, canonicalize and lexsort all replacements, and append them. Incidence
   lookup/mutation is local; no full-face-list rebuilding after each insertion.
5. Only after all site insertions, initialize the legalization queue with every
   internal edge. The queue is a set with lexicographic minimum extraction:
   an endpoint pair occurs at most once while queued. Each extraction costs one
   at `legalize` BEFORE removing it. An absent or now-boundary edge still costs
   its extraction and does nothing. Endpoint-pair identity is geometric, so a
   pair removed and recreated before extraction refers to its current incidence.
6. For a current internal edge (u<v), let a be its opposite vertex to the left
   of oriented u→v, b the opposite vertex to the right. It is flippable only if
   u and v lie strictly on opposite sides of oriented a→b. Otherwise do nothing.
   Test incircle(u,v,a,b), whose first triple is positive. Flip if the sign is
   positive; if zero, flip only when sorted(a,b) is lexicographically smaller
   than (u,v). Negative does nothing. A flip replaces its two faces with the
   two faces around diagonal a,b, canonically appended as above. Add every edge
   of both new faces that is currently internal to the queue (including the new
   diagonal), suppressing already-queued pairs. No global re-enqueue pass.
7. On empty queue, finish canonical output and return workUsed. Final sorting
   and incidence materialization add no separate charge and must be O(U log U).

A locate unit uses three orientation signs; a legalization unit uses a bounded
number of orientation/incircle signs and constant local topology updates plus
O(log U) queue work. Exact integer operands have finite binary64-derived bit
limits. The input charge covers linear storage and O(N log N) sorting; this is
a deterministic computation budget, not bytes or elapsed time. No uncharged
global rescanning is permitted inside a local flip. Active face scanning is
charged face by face, so long location searches cannot evade the budget.

Static validation scans all N inputs without retaining an input-sized coordinate
copy; create owned coordinate/map buffers only after the atomic N charge succeeds.
Live topology and queue storage are O(U+F+E); reclaim removed faces rather than
retaining the complete mutation history. The retained result and detached export
are O(N+U+F+E), because inputToVertex stores N entries even when duplicates make
U small. Indexed access is O(1). These bounds do not claim a measured heap limit.

The schedule intentionally differs from the small prototype's broad queue and
all-containing-face scan. Shared fixtures need an oracle implementing this
schedule as well as independent geometry checking; the prototype's recorded
work counts must not be reused.

## Errors and native access

Only static invalid input and explicit work exhaustion are expected operation
errors. Exact finite-coordinate signs avoid an arithmetic-invalid topology case.
An impossible mesh state is an implementation defect, not a documented way to
return partial or plausible geometry. Native allocation failure remains a host
failure, never an empty-success result.

Proposed Java class `org.procedurals.topology.Delaunay2D` exposes `triangulate`
with the shared parameter map, scalar counts/workUsed, indexed values and
reusable-buffer access for points, triangles, edges and edgeFaces, and detached
`toValues`. Input-map metadata reads return scalar indices. Indexed access uses
the established invalid-index → index-out-of-range → invalid-output precedence.
Specific method overloads and stable error shapes belong in the catalog, not
agent invention. All retained storage is owned; caller mutation after a call
does not change topology or map values.

## Evidence and acceptance

`points` is the existing source computation's geometric input. Exact ownership,
ordering, deduplication, mappings, edge incidence and maxWork are deliberate
engineering decisions. Source point-density measurements motivate editing the
supplied site set, not a density parameter inside this operation. No new artistic
range or default is proposed; a parameter render is not needed to choose an
integer representation ceiling or work accounting rule.

Before freeze, test exact budget thresholds and one-unit-short failures for each
reachable stage, full-input-validation precedence, empty/small/duplicate/collinear
cases, on-edge insertions, tie flips and reordered points. Include binary64
adversarial topology and independent determinant/coverage checks. Native workload
testing must cover hundreds of sites plus a declared stress workload; it remains
mandatory after implementation and cannot be replaced by the tiny oracle.
