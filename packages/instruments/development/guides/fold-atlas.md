# Fold Atlas

Push a grid through a chain of coordinate maps and watch it fold, swirl, pinch or unroll.
Lines and nodes follow the same mapping, so a fold is visible twice: the lines bunch and
cross, and the nodes the map turns inside out change color. The starting study is a
swirled, gently folded grid whose line spacing clumps and opens differently for every seed.

## Build the grid

| Controls | What changes on the canvas |
|---|---|
| **Grid center X/Y**, **Grid width/height** | The rectangle the source grid covers before any mapping. |
| **Columns**, **Rows** | How many cells the grid has; the line count is one more. |
| **Grid irregularity** | Blends the regular line spacing toward a seeded random spacing. At 0 the grid is regular and the seed changes nothing; at 1 lines clump and leave wide gaps. Order is kept and the edge lines never move. |

## Choose the mapping

Up to three maps run in order, each on the previous result; the whole chain can repeat.

| Controls | What changes on the canvas |
|---|---|
| **Map center X/Y**, **Map radius** | The fixed point of every map and the canvas length it treats as 1. A smaller radius applies each map more strongly. |
| **First / second / third map** | **Sinusoidal** folds the plane once the coordinate passes a quarter wave. **Swirl** twists more the farther a point is from the center. **Fisheye** compresses toward the edge. **Spherical** inverts through the center and leaves a hole there. **Polar** unrolls the grid around the center and cuts it at the seam. **Handkerchief** drapes it into petal-like lobes. **Waves** ripples both axes. **Horseshoe** reflects and stretches about the center. |
| **Amount** | Blends from no change (0) to the full map (1); values above 1 exaggerate it. Zero skips the stage. |
| **Frequency** | The map's coefficient: fold count, twist rate or scale, depending on the map. |
| **Repeat chain** | Runs the chain again on its own output. Order and repetition change the picture. |
| **Exclusion bound** | Points a map sends farther than this many radii from the center are dropped. Singular maps such as Spherical use this to leave a clean hole instead of runaway lines. |

## Draw the result

| Controls | What changes on the canvas |
|---|---|
| **Line material** | Ink, stitches or beads along each mapped line. Vertical grid lines use the first color and horizontal lines the second, so the two families stay distinguishable through a fold. |
| **Line weight**, **Station spacing**, **Station phase**, **Line retention** | Stroke width, stitch/bead spacing and offset, and stable omission of lines. Retention 0 leaves only the nodes. |
| **Cross-line phase** | Spreads each line's station offset by a stable amount, so neighbouring lines' stitches or beads stop lining up. |
| **Size ramp across the grid** | Beads shrink from the first line toward the last in each family, giving a soft gradient across the folded grid. |
| **Bead motif** controls | The mark and its size, petals, weight and opening on each bead. |
| **Node mark**, **Node size**, **Node petals/opening/weight** | The mark at every grid crossing, rescaled and turned by the map. Size 0 hides the nodes. Nodes a fold mirrors take the second color. |

## Try these

- Spherical, amount 1, map radius 200: concentric arcs around a clover-shaped hole.
- Handkerchief 1.5 then swirl .4, irregularity .6: closed lobes of packed lines.
- Polar, radius 260, irregularity .8: an unrolled fan cut at its seam.
- Beads with node size 0 for a field of dots that keeps the mapping's rhythm.

## Fold something you already have

The mapping is a separate consumer, not part of the grid. Any sites or paths can go through it:

```js
import { createInstrument, referenceComposition, wallpaperSites, contourPaths,
  warpSites, warpPaths, atEach, strokeWith, motif, pathMaterial } from "@procedurals/instruments";

const map = { centerX: 320, centerY: 320, radius: 260, iterations: 1, bound: 8,
  stages: [{ map: "swirl", amount: 0.9, frequency: 2 }, { map: "sinusoidal", amount: 0.4, frequency: 1.2 }] };

const wall = referenceComposition(createInstrument("wallpaper-motifs"));
atEach(p, warpSites(wallpaperSites(wall.source), map), motif(wall.mark, wall.palette));

const contours = referenceComposition(createInstrument("contour-scores"));
strokeWith(p, warpPaths(contourPaths(contours.source), map), pathMaterial(contours.material, contours.palette));
```

`warpSites` carries each site's frame through the map: position moves, the frame axis follows
the map's local direction, size follows the local area change, and a fold mirrors the mark
(`flipped` is reported; `tone` is never rewritten). Sites sent to a singularity or beyond the
bound are dropped. `warpPaths` subdivides each path to at most `segment` units (default 6),
maps the vertices, and starts a new part (`<id>#<n>`) wherever a vertex is excluded or two
neighbours land farther apart than 0.6 radii, so nothing is joined across a seam or hole.

The library does not create or clear a canvas. Lengths are canvas units. A map chain that
would produce more than 200,000 points is refused; enlarge the segment or use fewer lines.
