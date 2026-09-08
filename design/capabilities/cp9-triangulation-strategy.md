# CP9 triangulation strategy to investigate

Root engineering proposal, not a frozen operation contract or implementation
assignment. Read `cp9-facet-marks-direction.md` and the source-degeneracy audit
first. This proposal intentionally avoids copying the surveyed local port.

## Initial topology without a finite supertriangle

1. Canonicalize signed zero, sort distinct sites by numeric X then Y, and keep
   explicit mappings between input records and unique sites. Do not mutate the
   caller's points. Duplicate policy and result schema still require admission.
2. Compute the strict convex hull with exact orientation signs. Keep the sites
   lying on hull edges in the uninserted set rather than discarding them.
3. For a two-dimensional hull, triangulate its strict corner polygon by a fan
   from its smallest canonical vertex. These faces have positive orientation.
4. Insert all remaining sites in canonical order into this existing triangulation.
   An interior site splits one face into three. A site on an internal edge splits
   its two faces into four; a site on a boundary edge splits one face into two.
   Exact orientation tests distinguish these cases. No zero-area face is emitted.

All sites are within the initial hull, so insertion never requires artificial
vertices or a numerically constructed enclosing triangle. This is root's chosen
strategy to prototype, not a proof that every implementation of it is correct.
All-collinear and fewer-than-three-unique-site results are separate contract
questions; they must bypass the two-dimensional face construction.

## Restore the Delaunay property

Use edge flips on strictly convex adjacent-face quadrilaterals. Exact incircle
sign determines whether a nondegenerate internal edge violates the empty-circle
condition. Boundary edges are not flippable. Topology should use explicit site
indices and incidence, not coordinate rounding or object identity.

For an exactly cocircular quadrilateral, prefer the lexicographically smaller
sorted endpoint pair as the diagonal. This is a proposed independent tie rule;
it is not CGAL compatibility. CGAL's own documentation identifies cocircular
nonuniqueness and uses symbolic perturbation, illustrating why a named policy is
needed: [Delaunay triangulation reference](https://doc.cgal.org/latest/Triangulation_2/classCGAL_1_1Delaunay__triangulation__2.html).

Root's reasoning to test: within one convex cocircular Delaunay cell, a
triangulation that is not a fan from the smallest site has an internal edge
opposite that site which can flip to a smaller endpoint pair. The fan is the
local fixed point. For general inputs, strictly improving Delaunay flips and
zero-incircle tie flips need a termination argument together, plus adversarial
tests; do not assume a test timeout is an acceptable algorithmic guarantee.
Use an explicit work budget regardless of termination.

Maintain face/edge incidence and a deterministic candidate-edge queue. Rebuilding
and sorting the entire mesh after every flip is an avoidable cost; a tiny oracle
may do so, but representative workloads need measured production-scale behavior.
If queue order affects a reported work count, specify it before exposing that
count or its limit. Final vertices/faces/unique edges should have canonical
ordering independent of allocation slots and queue history.

## Predicate semantics

Orientation and incircle signs are signs of determinants over the exact dyadic
values represented by input binary64 coordinates. This removes the need for a
user-facing epsilon or coordinate snapping. A Java BigInteger implementation is
a candidate for a clear initial reference; other targets can implement the same
mathematical signs without inheriting a Java object type.

Investigate ordinary, subnormal, near-collinear, exactly cocircular,
near-cocircular, and mixed extreme-magnitude coordinates. A fast floating-point
filter is a later optimization only if its error bound is proved and fallback
preserves signs. Do not invent a heuristic epsilon to make ordinary probes fast.
The [robust-predicate reference](https://www.cs.cmu.edu/~quake/robust.html) motivates
exact signs, but no referenced implementation is copied into this repository.

## Required independent checks

- Small exact integer/rational cases with known topology: triangles, square tie,
  polygon with interior site, points on hull/internal edges, repeated sites,
  sorted/reversed/permuted inputs, long collinear runs, and all-collinear sets.
- Every two-dimensional unique site participates; every face has positive exact
  orientation; every edge has one or two incident faces; boundary traces the hull.
- No crossing edges, face interiors overlap nowhere, and summed exact oriented
  area equals hull area. Test incidence and boundary-site coverage separately
  from triangle counts.
- Every face has no other site strictly inside its circumcircle. For tied cells,
  compare against the declared canonical diagonal policy, not an arbitrary
  external triangulator's face list.
- Independent tiny brute-force/oracle work must not share the implementation's
  topology mutations or mutable edge map. Numerical sign fixtures must also
  come from an independent rational/integer calculation.
- Workload probes at the source-motivated hundreds of points and a declared
  stress set, with bounded operation counts, timing and retained memory evidence.

Only after the strategy survives these investigations should root freeze the
capability admission, numeric/work policy, output schema and shared fixtures.
