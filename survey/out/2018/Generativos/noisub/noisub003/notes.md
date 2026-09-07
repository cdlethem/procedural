---
sketch: 2018/Generativos/noisub/noisub003
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1521
animated: false
techniques: [noise-field, subdivision, grid]
primitives: [rect, shape]
palette:
  colors: ["#DAAC80", "#FCC9D2", "#FC2E1D", "#235F3F", "#02272D"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: noiseSubdivide, signature: "noiseSubdivide(cellSize, noiseScale, iterations) -> Rect[]", note: "repeatedly split random rects in a grid where Perlin noise above a threshold says 'keep splitting'"}
  - {name: cornerShade, signature: "cornerShade(rect, direction, alpha, extent) -> quad mesh", note: "two-sided black-alpha gradient quad pair that shades two adjacent edges of a rect"}
---

## What it draws
A full-bleed mosaic of axis-aligned squares in a five-colour palette (bright red, pale pink, tan,
dark green, dark teal) on a near-white ground. The squares have many different sizes: large blocks
coexist with dense clusters of tiny squares, giving a patchy, almost pixelated texture that is
finer in some regions and coarser in others. Most squares carry a soft black gradient fading in
from one or two corners, so each tile looks like a small shaded cube face, adding a mottled,
low-contrast relief over the flat colour.

## How the code works
`setup()` calls `generate()` once (line 8); `draw()` is empty, so the image is static.
`generate()` (lines 37-191):

- Seeds `randomSeed`/`noiseSeed` (lines 39-40), sets `background(252)` and
  `noiseDetail(2, 0.45)` (lines 42-43).
- Builds a 5x5 grid of `Rect` cells (lines 53-59), each 192x192 px.
- Subdivision loop (lines 61-77): 1,000,000 times it picks a random rect, samples Perlin noise
  at the rect's centre (`detSize` scale, ~0.004-0.006, offset by random `desSize`), maps it to a
  minimum size `min` (2..96 px), and if the half-cell is still larger than `min` it replaces the
  rect with its four quadrant halves. So where noise is high, cells keep splitting until they are
  smaller than the local threshold; where noise is low they stop early. This is what creates the
  regions of large squares versus regions of tiny squares.
- Fill loop (lines 80-190): each surviving rect is painted with a random palette colour
  (`rcol()`, line 214-216, uniform pick from the 5-colour list at line 213), drawn either as a
  plain `rect` or as a `beginShape()` quad (three shape variants, all the same square geometry —
  the per-vertex `fill()` calls do not actually change anything since the fill is set identically
  at each vertex).
- Shadow pass (lines 106-189): for each rect, a shadow direction `shw` 0-3 is chosen from a second
  Perlin field (`detDir` scale, offset `desDir`), and two quad strips are drawn with a linear
  alpha gradient from black at `alp = random(60,80)` alpha down to 0 (lines 111-189), covering a
  fraction `s1`/`s2` (0.2/0.8) of the two edges adjacent to that direction. This produces the
  corner-fade shading.
- `arc2()` (lines 193-211) is defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- The noise-gated subdivision loop (lines 51-77) is the generic core: a grid + repeated random
  splits whose depth is controlled by a Perlin threshold. Parameterisable as
  `noiseSubdivide(gridCount, noiseScale, noiseOffset, maxIterations)` returning the final rects.
- The corner-shadow quad pair (lines 106-189) is a reusable shading primitive:
  `cornerShade(rect, direction 0-3, alpha, extent)` — currently duplicated four times, one per
  direction, which a helper would collapse.
- Art decisions to keep as parameters: the 5-colour list, the 0.2/0.8 gradient extents, the
  60-80 alpha range, the two separate noise scales/offsets (`desSize`/`detSize` for subdivision,
  `desDir`/`detDir` for shading), and the 1,000,000 iteration budget.
- The three `type` shape variants (lines 83-104) are visually identical and one of them is dead
  weight; a clean port would just call `rect()`.
- `getColor()`/`lerpColor` ramp (lines 220-225) is unused — only the uniform `rcol()` is used.
