# Vector clipping topology and numeric direction

Root design decision after the private visual study; catalog admission and detailed
contract remain pending. The current double prototype is not production-ready.

## Region boundary

Choose one simple polygon with at least three distinct vertices, implicit closure and
nonzero exact signed area. Either winding is accepted. Concavity is essential: preserve
all interior intervals, never bridge a notch. Allow an extra vertex along a straight edge
when traversal continues in the same direction. Reject repeated vertices (including an
explicit duplicate closing point), adjacent backtracking/overlap, and any nonadjacent
edge contact/crossing. Holes and self-intersecting fill rules are outside this operation.
These are authored validity choices, not observed artistic parameter ranges.

A region includes its boundary. Keep positive-length source intervals on that boundary;
omit isolated point tangencies and zero-length input strokes. Merge adjacent retained
intervals only when no exterior interval lies between them. Source direction and source
index remain available. Boundary inclusion concerns centerline geometry; a rendered thick
stroke can extend beyond the region and may still need a raster mask.

The independently written exact validation study checks eleven polygon cases in both
windings. Nonzero-area self-crossing and nonadjacent edge-touch witnesses prevent signed
area alone from masquerading as a simplicity test. No polygon validity is inferred from
the existing strictly convex placement API.

## Exact topology, rounded representation

Existing Delaunay/convex-placement code has exact dyadic orientation predicates with
floating filters. Reuse that numerical principle, but do not transplant only orient():
clipping also needs reliable intersection parameter ordering and interval classification.
A rounded midpoint can land on a boundary or erase a narrow exterior gap.

Preferred first correct algorithm: interpret input binary64 coordinates exactly as dyadic
rationals; form exact rational intersection parameters; compare/deduplicate them exactly;
classify rational interval midpoints against exact edges. Compute final endpoint coordinates
from the exact source line and rational parameter, then round once to binary64. Preserve
original source endpoints at parameters zero/one. No user epsilon and no scale-dependent
geometric snapping. Any later filter must certify the same decision or use exact fallback.

Before contract freeze, specify exact nearest-even rational-to-binary64 conversion and
what happens when distinct retained interval endpoints collapse in the public numeric
representation. Prefer an explicit representational failure over silently dropping a
positive-length interval or bridging a gap. Test this with adjacent-float/subnormal and
large-coordinate witnesses. Exact topology does not imply exact binary64 output points
lie on the mathematical boundary; document the rounding distinction plainly.

## Work and acceptance

The diagnostic cut-and-midpoint algorithm has O(V²) polygon validation and up to
O(S V²) midpoint classification plus sorting for S segments and V polygon vertices.
It is not merely O(S V): every candidate interval may inspect every polygon edge.
Do not advertise a fast path based on the small private pictures. Bound admitted work
and retained interval growth explicitly, and measure exact arithmetic on representative
hatch and polyline inputs before choosing an optimization. Big-integer allocations are
acceptable in the correctness study, not an unmeasured performance acceptance.

Next: implement a private exact Java kernel or exact conversion diagnostic, compare it
against the rational oracle (including the adverse representation cases), and measure
moderate hatch workloads. Root then freezes a minimal contract with reviewed error and
budget semantics; existing native study establishes the artistic purpose only.
