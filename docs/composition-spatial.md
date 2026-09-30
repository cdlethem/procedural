# Spatial inputs and drawing (foundation F8)

Status: **foundation code, 2026-09-29; unreleased, no instrument, no Studio control.** It serves briefs 50 (differential
surface growth), 51 (hinged panels), 52 (surface weave), 53 (visibility-aware mesh drawing), 54 (point-cloud
reinterpretation), 55 (local mesh abstraction) and 56 (implicit sculpture) of the [release roadmap](next-release-roadmap.md).
Code: `packages/instruments/src/composition/{mesh,mesh-topology,mesh-sample,camera,visibility,mesh-samples}.ts`, exported
deliberately from `src/index.ts`. Tests: `tests/composition-spatial.test.ts` (44 tests).

Nothing here draws. It produces frozen values (a mesh, its topology, samples, projected paths) that the existing 2D
consumers (`atEach`, `strokeWith`, region fills, the path materials) already accept. A WEBGL drawing of the same values is
**not** claimed: the review below is SVG through Chromium, which establishes the 2D projection and occlusion, not WEBGL
surface, clipping, depth or alpha behaviour.

## What is reused and what is not

| Concern | Source |
|---|---|
| Revolved solid | `RadialProfile3D` from `@procedurals/javascript` (the source of the revolved instruments) builds every vase; only a proper rotation puts its +Z axis on +Y. |
| Renderer normals | `prepareSurfaceAttributes3D` backs `meshCornerAttributes` (flat / smooth corner normals). |
| Content hash | `sha256Hex` from `raster.ts`. |
| Seeds, caches, work budget | `componentSeed`, `memoized`, `CompositionRun` from the existing composition modules. |
| Height noise | `gradientNoise2D01` for the bundled terrains. |
| Not reused, and why | `loopSubdivideTriangles3D` smooths (moves) vertices; the icosphere must land on the sphere, so it subdivides by edge midpoints. `raymarchImplicitRays3D` stays the implicit source for brief 56 (below). `annularSolid3D` has no bundled use yet. |

Brief 56 renders implicit fields with the existing ray-march operation. Its hit points and normals can be handed to
`pointCloud` (positions + unit normals) and so use sampling-free projection, occlusion and grain drawing here; a mesh
extraction from a field (marching cubes) is **not** provided.

## Conventions

Right-handed world space, **+Y up**. Faces run **counter-clockwise seen from outside**: normal `(b - a) x (c - a)`; the
outside of a closed mesh is where normals point, and signed volume is positive. Canvas space is x right, y **down**.
Coordinates are finite, at most `1e50` in magnitude (`-0` is stored as `0`); units are the caller's.

## Meshes (`mesh.ts`)

`mesh(input)` validates, **copies** and freezes. The library never fetches or decodes a model; a host hands over resolved
numbers (`MeshInput`: `id`, flat `positions`, flat `triangles`, flat `quads`, optional `attributes`, `degenerate`). A `Mesh`
exposes counts, `bounds`, a lazily computed `key` and read accessors that return copies (typed arrays cannot be frozen, so
storage is private, as for rasters). Host binding of a user's own model is future work; the persisted form of an instrument
is a `MeshSource` (`{kind: "bundled", id, detail?, seed?, variant?}` or `{kind: "data", data}`), resolved by
`resolveMeshSource`.

* **Faces.** Triangles then quads; source face `f` is the f-th triangle, else the next quad. A quad is ONE face for
  topology (its diagonal is never an edge) and two triangles for geometry, along the **shorter diagonal** (tie: a-c), or the
  other if the shorter leaves the quad; a quad folded on both diagonals is rejected. A face's normal is Newell's
  `(c - a) x (d - b)`; its area is the sum of its triangles'.
* **Attributes.** Up to 12 named numeric attributes of size 1 to 4 per `vertex` or per input `face`. Face attributes follow
  the renumbering when degenerate faces are dropped.
* **Degenerate policy.** An index outside `[0, vertexCount)` or a non-integer index always throws, naming the face and
  corner. A face repeating an index, with `|cross| <= 1e-12 * longestEdge^2` (a sliver), or a folded quad is degenerate:
  `"reject"` (default) throws naming the face; `"drop"` removes it, lists the input index in `mesh.dropped` and renumbers.
  Vertices no face uses are kept and reported by the topology.
* **Content key.** SHA-256 over counts, positions (little-endian float64), face sizes and indices, attributes sorted by
  name. The `id` is a label and is not hashed, so equal content has one identity and derived values never key on
  appearance.
* **Limits (`MESH_LIMITS`).** 200,000 vertices, 200,000 source faces, 400,000 triangles, 12 attributes. Over a limit the
  call throws naming the input to reduce; nothing truncates. Measured at these sizes (444 x 444 terrain, 197,136 quads):
  build and validate 114 ms, hash 38 ms, topology 230 ms.
* `meshMeasures` (area, signed volume by the divergence theorem about the bounds centre, bounds, diagonal), `faceNormal`,
  `faceArea`, `vertexNormals` (angle weighted), `transformMesh` (scale, then rotate, then translate; exact at multiples of
  90 degrees; a mirror reverses faces so orientation is kept), `mergeMeshes` (attribute sets must match), `boxMesh`,
  `meshCornerAttributes`.
* Signed volume and silhouettes are meaningful only for a closed, consistently oriented mesh (`topology.kind`).

## Topology (`mesh-topology.ts`)

`meshTopology(mesh)` is linear in face corners (a bucketed half-edge table, no hashing of strings), cached by the mesh key.

* **Edges.** Unordered vertex pairs `{a < b}` in lexicographic order (id `e:<a>-<b>`); each lists its faces and class:
  `boundary` (1 face), `manifold` (2 faces traversing it oppositely), `flipped` (2 faces the same way: inconsistent
  orientation), `non-manifold` (3 or more).
* **Vertices.** The faces around a vertex form fans connected through shared edges: one fan is manifold, several (a pinch)
  is not. Class `interior`, `boundary`, `non-manifold` or `unused`.
* **Kind.** `closed-manifold`, `open-manifold`, `inconsistent-orientation`, `non-manifold` (wins over inconsistent).
  `counts.euler = V - E + F` over used vertices, real edges and source faces (cube 8 - 12 + 6 = 2).
* **Adjacency.** `meshFaceNeighbors` (across any shared edge), `meshEdgeFaces`, `findMeshEdge`.
* **Dihedral angle** `meshEdgeAngle`: signed degrees in (-180, 180], magnitude the angle between the outward normals
  (0 flat; a flipped edge is compared after negating one normal, so the fold is geometric), **positive convex (ridge),
  negative concave (valley)**; NaN for boundary and non-manifold edges. `meshCreaseEdges(topology, angle, convexity)` keeps
  `|angle| >= threshold` (inclusive with 1e-9 degrees of slack: a cube's 90 degrees satisfies a 90 degree threshold).
* **Silhouette** `meshSilhouetteEdges(mesh, topology, camera, {boundary})`: a face is front-facing when `n . (eye - c) > 0`
  at its centroid (perspective) or `n . (-forward) > 0` (orthographic), **strictly**, so an exactly edge-on face is
  back-facing. Facing is per source face. A silhouette edge has front and back faces; boundary edges (the contour of an open
  two-sided sheet) are separate and opt-in. `meshFeatureEdges` unions crease, silhouette and boundary with tone 0 crease,
  1 silhouette, 2 boundary.
* **Components** `meshComponents`: faces connected through shared **vertices** (two boxes touching at a corner are one),
  ordered by smallest face, id `c:<k>`, each with faces, vertices, edges, boundary edges and Euler characteristic.

## Cameras (`camera.ts`)

`camera(options)` returns a frozen `Camera`: `projection` (`orthographic` | `perspective`), `yaw`, `pitch`, `roll` (degrees),
`target`, `zoom` (canvas units per world unit at the target depth, both modes), `distance` (eye to target; perspective
strength and the origin of depth), `near` (perspective, default `distance / 50`), `center` (canvas position of the target).

Yaw 0, pitch 0 puts the eye on +Z looking toward -Z; positive yaw swings the eye toward +X; positive pitch raises it; the
basis is built by rotation, so pitch +-90 is not singular. **Positive roll turns the picture clockwise on the canvas.**
Multiples of 90 degrees use exact sines and cosines, so axis-aligned views are exact (and the front-on cube tests compare
with `===`). Camera space is `(xc, yc, zc)` with `zc` the **depth** along the view axis, larger farther. Canvas position is
`center + s * (xc, -yc)` with `s = zoom` (orthographic) or `zoom * distance / zc` (perspective). `project` returns null
nearer than the perspective near plane; `unproject`, `viewDirection`, `toView`, `scaleAt` are provided. A 3D segment
projects to a 2D segment in both modes, and the affine map to camera space preserves the segment parameter, which the
hidden-line solver relies on.

## Sampling and point clouds (`mesh-sample.ts`)

**`PointCloud`** is owned input like a mesh: `pointCloud({id, positions, normals?, attributes?, seed?})` validates and
copies (at most 200,000 points, 8 attributes, unit normals), private storage, content `key`. Point `k` has id
`p:<source index>` and seed `componentSeed(cloud.seed, id, "point")`. `selectPoints`, `thinPointCloud` and
`cropPointCloud` keep the original ids and seeds, so thinning or cropping never renames what remains. `thinPointCloud`
ranks points by a seeded hash: the set for `count` is inside the set for `count + 1`. `meshVertexCloud` turns a mesh's
vertices into a cloud. Reconstruction, registration and completion of scans are not offered.

**`sampleSurface(mesh, {seed, count, distribution, normals, attributes})`** places points with density proportional to
area, by barycentric coordinates in the mesh's triangulation. Each sample records its triangle, source face and weights
`(w0, w1, w2)` (non-negative, summing to 1), `position = w0 p0 + w1 p1 + w2 p2`.

* **Prefix property.** Sample `k` depends on `(mesh content, seed, distribution, k)` only, never on `count`: the first `n`
  samples of a longer run are bit-identical to the `count = n` run (tested for positions, sources, ids, seeds; both
  distributions, both normal modes).
* `even` (default): the triangle of sample `k` is `lowerBound(cumulativeArea, frac(s + k / phi))` (a golden-ratio sequence,
  so a triangle's count stays within a few of its exact share for every prefix); within a triangle its j-th point is the R2
  sequence `frac(o + j (0.7549, 0.5698))` plus a hashed jitter of `1 / sqrt(j)` per axis, folded into the triangle by
  reflection. The jitter is there because the bare R2 sequence draws visible lattice rows on large flat faces (found by
  looking at the figure's box faces). `random` uses independent hashes.
* `normals: "face"` (the source face's normal) or `"smooth"` (barycentric blend of the angle-weighted vertex normals).
  Requested attributes are interpolated (vertex) or inherited (face).
* Cost is linear in `count` (measured 200,000 even samples of an 81,920-triangle sphere: 34 ms; random with smooth normals
  71 ms). Results are cached by mesh key and options.

**`projectPoints(cloud, camera, {order, crop, cullBackFacing})`** returns `ProjectedPoint`s that extend `Site` (so `atEach`
and every mark accept them): position, `index`, camera `depth`, `facing` (cosine between the normal and the direction to the
eye, or null without normals). `order: "far-to-near"` is the painter order for opaque or additive grains (ties by index).
Points nearer than a perspective near plane are dropped.

## Visibility (`visibility.ts`)

### Hidden lines

`hiddenLines(mesh, curves, camera, options)` classifies every straight segment of every 3D curve (`SpatialCurve`: id,
points, closed, tone) against the mesh's triangles. A point is hidden if its projection is inside a triangle's projection
**and** it is farther than the triangle's plane along the viewing ray. Both conditions are affine in the segment parameter
(the planes through the eye, or parallel to the view axis, and through a triangle edge; and the triangle's plane), so one
triangle hides ONE interval, found by clipping the segment against four half-spaces analytically. The hidden set is the
union of those intervals and the visible set the complement. There is no depth buffer, no sampling and no resolution.

**Tolerance policy.** One number, `tolerance` (world units; default `1e-9 * mesh bounds diagonal`):

* a point is BEHIND a triangle only if it is farther than the plane by MORE than `tolerance` (perpendicular distance), so a
  curve lying on the surface (a mesh edge and its own faces) is never hidden by them, and two surfaces closer than
  `tolerance` are not ordered;
* a triangle's projected region is closed and grown by a rounding slack of about `1e-12` of the scene's magnitude (never more
  than `tolerance`): a point on its boundary counts as inside, so a triangulated occluder has **no crack** at shared edges
  and diagonals, and a curve exactly behind an occluder's silhouette (a cube behind a cube, axis aligned) is hidden rather
  than drawn twice, while one exactly in front is visible;
* hidden intervals shorter than `tolerance` are ignored and visible gaps shorter than it closed, so rounding leaves no dust.

**Near plane.** Perspective removes the part of a segment nearer than `near` (counted in `stats.clippedSegments`) and clips
triangles to the same plane before use, so geometry behind the eye neither occludes nor mirrors.

**Occluders.** `"all"` (default) uses every triangle, so open sheets and back faces occlude correctly (an opaque sheet seen
from behind hides what is above it); `"front"` uses only camera-facing triangles, giving the same answer on a closed,
consistently oriented mesh at about half the work (tested equal on a sphere in both projections). Edge-on triangles
occlude nothing.

**Output.** `ProjectedPath` values (`Path` plus `visible`, per-point `depths`, the source `curve`): each curve is cut into
maximal runs of equal visibility, runs continue through the curve's own vertices, and a wholly visible closed curve is one
closed path; a run spanning a closed curve's start vertex is merged. Ids `<curve id>#<n>`; seeds
`componentSeed(seed, id, "path")`; `tone` is the curve's. Hidden and visible runs are both returned: the hidden-line policy
(drop, fade, dash) belongs to the consumer. A run that projects to under 1e-6 canvas units (an edge seen end-on) is dropped
and counted in `stats.edgeOnRuns`; the first version returned them as dots.

**Curves from mesh edges.** `meshEdgeCurves(mesh, topology, edges)` chains selected edges (numbers or `FeatureEdge`s) through
vertices where exactly two selected edges meet, per tone, deterministically; ids `chain:<lowest edge id>`. A quad's diagonal
is never a curve; a closed silhouette becomes one closed curve.

**Occlusion of points.** `visiblePoints(mesh, cloud, camera)` returns 1 for visible, 0 for hidden (or nearer than the near
plane), with the same tolerance rules.

**Work.** A 2D bounding-volume hierarchy over the projected triangles (Morton ordered, depth pruned) serves each segment. Work
is charged per candidate triangle plus a quarter per node visited and per occluder built; over `maxWork` (default
`DEFAULT_VISIBILITY_WORK`, 20,000,000) or 200,000 segments the call throws naming `maxWork` / the curves. Measured on a
394,272-triangle terrain: preparing occluders and 4,012 curves 200 ms (1.4M work units); the same curves again for the same
camera 40 ms; a new camera 170-190 ms; 2,000 long lines over a grazing view 500 ms (5.6M units); all 30,720 edges of a
20,480-triangle sphere 200 ms. Roughly 1M work units per 55 ms, so the default is about 1.5 s. A pathological view (a huge
sheet at a grazing angle under very long curves) can approach segments x triangles, which is exactly what `maxWork` bounds.
Prepared occluders are cached for two views (and at most 500,000 pieces, about 150 MB).

### Painter order

`paintOrder(mesh, camera, {cull, tolerance, maxWork})` orders the mesh's **triangles** far to near so that every pair of
triangles whose projections overlap in positive area (more than 1e-9 of the smaller) and which do not intersect within the
overlap is painted farther-first. The pairwise test is exact: over the convex overlap polygon (computed by clipping) the two
depths are compared at every polygon vertex (1/depth is affine in screen position, so the sign at vertices decides the whole
polygon). Pairs that intersect within the overlap, or are coplanar within `tolerance`, are **undecided** and unconstrained;
cyclic overlaps are broken at the farthest remaining triangle and counted; unconstrained triangles fall back to centroid
depth. The result reports `overlapping`, `constraints`, `undecided`, `cycleBreaks` and `exact` (no undecided pair and no
cycle break). Limits: an inexact order is wrong only where its undecided or cyclic pairs overlap; `cull: "back"` is valid
only for closed outward meshes (an open vessel loses its interior, as the review's goblet shows); a triangle crossing the
near plane is ordered through its clipped pieces and appears once; a face's two triangles are not kept adjacent. Measured:
20,480 triangles 75 ms; 394,272 triangles 1.5 s with `maxWork` 1e9 (over the default, which it refuses by name).

## Bundled meshes (`mesh-samples.ts`)

Chosen by `bundledMesh(id, {detail, seed, variant})` (see `bundledMeshInfo` for ranges, what `detail` scales and the valid
variants). Each is deterministic, cached by construction, and has closed forms the tests check independently.

| id | Shape | Closed forms tested |
|---|---|---|
| `icosphere` | icosahedron subdivided by midpoints onto the sphere, 0 to 6 levels | V, E, F = `10n+2, 30n, 20n` (`n = 4^levels`), area and volume of the icosahedron `5 sqrt(3) a^2`, `5/12 (3 + sqrt 5) a^3`, area rising to `4 pi r^2` |
| `torus` | quads around ring and tube | Euler 0, `2uv` edges, area and volume errors shrink as `1/n^2` toward `4 pi^2 R r`, `2 pi^2 R r^2` |
| `terrain` | open quad height field, variants `hills`, `ridges`, `crater`, `dunes`, seeded | tilted plane area `w d sqrt(1 + a^2 + b^2)`, boundary `2 (c + r)` edges, Euler 1 |
| `vase` | profile revolved by `RadialProfile3D`: `amphora`, `goblet`, `bottle`, `urn` | volume and area of the stacked pyramid frusta exactly (to 1e-12), rim of `slices` boundary edges |
| `figure` | pedestal, two legs, torso, two arms, head: seven closed components, quads and triangles, parts separated by gaps of 0.01 to 0.02 | seven components, Euler 14, per-component Euler 2 |

`terrainMesh({width, depth, columns, rows, height})` also accepts a caller's height function (trusted code, never stored or
cached); a non-finite height throws naming the vertex.

## Failure, ownership, units

Every function throws an `Error` naming the mesh, face, vertex, control or limit at fault; nothing is truncated, repaired or
clamped silently. Producers return frozen values cached by content (mesh key plus options, or construction), never by palette
or material, so an appearance edit recomputes nothing (`meshTopology` and `sampleSurface` cache hits are microseconds).
Structural edits (a new mesh, a different seed or count, a different camera for visibility) recompute exactly what depends on
them. Units are the caller's world units for meshes and curves, canvas units for projected values, degrees for camera angles
and dihedral angles.

## Boundary decisions made conservatively

* The occluding region is closed (boundary included) and coincident-behind counts as hidden; the alternative would draw the
  front and back edge of an axis-aligned cube twice.
* Edge-on runs are dropped, not returned as dots; silhouettes treat an exactly edge-on face as back-facing.
* Components connect through vertices, not edges. Quads are one face (diagonals are not edges, creases or silhouettes).
* The painter orders triangles, not source faces. `"all"` occluders is the default so open geometry is never wrong.
* Bundled terrain is a trusted function of `(variant, seed)`; the figure's parts do not touch, so its painter order is exact.

## Not done

Planar sections and iso-contours of a mesh (briefs 53 and 55 will need them: only the crease, silhouette and boundary
selections exist), mesh extraction from implicit fields, smoothing groups derived from crease angles for
`meshCornerAttributes`, host binding of user meshes and clouds, simplification, remeshing and growth (their own briefs), a
WEBGL check, and any Studio control or gallery entry.

## Verification

`tests/composition-spatial.test.ts` has 44 tests with independent expected values: mesh validation and degenerate policy,
content hash, closed-form area, volume, Euler characteristic and edge counts for the icosphere, torus, terrain plane, vase
frusta and box, quad splitting (including a dart whose shorter diagonal lies outside), crease detection and ridge/valley
signs on a cube and V-terrains, classification of open, non-manifold, pinched, flipped and unused-vertex meshes, sphere
silhouettes as one closed loop on the tangent cone or cylinder (both projections), camera conventions at exact angles,
sampling barycentric identity, plane membership, attribute interpolation, the **prefix property**, area weighting and
even-versus-random uniformity, point-cloud identity under thinning and cropping, hidden lines for a **cube behind a cube**
(exact analytic split points in orthographic and perspective projection, both view directions), crack-free occlusion behind a
128-triangle wall, the tolerance policy, near-plane clipping, open-sheet occluders, `"front"` versus `"all"`, a ring behind a
sphere, nine visible and three hidden cube edges, closed curves, edge chaining, painter order verified by independent
Moller-Trumbore ray casting on a sphere, figure, grazing terrain and torus, undecided and cyclic painter cases, descriptor
round trips, and renderer corner attributes.

Nine mutations were each shown to fail at least one test (in the test run they fail 1 to 8): flipping the perspective depth
side (5 tests), flipping the orthographic depth side (7), removing the depth tolerance (2), making the sampling stream depend
on `count` (the prefix test), flipping ridge/valley sign (1), reversing the painter's depth comparison (2), removing near-plane
clipping (1), treating edge-on faces as front-facing (1 after the front-on silhouette test was tightened to check WHICH
square is the outline), and opening the closed region (8).

## Review record (rendered, not accepted through the real interface)

Drawn through a throwaway SVG surface and rasterized with Chromium under the render lease: hidden-line figure in both
projections, icosphere wireframes (sparse, dense at level 4, level 6 silhouette only), torus quad wireframe, terrain quad
grids (hills seeds 1-3, ridges, crater, dunes) with silhouette, crease and rim accents, vases (three merged), two cubes in
perspective with hidden edges faint, a coarse torus filled by the painter with lines, painter-shaded figure, torus, grazing
terrain and goblet, samples as grains (figure, sphere seeds 1-3, torus with and without depth order and occlusion, terrain by
height attribute, even versus random), a near plane cutting terrain, a sparse-plus-lines and a combined pale-fill / lines /
grains composition, and layered pairs in both orders with the unmodified Motif Ecologies and Contour Scores, including a
pale filled figure that hides the motifs beneath it and is crossed by them above.

Defects found by looking, and fixed: (1) the bare R2 sample sequence drew visible lattice rows on the figure's flat faces;
a `1 / sqrt(j)` jitter breaks them and keeps the prefix property; (2) edges seen end-on came back as dots at cube corners;
they are dropped and counted; (3) hidden regions grew by the whole depth tolerance, moving split points by about `tol / sin`
of the crossing angle; the closed-region slack is now separate and about `1e-12`; (4) the figure's legs and torso touched
in coplanar faces, so its painter order could not be exact; parts are now separated by gaps of 0.01 to 0.02; (5) the `ridges` terrain had too
little relief to show creases or fold silhouettes; (6) camera bases contained `-0`. Also observed and left as documented:
crease lines on quad grids run as staircases along grid edges; back-face culling removes an open vessel's interior.

Timings (this machine, single runs): first preparation of the figure, topology and all-edge hidden lines 3 ms; a 197,136-face
terrain: build 114 ms + topology 230 ms + first hidden lines 200 ms; appearance-only edit (palette, material, mark): no
recomputation, cache hits under 1 microsecond; curves changed with the same camera 40 ms; a new camera 170-190 ms; a new
sample count 30 ms for 100,000 points; icosphere level 6 (81,920 triangles) built, hashed and topologized in 145 ms.
These are observations, not certified slider ranges.
