---
sketch: 2020/generative/01_04/suelo
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1510
animated: false
techniques: [grid, polar, symmetry]
primitives: [line, rect, ellipse]
palette:
  colors: ["#FFFFFF", "#000000", "#F3B2DB", "#518DB2", "#02B59E", "#DCE404"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: div, default: 8, tried: [4, 16], change: moderate/large, effect: "lower = fewer, larger cells (clearer motifs); higher = fine dense lattice"}
  - {name: strokeWeight, default: 2.5, tried: [1.0], change: moderate, effect: "thinner lines, lighter overall image, less dark overlap"}
  - {name: strokeAlpha, default: 180, tried: [60], change: large, effect: "much fainter, pale pencil-like lines; every line affected"}
  - {name: ellipseCount, default: 48, tried: [24], change: moderate, effect: "half the rings: sparser radial field, grid reads more clearly"}
  - {name: dd, default: "ss/4", tried: ["ss/2"], change: large, effect: "motif scales with cell: full corner-to-center diagonals, half-cell square, bigger circles"}
reusable_candidates:
  - {name: radialRings, signature: "radialRings(cx, cy, n, maxDiameter, step) -> void", note: "concentric ellipses centered on the canvas, diameter mapped linearly"}
  - {name: motifGrid, signature: "motifGrid(div, offset) -> void", note: "grid of cells each containing corner diagonals, axis ticks, a center rect and 3 small ellipses (checkerboard-sized)"}
---

## What it draws
A dense, symmetric black-and-white line composition on white. An 8x8 grid of square cells covers the whole canvas (full-bleed, cells bleed past the edges); each cell contains corner diagonals, short axis ticks, a small square in its center, and a few small circles whose sizes alternate in a checkerboard pattern. Over this lattice runs a field of ~48 concentric ellipses centered on the canvas, so the whole image reads as a radial mandala whose density peaks at the center. All lines are the same semi-transparent black; no fill colors are used despite a palette array existing in the code.

## How the code works
`generate()` (lines 42-141), called once from `setup()`; `draw()` is empty, so the piece is static.

- Background white (line 46), `smooth(8)` antialiasing, P3D renderer (line 16).
- First block (lines 91-94): loop `i` from 0 to 95 step 2 (48 iterations); diameter `map(i, 0, 64, 0, width)` so the largest ellipse is 1.5x the canvas width; each is a `noFill()` ellipse centered at `(width/2, height/2)` with `stroke(0, 180)` and `strokeWeight(2.5)`. This produces the radial ring field.
- Second block (lines 97-140): `div = 8` grid, `ss = width/8 = 120` px cells, `dd = ss/4 = 30` px offset. Double loop over `i, j` from -1 to div-1 (cells extend past all four edges, hence full-bleed). Per cell:
  - four corner diagonals of length `dd` (lines 106-109) and axis ticks on two edges (111-115) -> the crosshatched lattice;
  - a center square `rect(x+dd, y+dd, dd*2, dd*2)` (line 128) -> the small squares visible in each cell;
  - a circle of diameter `dd` (line 131) plus two circles of diameter `dd*mul` where `mul` is 0.5 or 1.0 depending on `(i+j)%2` (lines 133-138) -> the checkerboard alternation of circle sizes.
- Randomness: only `seed` (line 4, overridden by the harness) feeds `randomSeed`/`noiseSeed`; the geometry is fully deterministic once seeded. `SimplexNoise` and triangulate are imported but never called. The `getColor()` palette functions (lines 157-171, palette at line 154) are only referenced in commented-out `fill()` calls, so the image is pure black-on-white.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_4 | `int div = 8;` -> `int div = 4;` | moderate | 4x4 grid: cells and motifs (square, circles, diagonals) are 4x larger; layout reads as sparse individual cells, ring field unchanged | variants/div_4/frame_00001.png |
| div_16 | `int div = 8;` -> `int div = 16;` | large | 16x16 grid: fine dense lattice of tiny squares/circles/diagonals, much busier, mandala center still visible | variants/div_16/frame_00001.png |
| strokeWeight_1.0 | `strokeWeight(2.5);` -> `strokeWeight(1.0);` | moderate | same geometry, lines visibly thinner; image lighter, overlaps less dark | variants/strokeWeight_1.0/frame_00001.png |
| strokeAlpha_60 | `stroke(0, 180);` -> `stroke(0, 60);` | large | identical geometry in much fainter grey; whole image looks like a light pencil sketch | variants/strokeAlpha_60/frame_00001.png |
| ellipseCount_24 | `for (int i = 0; i < 96; i+=2) {` -> `... i < 48 ...` | moderate | half the concentric rings (24); ring spacing doubled, radial density clearly reduced, grid more prominent | variants/ellipseCount_24/frame_00001.png |
| dd_ss2 | `float dd = ss/4.;` -> `float dd = ss/2.;` | large | motif offset doubles: corner diagonals run full corner-to-center, center square fills half the cell, circles larger; busier, more angular pattern | variants/dd_ss2/frame_00001.png |

## Modularisation notes
Two clean, reusable blocks: (1) the concentric-ring field (lines 91-94) — parameterised by count, step, and max diameter, renderer-agnostic; (2) the motif grid (lines 97-140) — a per-cell motif function of (cellSize, offset, checker parity) that draws diagonals, ticks, a center rect, and circles. The commented-out color/fill machinery (lines 54-83, 127-138, 157-171) is an art-direction layer: a clean parameter object would carry `div`, `ddFraction`, `ringCount`, `ringMaxDiameterFraction`, `strokeWeight`, `strokeAlpha`, and an optional per-cell color callback (index -> color). The unused `SimplexNoise`/triangulate imports and the `export`/`keyPressed` save plumbing are one-off scaffolding to drop.
