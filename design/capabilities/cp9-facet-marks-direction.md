# CP9 — turn a point arrangement into connected facets

Status: root-selected capability direction, before operation admission/contract.
Algorithm and degeneracy investigations remain open. Java 0.8.0 remains the
latest delivery; this document adds no shipped operation or target claim.

## Artist task

An artist supplies points and gets a connected triangular subdivision they can
fill, outline, or populate with marks. Moving or adding points changes the
facets. Recolouring, switching fill to wire, or filling each face with grain
retains the same triangulation. A second point source uses the centres of
RegionMarks cells, making the existing subdivision operation useful as a
triangulation layout policy.

The first proposed workflow is FacetMarks: a bounded scatter of points forms a
faceted composition; an alternate input uses retained quadrant-cell centres.
The editable drawing code chooses fills and edge treatment. The operation owns
connectivity, not scatter, colour, camera, lights, masking, or drawing.

This is a new computational capability. TrianglePoints2D currently consumes a
supplied triangle and returns points inside it; it cannot derive faces from a
point set. Conversely, triangulation should return triangles that can feed that
existing sampler without requiring the artist to reconstruct vertex membership.

## Decisive evidence read by root

Root read the complete reports for
`survey/out/2018/Generativos/datata/notes.md` and
`survey/out/2019/generativos/lightcity/notes.md`, plus their relevant pinned source
at revision `69bdd8513e4482a5e6018e36887d4bc208660eb5`. Note/source hashes and
four additional neighbours are recorded in `triangulation-evidence-audit.md`.

`datata#0` identifies the independent point-set triangulation step. Its drawing
consumer fills the resulting faces and overlays per-corner shading. Point count
depends on disc area and a sampled density factor. The diameter change is large
and the density-factor change moderate, but these alter upstream placement and
workload; they establish no triangulator parameter range. Source point radii
also depend on a sampled size before square-root radial sampling. The report's
description of uniform disc points is therefore an approximation to that source
schedule, not an exact uniform distribution contract to copy.

The `p1` distance filter in datata is not clipping a triangle against a circle.
Neither that filter nor the underlying disc, halo, palette, or corner shading
belongs in the triangulation operation. We will not present its convex-hull
coverage as exact coverage of a caller's arbitrary boundary.

`lightcity#1` is a third-party triangulation call over quadtree rectangle centres.
Its resulting faces feed triangular-prism/window drawing. This supports a second
placement source and downstream geometry use, but does not specify the imported
library's duplicate, tie, ordering, or numeric behavior. Root inspected the centre
construction and call, not every window-rendering path. No prism/window API or
city reproduction is admitted by this decision.

Neighbours distinguish related tasks: triangularGradient uses face-derived
circumcircles, parapara draws faint face edges and centroids, and ruso bundles
scatter, triangulation and colour into a drawing helper. Those consumers warrant
retained connectivity, not a single opaque artwork function. Further exact
source-degeneracy inspection is assigned separately.

## Proposed boundary and output requirements

The intended operation is an independently specified planar Delaunay
triangulation of caller-supplied finite 2D points. It should expose retained
vertices and indexed nondegenerate triangles with consistent winding, plus a
unique undirected edge traversal so outlining does not unintentionally draw
interior edges twice. The exact field names/accessors are not frozen here.

Preserve a usable correspondence to input point identities. Coordinate-based
canonical ordering is preferable to mutable source-array sorting: reordering the
same point set should not change geometric connectivity or face traversal. The
mapping back to caller indices necessarily changes when the input is permuted.
Duplicate coordinates must have an explicit collapse/mapping policy; approximate
coordinate merging is not implied. Signed zero should follow the existing
canonical positive-zero convention.

These are package design requirements, not recovered source guarantees. Topology
must not depend on a global geometric epsilon or an unspecified third-party
version. Decide exact handling of collinear sites, sites on existing edges,
cocircular sets, and canonical tie resolution before freezing the operation.
Regular grids and region centres make such inputs ordinary use cases, not
optional pathological fixtures. Empty/small/collinear inputs need a useful,
explicit result or error policy, with no zero-area triangles masquerading as faces.

No random stream, renderer, font, or time belongs in this computation. Colours
and optional sampling seeds stay in the example. Numeric predicates must refer
to the actual represented input coordinates, not silently snapped coordinates.
Runtime/work budgets and output ownership must be explicit in the contract.

## Alternatives and deliberate exclusions

- A template around an unversioned native triangulate dependency would leave the
  important topology and portability semantics outside the package. Investigate
  independently specified geometry first; any dependency would require a named
  version, license review and explicit equivalent behavior.
- Copying one local upstream port does not establish robust behavior or inherit
  a clear license chain for every attributed third-party algorithm. Use those
  sources as provenance and counterexamples, not implementation to paste.
- A brute-force enumeration of all point triples may be useful as a tiny exact
  test oracle. It is not an acceptable production substitute for a triangulator
  at the observed several-hundred-site workloads.
- Voronoi cells are not admitted by the combined survey tag. None of the six
  audited paths constructs clipped Voronoi cells. This is a pending rare-family
  investigation, not a final rejection of Voronoi throughout the whole corpus.
- Constrained edges, holes, polygon clipping, general 3D tetrahedralization,
  extrusion, smooth meshes and circumcircle drawing are outside this slice.

## Controls and transfer to demonstrate

The example must make point-set changes and face styling independent. Compare
coarse/fine point sets with an explicit seed; retain the result while changing
palette and switching filled faces to unique-edge wire drawing. Replace the
point source with quadrant-cell centres without modifying the triangulator.
Then pass a returned face's coordinates to TrianglePoints2D to demonstrate grain
inside facets. This transfer is an intentional package design test, not a claim
that datata itself used the shipped sampler.

Do not introduce density, alpha, shading or clipping parameters into the core
because a motivating artwork bundles them. There are no new artistic defaults
or encouraged parameter ranges at this stage. Select and register bounded
example configurations and visual acceptance before rendering them.

## Required evidence before admission and implementation

1. Read the local source-degeneracy audit and resolve the independent algorithm
   strategy. A finite supertriangle merely containing all sites must not be
   assumed to settle every near-collinear numerical case without analysis.
2. Evaluate exact orientation/incircle signs and feasible cost on ordinary and
   adversarial binary64 inputs. The numerical risk is established independently
   by [Shewchuk's robust-predicate work](https://www.cs.cmu.edu/~quake/robust.html):
   rounded determinant signs can be wrong near zero. This motivates exact-sign
   semantics; it does not select or copy his implementation.
3. Resolve canonical duplicate mapping, cocircular ties, hull collinear sites,
   face/edge order, degeneracy output and bounded work. Write a reviewed
   capability-dependency admission or computation-level keep decision with exact
   candidate accounting, then pass the existing architecture eligibility check.
4. Freeze the language-neutral contract and meaningful shared fixtures before
   core implementation. Use exact geometric invariants and an independent small
   oracle: site coverage, positive-area faces, noncrossing edges, hull coverage,
   empty-circumcircle property, deterministic ties and permutation behavior.
   A face count or picture alone is insufficient.
5. Validate native Java at representative and stress workloads, then implement
   and inspect the complete FacetMarks edits/transfer. Batch other ports later.

The operation is not admitted until these design questions are resolved. This
direction selects a valuable next capability while retaining the full milestone
scope and the existing Java-first delivery policy.
