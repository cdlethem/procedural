# Hinged Panels (brief 51)

Status: **implemented on branch `w4/hinged-panels`, 2026-09-30; unreleased, rendered review only (SVG through Chromium), no real-interface
acceptance.** Instrument `hinged-panels`, guide `packages/instruments/guides/hinged-panels.md`. Built on the spatial foundation
F8 ([composition-spatial.md](composition-spatial.md)): the posed sheet is a foundation `Mesh`, drawn through the foundation's camera, painter order,
exact hidden-line solver and exact point-occlusion test; nothing of the visibility code is duplicated.

Code: `src/composition/hinge-tiling.ts` (flat panels and hinge graph), `hinge-fold.ts` (angle fields, spanning forest, rigid poses, closure report),
`hinge-mesh.ts` (posed panels as a Mesh), `hinge-draw.ts` (composition, camera and view stages, folded and crease drawings),
`src/adapters/hinged-panels-instrument.ts` (definition). Tests: `tests/composition-hinged-panels.test.ts` (24 tests).

## What it makes and what it removes

A flat tiling of panels folds along its shared edges into a spatial fragment while every panel keeps its name. The computation removed is the
articulated kinematics: hinge graph, editable angle field, rigid poses from an anchored panel, an honest check of the closure conditions a
tiling cannot satisfy in general, and a mesh other consumers can use. It is a **kinematic fold model**, not cloth simulation, not a
fabrication or printable-joint plan, and it does not detect panels passing through one another.

## Stages and frozen semantics

```
panelTiling ─▶ hingeAngles ─▶ foldPanels ─▶ posedPanels (Mesh)        construction, cached by structure (no camera, no appearance)
                                              │
                                     camera ─▶ paintOrder / hiddenLines / visiblePoints        view, cached by mesh key + camera
                                              │
                                     fills, hatch, lines, motifs                                appearance, recomputes nothing above
```

* **Flat frame.** Sheets live in a y-up `(u, v)` plane in **edge units** (the shortest edge is 1). Folding maps `(u, v)` to world `(u, 0, -v)`: the sheet lies
  in the world's ground plane with its front facing +y, the picture's "up" is -z.
* **Panels** (`hinge-tiling.ts`): triangles or convex quadrilaterals, counter-clockwise, ids from the tiling (`q:c,r`, `t:c,r,u|d`, `b:r,i`, Penrose tile ids).
  Bundled sources: square grid, triangle grid, brick offsets (2 x 1, one edge shared with two bricks: a T-junction), Penrose rhombs from
  `substitutionTiling` (with the lone half-rhombs at the patch edge, so the patch is connected). `panelTilingFromPolygons` accepts a caller's own
  polygons and hinges in code only.
* **Hinges** are the maximal shared segments of two panels (Penrose reuses the tiling's own edges); ids `h:<a>|<b>` (with `#n` for several segments between one pair).
  `panelBoundaryEdges` returns the uncovered remainder of panel edges (outline and cuts).
* **Identity and seeds.** A bigger grid keeps every old panel and hinge id; retention drops panels by `componentSeed(seed, id, "keep")`, so the set kept at a
  lower share is inside the set kept at a higher one. Seeded fold angles are `angle * (2u - 1)` from `componentSeed(seed, hinge id, "fold")`: a hinge keeps its
  angle when the grid grows. Anchor, share selection and per-panel tones have their own purposes. Camera, palette and every appearance control are absent from every seed and key.
* **Angles** are signed dihedral angles in degrees with the `meshEdgeAngle` convention: positive is a ridge (mountain), negative a valley. Magnitudes are bounded by
  179 (`MAX_FOLD_ANGLE`); exactly 180 would lay one panel on another. A hinge the rule does not select stays a rigid flat joint (angle 0).
* **Fields** (`hingeAngles`), all evaluated at the hinge midpoint and scaled by `amount`: `uniform`; `stripes` = `cos(2 pi t / period + phase)`, `t` the distance along
  the stripe direction from the sheet's lower-left corner; `radial` = the same wave in distance from the sheet centre; `checker` = sign by the parity of the cell of size
  `period` a quarter cell in; `seeded` = random per hinge. `disorder` blends the first four toward the seeded value. Selection: all, the family whose axis lies
  within 18 degrees of a direction, or a per-hinge random share (nested subsets). `amount = 0` is the flat sheet exactly.
* **Kinematics** (`foldPanels`). Panels are rigid: a pose is a proper rotation and a translation. Roots (anchored panels) keep the identity; a child across a hinge is
  `T_child = T_parent . Rot(flat hinge line, -theta)`, so both ends of the hinge have the same world position through either panel and the dihedral angle is
  `theta` to rounding (rotations are re-orthonormalised at every step). Tests: edge lengths preserved, orientation kept, hinge ends coincident to 1e-11, dihedral read back through `meshEdgeAngle` to 1e-9 degrees.
* **Cycles and constraints.** A hinge graph with cycles cannot honour arbitrary angles. Policy: **fold only along a spanning forest** and report every other hinge:
  `realized` (its ends meet and the panels make the requested angle), `off-angle` (ends meet at another angle: the request conflicts with the tree) or `open` (ends do not
  meet: a crack, with `gap` the larger end distance). Nothing is adjusted. `tree: "breadth"` grows outward from the anchors; `"strongest"` takes the largest |angle| first
  (a maximum spanning forest). `anchors` roots are spread by farthest point among panel centroids; panels not reachable from any anchor (retention islands) become extra flat
  roots (`counts.strays`). Analytic tests: a consistent 4-cycle closes for any tree; opposite folds on two collinear hinges give `off-angle` with `achieved = +40`; a rotation of
  80 degrees between two panels gives a gap of `2 sin 40 degrees`; the weakest hinge of a cycle is the one a strongest-first tree drops.
* **Mesh** (`posedPanels`). With no gap and no thickness the sheet is one welded surface: corners that are the same tiling vertex share a mesh vertex when the hinges between
  them are closed; an open hinge leaves separate vertices, so a crack is a mesh boundary (`2(c + r) + 2 open` boundary edges on a grid, tested). With a gap (panels shrunk toward
  their centroid) or thickness (slabs, one closed manifold component per panel, signed volume = area x thickness, tested) every panel has its own vertices. Face attributes `panel`, `role`.
* **Ownership.** Tilings, folded values and meshes are frozen objects; typed arrays inside them (`angles`, `pose`, `parent`, `order`) are builder-owned read-only views by convention
  (typed arrays cannot be frozen). Everything is cached by construction key (tiling key, angle content hash, closure, mesh options).
* **Bounded work.** At most **4,000 panels** (a grid is counted before retention; Penrose after substitution); folding angle 179; anchors 16; gap 0.9; thickness 4 edges. The
  painter's order and hidden-line solver keep the foundation's `maxWork`; a fold that exceeds it throws naming Columns and Rows, Substitution depth or Thickness. Nothing truncates.

## Controls (groups, dependencies)

Groups in order: **Panels** (source, `Grid` = columns, rows *proportional*, patch, depth, retention), **Fold** (rule, angle, direction, period, stripeAngle, phase, disorder, amount, hinges,
hingeAxis, hingeShare), **Closure** (tree, anchor, anchors), **Body** (gap, thickness), **Placement** (centerX, centerY, size, fit, roll), **View** (projection, yaw, pitch, perspective),
**Drawing** (treatment, fill, colorBy, opacity, `Light`, `Hatch`), **Lines**, **Motif**. Only `Grid` is proportional (columns and rows share a unit and zero means none of it).

Inline `visibleWhen`: columns, rows on grid sources; patch, depth on Penrose; direction on uniform/stripes/radial; period on stripes/radial/checker; stripeAngle on stripes; phase on stripes/radial;
disorder unless seeded; hingeAxis on one-direction; hingeShare on random share; thickness, fit, projection, yaw, pitch, hidden only when folded; perspective when folded and perspective;
opacity when filled; shade, lightAzimuth, lightElevation when folded and shaded; hatch settings when hatching; motif settings by mark kind. **Left visible on purpose** (relevance is a
disjunction a conjunctive condition cannot state): `colorBy` (fills or motifs), `lineWeight` (lines, cracks), `anchor`, `anchors`, `roll`. The suite's conditional-control property
test covers the instrument like every other; a test compares a crease pattern under changed view, thickness and light controls call for call.

Slider intervals versus hard limits: fold angle slider 0-150, hard 0-179 (geometric); columns and rows slider 2-24, hard 1-200 with the 4,000 panel product bound; thickness slider 0-0.5,
hard 0-4; gap slider 0-0.5, hard 0-0.9; depth slider 1-5, hard 0-8 (sun depth 6 = 1,925 panels, depth 7 = 5,000, refused naming Substitution depth).

## Treatments

* **Folded**: painter's algorithm over mesh triangles, each lit by a fixed world light (the light does not move with the camera); panels seen from behind are paler; panel hatching is
  drawn in each panel's flat coordinates and clipped to the painted triangle in screen space; hinge lines, cracks and outline go through `hiddenLines` (visible runs solid, hidden runs dropped or faint);
  panel motifs are placed through the panel's projected affine frame (a foreshortened, mirrored-from-behind mark), and hidden through `visiblePoints`.
* **Crease pattern**: the same panels, gap, fills, hatch, fold signs and closure report drawn flat: mountains dash-dot, valleys dashed, flat hinges thin, cracks dotted, outline solid. It builds no pose, no mesh and no camera and is a
  layer of its own. An edge-only folded drawing (`fill: none`, `lines: panels`) stays legible with hidden lines dropped.

## Verification

24 tests with independent expected values: closed-form panel and hinge counts, areas and the perimeter identity (`sum perimeters = 2 x hinge length + outline length`) on all four sources including T-junctions; Penrose rhomb edge lengths, areas and Euler characteristic 1; id stability and nested
retention; every fold field against its analytic formula; seeded angles tied to hinge names, disorder 0 and 1, nested random shares; rigid-body invariants on random angles for every source and both tree policies; the flat state as an exact identity; dihedral angles through `meshEdgeAngle`; the closure cases above; anchors and islands; error messages
naming controls; areas, normals, gap and slab volumes of the mesh; camera and appearance reusing the pose and mesh objects while structure does not; drawing counts (triangles painted once, hatch line counts, motif occlusion behind a standing wall, crease styles, edge-only drawings); the instrument's controls, groups, visibility and seed use.

Eight mutations were each shown to fail at least one test: fold sign flipped (3 tests), pivot at the origin (3+), strongest-first reversed (1), open hinges welded (3+), checker offset on one axis (1, after adding the triangle check), stripes origin at the centre (1), motifs ignoring occlusion (1), child side not oriented (2).

## Review record (rendered, not accepted through the real interface)

Drawn through the throwaway SVG surface and rasterized with Chromium under the render lease: the default at three seeds and from four cameras (perspective and orthographic, from above, below and top-down); the flat state (`amount 0`, top-down) against the crease pattern;
nine structural settings (scroll with hatch and arrow motifs, accordion slabs with gaps, Penrose sun depth 4, radial triangles, checker bricks, wire model, retention with three anchors, crease pattern with rosettes, a 40 x 30 dense sheet); extremes (2 x 2 with cracks, near-plane perspective, slabs 0.5 with gap and hatch, half-folded and fully folded (179) accordions, roll, sparse hinges at 150 degrees, valley triangles, dense Penrose wire);
and layered pairs in both orders with the unmodified Contour Scores and Motif Ecologies (opaque panels hide the contours beneath them and are crossed by them above; pale panels reveal them), a crease pattern beside its fold, and a wire model under motifs. Depth is real: panels in front hide those behind in every view, the underside reads paler, and the dome's rim visibly passes in front of its own body.

Defects found by looking, and fixed: (1) the stripe wave measured from the sheet centre put its zeros on hinge rows (an accordion came out flat): the origin is now the lower-left corner and the wave a cosine; (2) a folded form shrank to a speck when it curled (a ball at 60 canvas units): *Scale to* chooses between the flat sheet's and the folded form's diagonal; (3) purely seeded angles gave a shapeless crumple as the only structure: a *Disorder* blend lets a coherent rule (scroll, pleats, checker) be roughened, and the default is a dome with tassels; (4) Penrose with whole rhombs only left isolated rhombs lying flat around the fold, which dominated the framing: the patch keeps its lone half-rhombs and is connected; (5) cracks drawn in the accent colour vanished against panels of the same colour: they are ink now; (6) a retention share could slip a large grid under the panel limit: the grid is counted before retention.
Observed and left as documented: a hinge line can show through a crack between panels (the crack is real); heavily folded slabs at the 4,000 panel bound exceed the painter's work budget (62 x 62 slabs are refused naming Thickness); panels that pass through each other are drawn by the painter's order where it can decide and are otherwise unconstrained.

Timings (this machine, busy, single runs; observations, not certified ranges): first preparation of a 62 x 62 square sheet (3,844 panels) 345-740 ms, a camera-only edit 570-940 ms (painter order and hidden lines; the mesh is reused), an appearance-only edit (colour, light, hatch) 34-73 ms, a structural edit (angle, seed) 620-1,050 ms; 40 x 40 slabs (1,600 panels, 9,600 faces) prepare in 1.5 s, camera edit 1.7 s, appearance 30 ms; 44 x 44 triangles 72 ms prepare; Penrose depth 6 (1,925 panels) 72 ms; the default sheet 7 ms.

## Not done

Host binding of a user's own mesh as the panel source (the instrument names bundled tilings only; `panelTilingFromPolygons` is the code path), self-intersection detection and dynamic (cloth) simulation, hexagonal or non-convex panels, a WEBGL drawing, real-interface review.
