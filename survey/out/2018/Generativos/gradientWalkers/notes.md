---
sketch: 2018/Generativos/gradientWalkers
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1498
animated: false
techniques: [grid, particles]
primitives: [shape, rect]
palette:
  colors: ["#EE3425", "#000000", "#D3D3D3", "#FEFEFE"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: cc, default: "random(8, random(20,40))", tried: [24, 8], change: large, effect: "24 = dense small-tile mosaic; 8 = coarse 8x8 tiles with big smooth gradients"}
  - {name: walkers, default: 100, tried: [20], change: large, effect: "fewer walkers -> more pure-black unvisited cells, sparser tiles"}
  - {name: steps, default: 200, tried: [40], change: large, effect: "shorter walks -> more black gaps, less connected tile paths"}
  - {name: turnProb, default: 0.25, tried: [0.6], change: large, effect: "more turning -> shorter straight runs, more uniform mix of tile orientations"}
  - {name: gridStroke, default: "0,10", tried: ["255,60"], change: none, effect: "no visible change; stroke is overdrawn by the gradient tiles"}
reusable_candidates:
  - {name: randomWalkGrid, signature: "randomWalkGrid(cc, walkers, steps, turnProb) -> int[][]", note: "random walkers over a grid storing the last 4-way direction (0/2/4/6) per visited cell; -1 = unvisited"}
  - {name: gradientTile, signature: "gradientTile(x, y, s, dir) -> void", note: "black<->white gradient tile from two vertex-coloured trapezoids plus a diagonal split quad, oriented by dir"}
---

## What it draws
A full-bleed 11x11 mosaic of square tiles on black. Nearly every tile is a smooth
black-to-white gradient: some run vertically (bright top or bright bottom), some
horizontally, some as a diagonal white/black split. A handful of cells are pure
black (never visited by a walker). No colour — only grayscale gradients and black.

## How the code works
`setup()` calls `generate()` once (`draw()` is empty, so the image is static;
`keyPressed` regenerates on any key). `generate()` (gradientWalkers.pde):
- Line 23: black background. Line 25: `cc = int(random(8, random(20, 40)))` sets the
  grid count (11 for seed 42); `ss = width/cc` is the cell size (line 26).
- Lines 33-38: every cell is marked `-1` in `values[][]` and outlined with a nearly
  invisible `stroke(0, 10)` rect.
- Lines 40-64: 100 walkers. Each starts at a random cell (lines 41-42) and takes 200
  steps (line 48), moving one cell in one of 4 cardinal directions (lines 49-50); with
  25% probability per step the direction changes by a random wrap-around amount
  (lines 52-56). The visited cell stores `ndir = dir*2`, so only values 0/2/4/6 occur
  (line 58, line 61); unvisited cells stay -1.
- Lines 66-165: rendering. `val 0/4` (right/left move) draws two vertex-coloured
  trapezoids (fill 0,0 -> 0,240) forming a vertical gradient across the cell
  (lines 74-92); `val 2/6` draws the horizontal equivalent (lines 94-112). Then
  `val 0/2/4/6` overlays a quad split into a white half and a black half with a
  diagonal edge (lines 114-156). Cells with `val == -1` get nothing, staying black.
- Randomness enters only via `random()` for `cc`, walker starts, steps and turns.
  No Perlin noise. The `colors[]` palette (lines 172-185, includes #EE3425) is dead
  code: `rcol()`/`getColor()` are never called, and all fills are hardcoded 0/240/255.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `randomWalkGrid(cc, walkers, steps, turnProb) -> int[][]` is fully generic: the
  walker loop (lines 40-64) only depends on grid size and the turn probability.
- `gradientTile(x, y, s, dir)` is a generic primitive: the two trapezoid + split-quad
  pattern (lines 74-156) is direction-parameterisable and reusable for any
  "orient a tile by a flow value" effect.
- One-off art decisions: the exact trapezoid geometry (half-cell offset), the 0/240
  brightness, the dead `colors[]` palette, and the key-press regeneration behaviour.
- A clean parameter object: `{cc, walkers, steps, turnProb, minGray (0), maxGray (240),
  gridStrokeAlpha, seed}`.
