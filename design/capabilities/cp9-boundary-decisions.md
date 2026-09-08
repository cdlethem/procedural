# CP9 retained topology boundary decisions

Root design decisions for the upcoming admission; not a public catalog contract.
The topology prototype and representative workload investigation are still
required. No implementation assignment may infer missing details from this file.

## Identity and ordering

Accept caller-supplied ordered finite binary64 XY pairs, immutable to the
operation. Normalize negative zero to positive zero. Sort unique coordinates by
numeric X then Y, with exact coordinate equality for duplicate collapse. No
epsilon, snapping, implicit jitter, seed, renderer or host-global state.

The retained result must contain both an input-record → canonical-vertex map and
a canonical-vertex → first-input-record map. This lets an artist carry arbitrary
attributes beside the points without losing their identities when sites are
sorted or duplicates collapse. A duplicate with conflicting attributes uses the
first input record only if the caller chooses that map; the geometry operation
does not inspect or reconcile colour/size/other attributes. Reordering input
records changes these mappings, but not the canonical point geometry/topology.

Canonicalize each positive-orientation triangle by cyclically rotating its
smallest vertex index first; never sort all three indices and thereby erase
winding. Sort these triples lexicographically for final face order. In ordinary
screen coordinates, positive mathematical XY orientation appears clockwise;
describe both conventions in the final documentation.

Return unique undirected edges as increasing endpoint pairs, in lexicographic
order. Include the incident face indices in increasing order, using one explicit
sentinel for a missing second face on the boundary. A wire consumer can draw
each edge once; other consumers can relate neighboring faces or distinguish
the convex-hull boundary without reconstructing adjacency. Exact sentinel and
schema field names will be fixed in the catalog.

The edge set is derived from triangles. For fewer than three unique sites or an
all-collinear site set, return zero triangles and zero edges while retaining
canonical sites and both input mappings. This is a valid empty two-dimensional
triangulation, not an error or a manufactured line mesh. No separate dimension
or chain-edge API is needed for the selected facet capability.

## Topology and ties

Every unique site in a two-dimensional input must be represented in faces,
including sites on straight hull edges. Faces have strictly positive exact
orientation and cover the convex hull without holes or overlaps. A result does
not clip to the source disc, user polygon, concave outline, or canvas.

All faces satisfy the exact empty-open-circumcircle condition. For an exactly
cocircular flippable quadrilateral, prefer the lexicographically smaller
endpoint pair as its diagonal. IDs are geometric canonical site IDs, not caller
order or allocation IDs. The rule is independent of the source port and any
third-party triangulator.

Root independently enumerated convex triangulations for 4, 5, 6, 8, 10 and 12
integer sites on a circle using
`tools/diagnostics/cp9/check_cocircular_ties.py`. All 18,379 triangulations had one
terminal minimum-site fan per polygon under this rule; 80,944 improving local
flips strictly decreased the ordered internal-edge vector. Result:
`.work/cp9-ties/result.json`. This settles the tested convex cocircular-cell
case, not general Delaunay termination or triangulator correctness. The topology
prototype must test mixed cases, edge insertion and geometric invariants.

Root's tie argument extends beyond the enumerated sizes: a non-fan triangulation
of a strictly convex cocircular polygon has a triangle incident to its smallest
vertex, adjacent across an internal edge to a triangle not incident to that
vertex. Their quadrilateral is convex. Replacing the separating edge by the
diagonal incident to the smallest vertex is a lexicographic improvement. Thus
every non-fan has an improving edge, while none of the fan's internal edges can
improve. Every tie flip strictly decreases the sorted internal-edge vector over
a finite set of triangulations, so tie-only cycles are impossible. This argument
assumes a valid convex cocircular cell; it does not excuse errors in constructing
that cell or its surrounding triangulation.

## Numeric and resource responsibility

Orientation/incircle decisions use the exact rational values represented by
binary64 inputs. Returned coordinates remain those canonical input values;
there is no newly rounded construction coordinate. This separates exact
connectivity from renderer rasterization and avoids exposing a numeric epsilon.
Java BigInteger is an implementation option, not part of the portable data.

Use an explicit caller work budget with a deterministic semantic unit and
stable exhaustion error. A budget must bound actual topology search/legalization
work, not only the final face count. Pure predicate sign correctness does not
bound the number of predicate calls. Validation and canonicalization also need
bounded storage and input-size checks. Do not introduce an arbitrary artistic
point-count maximum based on a small successful prototype.

The final admission must specify the input-size representation ceiling and
topology-work accounting independently from measured example configurations.
The contract must then settle validation precedence, queue/traversal order,
budget charging and failure atomicity before fixtures or production code.
No partial mesh should escape on budget exhaustion.

## Composition test that these decisions enable

FacetMarks can supply its own scatter or existing quadrant-cell centres, keep
face topology through palette/fill/wire edits, use each unique edge once, and
pass any face's three point coordinates to TrianglePoints2D for grain. Site
attribute correspondence remains available to an artist writing another
consumer. These output conveniences remove topology bookkeeping without
embedding the source artwork's palette, shadow, mask or placement choices.
