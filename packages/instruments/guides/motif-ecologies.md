# Motif Ecologies

Build an irregular population of marks without tying its positions to one drawing style.
The starting study is a tilted, open-centered cloud of radial rosettes. Large and small
marks overlap lightly; dark, terracotta and ochre accents leave the host's paper visible.
Switch to rings or dots without moving a single source position.

## Direct the population

| Controls | What changes on the canvas |
|---|---|
| **Support**, **Support opening** | Choose a rectangle, ellipse or annulus. The opening removes the annulus's inner population; it does not paint a paper-colored hole. |
| **Width**, **Height**, **Center X/Y**, **Support angle** | Change the sampling footprint and its position. Width and height change the population, not a finished image's stretch. |
| **Separation** | Increase the minimum distance between sites for an airier population. Smaller values admit denser neighbors. |
| **Population cap** | Cap the generated sites before support filtering. The visible population can be smaller. Zero gives an empty layer. |
| **Seed** | Discover another arrangement at the same construction settings. |

These are construction edits. They may change positions and identities. For a rigid
move or scale of an already chosen layer, use the host's layer transform instead.

## Replace the mark

| Controls | What changes on the canvas |
|---|---|
| **Mark** | Dots, concentric rings, radial rosettes or arrows on the same sites. An arrow has a head and a one-sided tail flag, so its orientation is readable; the other marks are round. |
| **Mark diameter**, **Size variation** | Set the maximum diameter and the stable variation below it. More variation gives small supporting marks among larger accents. |
| **Petals** | Change the number of radial strokes in a rosette. This appears only for rosettes. |
| **Interior opening** | Open the rosette center, or change the offset between a ring's two circumferences. |
| **Line weight** | Change outlines, petals and arrow strokes, not source separation. Dots have no outline. |
| **Mark retention** | Omit marks without resampling. Raising it restores the same omitted marks, including their scale. |
| **Palette** | Recolor the existing marks without rerolling the population or its size hierarchy. |

For a sparse supporting fragment, try an ellipse 250 units wide and 360 high,
separation 50, rings of diameter 22 and retention 0.55. For a more intricate population,
keep the starting annulus but increase petals and vary the diameter. For a quiet rhythm,
replace the rosettes with small dots. Overlap and off-canvas placement are intentional
possibilities, not errors to be clamped away.

## Use the same geometry twice

```js
import {
  createInstrument, referenceComposition, poissonSites, atEach, motif,
} from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("motif-ecologies"));
const sites = poissonSites(recipe.source);

// One source; two independently replaceable consumers.
atEach(p, sites, motif({ ...recipe.mark, kind: "rings" }, recipe.palette));
atEach(p, sites, (p) => {
  p.noStroke();
  p.fill(25, 43, 52);
  p.circle(0, 0, 2);
});
```

A mark receives `(surface, site, run)`. The consumer installs the site's local origin,
radians rotation and uniform scale, then restores drawing state—even if the callback
throws. Site geometry is deeply frozen. Use `componentSeed(site.seed, site.id, purpose)`
for a custom independent choice instead of consuming a random stream shared by siblings.
Pass the supplied run into any nested consumer.

The library does not create or clear a canvas. Source options and inspector angles use
degrees; callback frame angles use radians. No support clipping is applied to oversized
marks, so marks near the annulus boundary may extend into its opening. Increase the
opening or reduce mark size when that overlap is unwanted.

The Poisson producer permits at most 600 sites and 1600-unit footprint dimensions, with
bounded proposal work. Slider intervals are convenient working spans; exact entry accepts
the wider advertised domain. This study supplies reusable placement and marks, not a
general mask or graph editor.
