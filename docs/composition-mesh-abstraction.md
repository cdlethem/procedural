# Local mesh abstraction (brief 55)

Status: **implemented on branch `w4/mesh-abstraction`, unreleased.** Instrument `mesh-abstraction` (title *Mesh Abstraction*), guide
`packages/instruments/guides/mesh-abstraction.md`. It is built on the [spatial foundation F8](composition-spatial.md) (meshes,
topology, cameras, exact hidden lines and painter order, bundled meshes) and on the [stateful snapshots F7](composition-snapshots.md)
(the collapse count is a scrubbable step). Code: `packages/instruments/src/composition/{mesh-region,mesh-simplify,mesh-abstraction,mesh-abstraction-draw}.ts`,
`src/adapters/mesh-abstraction-instrument.ts`. Tests: `tests/composition-mesh-simplify.test.ts` (14) and
`tests/mesh-abstraction-instrument.test.ts` (12).

An artist gets forms that pass from **detailed source structure to coarse flat facets, with one chosen region left vertex for
vertex as detailed as it was**: a terrain of large shaded triangles around a patch of fine ruled edges, a vase with a fine neck
and a faceted body, a blocky figure with a high-resolution head. Drawn on a 2D canvas as projected geometry (no WEBGL), with real
occlusion: facets are painted far to near, edges are hidden-line solved, and a moving camera shows the same abstraction from
another side. It reconstructs no scan and fabricates nothing.

## Pipeline (three separate stages)

| Stage | Function | Depends on | Never depends on |
|---|---|---|---|
| Construction | `meshAbstractionProducts(recipe)` | source, region, rule, boundary, crease angle, error limit, facet count, seed | camera, palette, materials |
| View | `meshViewProducts(mesh, camera, spec)` | one mesh, one camera, edge selection | palette, materials, opacity, weights |
| Appearance | `drawMeshAbstraction(surface, recipe, {line, facet})` | the two above | (draws only) |

Construction is a frozen `Abstraction`, cached by construction: the F7 snapshot cache keys on the source mesh's content hash, region,
rule, boundary, crease angle, error limit and seed; **`steps` (the collapse count) is not in the construction**, so a different
facet count extends or replays the cached run (measured below). The camera fits the SOURCE bounds, so it never depends on the
abstraction. View products are cached per mesh object and camera key (8 per mesh); appearance edits recompute nothing (an
appearance-only redraw of the largest setting takes about 50 ms, all of it drawing).

## The simplification (`mesh-simplify.ts`)

**Input.** A `Mesh` of kind `closed-manifold` or `open-manifold` (consistently oriented, no pinch vertex, no edge on three faces); other
kinds throw naming the class. Quads are simplified as the two triangles the mesh already uses for geometry, so the result is a
triangle mesh. At most `SIMPLIFY_LIMITS.maxTriangles` = 40,000 triangles (a bundled icosphere at level 6 has 81,920 and is refused,
naming "reduce the source detail"; the instrument names *Source detail*). The library never fetches a model; **host binding of a user's
mesh or scan is future work** and the instrument stores only the bundled id plus scalars. The direct API takes any resolved `Mesh`.

**Rule.** One collapse merges an edge's endpoints into one of them; the survivor keeps its ORIGINAL vertex id (no vertex is ever born,
so ids are stable and the birth counter is the source vertex count). Each vertex carries the Garland-Heckbert quadric of the planes of
the source triangles it now represents (a triangle counts once per corner it is merged through) and their count, so
`sqrt(Q(p) / count)` is the **root-mean-square distance in world units** to those planes: the `error` attribute. Constraint planes for boundary and crease
edges (weight `CONSTRAINT_WEIGHT` = 10, counted like planes) make leaving a preserved edge expensive.

* Position of the merged vertex: the quadric optimum (rule *error-driven*, when the 3x3 system is well conditioned and the optimum lies
  within twice the edge length of the midpoint), else `u`, `v` or the midpoint; the cheapest that passes the fold test wins (ties in that
  order). A locked endpoint fixes the position.
* Priority (lowest first, ties by `(u, v)`): error-driven `(Q(p) + 1e-3 |uv|^2)(1 + 100 w^2)`; shortest edge `|uv|^2 (1 + 100 w^2)`, with `w` the larger endpoint
  importance. The small length term makes a flat region collapse shortest edge first (uniform coarsening) instead of arbitrarily.
* **Rejection rule** (each named, and counted at the end by `blockedCensus()`): `locked` (both endpoints protected: importance 1 or frozen
  boundary), `link` (the link condition of the surface completed by a vertex at infinity joined to every boundary vertex: the endpoints'
  common neighbours must be exactly the edge's opposite vertices, so no collapse pinches, tears or fuses a boundary), `tetrahedron`
  (a closed component of four vertices), `component` (it would delete every face of a component), `flip` (a surviving triangle's normal
  would turn more than 78.5 degrees, cosine below `MIN_NORMAL_DOT` = 0.2, or shrink to a sliver of |cross| <= 1e-6 L^2),
  `valence` (the merged vertex would exceed the source's largest valence, at least 16: bounds the work of a step) and `error` (the
  RMS error would exceed the local limit `maxError (1 - w)`).
* After every collapse the star of the survivor is checked to be one manifold fan or one boundary chain (an internal assertion, never
  reached while the rejection rule holds).
* **Stop reasons** (`Abstraction.stop`): `target` (the requested count reached, more could follow), `error-limit` (nothing legal is left
  and some collapses were refused for their error), `no-legal-collapse` (nothing legal is left for structural reasons: an exhausted
  form, a tetrahedron per component, everything protected).
* **Counts.** An interior collapse removes two faces and one along a boundary edge removes one, so a closed mesh of `F` faces has exactly
  `F - 2k` after `k` collapses. `simplifyMesh({targetFaces: T})` stops at the FIRST collapse count whose face count is at most `T`
  (exactly `T` for a closed mesh with matching parity, `T - 1` for the other parity; an open mesh ends on `T` or `T - 1`). The instrument's
  *Facets kept* is a share of the triangles OUTSIDE the protected region (`protectedTriangles`: all three corners at importance 1):
  the total target is protected + share x the rest, never below 4.

**Preserved region** (`mesh-region.ts`). `regionImportance(mesh, region, seed)` gives one importance per vertex in [0, 1]: 1 inside
(the vertex is frozen: never moved or removed, bit-identical in the result), falling linearly to 0 over `falloff` world units, or the
complement with `invert`. Shapes are fractions of the mesh's own bounds so a recipe fits any source: `sphere` and `box` (centre as a
fraction of the bounds, radius as a fraction of the diagonal, box half extent as a fraction of the extent), `band` (a slab along an axis), `seeded`
(spheres on area-weighted surface samples: raising the count only adds spheres). Failure: a NaN, an out-of-range fraction or a band with `from > to` throws naming the field.

**Determinism and the snapshot API.** `simplifySimulation` (id `mesh-simplify/1`) is an F7 `Simulation`: one step is one collapse; the state
(positions, triangles, quadrics, importance, lock flags, a stamped binary heap with lazy deletion) is plain typed data, so a checkpoint
replay is bit-identical; edges are visited in ascending order and the heap order is total `(priority, u, v)`. `checkSimulation` passes on an icosphere, a
terrain, a vase and the figure (regions, creases and an error limit on): bit-identical runs, spacing-invariant, resume equals scratch, the **prefix
property** (more collapses only append), replay. The structure of the prefix is tested directly: merged sets only grow and surviving facets only shrink.
Retention (`simplifyRetention`) keeps 2 to 12 checkpoints so stored values stay near 3 million. A cancelled `prepareSimplification` publishes nothing.

**Output (`Abstraction`).** A frozen triangle `Mesh` of the alive vertices in ascending original id and alive triangles in ascending original
index with vertex attributes `error` (RMS distance), `importance` (the field; the larger of merged vertices), `origin` (original vertex id) and face
attribute `source` (original triangle); plus `representative[v]` (which surviving vertex stands for source vertex `v`), `faces`, `collapses`,
`stop`, `lastError`, `maxVertexError`, the `snapshots` and `blockedCensus()`. Every output facet's corners are the representatives of its source facet's corners (tested).
`abstractionAt(abstraction, k)` reads the mesh after exactly `k` collapses.

## The instrument

Controls (groups in order): **Source** (source, detail, terrain kind, vase profile), **Placement** (center X/Y, size), **Abstraction** (facets kept, collapse rule, error limit,
boundary, keep creases, crease angle), **Preserved region** (region, X/Y/Z, size, band axis/from/to, count, falloff, invert), **View** (projection, yaw, pitch,
roll, eye distance), **Facets** (facets, opacity, light, contrast), **Lines** (edges, line material, hidden lines, and the proportional *Line weights*: line and
ghost), **Highlight**, **Comparison**. Conditions are inline: e.g. the region controls only under a region that uses them, *Eye distance* only for perspective, *Boundary* only for
open sources, ghost controls only for *Ghost*; a hidden control never changes the drawing (the property test of the conditional-controls suite passes with this entry included).
*Line weights* is the one proportional cluster (both are stroke widths in canvas units, zero means none).

Palette tones: 0 facets, 1 edge lines and ghost, 2 the preserved region (tint and edges). The layer paints no background.
Slider intervals are conveniences, hard limits are required by geometry: Source detail 1..7 (icosphere 7 and figure 7 refused by name), Facets kept hard 0.0001..1,
Error limit 0..1 of the diagonal, Region fractions -1..2.

Edge-only drawing (*Facets* none) is a real hidden-line drawing of the abstracted mesh. Substituting a consumer:
`drawMeshAbstraction(surface, recipe, { line: anyPathMaterial, facet: (surface, { points, rgb, importance }) => ... })`.

## Verification

Independent expected values (no wiring tests): Euler characteristic and manifold kind at 7 prefixes for five sources (sphere 2, torus 0, terrain 1, vase 1, figure 14);
exact face counts (`F - 2k`, first-count target rule with both parities); no inverted facets (outward normals on the sphere, `n_y > 0` on a rough terrain at four
facet counts, and per collapse the turn of every surviving facet against its previous normal on a terrain, a sphere with a region and a torus); region, box, band and frozen-rim vertices
bit-identical and every protected triangle kept; gradual falloff by measured facet area in three distance bands; a flat surface collapsing at zero error with exact area and corners; the
error attribute equal to the RMS distance to the represented source planes (independently recomputed); correspondence identities; the prefix property against runs from scratch,
`checkSimulation` on four sources; the error limit respected at every collapse (history of a fresh run) and its stop reason; every remaining edge blocked for exactly one named reason
(tetrahedron, single triangle, the square's diagonal by the link condition, all-locked); input refusals. Instrument: painter coverage of the front-facing facets of a closed
abstraction, hidden-line edges checked by an independent ray cast in both projections (visible samples see the eye, hidden ones do not), analytic visible and hidden projected
lengths of a cube, stage separation by object identity, the seed's reach, the region-relative facet target, cooperative preparation, consumer replacement.

Mutations, each shown to fail at least one test (number failing): the facet-turn limit removed (1), the link condition removed (4: prefix Euler, prefix property, blocked
census, seed), protected vertices allowed to move (4), the importance bias removed from the priority (1: the falloff test), a `Math.random` term in the priority as a hidden input (2: the
prefix property and the seed test), the error attribute not divided by the represented plane count (1), the tetrahedron rule removed (1), and the target rule asking one collapse too many (4: exact counts, region, the region-relative target, the cube).

## Measured

Node 22 on the shared development machine (other jobs running, so ranges are pessimistic). Simplifying an icosphere of 20,480 triangles to about 3,000: 0.7 to 2.8 s including
region, mesh hash and checkpoints; a 3,200-triangle terrain (the default) 0.3 to 0.45 s cold. Scrubbing *Facets kept* on the large sphere: down 0.7 s, up 0.4 s (replay from a
checkpoint plus the difference); a changed region or seed is a new construction (0.3 to 2.5 s). The view stage (painter order and hidden lines of the abstraction plus the ghost's 30,000 edges) takes
1.2 to 1.6 s at the largest setting, 20 to 150 ms for terrain at detail 7 and the default; an appearance-only edit is 1 to 50 ms. Nothing here is a certified slider range.

## Not done, and decisions taken conservatively

* **Sectioning and caps.** The brief allows "constrained simplification and/or explicit sectioning". Exact sections and iso-contours exist in F8 (`mesh-section.ts`); this instrument does
  not cut. A cut would need a capped-solid construction whose validity is checked; that is a separate study, not a decoration of this one.
* No host binding of user meshes; the instrument's sources are the five bundled ones. The foundation's `figureMesh` gained an optional `headLevels` (default 1, unchanged
  geometry) so the figure has a detailed head to preserve.
* Quads are simplified as triangles (a quad's diagonal becomes an ordinary edge); the abstraction of a quad mesh is a triangle mesh.
* A source with several components collapses each to a tetrahedron at most (`figure`: 28 triangles for its seven closed parts).
* Facet fills use the painter's algorithm of F8 (exact for non-intersecting facets; an inexact order is reported by `paintOrder`), not a depth buffer. SVG through Chromium was the
  render check; WEBGL was not exercised.
* The tint colours a facet by the mean importance of its corners, so a large facet touching the region is partly tinted; that is the transition made visible.
* Limits are of this construction, not of the library: 40,000 source triangles, valence cap at least 16, 12 checkpoints at most.
