# Differential surface growth (brief 50)

Status: **implemented on branch `w4/surface-growth`, unreleased.** One instrument, `surface-growth` ("Surface Growth"),
built on the F7 snapshots and the F8 spatial foundation. Code: `packages/instruments/src/composition/{growth-seeds,growth-field,surface-growth,surface-growth-controls,surface-growth-draw}.ts`,
`src/adapters/surface-growth-instrument.ts`; guide `packages/instruments/guides/surface-growth.md`; tests
`tests/composition-surface-growth.test.ts` (30). Not certified through the real interface: the review below is SVG
through Chromium (2D projection, occlusion, hidden lines), not WEBGL and not the private Studio.

## What it makes, and what it does not claim

Ruffled sheets, frilled discs and growth-constrained skins whose regions of expansion are editable. The surface is a
triangulated mesh that actually evolves: a growth field raises the rest lengths of edges where it is high, the skin is
relaxed in 3-D, and over-long edges are split. A ruffle here is the result of that evolution; nothing is a noisy sphere
(the `Perturbation` control is only the symmetry-breaking nudge a flat compressed skin needs, and with it at 0 the
skin stays exactly flat, which is tested). It is a bounded spring-and-hinge model: **not cloth physics, not a
finite-element membrane, not a biological model, and no fabrication claim.**

## Model

Material coordinates `m_v` (the seed's positions), per-vertex growth scale `S_v >= 1`, per-vertex driving value
`G_v = field(m_v)` in [0, 1]. Rest length of an edge `{a, b}`: `r = |m_a - m_b| (S_a + S_b) / 2`. Energy:
`sum_e (len - r)^2 / (2 r)` plus `sum_h k_h (theta - theta0)^2 / 2` over interior edges, `theta` the signed dihedral
deviation (`hingeAngle`, gradient checked against finite differences), `theta0` the dihedral of the same four vertices
in material space (0 for a flat seed, so a sheet rests flat and a sphere rests round), `k_h = bending * 3 r^2 / (A_1 + A_2)`
with areas from the rest lengths (Heron), so bending does not change with resolution (`bending` is a rigidity in
stretch-modulus x seed-length^2; plate thickness about `sqrt(12 bending)`). One step, fixed order:

1. **Growth**: `S_v <- min(limit, S_v (1 + rate G_v))`, index order. Growth has ended when every driven vertex is at `limit` (`growing` in the frame); from then the skin only relaxes (tested: energy never rises).
2. **Refinement** (optional): in at most 2 passes, edges longer than `edgeLimit * meanEdge` are taken longest first (ties by edge id), no triangle twice per pass, and bisected at their current midpoint *with both adjacent triangles* (conforming; winding of every triangle preserved by construction; Euler characteristic preserved). The newborn vertex takes material position = midpoint of its parents', `S` = their mean, `G` = **the field evaluated at the new material point** (not interpolated), so refinement sharpens a field and never moves it; the two halves of a split edge have rest lengths summing exactly to the parent's (tested). When `maxVertices` would be exceeded the remaining candidates are refused, counted (`deferred`) and reported; nothing else truncates.
3. **Relaxation**: up to `sweeps` Jacobi sweeps of the Gauss-Newton-preconditioned gradient (`omega 0.5`, each move clamped to a quarter seed edge); a sweep whose largest move is under `2e-5` seed edges ends the step early. Pinned vertices never move. Optional contact (`thickness`): vertices that are neither neighbours nor share a neighbour and are closer than `thickness * meanEdge` repel (a bounded 3-D hash grid, pairs found once per step). **Self-contact is scoped, not solved**: contact acts between vertices only; faces can still cross between vertices.
4. **Collapse check**: a triangle with `|cross| <= 1e-9 longest^2` throws naming the step, `v:a, v:b, v:c` and the controls to change.

### Identity, ownership, units

Vertices are born in index order and never removed: index `i` is id `v:<i>`, a seed vertex is `v:0..N-1`, a newborn
records `parentA < parentB`, `birth` step and `generation` (mesh attributes). Faces are re-derived and carry no stable
identity (a split replaces a triangle by two); the brief's "lineage where stable" is the vertex lineage. The initial
normal perturbation of vertex `i` comes from `ctx.stream("v:<i>", "perturb")`, so it does not depend on how many other
vertices exist. Units: seed units (disc, sphere radius 1; sheet half width 1; strip half length 1.5, half width 0.375);
angles are radians inside the model and degrees in the controls. Every producer returns frozen, content-cached values.

### Result

`grownSurface(snapshots, step?)` returns `{ mesh, step, frame }`: a validated F8 `Mesh` with vertex attributes
`growth` (S), `field` (G), `stretch` (mean over incident edges of `len / r - 1`, positive in tension), `birth`,
`generation`, `parentA`, `parentB`; `frame` is the plain diagnostics (vertices, triangles, splits, deferred, residual, energies, growing).
Cached per snapshots and step; the snapshot runs are cached by content through the shared `SimulationCache`
(4 runs, 10M stored values, checkpoints every 25 steps, history every step): extending reuses the run, scrubbing down
replays from a checkpoint, cancelled runs store nothing, and `checkSimulation` proves bit-identity, prefix, resume,
spacing and cancellation invariance (tested with refinement, a pin and contact on).

## Stages: camera and material never reach the growth

| Stage | Key | Edits that recompute it |
|---|---|---|
| run | seed surface, resolution, field, rate, limit, steps, bending, pin, sweeps, contact, refinement, seed (perturbation and noise) | any construction control |
| mesh | the run and the step | Steps |
| view | mesh key, camera key, crease angle, level quantity, grain count | camera, crease, levels, grains |
| appearance | nothing cached | palette, colour, opacity, weights, materials, light |

The camera frames the grown mesh (target = centre of its bounds, `size` = canvas radius of its bounding sphere about
the target, `distance` in those radii), so a grown skin fills the same canvas; an orthographic camera uses a constant
distance so the hidden eye-distance control is truly irrelevant. Tested: camera and palette edits return the same
`Snapshots` and `Mesh` objects; a growth, field, bending or seed edit changes the run key.

Drawing uses the foundations and does not re-implement them: `paintOrder` (exact painter order), `hiddenLines` +
`meshFeatureEdges` + `meshEdgeCurves` (silhouette, rim, creases, wire), `isoContours` (level lines), `sampleSurface` +
`visiblePoints` + `projectPoints` (grains), `motif`, `pathMaterial`, `strokeWith`, `atEach`. Tested against independent
expectations: on an untouched icosphere drawn orthographically the visible wire is exactly the edges having a
front-facing face (total projected length to 1e-6), the faded ink covers exactly the rest, and painted faces are
exactly the front-facing triangles.

## Limits and bounds (measured, not certified slider ranges)

* Hard limits (`GROWTH_LIMITS`): steps 1,200, vertices 16,000, sweeps 60, rate 0.2, growth limit 8, bending 1, contact 1.5 seed edges, edge limit 1.1..4. Each failure names the control.
* Work bound: the run declares `steps x worst-case step` (every step at the vertex limit: `16 V sweeps + 70 V (1 + passes) [+ contact]`) and refuses over 400 million units naming "Steps, Relaxation or Vertex limit". About 25 ns per unit on this machine, so the worst case costs about 10 s and typical runs a fraction of it.
* Slider intervals are narrower, chosen so that **every numeric control at its slider maximum at once** is valid and costs about 1.7 s of CPU (first preparation plus draw): steps 0..160, vertex limit 300..1,400, resolution 8..24, sweeps 4..16 (the default reaches 1,176 vertices, so the default vertex limit is 1,400). An earlier version allowed steps 300, vertex limit 4,000, resolution 30 and sweeps 40; its all-maximum corner was refused by the work bound and the nearest valid corner cost 5 to 7 s, which the real-interface review measured as 3.4 s for a corner of it. Drawing controls (grains, levels, wire) cost under 10% of the run and are not the limit.
* Declared cost at the slider maximum of everything: 1,400 vertices x 16 sweeps with contact gives 0.88M units per step, 140M units over 160 steps (measured about 18 ns per unit when the run uses its sweeps, so 2.5 s if every unit were spent). The hard maxima of every control together (steps 1,200, vertex limit 16,000, sweeps 60, contact on) declare 34,000M units and are refused by name, never attempted.

## Controls and dependencies

Groups in order: Seed surface; Placement (centre X/Y, size); Growth field (with a proportional `Ring` subgroup: radius and width); Growth; Skin; Refinement; Faces (with `Light`); Color; Lines (with a proportional `Line weights` subgroup); Grains; View. All `visibleWhen` are inline:
`pin` (seed is not the sphere), field numbers by field kind, `spotX/Y/Width` (hot spot), `edgeLimit`/`maxVertices` (refine), `faceOpacity`/`backFaces` (faces not none), light controls (facets or smooth), `creaseAngle`/`contourWeight` (contours), `wireWeight` (wire), `hiddenOpacity` (faded hidden lines), `levels`/`levelWeight` (level lines), `distance` (perspective). Left visible because their relevance is a disjunction a conjunctive condition cannot say: `hidden`, `lineMaterial` (any of contour, wire, level lines), `colorBy` (faces or grains), `grainMark`/`grainSize` (grains > 0 is numeric). Hidden controls are normalized away in the construction (pin ignored on the sphere; refinement numbers fixed when refine is off), tested by changing 23 hidden controls and comparing drawing fingerprints.

## Timings at the slider corners (CPU time, 2026-09-30, machine load average about 8)

| Setting | First preparation + draw (CPU) |
|---|---|
| Defaults (disc 16, edge growth, 150 steps, 1,176 vertices reached) | 0.85-0.90 s |
| Every numeric control at its slider maximum (edge limit 3, so few splits) | 1.67-1.69 s |
| The same with the finest edge limit 1.2, wire and level lines on (the most expensive reachable setting) | 2.45-2.51 s |
| Every numeric control at its slider minimum | 0.04 s |
| Every control at its hard maximum | refused by the work bound (34,000M units declared against 400M) with an error naming Steps, Relaxation and Vertex limit |

Camera, palette and appearance edits at these corners recompute nothing of the run (see the stage table above).

## Verification

`tests/composition-surface-growth.test.ts` (30 tests, independent expectations; the last sets every numeric control to its slider minimum and maximum alone, then all minimums, all maximums and the most expensive reachable corner together, and requires `validateInstrument`, drawing and a charged work within the declared bound, and requires the all-hard-maximum setting to be refused): closed-form seed counts, areas (the disc's regular polygon), Euler characteristics, orientation; rejection of quads, non-manifold, flipped, unused-vertex meshes; analytic field values (edge smoothstep, Gaussian ring, stripe cosine, combine max/sum/multiply, baseline lift); bilinear grid field; field identity by content; hinge angle known folds, finite-difference gradient, rigid-motion balance; bitwise rest of an unstretched skin; uniform free growth scaling exactly by the limit (positions, bounds, strain 0); `S = min(limit, (1 + rate G)^steps)` per vertex with `G` recomputed independently; exactly flat without perturbation and ruffling (amplitude against the initial bound, rim length near `limit x` seed rim) with one; monotone energy after growth ends; conforming, orientation-preserving refinement with Euler 1 (open) and 2 (sphere) and area `limit^2 x 4`; newborn transfer of position, scale, field and rest length; ids and lineage stable as steps grow; vertex-budget counting; every control naming itself; pins; contact separating two sheets to the contact distance and leaving a flat sheet alone; collapse report; `checkSimulation`; extension equal to scratch; cancellation; the wire and painter integrations; camera/palette independence; hidden controls.

Mutations shown to fail (failing tests in brackets): flipped hinge gradient sign (2), newborn field averaged instead of evaluated (1), split flipping the new triangle's winding (9), pins ignored (1), newborn scale from one parent (1), vertex budget off by one (1).

## Review record (rendered, not accepted through the real interface)

Drawn through the throwaway SVG surface and rasterized with Chromium under the render lease: the default and seeds 7 and 1234567; a sheet with stripes pinned on one side, a sphere grown from a pole spot, a strip with blobs; a rim-pinned sheet as wire and contours (orthographic), a ring-growth disc as a translucent flat skin with height level lines, edge plus hot spot coloured by stretch, a noisy sphere with depth colouring and grains, a disc with contact, a coarse unrefined disc as facets; camera moves (top-down, low oblique, roll, close perspective, underside, orthographic side), dense (resolution 30, 4,000 vertices) and sparse (resolution 8, no refinement) wire, and a combined translucent faces + faded wire + level lines + rosette grains picture; three layered pairs in both orders with the unmodified Motif Ecologies, Contour Scores and Optical Plates.

Defects found by looking, and fixed:
1. The first bending stiffness (`bending` 2, relative to stretching) was a plate 5 disc-radii thick: the disc stayed exactly flat under 2.5x rim growth. Rescaled to a rigidity (default 0.0004) and verified against the flat/ruffled tests.
2. Colour by growth saturated to one colour, because with the first rate nearly every band vertex reached the limit. The default rate was lowered to 0.012 and the limit raised to 3 so the ramp crosses the band; stretch colouring was scaled by the 95th percentile of the skin's own strain after a fixed scale showed one flat colour.
3. A fixed zoom let a grown sphere overflow the canvas; the camera now frames the grown mesh (size = bounding radius), and the eye distance is in those radii.
4. Flat triangle shading showed coarse facets; normals are now smoothed across triangles by default (`Facets` remains as a choice).
5. Jacobi relaxation converged slowly in the uniform-scaling mode and stopped early at a sweep move of 1e-4: a grown sheet came out 0.2% small. The settle threshold is now 2e-5 seed edges.
6. Sliders that individually were fine could combine past the work bound (default settings with steps 400): the bound and slider maxima were rebalanced so the default fits with steps up to 300, and the error names the controls.

Timings (this machine, load average 60 to 90 while measured, so read as upper bounds; CPU-ms / wall-ms): default first prepare 1,369 / 8,516 (0.7 s wall on a quieter machine before the settle threshold was tightened), first draw 166 / 282; camera-only 99-172 / 99-142; palette or colour-only 15-26 / 9-15; steps +1 157 / 168; steps -1 508 / 791; a structural edit (rate) 1,534 / 3,688. Earlier large setting, now beyond the sliders (resolution 30, edge limit 1.25, 4,000 vertices, 240 steps; reachable only through the code API): first prepare 10,153 CPU-ms, structural edit 10,069, camera-only 385-421, palette-only 86, steps +1 438, steps -1 1,029.

## Decisions on undecided boundaries (conservative)

* Every option of every select draws from the defaults (tested). On a closed seed the instrument's `Edge` field falls back, deterministically, to a radial cap at the pole (`centerX = centerY = 0`, radius 0, width = Band width); it is the same cached run as choosing `Ring` with those numbers. The typed `growthField` API still refuses an edge region on a closed seed by name.
* The vertex budget is a *model* rule with a visible counter, not an error: a run reaching it keeps stretching without splitting (an error would make scrubbing Steps upward fail at an arbitrary step). The hard ceilings and the work bound do throw.
* Seed meshes live in this brief's module, not in the F8 `bundledMesh` list (they need triangles only and carry pin sets); nothing was added to the F8 modules.
* Faces have no stable ids; vertices do.
* Hidden-line removal is only as exact as `visibility.ts`; a painted skin that cuts through itself (self-contact not modelled) is painted by the exact painter order where the order is decided and by its documented fallback otherwise.
* The preparation path (`prepareInstrument`) runs the growth cooperatively in 8 ms slices and stores nothing when cancelled.

## Not done

Host binding of a user's own mesh or growth field (the code API takes any triangle `Mesh` and a sampled `gridGrowthField`; the instrument names bundled seeds and field kinds only); solved self-contact (face-face), remeshing by edge flips or collapse (only splits), stable face ids, growth driven by a field that evolves during the run, a Pattern Competition field wired in (the direct API accepts its raster through `gridGrowthField`), WEBGL and real-interface checks.
