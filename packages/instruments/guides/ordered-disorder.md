# Ordered Disorder

A regular lattice under a shared correlated field of displacement, rotation, scale and
omission. Zero disorder is genuinely ordered; anchored sites stay pinned; a focal region
limits where disorder applies.

## Build the lattice

| Controls | What changes on the canvas |
|---|---|
| **Columns**, **Rows** | Lattice grid dimensions. |
| **Center X/Y**, **Width**, **Height** | Footprint of the lattice. Sites are spaced evenly within this region. |

## Shape the disorder

| Controls | What changes on the canvas |
|---|---|
| **Correlation length** | Disorder field correlation in cells. Larger values keep neighbors' displacements more alike. |
| **Displacement** | Maximum site shift as a fraction of the cell size. |
| **Rotation** | Maximum stable rotation in degrees. |
| **Scale wobble** | Maximum relative scale deviation per site. |
| **Omission** | Correlated omission threshold on the shared field. Omissions form spatially coherent runs. |
| **Anchors** | Stable fraction of sites pinned to their exact grid origin. Anchored sites are never displaced or omitted. |
| **Site retention** | Stable per-site omission independent of the correlated field. |

These are structural edits. A site's ID is `lat:<col>:<row>`; changing column count or
grid size changes identities. Reordering columns and rows does not move the sites.

## Define the focal region

| Controls | What changes on the canvas |
|---|---|
| **Focal X/Y** | Center of the disorder focal region. |
| **Focal radius** | Radius of full-strength disorder. Sites outside the radius stay on the grid; within, amplitude falls off quadratically to the edge. |

A small focal region at a corner leaves most of the lattice ordered. A large radius covers
the whole lattice and the focal center simply shifts where displacement is strongest.

## Replace the mark

| Controls | What changes on the canvas |
|---|---|
| **Mark** | Dots, concentric rings, radial rosettes, or arrows. Arrows reveal local rotation. |
| **Mark diameter**, **Size variation** | Nominal size and stable per-site variation. |
| **Petals** | Radial strokes in a rosette. Ignored for dots and arrows. |
| **Interior opening** | Rosette center offset or ring thickness. |
| **Line weight** | Outline, petal and arrow stroke width. |
| **Palette** | Recolor existing marks without rerolling positions. |

## Try these

- 14×14 lattice, 520-unit footprint, correlation 4.5, displacement 0.55, arrows of size 26.
- Same lattice with focal radius 300 at the center — disorder fades to the edges.
- Anchors at 8% to see pinned reference points among the disorder.

```js
import {
  createInstrument, referenceComposition, latticeSites, atEach, motif,
} from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("ordered-disorder"));
const sites = latticeSites(recipe.source);

atEach(p, sites.filter(s => s.kept), motif(recipe.mark, recipe.palette));
```

A mark receives `(surface, site, run)`. The consumer installs the site's frame
(translate, rotate, uniform scale) then restores drawing state. The `latticeSites` source
outputs sites with `origin` (exact grid position), `position` (perturbed position),
`anchor`, `kept`, and `exception` attributes. Use `kept` to filter omitted sites before
drawing.

The lattice source samples a seeded value-noise field for displacement, rotation, scale
and omission. Sites within a focal region receive full amplitude; outside, amplitude falls
off quadratically. Anchored sites are never displaced or omitted.

The library does not create or clear a canvas. Source options use canvas units. Rotation
controls use degrees; internal computation uses radians. No polygon clipping is provided.
