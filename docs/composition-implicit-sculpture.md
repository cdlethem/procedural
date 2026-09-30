# Implicit sculpture (brief 56)

Status: **instrument and producers, 2026-09-30; unreleased.** Instrument `implicit-sculpture` ("Implicit Sculpture"). Code:
`packages/instruments/src/composition/{sdf,sdf-samples,sdf-march,sdf-mesh,sdf-draw}.ts` and
`src/adapters/implicit-sculpture-instrument.ts`, exported deliberately from `src/index.ts`. Guide: `guides/implicit-sculpture.md`.
Tests: `tests/composition-implicit-sculpture.test.ts`. It builds on the F8 foundation ([spatial inputs and drawing](composition-spatial.md)):
meshes, topology, cameras, hidden lines, painter order, sections, surface samples and point clouds are used as they are, none re-implemented.

The instrument draws a solid defined by an editable **signed-distance tree** and offers the same values as functions. Nothing is
physically simulated and no fabrication or scan claim is made; the drawing is 2D canvas geometry (no WEBGL).

## Stages and ownership

```
construction   sculptureSdf(spec)                  spec + seed                 -> Sdf                 (frozen, cached by tree content)
extraction     sdfMesh(sdf, detail)                sdf + Mesh detail           -> Mesh + provenance   (frozen, cached)
camera         sculptureCamera(sdf, view)          view controls + sdf bounds  -> Camera              (a small value)
view           sdfView(sdf, camera, sampling)      sdf + camera + cell + steps -> per-cell arrays     (frozen, cached)
appearance     shadeView / toneColor / painter order / hidden lines / drawing (palette, light, levels, weights)
```

The camera is created after the tree and never enters it: a camera edit re-marches the view and re-solves hidden lines but returns the
same `Sdf` and the same `Mesh` objects; an appearance edit (palette, opacity, levels, light, weights, hidden-line policy) returns every
producer as the same object and marches no ray. A sculpt edit rebuilds everything downstream. `sculptureProducts(recipe)` builds only
what the recipe draws (lines only: mesh and lines, no march; cells or bands only: view, no mesh). All producers return frozen values
(typed-array storage is private or frozen views) keyed by content; the layer paints transparent space and never clears.

## The tree (`sdf.ts`)

Plain data (`SdfNode`), validated and frozen by `sdf(root)`; every failure names the node path (`0.1.2`), kind and field.

| Kind | Meaning | Class of the result |
|---|---|---|
| `sphere`, `box` (optional rounding), `torus`, `capsule` (segment), `cylinder` | Primitives, negative inside | `exact` |
| `place` | Translate, rotate (`Ry Rx Rz`, degrees), uniform scale; the field is scaled back | keeps the child's class |
| `union`, `intersection`, `subtract`, `smoothUnion` | min, max, `max(base, -cut)`, polynomial smooth minimum | `bound` |
| `shell` | `abs(d) - t/2` | `bound` |
| `repeat` | Bounded lattice of copies (`counts` per axis), optional seeded `keep` | `bound` (`exact` for one copy) |
| `twist`, `bend` | Rotation proportional to height / width, divided by a Lipschitz constant | `bound` |
| `fold` | Bounded fractal fold `menger` or `tetra`, `iterations` at most 5 | `bound` |
| `field` | A trusted caller's function with bounds and an optional declared Lipschitz constant | `bound` if declared, else `scalar` |

**What the number means.** `exact` is the true Euclidean signed distance everywhere (single primitives under rigid motion and uniform
scale). `bound` is 1-Lipschitz and zero on the surface, so `|f(p)| <=` the true distance: sphere-tracing steps are safe, only short.
Every operator preserves this: min, max, negation and the polynomial smooth minimum (whose partial derivatives are non-negative and sum
to one) are 1-Lipschitz combinations; a shell is `|d| - t/2`. **Twist** by `k` over a region of radius `R` (a ball about the origin that
contains the bounding sphere) has Lipschitz constant `(m + sqrt(m^2 + 4)) / 2`, `m = |k| R` (the Jacobian is `R(I + w e_y^T)` with
`|w| <= |k| R` perpendicular to `e_y`); **bend** has `1 + |k| R`; the node divides its field by the constant, so the class stays `bound`.
A **repeat** returns `min(child(p - centre), b)`, `b` the distance to the nearest neighbouring copy's bounding slab: it requires the
child's bounding half-extent to be at most half the spacing on every repeated axis (else the node is refused, naming the axis), and the
slab bound is symmetric so the field is continuous across cell faces. A **fold** returns `child(fold(p)) / scale^n` for isometric folds
(sorted absolute value and translation, or three swap-negate reflections) and a uniform scale `s`, so it is `s^n`-Lipschitz before the
division. **Scalar** trees can be meshed, sliced and sampled; `marchRays` refuses them by name: no arbitrary field is treated as a
distance estimator. A `field` with `lipschitz: L` is trusted and divided by `L`.

**Bounds** are conservative and bottom-up (twist and bend by circumscribing the swept circle; fold by `1 + (e - 1) s^-n`; smooth union
by `k / 4`); an intersection of disjoint boxes is refused. `sdf.radius` is the bounding sphere plus 3 percent, so rays start outside
touching solids. **Limits:** 128 nodes, depth 16, 64 children per operator, 5 fold iterations, 32 repeat copies per axis,
coordinates at most `1e6`. `sdf.cost` counts primitive evaluations per field evaluation and drives every work bound.

## Marching and the view (`sdf-march.ts`)

`marchRays(sdf, rays, {maxSteps, hitEpsilon, maxDistance, engine, maxWork})` steps by the field: HIT at `f <= eps`, INSIDE when the first
sample is negative, MISS_RANGE past `maxDistance`, MISS_STEPS at the cap (exactly `maxSteps` evaluations), MISS_STALLED when a step
does not advance. This is the rule of the released `raymarchImplicitRays3D` (`@procedurals/javascript`, `field.raymarch-implicit-rays-3d`),
which the `released` engine calls whenever `releasedScene(sdf)` can express the tree (spheres, boxes without rounding, translation and
uniform scale, union, intersection, subtraction, smooth union); every other tree uses the same rule over the compiled closure (`local`).
A test pins identical kinds, step counts and distances on the shared subset. **Work** is `rays x (maxSteps + 6) x sdf.cost`, checked against
`maxWork` (default 500,000,000) before any ray runs; it is a worst case, typical work is a fraction.

`sdfView` lays a square lattice of `cellSize` canvas units over the projected bounding disc (anchored to the disc so the lattice moves with
the sculpture), keeps the cells that meet the 640 canvas, and fires one ray per cell centre. Per hit it stores camera depth, the field's
unit gradient (tetrahedron at 1.5 hit epsilons) and an ambient-occlusion term (five samples along the normal out to 0.155 of the
bounding radius). Cells next to a change of hit status get the eight other rays of a 3 x 3 pattern, so `coverage` (ninths) locates the
silhouette to a ninth of a cell for either engine. The hit epsilon is 5 percent of a cell's world size. At most 60,000 cells.

## Extraction (`sdf-mesh.ts`)

**Dual contouring** on a regular grid (one vertex per surface cell placed at the least-squares meeting point of the local surface planes,
one quad per sign-changing grid edge). It replaces marching cubes because a tree's CSG creases must stay sharp for the crease and
silhouette consumers; marching cubes and marching tetrahedra chamfer every sharp edge by up to a cell and made the drawn lines zigzag
(observed and abandoned while building this). Edge crossings are located by the Illinois root finder on the true field, since near a crease
interpolation puts them off the surface; normals are the field's gradient; the step drops eigenvalues under a hundredth of the largest.
A box therefore meshes to exact volume, area and corners; a bore's rim vertices lie on the circle to a twentieth of a cell. Quads are
wound outward; a quad that folds becomes two triangles; welded corners collapse cleanly and are counted. Thin features (a limb under
about two cells) can give non-manifold vertices, reported by `meshTopology`; the drawing treats such a mesh as open. `provenance` names the
tree key and class, method, level, grid, and counts. Limits: detail 4 to 128, 2,500,000 grid points, 200,000 vertices and faces, a work
bound; all name Mesh detail. `sdfSurfacePoints` samples the mesh by area (prefix-stable), pulls each point onto the exact zero set by
Newton steps and attaches gradient normals: a `PointCloud` for `projectPoints` and `visiblePoints`.

## Bundled sculptures (`sdf-samples.ts`)

Carved block, lattice cavity, coral and fractal fragment, then one shared pipeline: hollow shell and cutaway in either **order**, twist,
bend, bounded repeat of the whole (spaced by its own extent times `1 + gap`, so it is always valid). Seeds enter only through
`componentSeed(seed, id, purpose)`: coral limb heights, azimuths, tilts, lengths and twig angles (ids `b<k>`, `b<k>/t<j>`), and the
lattice repeats' per-cell `keep` hash (id `i,j,k`; separate streams for voids and each tunnel axis). A block and a fractal do not read the seed (`usesSeed` is false), a hidden
control is never read (tested by property).

## The drawing (`sdf-draw.ts`)

Fills: **cells** (rectangles merged along rows, or halftone dots), **bands** (the `IsoField` level rings of the shade, each clipped by
`domainIntersection` to the coverage-0.5 silhouette domain, which is also painted as the darkest tone, so bands meet the outline exactly), **facets** (painter order from `paintOrder`, with the extracted
mesh's own face normals), **grains** (`sdfSurfacePoints`, occluded by `visiblePoints` with a tolerance of 0.4 mesh cells, far to near).
Lines: silhouette and crease edges of the mesh (chains shorter than 1.5 mesh cells, closed loops shorter than 5, are dropped as extraction noise: a skin thinner than the grid leaves such slivers) through `hiddenLines`, and planar slices through `sliceMesh`, hidden runs dropped or faint.
Shading: Lambert from a viewer-frame light, ambient, occlusion and a depth cue; tones from the palette (entry 0 is ink, 1..n-1 the ramp),
quantised to `levels`. `SculptureConsumers.line` replaces the built-in line material with an ordinary path material.

## Controls by group

Form (`form`, `blend`, subgroups Block, Lattice, Growth, Fold, each visible only for its form), Placement (`centerX`, `centerY`, `size`),
Carve (`cut`, `cutAt`, `cutTurn`, `hollow`, `wall`, `order`), Deform (`twist`, `bend`), Repeat (`repeatX/Y/Z`, `repeatGap`), View
(`projection`, `yaw`, `pitch`, `roll`, `distance`), Light, Fill (with Cells and Grains subgroups), Lines (with the proportional **Line
weights** subgroup: `lineWeight`, `sliceWeight`, both non-negative canvas widths), Quality. Conditions: form controls on `form`;
`cutAt` on `cut` not none; `cutTurn` on `cut` in half, quarter, corner; `wall` on `hollow`; `order` on `hollow` and a cut; `distance` on
perspective; light, opacity and levels on `fill` not none; `aoStrength`, `cellSize`, `steps` on cells or bands; cell options on cells;
grain options on grains; `creaseAngle` on `creases`. **Left visible** because relevance is a disjunction: `meshDetail`, `sliceAxis`, `hiddenLines`,
`lineWeight`, `sliceWeight`, `twist`, `bend` (a value of 0 is inert, but a numeric driver is not expressible).
Slider intervals are chosen so every combination of slider ends draws (tested for each form: every numeric control at its slider minimum and at its maximum alone and together, under all five fills, hollow, cuts and perspective, all-max under 2.5 s): Cell size starts at 3 (so at most 45,000 cells) and Mesh detail ends at 44 (facets stay under 120,000 for every form, fill, hollow and cut). Slider intervals are convenient spans; hard limits are the model's (for example Cell size 1 to 64 (slider 3 to 16), Mesh detail 4 to 128 (slider 12 to 44), iterations 0 to 5,
repeats 1 to 12) and refused outside them by name.

## Failure, units

Every limit throws an `Error` naming the control or option (typed values past a hard limit only; **slider ends never refuse**: a sculpture the mesh grid cannot resolve, no surface at all or a hollow **Wall** thinner than 0.8 of a mesh cell, gives `meshOrEmpty` = null, so facets, grains, silhouettes, creases and slices draw nothing while cells and bands still march; `SdfNoSurfaceError` is the typed error `sdfMesh` throws for no surface); nothing truncates, repairs or falls back to another picture. World units
are half the block's side (or the caller's); canvas units are the 640 reference frame; angles are degrees except twist and bend
rates, in radians per world unit.

## Verification

`tests/composition-implicit-sculpture.test.ts` (32 tests, independent expected values): every primitive against its own closed form or a brute-force
reference (sphere, box, rounded box, torus, capsule by 4,000-sample projection, cylinder, a placed cylinder); bounds contain every interior point; every
operator and every bundled tree is 1-Lipschitz on random pairs; a lens (intersection of two spheres) underestimates the brute-force distance
to its sampled boundary; the twist's Lipschitz constant is not vacuous (the undivided twist reaches slope 1.2 or more but never the constant);
a bounded repeat bounds the union of copies (including a lopsided child whose nearest copy is a neighbour) and is exact beside a copy; the
keep hash equals `componentSeed` of the cell index; Menger levels 1 to 3 keep exactly the 20^n cells a ternary-digit rule keeps, tetra levels 1
and 2 hold 4^n cubes; a scalar field meshes (volume within 3 percent) and is refused by `marchRays` until a Lipschitz constant is declared;
sphere rays at analytic distances in both engines, the exact step cap, range and work errors; the released operation and the local tracer agree
exactly (kind, steps, distance) on 400 rays; a sphere's view has the analytic silhouette area in both projections to 1 percent, central depth and
normal, and no occlusion, a bore is occluded; views are cached by tree, camera and sampling and not by light; camera, appearance, sampling and sculpt
edits return the same or new producers exactly as documented (identity checks); dual contouring gives a box exact volume, area and corners, sphere
volume converging (below 0.5 percent at 64), torus Euler 0 with volume and area within 2 percent, a bore's rim on its circle to a twentieth of a
cell, outward orientation; surface points lie on the exact surface and thin by prefix; mesh hidden lines agree with the ray-marched depth at over 98
percent of interior samples and a floating ring is hidden by a slab and a sphere exactly where the analytic occlusion says; operation order
changes a membership test in the wall; bands are clipped to the silhouette with the disc's area; a hidden-control property test (24
configurations, 144 hidden-control changes, drawing fingerprints unchanged); cancellation publishes nothing.

Mutations each shown to fail tests (dist edited, tests run, restored): twist not divided by its constant (2 failing), repeat without the slab bound (3),
mesh quads wound inward (3), hit rule `d < 0` for `d <= eps` (5), wrong Menger split (2), coverage ignoring the refinement rays (1), shell without
`abs` (1), smooth union adding the blend (3). Full `npm run build && npm test`: the full suite passes (the 1,059 baseline plus these).

## Review record (rendered, not accepted through the real interface)

Drawn through a throwaway SVG surface and rasterized with Chromium under the render lease: the default and seeds 1, 7, 42, 1234; the four forms; hollow
blocks with both operation orders; twisted and bent blocks and lattices; repeated corals; Menger 2, 3 and 5, sphere-sponge cells, tetra facets and
slice-only tetra; halftone and grain fills; yaw 0, 60, 200 (from below), pitch 89, perspective at distance 1.5, 3 and 8, roll 30 off centre; sparse
(cell 14, 24 steps) and dense (cell 2.5) sampling; mesh detail 12 and 64; three layered pairs in both orders with the unmodified Contour Scores,
Substitution Tilings and Motif Ecologies (the opaque sculpture hides what is beneath it and is crossed by what is above; the lines-only
sculpture leaves the motifs visible in both orders).

Defects found by looking, and fixed: (1) marching cubes and then marching tetrahedra chamfered every crease by up to a cell and the
hidden-line silhouettes and creases zigzagged; replaced by dual contouring. (2) A regularised least-squares vertex undershot box edges by
5 percent of the cell and an unbiased one still landed 0.06 cell off, because edge crossings were interpolated in a field that is not linear near
a crease; crossings are now found by root finding and the truncated pseudo-inverse keeps edges and corners exact. (3) Coincident cell
vertices left cracks (open meshes); they are welded and collapsed faces are counted. (4) Facets showed star-shaped fans around holes when shaded by
the field's gradient at a quad's centroid; they use the mesh's face normals. (5) Bands stair-stepped beside the outline with a dark rim; they are
now clipped to the exact silhouette domain. (6) Default seeds looked identical because only the voids were omitted while the tunnels made
every face the same; tunnel lines are thinned by the same hash. (7) Slivers of a skin thinner than a cell drew stray marks and whiskers on
faces; short chains and small closed loops are dropped and a thinner-than-cell hollow wall is refused. (8) The coral filled a third of the frame; the
default size is 600. (9) A 3 x 1 x 3 coral was refused by the worst-case work bound although it drew in half a second; the bound was
raised to 500 million (a worst case: a typical march uses a fraction). Observed and left as documented: rims of holes a few cells across
are polygons that differ from the ray-marched outline by a pixel or two; heavy twist (beyond about 2) needs more March steps and shows missing
surface otherwise; a mesh detail of 12 breaks a lattice into shards; features thinner than a cell blur.

## Timing (this machine, busy with other builds, single runs)

Large setting (5 x 5 x 5 lattice, cell 3, mesh detail 56, 160 steps, 10 slices, size 620): first prepare 3.0 s (mesh, march of about 45,000 rays, lines and
slices); the same again 3 ms; **camera-only** edit (yaw, then pitch and perspective) 0.9 to 1.0 s (march and hidden lines; the tree and mesh are reused);
**appearance-only** edit (levels, light, weights, opacity) 2 ms to prepare and about 120 ms to draw (shading and the band clipping); **structural** edit (6 cells)
2.4 s. Default: 0.45 s to prepare, 30 ms to draw. Menger level 4 at detail 40: 0.8 s; a coral with 10 branches in 3 x 3 copies: 1.5 s; a twisted and bent block: 0.5 s.
These are observations, not certified slider ranges.

## Not done

Host binding of user trees, meshes or scans (a persisted instrument names only bundled construction); a general node editor; a WEBGL
drawing; smooth-normal facets; adaptive extraction; distance-field slices at nonzero offsets; a Studio control or gallery entry.
