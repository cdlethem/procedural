# Optical Plates

Two pattern plates lie over each other and their small differences in period, angle, phase and
position make the large-scale form: beats, fringes, moiré rosettes. The plates are real
geometry drawn as lines and dots, not a computed interference field, so the picture is whatever
the two plates make when they overlap. The starting study is a square dot screen over the whole
footprint with a second, slightly finer and rotated dot screen that follows the outline of the
letters *OP*: the letters appear because the two screens drift in and out of register inside
them, and the regular screen keeps the surrounding negative space.

Compare three states of the same pair: **Show A** (a single plate), **Show both** with the
plates **linked** (B rides along with A) or **detached** (B keeps its own absolute
registration), and **Show B** as a second layer that registers exactly with the first.

## Choose each plate

Plate A and Plate B have the same controls. Plate A uses the first palette color and Plate B
the second.

| Controls | What changes on the canvas |
|---|---|
| **Pattern** | **Grating**: parallel lines. **Rings**: concentric circles about the plate's center. **Dots**: a square or hexagonal lattice. **Waves**: a grating whose lines are bent sideways by a sine. **Spokes**: rays from a hub. |
| **Period** | The distance between neighbouring lines, rings or dots. It cannot go below 3 canvas units, so a screen is never finer than the device can draw. |
| **Frequency drift** | Changes a grating's, ring set's or wave grating's local frequency across the plate by this fraction per 100 units from its center: lines crowd on one side and open on the other, and the fringes against a regular plate curve. Zero is regular. A drift that would change the local frequency by more than 80% over the plate, or push the local period below 3, is refused. |
| **Wave height**, **Wavelength** | How far the wave pushes each line sideways and the distance along the lines over which it repeats. Height 0 is a straight grating. Where the wave is steep the lines crowd together, which is real geometry, not a sampling effect. |
| **Spokes**, **Hub radius** | The number of rays and the empty radius at their center. The hub is enlarged automatically so that neighbouring spokes never start closer than 3 units. |
| **Lattice**, **Dot diameter** | Square rows or staggered hexagonal rows, and the diameter of each dot. A dot is kept whole when its center lies inside the plate's support, so edges of a rotated lattice are stepped. |
| **Rotation** | Turns the plate about the footprint center, in degrees. |
| **Phase** | Slides the pattern by this fraction of one period: lines and dots slide, rings grow, spokes turn. One full cycle returns to the same picture. |
| **Offset X/Y** | Moves the plate's pattern in canvas units: rings and spokes move their center, dots move as a lattice, and a grating shows only the part of the move across its lines. |
| **Line weight** | Stroke width of lines, rings and spokes. Dot plates use the dot diameter instead. Weight is appearance only: it never moves a line. |

## Register the pair

| Controls | What changes on the canvas |
|---|---|
| **Link** | **Linked**: Plate B is registered to Plate A. B's rotation and phase add to A's and B's offset is read in A's rotated frame, so rotating, moving or phasing A carries B with it and the moiré keeps its shape while it turns. **Detached**: B uses its own values in the canvas frame, so moving A changes the relationship and the moiré with it. With A at zero rotation, offset and phase the two look identical. |
| **Show** | Draw both plates, or only A or only B. The registration does not change, so a layer showing only B lines up with a layer showing only A. Hiding a plate also hides the pattern controls it no longer uses. |

There is no recorded phase sequence: phase is one static value per plate, because the library
has no recording to replay from.

## Bound the plates

| Controls | What changes on the canvas |
|---|---|
| **Center X/Y**, **Width/Height** | The footprint that bounds every plate. Plates are stencils fixed to the canvas: only the pattern moves under them. |
| **Footprint** | Rectangle or ellipse for a plate that is not following the mask. |
| **Follows mask** | Which plate is confined to the mask: none, A, B or both. The other plate stays regular over the plain footprint. |
| **Mask**, **Type** | **Type**: 1–20 ASCII characters in the licensed glyph font, fitted to the footprint without stretching and centered in it; counters (the inside of an O) stay empty. **Regions**: a set of rectangles. |
| **Region grid**, **Region cuts**, **Region retention**, **Region inset** | The seeded binary partition of the footprint that makes the regions, the fraction of regions kept (dropping one never moves another), and the clearance inside each so neighbours do not touch. Only region masks use the seed. |
| **Invert mask** | Keep the footprint outside the mask instead of inside it. |

## Try these

- **Zone plate**: A grating period 10, B rings period 10, B offset X 40, no mask: curved
  fringes centered off to one side.
- **Chirped beat**: both plates gratings at period 10 and 0°, A frequency drift 0.15: the lines
  slide in and out of register from one edge to the other.
- **Patchwork**: A grating 8 at −2°, B grating 8.5 at 5°, B follows a region mask with
  12 cuts, grid 12, retention 0.75, inset 5, footprint 540 × 480. Change the seed to re-partition.
- **Two centers**: both plates spokes, 70 rays, hub 20, B offset X 60: two hubs and a lattice of
  crossing rays between them.
- **Linked or detached**: two gratings at periods 9 and 9.6 with A rotated 20° and B at 0°.
  Linked gives long, gentle beats along A's direction; detached leaves B horizontal and A slanted, so
  the plates cross at 20°.
- **Hexagonal dot screens**: both plates hexagonal dot lattices, period 8, dot 3, B rotated 4°,
  footprint 480 × 480: a hexagonal super-lattice.
- **Negative type**: the default with **Invert mask** on: the letters stay clear and the second
  screen fills the space around them.
- **Fragment**: gratings 20 and 21, B at 10°, footprint 200 × 160: a small crossing accent.

## Use the plates in code

A plate is a pattern function evaluated once inside a frame and a support. Plates come back
separately and as a composite; none of them is a picture.

```js
import { createInstrument, referenceComposition, opticalPlates, drawPlate, motif, pathMaterial } from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("optical-plates"));
const { plates: [a, b], composite } = opticalPlates(recipe.source);
// a.paths, b.sites, a.frame, a.reach, a.minPeriod; composite.paths is a's then b's, the same objects.
for (const plate of [a, b]) {
  const ink = recipe.ink[plate.tone];
  drawPlate(p, plate, { stroke: pathMaterial(ink.material, recipe.palette), mark: motif(ink.mark, recipe.palette) });
}
```

Plates are ordinary composition values, so every consumer works on them: their paths carry
`tone` (plate index), `level` and stable ids such as `A/line:12#0`, and their sites carry the
lattice frame, so `strokeWith`, `atEach`, `warpPaths` and `warpSites` accept them unchanged.
Editing Plate B returns Plate A as the very same object. Weight, ink and the choice of
consumer never enter a cache key.

Any function of the pattern type replaces a stock pattern:

```js
import { makePlate, resolveSupport, plateFrames } from "@procedurals/instruments";

const diagonal = ({ x, y, reach }) => ({ minPeriod: 10, dots: [],
  strokes: [{ id: "diagonal", closed: false, points: [[x - reach, y - reach], [x + reach, y + reach]] }] });
const support = resolveSupport({ footprint: { shape: "rectangle", centerX: 320, centerY: 320, width: 500, height: 400 } }, 0.02);
const [frame] = plateFrames("detached", 320, 320, [{ offsetX: 0, offsetY: 0, rotation: 10, phase: 0 }]);
const custom = makePlate({ id: "C", tone: 2, seed: 1, pattern: diagonal, frame, support, flatness: 0.02 });
```

The mask can be a supplied set of closed paths (`{ kind: "paths", rings }`, nonzero winding, so
a ring of opposite winding is a hole), any list of rectangles with `bounds` (such as the output
of `partitionRegions`), or text. `linked` and `detached` are `plateFrames` modes over any number of
plates: each plate after the first is registered relative to the one before it.

## Sampling and export

Nothing here samples an image. Straight lines have exactly two vertices; rings and waves are
flattened so that no chord deviates from the true curve by more than 0.02 units, and that
tolerance alone decides the vertex count. Vertices are not tied to any pixel grid, so preview
and export differ only in how the drawing device antialiases the strokes. Because the periods
cannot fall below 3 units, a plate has at least three device pixels per period at 1:1 and more
at export scale. In review, plates with periods from 3 to 12 units, straight and tilted 3°, were
rasterized at 1×, 2× and 4× and compared with an 8× reference: the residual low-frequency
modulation after smoothing over 2.5 periods stayed below 0.7% of the mean ink coverage, which is
below anything visible, so the fringes you see are the plates' own. The plate's `minPeriod`
reports its smallest local period for hosts that export at less than 1:1.

The library does not create or clear a canvas. Lengths are canvas units; rotations in controls
are degrees and in frames radians. Ink extends half a stroke width past a support edge because
strokes have round caps.
