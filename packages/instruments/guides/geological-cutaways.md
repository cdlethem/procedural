# Geological Cutaways

A block of rock seen the way a geologist draws it: layers that dip, fold and break along faults, an eroded ground surface
where the layers outcrop as coloured bands, and a section cut open to show the inside. The starting study is an eight-unit
stack tilted a few degrees, folded into gentle waves and cut by two parallel normal faults, with valleys eroded into its top
and a box removed from the near right corner, so the front face, the right face, the ground and the three faces of the
notch are all drawn from the same model. It is not a coloured height map: the strata are solids with thickness, every
layer on the far side of a fault is displaced by exactly the declared throw, and each cut face is an exact section of those
solids, painted region by region.

Everything is built from the geology. Changing the camera, the palette, fills, shading or line weights never rebuilds the
block. Changing the cut (slice, corner, explosion) re-cuts the same strata: the layers, folds and faults do not move or
reseed. Changing strata, tilt, folds, faults, erosion, block shape or grid resolution builds a new block. The seed draws the
fold phase, random thicknesses, scatter of fault spacing and throw, the sense of mixed faults and the shape of the valleys;
with folds off, uniform thickness, no scatter and a flat surface it changes nothing.

## The strata

| Controls | What changes on the canvas |
|---|---|
| **Strata**, **Thickness sequence**, **Thickness contrast** | Rock units from oldest (base) to youngest (surface). The oldest and youngest run to the base and to the surface; the units between them have thickness that is uniform, thinning or thickening upward, alternating thick and thin, or seeded random, with the thickest at most *contrast* times the thinnest. Contrast is hidden when the sequence is uniform. |
| **Stack depth** | Combined thickness of the units between the oldest and youngest, as a fraction of block height. Around 1 fills the block; more pushes the stack through the top and base so units outcrop and vanish; less leaves thick basement and cover. |
| **Thickness trend** | Alternate units thicken toward one side while their neighbours thin, so contacts fan instead of running parallel. Zero is parallel. |
| **Tilt**, **Tilt direction** | The whole stack dips by this many degrees toward the direction given (degrees from the right-hand side toward the front). On a flat ground it turns into parallel outcrop bands. |
| **Block depth**, **Block height** | Front-to-back size and height as fractions of the block width. |

## Folds, faults and erosion

| Controls | What changes on the canvas |
|---|---|
| **Fold type**, **amplitude**, **wavelength**, **axis**, **phase** | **Sinusoidal**: smooth waves; **chevron**: straight limbs and sharp hinges; **dome**: closed domes and basins, which a horizontal slice turns into rings with older units in the middle; **none**. Amplitude is a fraction of block height, wavelength of block width, axis the direction of the hinge lines in degrees. Every horizon shares the fold, so the layers stay parallel apart from *Thickness trend*. |
| **Faults** | Turns the fault family on. Everything below is hidden while it is off. |
| **Fault count**, **Fault position**, **Fault scatter** | Parallel planes evenly spaced across the block, slid by a fraction of a spacing, with seeded irregularity in spacing and throw. |
| **Fault throw** | Vertical offset of every layer across a fault, as a fraction of block height. Positive drops the hanging wall (above the plane) of a normal fault; negative raises it (reverse). The offset is exact: across the plane each horizon is `throw` higher on one side and its trace is shifted `cot(dip) × throw` along the plane. |
| **Fault dip**, **Dips toward**, **Fault strike** | Angle of the planes from horizontal (90 is vertical), the way they lean, and whether they run into the picture (dip shows on the front face) or across it (dip shows on the right face). |
| **Fault pattern** | **Stepped**: every fault the same sense, a staircase; **alternating**: horsts and grabens; **mixed**: seeded senses. |
| **Ground surface**, **Erosion depth**, **Valley spacing** | **Flat**: level top, so tilt and folds give outcrop bands. **Eroded**: seeded valleys cut into the top that expose older units in the low ground. |

Fault dip is a request. A plane is steepened, only as far as needed, when a shallower one would meet a horizon twice within a
column (steep folds, tilt or valleys) or would run out of the block between the base and the top (a tall, narrow block); the
picture and every offset then use the angle actually drawn, so no slider setting is refused. The faults are spread inside the
walls, so a compartment never gets narrower than 4% of the block.

## Cutaway

| Controls | What changes on the canvas |
|---|---|
| **Cutaway** | **Whole block**, one **slice** plane that removes the near side and shows the layers on the plane, a **corner cut** that removes a box and shows its three faces, or **exploded**: the block split along a plane and pulled apart. |
| **Slice position**, **Slice direction**, **Slice dip** | Where the plane sits across the block, the way its removed side faces (degrees from the right-hand side toward the front) and its dip: 90 a vertical section, small values a horizontal map slice. Slice cuts are exposed as sections painted region by region; a section through a dome shows a ring. |
| **Explosion** | How far the far half moves along the plane normal. From any one viewpoint only one of the two cut faces faces you: a horizontal plane (dip about 15) with the camera above shows the lower cut face beneath the lifted slab, and the slab's own layers and faults shifted with it. |
| **Corner**, **Cut width**, **Cut depth**, **Cut height** | Which top corner is cut away and how much of the width, depth and height is removed there. |

## View, fill and lines

| Controls | What changes on the canvas |
|---|---|
| **Projection**, **Yaw**, **Pitch**, **Viewing distance**, **Block size**, **Center X/Y** | The camera is separate from the geology: it turns and tilts the same block, converges the edges in perspective, and *Block size* is the canvas diameter of the sphere that holds the whole block, so no angle overflows. Real occlusion, not a flattened picture: faces are painted far to near by an exact ordering and lines behind faces are hidden. |
| **Fill**, **Shading**, **Fill opacity**, **Color by** | **Shaded**: unit colours darkened by the direction each face points; **flat**; or **none**, lines only. **Cycle** repeats palette entries up the stack, **ramp** runs one smooth gradient from the oldest to the youngest unit. The first palette entry is ink for lines. |
| **Line color**, **Hidden edges** | Lines in ink or in the colour of the unit beside them (darkened); hidden block edges and faults dropped or drawn as faint dashes. |
| **Bedding lines**, **Ground contours** | Fine lines inside every unit parallel to its contacts, on the walls, the cut faces and the ground; topographic contours of the eroded surface. |
| **Outline weight**, **Contact weight**, **Fault weight**, **Bedding weight**, **Contour weight** | Line thicknesses; they scale together. Outlines are the block edges and the boundary of every cut face, contacts the boundaries between units (walls, ground outcrops and sections), faults the traces of the fault planes on every visible surface. |

## Things to try

| Setting | Result |
|---|---|
| Fold none, Faults off, Tilt 14, Ground flat, Cutaway whole block, Bedding lines 3 | Tilted layers as bands across a flat top: the cleanest picture of outcrop against dip. |
| Fold dome, Faults off, Ground flat, Cutaway slice with Slice dip 12 | A horizontal map slice: concentric bands, rings with holes around the domes. |
| Fold chevron, Faults 3, Pattern alternating, Cutaway slice | A graben and horst pair with straight-limbed folds in a vertical section. |
| Fault throw −0.12, Fault dip 55, Fault strike across the picture | Reverse faults whose repeated layers show on the right face. |
| Cutaway exploded, Slice dip 15, Slice direction 0, Explosion 0.4, Pitch 34 | A lifted slab over its own cut face with the fault offsets visible in both. |
| Fill none, Line color by stratum, Hidden edges dashed | Edges only: every contact, fault and block edge still reads, and layers behind show through. |
| Strata 14, Faults 5, Fault dip 70 | A dense stepped fault staircase in thin layers. |

## As functions

The producers are ordinary functions; the instrument is one composition of them. Lengths are in block widths (the block is 1 wide) and
angles in degrees. Nothing is drawn until `drawGeologicalView`.

```js
import { strataModel, geologicalBlock, viewGeometry, geologicalCamera, drawGeologicalView, createCompositionRun,
  geologicalCutawaysComposition, createInstrument } from "@procedurals/instruments";

const model = strataModel({ seed: 7, depth: 0.8, height: 0.55, strata: 8, sequence: "random", contrast: 3, stack: 1, trend: 0.25,
  tilt: 4, tiltAzimuth: 20, fold: "sinusoidal", foldAmplitude: 0.1, foldWavelength: 0.9, foldAxis: 25, foldPhase: 0,
  faultCount: 2, faultThrow: 0.09, faultDip: 62, faultStrike: "depth", faultDipDirection: "left", faultStyle: "stepped",
  faultShift: 0, faultScatter: 0.25, relief: 0.08, reliefScale: 0.9 });
model.stratumAt(0.1, 0.2, 0.05);            // { stratum, compartment } by the inverse map: undo the faults, count the horizons below
const block = geologicalBlock(model, 44);   // block.mesh: one Mesh, closed bricks per (stratum, compartment), face attributes stratum, compartment, role
const view = viewGeometry(block, { kind: "slice", slicePosition: 0.5, sliceAzimuth: 30, sliceDip: 90, corner: "front-right",
  cutWidth: 0.5, cutDepth: 0.5, cutHeight: 0.5, gap: 0.2 }, { beds: 2, contours: 0 });
view.caps;                                  // PlanarDomain per (stratum, compartment) on the section plane, with holes
```

`view.mesh` (the kept surfaces and cut faces as outward triangles), `view.curves` (typed lines) and the block mesh are ordinary
values for `hiddenLines`, `paintOrder`, `sliceMesh` and `isoContours`. `geologicalProducts(recipe)` returns the cached model, block
and view of a recipe from `geologicalCutawaysComposition(input)`; `drawGeologicalView(surface, recipe, view, camera, run)` paints any
`ViewGeometry` through any recipe's appearance. The instrument names only the stated model and bundled choices. Binding a caller's own
mesh or scan as a Studio layer input is future host work: the block is a horizon-function model, not a reconstruction of measured rock,
and it makes no claim of geological simulation.

## Limits

The sliders are narrowed so that every combination of slider ends draws (tested: each control alone at both ends, all minima, all maxima, in every cutaway
and for both fault strikes; the all-maxima corner prepares in about 0.4 s). Typed values past the sliders are refused with the controls to lower named (Grid
resolution, Strata, Faults, Beds) beyond 160,000 vertices or 190,000 triangles, or 140,000 bedding sheet vertices. More than 6 faults, 16 strata or a grid over 120 cells are outside the hard limits.
A stratum that is eroded away or pinched out keeps a sliver of one hundred-thousandth of the block's height instead of vanishing, so every
solid stays closed; cut-face regions under 1e-5 of the block width squared and contacts beside a stratum thinner than 0.4% of the height
are not drawn. A surface is a straight-edged triangle mesh at the chosen resolution: tight folds need a finer grid. The section of a plane
that lies exactly on a stratum boundary follows the mesh foundation's tie rule (the coincident face is above the plane).
