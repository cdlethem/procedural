---
sketch: 2017/Generativos/cuadraditos
year: 2017
renderer: JAVA2D
size: [1920, 1920]
libraries: []
deterministic: true
ms_first_frame: 293
animated: false
techniques: [grid, dots-stippling]
primitives: [rect]
palette:
  colors: ["#FF1649", "#400968", "#3AA6D1"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: subdivGrid, signature: "subdivGrid(cellSize, subCount, subScale, palette, alphaMax) -> void", note: "tile canvas with cells, each subdivided into a random-n sub-grid of gapped squares"}
---

## What it draws
Full-bleed black canvas covered by a square grid rotated at a shallow angle, so rows of cells run diagonally. Each cell is itself tiled with a small sub-grid of squares (from a single solid square up to a dense ~20x20 checkerboard) with black gaps between sub-squares. Colours are hot pink/red, dark violet, and light blue, many at partial alpha so the black background shows through; cells of the same sub-grid size and colour form larger diagonal patches, giving a quilted, pixel-mosaic look.

## How the code works
`setup()` (line 1-5) sets a 1920x1920 canvas, `rectMode(CENTER)`, and calls `generate()` once; `draw()` is empty (line 8-9), so the sketch is static. `generate()` (line 26): `background(0)` (27), `translate` to centre (29), a random cell size `ss` in [20,200] (32), cell count `cc = ceil(diag/ss)+1` covering the full diagonal (31,33), then a random `rotate` (34). The double loop (36-37) visits each grid cell; per cell a random sub-count `ccc` in [1,20] (39) splits it into `ccc*ccc` sub-squares of pitch `dd = ss/ccc` (40), each drawn at size `sss = dd*random(0.5,0.9)` (41) leaving a gap. Fill is a random palette colour (22-24, from {#FF1649, #400968, #3AA6D1}) with random alpha 0-255 (44); with 50% probability per sub-square the colour is re-rolled (43,47), which is what creates both single-colour cells (same colour held across the sub-grid) and mottled multi-colour cells. `noStroke()` (35) and the gap between sub-squares produce the black grid lines. Randomness enters only via `random()` calls; seed 42 makes it deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The `generate()` body is a clean single function: (cellSize, subCountRange, subScaleRange, palette, alphaRange, rotate, background) -> draw. Generic parts: the two-level tiling (cells of a base grid, each subdivided into a random sub-grid of gapped squares) and the "hold-or-re-roll colour per sub-square" logic. One-off art decisions: the specific 3-colour palette, the 50% re-roll probability, alpha randomisation, and the single random rotation. A parameter object: `{cellSize: [min,max], subCount: [min,max], subScale: [min,max], palette: [...], alpha: [min,max], reRollP: 0.5, rotate: [min,max]}`.
