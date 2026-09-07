---
sketch: 2017/Generativos/circlesDarknes
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 246
animated: true
techniques: [grid, blend-modes]
primitives: [line, ellipse, rect]
palette:
  colors: ["#FFFDF5", "#F2542C", "#5AE5B3", "#2C5FE5"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: gridOverlay, signature: "gridOverlay(cells, color, alpha, weight) -> void", note: "full-bleed horizontal+vertical lines every width/cells px"}
  - {name: snapToGrid, signature: "snapToGrid(v, cell) -> float", note: "v - v % cell, snaps a coordinate onto the grid"}
  - {name: scatterGridShapes, signature: "scatterGridShapes(cells, count, sizeSteps, palette, blend) -> void", note: "grid-snapped filled circles, thick quarter-arc strokes, and rects in 3 types"}
---

## What it draws
Cream (#FFFDF5) background crossed by a thin grid of pale lines; scattered over it are flat
geometric shapes in orange, mint green, and blue: solid circles, thick square-capped quarter/half
arcs, and rectangles, all snapped to grid cells and sized in 1/3, 1/2, 1, or 2 cell steps. Where
shapes overlap, DARKEST blending turns them into dark olive/forest green. Baseline frame 1 has a
coarse 6×6 grid and a few dozen shapes; frame 60 (after an in-schedule regeneration) shows a
finer ~12-column grid, much denser coverage, and many dark overlap blobs.

## How the code works
`setup()` (line 2) sizes the canvas 960×960, calls `generate()` once; `draw()` (line 8) calls
`generate()` again every 40 frames, so the piece periodically re-rolls itself (this is why
frame 60 differs from frame 1 while frame 10 does not).

`generate()` (line 22): `blendMode(DARKEST)` (line 23) — all overlaps composite to the darker
colour, producing the olive/forest patches. `background(#FFFDF5)` (line 24) resets the canvas.
`sub = int(random(4, random(20, 80)))` (line 26) picks the cell count (4–80); `des = width/sub`
(line 27) the cell size. The grid: `strokeWeight(1)`, `stroke(rcol(), 100)` (lines 28–29) — one
random palette colour at alpha 100 for the whole grid — then horizontal lines every `des`
(lines 30–32) and vertical lines every `des` (lines 33–35).

Then `cc = int(sub*sub*random(0.2, 2))` shapes (line 39): each gets a random position snapped to
the grid with `x -= x%des; y -= y%des` (lines 43–44) and a size `des * sizes[k]` with
`sizes = {1./3, 1./2, 1, 2}` (lines 38, 45). Type roll `rnd = int(random(3))` (line 46):
0 → filled `ellipse` centred on the cell origin (lines 47–50); 1 → unfilled `arc` with
`strokeWeight(des/3)`, `strokeCap(SQUARE)`, start/end angles integer multiples of HALF_PI so
arcs are 90°/180°/270° sweeps, sometimes shrunk by `des/3` (lines 51–59); 2 → filled `rect`
of random w×h from the same size steps, sometimes re-centred (lines 60–70). Colour is always
`rcol()` (lines 75–77): random from `{#F2542C, #5AE5B3, #2C5FE5}`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic, reusable: `gridOverlay` (cell count, colour, alpha, weight) and `snapToGrid`; the
scatter loop itself (count as cells²×density, size-step table, 3-way shape-type roll, palette
list, blend mode) is a clean parameter object: `{cells, density, sizeSteps, arcWeight, gridAlpha,
palette, blendMode}`. One-off art decisions: the exact palette, the cream background, the
quarter-arc aesthetic with square caps, and the 40-frame re-roll cadence.
