---
sketch: 2014/Generativos/pastelines
year: 2014
renderer: P2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 1625
animated: false
techniques: [grid, distortion, dots-stippling]
primitives: [shape, ellipse]
palette:
  colors: ["#FFF3EB", "#FFEED4", "#F0CFCC", "#BFCFDE", "#ABBECF"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: displacedGrid, signature: "displacedGrid(x, y, w, h, cell, noiseAmp) -> void", note: "grid of quads whose corners are jittered by a random offset; each cell filled from a palette"}
---

## What it draws
A full-bleed pastel mosaic on a 600x800 canvas. The background is a grid of
irregular, slightly-warped quadrilaterals (a "torn-paper" / mosaic look) in a
soft palette of cream, pale pink and blue-grey. Scattered over this are many
small filled dots in the same pastel colours, some carrying a faint set of
concentric ring outlines around them. Static (frame 10/60 identical to frame 1).

## How the code works
`setup()` (pastelines.pde:5) calls `generar()` once; `draw()` (line 11) is empty
so the piece is static.

`generar()` (line 14):
- Line 15: fills the background with a random palette colour (`rcol()`, line 41,
  picks uniformly from `paleta[]` line 1-3).
- Line 16: `tam = random(10,160)` is the grid cell size.
- Lines 17-18: derive grid column/row counts `cw`, `ch`.
- Line 19: calls `cuadricula(...)` with a per-corner jitter amplitude
  `random(tam/8, tam/2)`.
- `cuadricula` (line 45): loops over `cw x ch` cells; for each cell corner
  (lines 52-55) it offsets the lattice point by a random angle `ang` and random
  distance `des` in `[-noi, noi]`, storing a `PVector` per corner. When both the
  upper-left neighbour cells exist (line 58) it emits a closed quad
  (`beginShape`/`vertex`/`endShape(CLOSE)`, lines 59-64) filled with a random
  palette colour (line 57). The shared, jittered corners make neighbouring quads
  tile edge-to-edge into the warped mosaic.
- Lines 20-33: 200 scattered dots. Each picks a random (x,y) (lines 22-23);
  draws 4 concentric unfilled ellipses of diameter `tt` (line 20) with growing
  `strokeWeight(j)` at near-invisible `stroke(0,2)` (lines 24-29) — faint rings;
  then draws a filled ellipse of diameter `tt` in a random palette colour
  (lines 30-32) — the solid dot.

Randomness enters at: background colour, `tam`, per-cell corner angle/distance,
per-quad and per-dot colour, and each dot position. No blend modes; P2D renderer.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
`cuadricula` (line 45) is the generic, reusable block: a jittered lattice of
edge-to-edge quads — parameterise as `displacedGrid(x, y, w, h, cell, noiseAmp, palette)`.
The dot-scatter loop (lines 20-33) is a separate generic "scatterDots(count,
diameter, ringCount, palette)" routine. One-off art decisions: the 5-colour pastel
palette, the 4-ring faint outline, and the specific jitter range `random(tam/8,
tam/2)`. A clean parameter object: `{cellSize, cellJitter, dotCount, dotDiameter,
dotRings, palette, backgroundColor}`.
