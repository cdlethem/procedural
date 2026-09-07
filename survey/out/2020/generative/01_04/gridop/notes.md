---
sketch: 2020/generative/01_04/gridop
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1536
animated: false
techniques: [noise-field, grid]
primitives: [shape]
palette:
  colors: ["#80FF00", "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF"]
  selection: fixed
composition: full-bleed
parameters:
reusable_candidates:
  - {name: noiseBands, signature: "noiseBands(cells, detailRow, detailCol, ampRow, ampCol) -> void", note: "per-row quad strips whose thickness is 1-D noise sampled in both row and column, tiling the width"}
  - {name: gridStripes, signature: "gridStripes(cells, color, axis) -> void", note: "thin quad-strip grid lines at cell boundaries with noise-modulated thickness"}
---

## What it draws
A full-bleed square on a bright lime-green background. A regular 64×64 grid of thin black cell borders covers the canvas, and several rows carry thick black horizontal bands of uneven thickness, so the green background peeks through between them as vertical stripes of varying width. White vertical stripes of varying thickness sit on the grid's column boundaries, some wide, some hairline.

## How the code works
`settings()` sizes a 960×960 P2D canvas (gridop.pde:14-19). `generate()` (gridop.pde:40-84) seeds `randomSeed`/`noiseSeed` from `seed`, paints `background(#80ff00)`, and sets `cc = 64` rows with cell size `ss = width/cc` (lines 42-47). Randoms drawn once per run: `det1 = random(1)`, `det2 = random(0.01)` (noise frequencies, lines 49-50) and `amp1, amp2, amp3 = random(2)` (amplitudes, lines 52-54).

The `j` loop (lines 58-83) draws two filled quad strips per row, no stroke:

1. Black strip (lines 62-71): for each pixel column `i`, `v1 = noise(j*det1)*amp1` (per-row value) and `v2 = noise(i*det2)*amp2` (per-column value) bound the strip between `y = ss*j` and `y = ss*(j + v1*v2)`. The top edge is exactly the row boundary, so where the noise product is small the strip degenerates to a thin horizontal grid line; where it is large it becomes a thick black band. Because the thickness varies along `i`, the green background between bands reads as vertical stripes.
2. White strip (lines 73-82): same `v1`, `v2` with `amp3`, but the vertex coordinates are swapped (`vertex(y1, i)`, `vertex(y2, i)`), so it draws a vertical strip at `x = ss*j` from top to bottom, i.e. a white stripe of noise-modulated thickness on each column boundary.

Colour is fixed (black/white fills on a green background); `colors[]` and `getColor()` (lines 92-107) are defined but never used. `draw()` is empty, so the image is static; `keyPressed` regenerates with a new seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The two quad-strip loops (gridop.pde:58-83) are the reusable core: a `noiseBands` primitive that tiles the width with per-row strips whose thickness is `noise(row)*noise(col)` with independent frequencies and amplitudes, plus an axis-swap for vertical vs horizontal orientation. The one-off art decisions are the fixed `#80ff00` background, the exact black/white fill pairing, and the unused `getColor()` palette machinery. A clean parameter object: `{cells, detailRow, detailCol, ampRow, ampCol, bandFill, stripeFill, background, orientation}`.
