---
sketch: 2018/Generativos/postis
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1577
animated: false
techniques: [grid, 3d-pointcloud, distortion]
primitives: [shape]
palette:
  colors: ["#FFFEF8", "#FAE0E0", "#E66B85", "#AFE9E5", "#64B9DA", "#427FAD", "#3C5A81", "#252B22", "#539A6D", "#ADBF83"]
  selection: random-from-list
composition: centered
parameters: []
reusable_candidates:
  - {name: mosaicGrid3D, signature: "mosaicGrid3D(cells, tileSize, colorFn, jitter) -> void", note: "grid of jittered random quads in a 3D-transformed plane"}
---

## What it draws
A dark charcoal-green background with a cluster of floating mosaic "sheets" in the center of the canvas. Each sheet is a grid of small, slightly irregular colored tiles (squares/quadrilaterals) in blues, pinks, greens and off-white, drawn with mild 3D perspective tilt so some sheets recede and shrink toward the edges. The overlapping sheets form a dense, confetti-like patch in the middle, with sparser tile columns fringing the left and bottom.

## How the code works
`generate()` (postis.pde:30) runs once in `setup()`; `draw()` is empty, so the piece is static. It sets a random perspective camera (fov random 1.1..2 rad, line 38-41), centers the origin (line 44), then loops 10 times (line 47): each iteration translates to a random position in a ±1000 box with a fixed small z offset of 200 (line 50) and applies small random X/Y/Z rotations bounded by `maxRot = random(0.2)` (lines 48, 51-53). Inside, it builds a `cc × cc` grid where `cc = int(random(8, 45))` (line 55) over a `1800×1800` virtual area (line 57); each cell draws one filled quad (beginShape/endShape, lines 67-76) whose four corners are jittered independently by `random(0.6, 1)` fractions of the half-cell size (lines 64-65, 69-75), so tiles overlap or leave gaps. Fill is a per-vertex `lerpColor` between two random palette colors (line 68 etc.); the palette (line 90) is 10 colors mixing cream/pink blues/greens/dark olive, and the background is one random palette color (line 36). Randomness enters via `randomSeed(seed)` at line 34.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The reusable core is the jittered mosaic grid: a `cc × cc` loop drawing one quad per cell with per-corner random jitter and per-vertex lerped fill (lines 55-78) — generic as `mosaicGrid3D(cells, size, colorFn, jitter)`. The 10-layer scatter (random 3D translate + bounded rotations, lines 47-53, 79) is a second generic block, a "sheet scatter" that places a 2D pattern in 3D space. One-off art decisions: the specific 10-color palette, the ±1000 translate box, the 200 z-offset, the maxRot bound of 0.2, and the 1800 grid size. A clean parameter object would contain: layerCount, cells, gridSize, zOffset, maxRot, translateExtent, palette, jitterRangeError: RangeError: RangeError: RangeError: RangeError: RangeError: write failed: write failed: repeated tool call with no progress
repeated tool call with no progress
repeated tool相同的内容，继续