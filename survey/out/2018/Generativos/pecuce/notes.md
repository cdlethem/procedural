---
sketch: 2018/Generativos/pecuce
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1467
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#F0C4D1", "#EF514A", "#373B92", "#262046"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: div, default: "random(10,120)", tried: [30, 160], change: large, effect: "lower = fewer, coarser blocks (mostly flat colour); higher = dense field of small cells with fine bands. Layout also reshuffles because the random stream shifts."}
  - {name: sub, default: 8, tried: [3, 20], change: large, effect: "fewer insets = thick chunky corner bands and flat areas; more = thin dense concentric stripes in every cell. Same cell layout as baseline (no randomness consumed)."}
  - {name: splitRatio, default: 0.5, tried: [0.3], change: large, effect: "children no longer tile the parent (cover 0.6x0.6 of it top-left), so large flat background gaps appear and size contrast between cells grows"}
  - {name: sel, default: "random(4)", tried: [0], change: large, effect: "all corner bands anchored at the top-left corner; loses the baseline's mixed corner orientations (layout also reshuffles: random stream shifts)"}
reusable_candidates:
  - {name: randomQuadSubdivide, signature: "subdivide(width, iterations, splitRatio=0.5) -> quad[][]", note: "recursively replace a random quad with its 4 children; leaves = final cells. splitRatio != 0.5 leaves uncovered gaps (artistic, or a bug depending on intent)"}
  - {name: cornerBandRects, signature: "cornerBands(x, y, s, steps, corner) -> rect[]", note: "stacked inset rects anchored to one corner produce L-shaped bands"}
---

## What it draws
A full-bleed abstract patchwork of nested L-shaped corner bands in coral red, indigo blue, pale pink, and dark navy. Large soft blocks of flat colour occupy the left and bottom; the right and top-right are densely tiled with small concentric corner motifs. No strokes, no gradients, no text; one small region near the centre-right is extremely fine (deeply subdivided cell).

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (regeneration only via a key press, so the render is static).

- `generate()` (pecuce.pde:22): background from `rcol()`, a random palette colour.
- Subdivision (lines 25-38): start with one full-canvas quad `PVector(x, y, size)`. `div = int(random(10, 120))` times (line 28): pick a random existing quad, replace it with its four quadrants of size `q.z*0.5` (line 32). The final list is a partition of the canvas into ~4*div+1 squares of wildly different sizes — the cause of the big-blocks / fine-tile structure.
- Rendering (lines 40-54): for every final quad, `sub = 8` (line 43, hardcoded; the original `int(random(3,13))` is commented out). Draw `sub` rects with `fill(rcol())`, each inset by `j * q.z/sub` (lines 48-52); the anchor corner `sel = int(random(4))` (line 45) is fixed per quad, so each quad renders as concentric squares anchored at a random corner — visually an L-shaped band motif in one of four orientations.
- Randomness: seed (line 1), quad pick (line 30), per-quad corner (line 45), per-rect colour (line 47).
- Palette (line 62): 4 fixed colours picked uniformly by `rcol()`; the lerp-based `getColor` (lines 66-75) is unused.
- `noStroke()` (line 40) keeps edges crisp; P2D renderer.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_30 | `int div = int(random(10, 120));` -> `int div = 30;` | large (0.2874, 75.8%) | much coarser: mostly large flat colour blocks, corner-band motifs visible in only a few cells | variants/div_30/frame_00001.png |
| div_160 | `int div = int(random(10, 120));` -> `int div = 160;` | large (0.2815, 74.1%) | much finer: small cells everywhere, dense field of thin concentric L-bands, no large flat regions | variants/div_160/frame_00001.png |
| sub_3 | `int sub = 8;//int(random(3, 13));` -> `int sub = 3;` | large (0.2888, 72.9%) | same cell layout, but each cell has only 3 insets: thick chunky corner bands and more flat area | variants/sub_3/frame_00001.png |
| sub_20 | `int sub = 8;//int(random(3, 13));` -> `int sub = 20;` | large (0.2938, 74.9%) | same cell layout, 20 insets per cell: thin dense concentric stripes, busier texture in every cell | variants/sub_20/frame_00001.png |
| split_0.3 | `float ms = q.z*0.5;` -> `float ms = q.z*0.3;` | large (0.2615, 72.9%) | children now cover only the top-left 60% of each split cell: big flat background gaps, stronger size contrast, dense busy cluster in the top-left, large bands on the right | variants/split_0.3/frame_00001.png |
| sel_0 | `int sel = int(random(4));` -> `int sel = 0;` | large (0.2759, 72.4%) | all corner bands anchored at the top-left corner, a uniform directional look; baseline mixes all four orientations. Layout also reshuffled (random stream shift), so part of the score is the new layout | variants/sel_0/frame_00001.png |

## Modularisation notes
The subdivision loop (lines 25-38) is a generic "stochastic quadtree" — replace a random leaf with its 4 children N times — reusable for any cell-based composition; the art decisions are `div` (iteration count) and the split ratio (0.5; anything else leaves uncovered gaps, which in split_0.3 reads as an intentional negative-space effect). The corner-band renderer (lines 41-54) is also generic: given a cell, step count, anchor corner, and colour source it produces the nested-L look; the art decisions are `sub`, the per-quad corner choice (random vs fixed), and the flat 4-colour palette with `noStroke`. A clean parameter object: `{iterations, splitRatio, subSteps, cornerMode: "random"|"fixed", corner, palette, backgroundMode: "random-palette"|"fixed"}`. Note `sub` was hardcoded to 8 in the source (per-quad `int(random(3,13))` commented out), which is why all cells share the same band count in the baseline.
