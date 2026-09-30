# Geological Cutaways (brief 46)

Status: **implemented on branch `w4/geological-cutaways`, unreleased. Reviewed from rendered output (SVG through Chromium) and package tests
only; not exercised through the real Studio interface.** Guide: `packages/instruments/guides/geological-cutaways.md`. It is built on the
[spatial foundation F8](composition-spatial.md) (meshes, topology, sections and contours, cameras, hidden lines, painter order), the
[planar domains F4](composition-domains.md) and the frozen [composition boundary](composition-reference-slice.md). It draws projected
geometry on a 2D canvas: no WEBGL is used or claimed, and nothing here claims geological simulation, scan reconstruction or physical
fabrication.

## What it makes and what it reuses

A block of strata with tilt, sinusoidal / chevron / dome folds, a family of parallel planar faults that displace every layer along the
fault plane, and an eroded ground surface, cut open by a slice plane, a corner box or exploded halves. The stated model is a stack of horizon
functions `y = Y_w(x, z)`; the produced values are the block Mesh with one attribute per layer, the erosion surface mesh, exact cut faces
(a `PlanarDomain` per stratum and fault compartment, holes where an older stratum is exposed) and typed lines.

| Concern | Source |
|---|---|
| Model, faults, erosion, inverse map | `composition/strata.ts` (new) |
| Block mesh of closed bricks, erosion surface | `composition/strata-block.ts` (new), on `mesh()` |
| Cuts, cut faces, lines | `composition/strata-cut.ts` (new): `sliceMesh` for the sections, `ringsDomain` / `domainIntersection` / `unionDomains` / `clipPath` for the regions, `isoContours` for outcrops, bedding and contours on the ground |
| Painter order and hidden lines | `paintOrder(view.mesh, camera, {cull: "back"})` and `hiddenLines(view.mesh, curves, camera)` (foundation, unchanged) |
| Composition value, drawing, preparation | `composition/strata-draw.ts` (new) |
| Instrument, groups, conditions | `adapters/geological-cutaways-instrument.ts` (new) |
| Added to the foundations | `composition/polygon-triangulate.ts`: ear clipping of a region with holes (the planar-domain foundation stops at regions; cut faces have to enter the painter as triangles). Tested against the analytic annulus and random star regions with holes. |

## The model

Coordinates are those of the mesh foundation (+Y up, right-handed); the block is `x in [-1/2, 1/2]`, `z in [-D/2, D/2]`, `y in [0, H]`, W = 1 the unit of
length, front = +Z, right = +X. Everything is a fraction of W or H. Strata are numbered from the oldest (0, extending to the base) to the youngest (n-1, extending
to the ground); horizon `w` lies between `w-1` and `w`.

```
Y_w(x, z) = level_w + trend_w x / W + tilt(x, z) + fold(x, z),     thickness_k(x, z) = stack H r_k (1 + trend s_k x / W)  > 0
```

with `r_k` the relative thicknesses of the internal strata from the chosen sequence and contrast, `s_k = ±1` alternating, so **horizons never cross**: the
difference of two consecutive horizons is the closed-form positive thickness (tested against the formula, and every built sheet rises by at least the
floor at every vertex of 40 random models).

**Faults.** The planes are `p - kappa (y - H/2) = c_j` (`p` across the strike, `kappa = cot(dip)`, signed by the dip direction), all parallel. A fault with
signed throw T moves its hanging wall (the side above the plane) along the dip vector `(kappa, 1)` down by T. The displacement lies in the plane, so there is
neither gap nor overlap, and because every slip is along the shared dip vector a fault never moves another fault's plane: displacements add and the order of
faults does not matter. Compartment i moves by `-S_i (kappa, 1)` (`S_i` the sum of the throws of the faults it is the hanging wall of) and its final horizon is
`y = Y_w(p + kappa S_i, q) - S_i`. **The offset across a fault is exactly T vertically and kappa T horizontally, whatever the folds** (tested for five
configurations from the solved sheets: sinusoidal, chevron, dome, both dip directions, both strikes, alternating, mixed and reverse faults).

**Erosion** is `ground = H - relief H E(x, z)` with `E` in [0, 1] a seeded sum of three sinusoids. It cuts the strata (outcrop) and is not displaced by faults.

**Inverse map** (`stratumAt`, the oracle of the tests): undo the throws of the faults the point is hanging wall of, then count the horizons at or below it.

**Validity by steepening, not refusal.** A column-by-column build needs each horizon to cross a plane once per column: (steepest slope across the strike, sampled over the model, +5%) times
`kappa` must stay under 0.92, for horizons and ground; and a plane's base-to-top trace must span at most 60% of the room left inside the walls. A requested dip that breaks either is **steepened to the
shallowest that does not** (`model.dip` is the angle used; offsets are exact for that angle, tested with a finite-difference slope oracle), and the fault family is compressed and slid so every
trace stays inside the walls (compartments are never under 4% of the block). Every input is checked (`Strata must be a whole number from 2 to 16 ...`); nothing is clamped silently, except that the dip is documented as a request.

## The block mesh

Compartment i is a strip bounded by two planes (or block walls), parametrised by `(zeta, q)`; the sheet of horizon w is the fixed point `y = G_w(p(y, zeta), q)`,
solved by bisection (60 iterations, machine precision; the map is monotone because of the slope condition). Sheets are clamped to `[previous + floor, ground - (n - w)
floor]` with `floor = 1e-5 H`; because graphs ordered pointwise have fixed points ordered the same way at the same `(zeta, q)`, the clamp keeps every point on its own
horizon or the ground and **every stratum keeps at least `floor` at every vertex**, so a stratum that is eroded away or pinched out thins to a sliver instead of
vanishing (a weld-and-drop design was tried first and made non-manifold edges where a pinch was exactly one edge wide). One brick per (stratum, compartment): top sheet, bottom sheet
and four walls, every one a closed manifold. The merged mesh has face attributes `stratum`, `compartment` and `role` (horizon up/down, ground, base, outer wall, fault wall).

Tested: the merged mesh is closed-manifold with no unused vertex; components equal bricks; every brick has positive volume; **the volumes of the bricks add up to
W D H exactly (1e-9) with flat ground**, and to the volume under the ground mesh with relief; **260 random points per configuration are inside exactly one brick
by ray parity, and that brick's stratum and compartment equal the inverse-map oracle** away from contacts.

## Cuts, sections and lines

`slice`: the plane's +normal side is removed, the plane exposed. `corner`: `sx x > W/2 - cutWidth W`, `sz z > D/2 - cutDepth D`, `y > H - cutHeight H` removed, three faces
exposed, each restricted to the removed box by a Boolean intersection with the wedge of the other two half-planes. `exploded`: the plane splits the block and the far half moves
`gap × diagonal` along the normal. Each kept piece is an intersection of half-spaces, so shell polygons clip exactly. The erosion surface is split by horizon inside each triangle
by the linear interpolation of `horizon - ground` (the same scalar `isoContours` traces). Sections come from `sliceMesh` on the block mesh; each loop is a closed loop of one brick; the loops of a
(stratum, compartment) become a domain by even-odd fill; regions under `SECTION_MIN_AREA` (the floor slivers) are dropped. Tested: a vertical slice's stratum areas add up to
the face (1e-9) and 500 random points lie in the region of their own stratum (99%); a horizontal slice through domes has a ring whose middle is another stratum; **the kept volume
after a corner, slice or explosion equals the analytic box minus the removed box** to 5e-7 (the dropped slivers), with faults and folds inside; the painted ground and wall triangles agree with
the oracle at 100% away from contacts; bedding lines lie in their own stratum (97%); every fault line lies on exactly one fault plane.

Lines: `outline`, `contact`, `fault`, `bed` (contours of the stratigraphic coordinate on the ground, sections of interpolated bedding sheets on cut faces, border rows on walls),
`contour` (topographic). Hidden lines come from `hiddenLines` against the kept surfaces; the policy (drop or dash) is the consumer's.

## Stages, seeds, ownership

`geologicalProducts(recipe)` returns model, block and view, each frozen and cached by its own construction: **the camera, palette, fill, shading and line weights never rebuild
or re-cut anything** (tested by identity of the block and view objects across a camera move, a palette change and a material change), a cut edit reuses the solved strata (the
same sheet arrays), and only strata, tilt, folds, faults, erosion, block shape or grid resolution build a new block. Seeds use `componentSeed(seed, id, purpose)`
(`fold/phase`, `stratum:k/thickness`, `fault:j/position|throw|sense`, `relief:i/direction|phase`): adding a fault or a stratum re-rolls nothing else. `usesSeed` is exact (tested against
drawings). Values are owned by the module that built them and are never mutated. The persisted form is the technique id, scalar parameters and a palette; user meshes and scans are future host work.

## Controls

Groups (construction first): **Strata** (strata, sequence, contrast, stack, trend), **Placement** (centerX, centerY, size), **Tilt**, **Folds** (type, amplitude, wavelength, axis, phase),
**Faults** (toggle, count, throw, dip, strike, dip direction, pattern, position, scatter), **Erosion** (ground, relief, valley spacing), **Block** (proportional `Proportions`: depth,
height; resolution), **Cutaway** (kind; `Slice`; explosion; `Corner`), **View** (projection, yaw, pitch, distance), **Fill**, **Lines** (proportional `Line weights`: five
thicknesses in one unit). Conditions are inline: fold controls under a fold type, fault controls under the Faults toggle, erosion under Eroded, contrast under a non-uniform sequence, slice/corner/explosion controls
under their cut, viewing distance under perspective, shading under Shaded, opacity under any fill. Numeric drivers cannot be conditions, so the fault, fold and erosion switches are a toggle and selects.
The shared control audit (`tests/helpers/audit-controls.ts geological-cutaways`: 56 controls, 2,319 probes over 30 sampled contexts, 20 minutes on a busy machine) reports
**0 violations**. It proposed two conditions, both adopted inline (`contours` under Eroded, `faultWeight` under Faults; the audit ran before the first was written inline, the
conditions are identical to its proposals and it was not repeated); `contourWeight` is dead where `contours` is 0 (a numeric disable, left visible) and `colorBy` is disjunctive
(it colours fills and, with Line color by stratum, lines) so it is left visible. The suite's random hidden-control property test covers the instrument as well as the direct hidden-control test in this brief's tests.

## Limits

`BLOCK_LIMITS`: 160,000 vertices, 190,000 triangles (the mesh foundation refuses 200,000 faces), grid 8 to 120 (slider 16 to 48; Bedding lines slider 0 to 4), refused before anything is solved with Grid resolution, Strata and
Faults named; bedding sheets 140,000 vertices (Beds); 16 strata, 6 faults. Timings are below; an eroded stratum keeps `1e-5 H`; contacts beside
a stratum thinner than 0.4% of the height are not drawn. The default `hiddenLines` and `paintOrder` budgets are raised to 2·10^8 work units per view; the drawing charges its triangles and line points to the run (default 600,000).

## Checks, mutations and review

`tests/composition-geological-cutaways.test.ts` (16 tests): monotone horizons (closed-form thickness, 40 random models), the exact throw across every fault from the solved sheets, the inverse-map oracle
against the sheets, closed bricks / exact tiling / point ownership by ray parity, volume under an eroded ground, sections as a partition of the face and dome rings, kept volume of every cut
against the analytic box, triangulation of annuli and random star regions with holes, stage separation by object identity, hidden-control invariance and `usesSeed` against drawings, named errors, fault
lines on their planes, hidden-line occlusion, the painted outer surface against the oracle, and the control conditions. **Nine mutations each fail at least one test** (run on a copy of the package):
fault shift sign (5 tests), fault planes taken as vertical in the builder (7), trend sign drift (1), corner wedge on the wrong side (1), ground outcrop split with the wrong stratum (4), brick walls inward (5),
exploded far piece not moved (1), hidden lines that see through the block (1), inverse map without the horizontal slip (1).

Looking at the rendered SVG (Chromium, 2D canvas projection; not the Studio) found and fixed: a weld-and-drop treatment of pinched-out strata that made non-manifold edges (replaced by the floor thickness); mesh face
limit hit by 16 strata at high resolution (limit now checked up front, slider maximum 60); a hairline of the wrong stratum colour along the top of a wall where a stratum is eroded (floor slivers stay in the surface but are
never painted); edge-only stratum colours too pale as lines (darkened); an analytic slope bound that refused reasonable erosion with faults (now sampled, and measured across the strike only); an exploded block seen from the side that hid its own cut face (the
guide now recommends a horizontal plane seen from above, where both slabs read). Images reviewed: the default at seeds 1, 2 and 3; six structural settings (undeformed tilt with flat ground, chevron and alternating grabens in a slice,
domes cut by a horizontal slice, an oblique exploded block, reverse faults with strike across the picture in perspective, edge-only with dashed hidden edges); six extremes (14 strata and 5 faults, 3 strata, top-down at yaw 200,
strong thinning, ramp colours at 0.8 opacity, a refused erosion depth); six cameras (front, right face, perspective from the left, from behind, from below, near top-down perspective); six combined settings (domes with faults and an oblique slice,
a horizontal exploded graben, thin beds at high resolution, large relief with vertical faults and contours, strong wedging, reverse faults at 45 degrees); and the layered pairs with Contour Scores and Motif Ecologies in both orders.

Timings (development machine while other agents and a 20-minute audit ran, so upper bounds; ranges are default / large: 12 strata, grid 58, 3 faults, 2 bedding lines, 6 contours, 71,064 vertices):
first prepare 0.8 s / 0.8 s, camera-only edit 0.10-0.13 s (paint order and hidden lines), appearance-only edit under 20 ms, a cut edit 0.35-0.39 s (strata reused), a structural edit or a new seed 0.55-0.65 s.
Drawing into a null surface takes 6-25 ms; the canvas cost of the 9,000-15,000 triangles and 300-500 lines was not measured.

Open concerns: only parallel faults of one dip are modelled (crossing fault sets need a different construction of compartments); a horizon steeper than the fault dip is refused, not meshed; bedding is proportional to
thickness (parallel to contacts) and not a separate model of sedimentation; sections of a stratum eroded to its floor are sub-pixel and omitted, so a wedge tapers to nothing at 1e-5 of the block width squared; the Studio
interface, layer persistence and export were not exercised.
