# Ordered Disorder

Start with a plain grid and let a slowly varying field push it out of order: sites drift,
turn, swell and drop out together, so the disturbance reads as a region rather than noise.
Sites disturbed most strongly are drawn in a second color; pinned anchors take a third.
Where the field is quiet the grid survives, so order and disorder share the canvas.

## Build the grid

| Controls | What changes on the canvas |
|---|---|
| **Columns**, **Rows** | The lattice dimensions. |
| **Center X/Y**, **Width**, **Height** | The footprint the lattice fills. |
| **Correlation length** | How many cells a disturbance spans. Small values give restless local jitter; large values give broad, slow warps. |

## Direct the disturbance

| Controls | What changes on the canvas |
|---|---|
| **Focal X/Y**, **Focal radius** | Where disorder is strongest. It fades smoothly to nothing at the radius, and sites outside stay exactly on the grid. Zero applies it everywhere. |
| **Displacement** | The largest shift, as a fraction of a cell. |
| **Rotation** | The largest turn, in degrees. Only visible for marks that show orientation (arrow, rosette). |
| **Scale wobble** | The largest change in size. |
| **Omission** | How much of the field removes sites. Removed sites cluster into runs and holes instead of scattering. |
| **Anchors** | A stable fraction of sites pinned to the exact grid, never moved or removed. |
| **Site retention** | Stable omission independent of the field. |

Setting displacement, rotation, scale and omission to zero returns the exact grid. The
strongly disturbed sites (past 70% of a stated limit) are the exceptions; they and the
anchors are colored by role, not at random.

## Replace the mark

| Controls | What changes on the canvas |
|---|---|
| **Mark**, **Mark diameter**, **Size variation** | Ring, dot, rosette or arrow on the same sites, and their size. |
| **Petals**, **Interior opening**, **Line weight** | Rosette and ring detail and stroke width. |
| **Palette** | Recolor: first color for ordinary sites, second for exceptions, third for anchors. |

## Try these

- Rings, 14 by 14, correlation 4, focal radius 420 at the upper right: the grid warps and
  frays toward one corner.
- Dots with scale wobble .6 and no rotation: a halftone-like swelling.
- Arrows at correlation 3 with rotation 90: a vector field with calm margins.

```js
import { createInstrument, referenceComposition, latticeSites, atEach, motif } from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("ordered-disorder"));
const sites = latticeSites(recipe.source);
atEach(p, sites.filter((site) => site.kept), motif(recipe.mark, recipe.palette));
```

Each lattice site keeps its grid `origin` beside the disturbed `position`, and reports
`anchor`, `kept` and `exception`. Ids are `lat:<column>:<row>`. The field is seeded value
noise sampled at `(column / correlation, row / correlation)`, stretched so each amplitude
can reach its stated limit.

The library does not create or clear a canvas. Lengths are canvas units.
