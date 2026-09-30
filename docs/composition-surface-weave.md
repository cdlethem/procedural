# Surface Weave (brief 52)

Status: **implemented on branch `w4/surface-weave`, unreleased. Reviewed from rendered output (SVG through Chromium) and package tests
only; not exercised through the real Studio interface, not layered in the app, not checked in WEBGL (the drawing is 2D).** It is a
composition under the frozen [composition boundary](composition-reference-slice.md) on the [spatial foundation](composition-spatial.md)
(F8). It draws a projection of threads on a surface: no scan reconstruction, no claim of a fabricable object.

## Artist-facing brief

Two thread families follow a curved bundled surface (vase, terrain, torus, sphere cap, parametric sheet), with orientation and
spacing changing across it, and are woven over and under where they cross, seen through a camera with true occlusion. Direction comes
from the isolines of a scalar on the mesh (height, axis distance, centre distance, plane bands, seeded waves) or from a guide direction,
turned by a thread angle and a swirl field; the second family is the first turned by the weave angle. Spacing is a distance on the
surface, steered by a density field. Over and under uses the rule and seeded phase of [Crossing Lace](composition-crossing-lace.md). An
edge-only drawing (hairline threads and the model's silhouette and boundary) stays useful, and a veil paints a pale translucent surface
behind fine lines.

## Frozen input contract

Instruments persist a technique id, scalar params and a palette. The **library** defines the typed values: `Mesh` in, `SurfaceStrand`,
`SurfaceCrossing`, `CrossingOrder`, projected fragments out. The instrument names only **bundled, seeded surfaces** through validated
selects (`WeaveSurface`); a caller's own resolved `Mesh` goes to `surfaceWeaveProducts(recipe, mesh)` (any manifold with consistently
oriented faces; anything else is refused by name). Binding a user's model or scan to a Studio layer is **future host work**.

## Boundary

| Piece | File | Reuses |
|---|---|---|
| Open surfaces: parametric sheets (`saddle`, `waves`, `twist`, `scroll`), icosphere patch | `composition/mesh-surfaces.ts` (new foundation) | `mesh`, `icosphereMesh`, `memoized`, `componentSeed` |
| Vase profile refinement (`smooth`) | `composition/mesh-samples.ts` (option added) | `RadialProfile3D` |
| Marching across triangles: adjacency, unfolding walk, midpoint step, boundary distance | `composition/mesh-trace.ts` (new foundation) | `meshTopology`, `meshDerived`, vertex normals |
| Scalar, direction and spacing fields | `composition/surface-fields.ts` | `traceGraph`, `componentSeed` |
| Evenly spaced strands, crossings on the surface | `composition/surface-strands.ts` | `sampleSurface`, `mesh-trace` |
| Camera-free products: mesh, strands, crossings, order | `composition/surface-weave-products.ts` | `orderCrossings` (Crossing Lace) |
| Camera stage: projection, hidden lines, canvas crossing table | `composition/surface-weave-view.ts` | `camera`, `hiddenLines`, `CrossingSet` |
| Cut pieces, ribbons, model edges and veil | `composition/surface-weave-pieces.ts` | `strandPieces`, `cutPath`, `meshFeatureEdges`, `hiddenLines`, `paintOrder` |
| Composition, drawing, overlay, preparation | `composition/surface-weave.ts` | `strokeWith`, `color`, `drawNumber` (exported from Crossing Lace) |
| Instrument, controls, groups, conditions | `adapters/surface-weave-instrument.ts` | |

Extension to a shared module: `orderCrossings` gained `solve: "chains" | "breadth" | "fewest"` (default `"chains"`, the old behaviour;
Crossing Lace is unchanged and its 28 tests and drawings are untouched). See "Over and under" below.

## Semantics

- **Surface, not UV.** A strand vertex is a point inside a triangle of the mesh's triangulation. A walk crosses an edge by unfolding the
  heading into the neighbour (the along-edge part kept, the across-edge part turned onto the neighbour's plane), so path length on the
  surface is the sum of segment lengths, exactly, and seams and poles of a periodic surface need no case. Where the direction field
  vanishes (a pole of a height field, a critical point, the flat base under a height field, a guide along the normal) threads stop
  (`ends: "singular"`) and that region is left bare; a curve that turns 1.5 times without closing on a radius under about 3 spacings
  is a whirl around a critical point and is discarded. The integration is the explicit midpoint rule in the unfolded surface, second order
  (measured), with unit vectors interpolated barycentrically from the vertices and projected on the triangle.
- **Fields.** Scalars are normalised to [0, 1] over the used vertices. Isoline direction is `n x grad s` from the exact triangle gradient
  averaged at vertices by interior angle; angle, cross and swirl turn it about the vertex normal. Spacing at a vertex is
  `base * ratio^(0.5 - h)` (`h` reversed when asked). Everything is per vertex and cached by mesh content and spec; palette, camera
  and drawing never enter.
- **Strands** (evenly spaced streamlines after Jobard and Lefer). Seeds propagate from accepted strands at 1 and 0.65 spacings on either
  side (the second only where the first is reachable); a candidate needs 0.6 spacing of clearance from earlier samples on the same side of
  the surface (normals agree by more than 0.3), a step end nearer than 0.5 stops a strand (`proximity`), and a sampled surface point
  seeds regions no strand reached (a full spacing of clearance). Neighbours end up 0.6 to about 1.25 spacings apart and exactly one
  spacing where the field is parallel (tested on a plane and on a sphere). Ends: `boundary`, `margin` (inset or fringe), `proximity`,
  `singular`, `limit` (5,000 steps), `closed` (a ring). Ids `A<k>`/`B<k>` are the acceptance order: not stable across structural edits,
  never dependent on the camera. Seeds come from `componentSeed`.
- **Crossings** are found exactly in each triangle's plane (segments are bucketed by triangle, so the search is linear), camera free, with
  the surface angle, arc lengths in surface distance and ids `<A>@<s>~<B>@<s>`. A brute-force search of all segment pairs on a sphere
  agrees (tested).
- **Over and under.** The surface crossings are a `CrossingSet` whose paths are the strands developed onto `(arc length, 0)`, presented
  open (a ring is cut at its seed): alternation is then chains, satisfiable on a square weave, instead of a cycle around each ring, which
  is impossible for an odd count. A weave on a surface cannot alternate everywhere (a thread ending inside the lattice, an odd number
  of threads round a cylinder), so contradictions remain (`order.breaks`, all `unavoidable`); `solve: "fewest"` solves by chains and by
  breadth first plus a one-flip improvement and keeps the fewer (measured on the default-like vase: chains 199 breaks, kept 145; on a sphere
  of rings and meridians chains 26 against breadth first 44, so neither is always better). The seam of a closed strand is reported by
  `products.seams`. The order is computed once, camera free; the canvas crossing table copies its decisions.
- **Camera stage.** `projectWeave` projects every strand vertex (a vertex nearer than a perspective near plane throws naming the
  problem; with the instrument's minimum distance 0.7 diagonals it cannot happen), runs `hiddenLines` for hidden intervals of canvas arc
  length per strand, and builds the canvas crossing table (canvas arc lengths, projected tangents, `sine` in the picture floored at 1e-4).
  `weavePieces` cuts the under strand at every woven crossing with Crossing Lace's `strandPieces` (gap `(over + under) / (2 sin) + clearance`;
  a flat ribbon has square ends, so its under reach is 0), clips each piece at the hidden intervals, drops remnants of under 1e-6 (they
  would draw as dots), and reports facing and depth per fragment.
- **Widths.** A thread is a share of its strand's mean spacing: canvas width `share * spacing * scaleAt(mean depth)`; a flat ribbon
  additionally carries per point the projection of its across-strand tangent vector (half the world width), so it foreshortens and vanishes
  edge-on exactly as a strip in the surface would. Hairlines are 1.4 canvas units.
- **Failure and limits.** 300,000 strand vertices and 30,000 crossings per construction; the vertex bound is estimated from the spacing
  fields before tracing and over it the error names Thread spacing, Second family spacing and Density ratio; validation of the
  controls alone rejects spacing / second-spacing combinations over the bound. Weave angle within 5 degrees of 0 or 180 is refused. Visibility
  has its own bound (`maxWork` 20,000,000). Nothing is truncated.
- **Units.** Spacing is a share of `sqrt(area)`; world units below the structure; canvas units above the camera.

## Controls, groups and conditions

Groups: **Surface** (surface; per-surface shape selects, detail, relief, tube radius, cap angle), **Placement** (center, size), **Flow**
(direction from, band direction, wave frequency, guide yaw/pitch, thread angle, weave angle; nested **Swirl**), **Threads** (nested **Spacing**,
density field/ratio/reverse, edge, margin), **Weave** (rule, invert, exceptions, clearance, shallowest woven crossing), **Strands** (style,
cross-section, width, proportional **Line weights** of casing and outline weight, shading, hidden threads), **Model**, **Color** (nested
**Palette**), **View** (projection, yaw, pitch, roll, distance), **Diagnostics**. Inline `visibleWhen`: surface-specific controls follow
`surface`; flow parameters follow `flow`; Density ratio and Reverse follow `density`; Edge follows a surface that has an edge and Margin
also `edge`; width and cross-section follow `style` (not hairline); Casing follows cased; Shade amount follows shading; outline weight and
veil controls follow `model`; colour slots follow `coloring`/`model`; Distance follows perspective. Slider intervals are narrower than hard
limits throughout (Thread spacing 0.03 to 0.12 against 0.012 to 0.4, Density ratio 1 to 5 against 1 to 8, Detail 2 to 6 against 1 to 8).
Left visible although inert in some configurations: Swirl field while Swirl is 0, Second family spacing, Detail on sphere above 6, Edge margin
on a sphere cap of 180 degrees (a numeric or disjunctive relevance a conjunctive condition cannot state).

## Checks (`tests/composition-mesh-surfaces.test.ts` 5, `composition-mesh-trace.test.ts` 8, `composition-surface-strands.test.ts` 16, `composition-surface-weave.test.ts` 12)

Independent expected values: the helicoid strip's closed-form area (error falling as 1/n^2) and the scroll's height x spiral length; saddle
and waves heights from their formulas; sheet Euler characteristic 1 and `2 (columns + rows)` boundary edges; the sphere cap's triangles and
area `2 pi (1 - cos)`; vase knots kept exactly and slope continuity of the refined profile. A walk over a plane is the straight line
(60 random walks, every crossing event on an edge), over a cube edge it goes straight down the side and along the bottom (unfolding
twice, exact coordinates and heading), it stops on a boundary edge with the point on it, follows a great circle on an icosphere, and the
midpoint step is second order (radius drift falls at least 3.5x per halving against 0.40 for Euler); non-manifold and inconsistently oriented meshes
are refused by name. On a plane both families are exactly parallel, chained one spacing apart, end on the boundary, cross A x B times at
analytic points at a right angle, and alternate as an exact checkerboard of strand ranks; on a sphere the rings are one spacing apart in
latitude and the meridian counts follow `2 pi cos(latitude) / spacing` (measured 70 at the equator against 26 at 70 degrees: a UV layout gives
the same number everywhere); an inset keeps every vertex the margin from the edge and a fringe scatters the ends between 0 and twice the
margin; a sheet lying 0.05 from another with opposite normals does not stop its threads; six terrain seeds build without a spiralling strand;
crossings agree with a brute-force closest-approach search of every segment pair on a sphere; a crossing exactly on a diagonal is reported
once. Camera stage: five cameras give the identical frozen strands, crossings and order; width edits reuse the projection; gap lengths
equal `(over + under) / (2 sin) + clearance` and each gap is centred on its projected crossing; perspective widths are share x spacing x scale
at the strand's mean depth; on a sphere visible fragments are in front and hidden ones behind (within one facet), half the length is hidden and
front/back crossings are classified; breaks equal an independent count of equal-state neighbours; a ribbon's edge offset is half width x
zoom x sin(pitch); a near-plane strand throws; hidden controls change nothing over 6 seeded random configurations (46 changes) and the audit.

Nine mutations, each shown to fail at least one test in the run (baseline 0): the unfolding turned wrongly (15), Euler instead of the midpoint
step (4), no normal agreement between samples (1), the spacing exponent sign (1), hidden intervals dropped (1), canvas crossing arc that ignores
the position inside the segment (1, after adding the gap-centring assertion; it survived the first version), ribbons without foreshortening
(1), unmerged crossings on a shared edge (1, after adding the diagonal case; it survived the first version), and the spiral guard removed (3).
`tests/helpers/audit-controls.ts surface-weave` (53 controls, 2,304 probes): 0 violations, no dead control; `inkColor` (relevant if the threads are
cased or the model is drawn) is a disjunction and stays visible.

## Review record

Rendered through a throwaway SVG surface under the native lease and read: the default vase for three seeds; nine structural settings
(ridged terrain with plane bands, swirl and a height density; a torus following seeded waves at a 60 degree weave angle; a sphere cap
combed by a guide with a fringe edge and centre density; a twisted ribbon in hairlines over a veil; a scroll of flat ribbons with faint
hidden threads; a saddle with a fine second family; a goblet with a seeded rule and a 50 degree weave; an urn edge-only; a bottle from above);
six camera moves (front, high, from above into the rim, from below, roll with strong perspective, orthographic); sparse, dense, extreme
and combined settings (spacing 0.12 to 0.018, cross 25 with swirl 60, relief 3 dunes, torus tube 0.6, inset cap with the rank rule and
depth shading, numbers overlay with exceptions); and the default above and below Contour Scores and Motif Ecologies. Depth was checked, not
assumed: the far wall of the vase is hidden, the rim view shows the inside threads through the opening, the torus hides the far side of its
tube, the scroll hides its inner layers, and ribbons narrow toward silhouettes.

Defects found by looking (or by tests) and fixed:
1. One ring-and-meridian weave had 45 contradictory pairs; more came from the greedy chain solve scattering them: open presentation
   of closed strands, then the breadth-first solve with a one-flip improvement, then keeping the better of the two (`fewest`).
2. One strand spiralled 40,000 steps around a terrain peak (2,900 units long, 4.8 s): winding detection for curves that turn 1.5 times
   without closing, and a 5,000-step limit; closing now needs 3 steps instead of 6.
3. Divergent families left gaps up to two spacings (meridians reached 70 % of their count): a second seed offset at 0.65 spacings, clearance
   for chained seeds 0.6; seeds drawn from the surface still need a full spacing, or an edge-hugging extra thread appears (found by looking at the
   plane's boundary line).
4. Fragments hidden by the mesh were missing in the faint mode (a whole-piece early return); zero-length remnants drew as dots at strand ends.
5. Flat ribbons were cut like round strokes (gaps a whole width too wide); a ribbon has square ends, so its under reach is 0.
6. The defaults were dashes of round thread; flat ribbons at 0.8 of the spacing read as a woven basket and show depth by foreshortening.
7. `outlineWeight` changed the drawing while hidden (the outline was drawn for Model drawn as: Nothing): the audit found it.
8. Threads wider than about 0.55 of the spacing as round strokes were consumed by their own gaps: said in the control's description and the guide.

Timings (this machine, otherwise idle, single runs after warm-up, milliseconds; first preparation / camera-only edit / width and colour edit / structural edit):

| Setting | first | camera | appearance | structural | size |
|---|---|---|---|---|---|
| default vase | 174 | 61 | 8 | 271 | 72 threads, 7,892 vertices, 947 crossings |
| vase detail 8, spacing 0.02, ratio 4 | 580 | 182 | 50 | 643 | 290 threads, 67,361 vertices, 10,470 crossings |
| terrain detail 8, spacing 0.022 | 265 | 137 | 26 | 189 | 462 threads, 33,866 vertices |
| sphere detail 6 (81,920 triangles), spacing 0.02, veil | 1,334 | 828 | 304 | 940 | 123 threads, 98,487 vertices |
| torus detail 8, spacing 0.025, faint hidden | 204 | 83 | 19 | 339 | 261 threads, 27,176 vertices |

Repeating an appearance edit costs 1 to 10 ms (cached pieces). While other workers were busy the same runs took two to six times longer.
These are observations, not certified slider ranges.

## Open items

- Real Studio interface exploration, layered review in the app and responsiveness in the host were not done; nothing was checked in WEBGL.
- A square weave cannot alternate on a general surface: contradictions remain at thread ends, limbs and one seam (Breaks overlay). About a third of
  neighbouring pairs on the default vase are equal-state; the interior weave reads cleanly.
- The `sphere` cap boundary follows triangle edges and is jagged by up to one edge length; the Edge controls hide it but do not smooth it.
- A direction field that vanishes leaves bare regions (the vase base under a height field, the poles of a sphere under a height field).
- Threads follow the mesh facets; there is no smoothing of the surface (detail and the vase's `smooth` rings are the remedies).
- `orderCrossings` gained an opt-in `solve` option in a shared module; `fewest` runs two solves. Root may prefer to move it behind the surface producer.
- Export names aliased at the export site (`MeshWalker`, `MeshWalkEnd`, `walkMesh`, `meshWalker`, `meshBarycentric`, `interpolateVertexValues`, `SpacingDensitySpec`, `SurfaceStrandOptions`) because `Walker`, `WalkEnd`, `FamilyOptions` and `DensityField` are already exported by other modules.
