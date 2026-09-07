---
sketch: 2018/Generativos/OP/op_prob1
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1514
animated: false
techniques: [grid, noise-field]
primitives: [rect]
palette:
  colors: ["#E70012", "#D3A100", "#017160", "#00A0E9", "#072B45"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
parameters:
  - {name: cc, default: 30, tried: [15], change: large, effect: "fewer, bigger checkerboard squares; dots read as a denser fine-grain noise field over them"}
  - {name: dotSize, default: 0.2, tried: [0.35], change: large, effect: "corner dots fill most of each cell corner; texture becomes coarse and blocky"}
  - {name: cornerOffset, default: 0.3, tried: [0.15], change: large, effect: "dots move from the cell corners toward the cell centre; a regular dot grid appears"}
  - {name: threshold, default: 0.5, tried: [0.65], change: subtle, effect: "a few extra dots per cell; overall look barely different"}
  - {name: noiseDetail, default: random(0.05), tried: [0.01], change: moderate, effect: "dot placement correlates over many cells; dots cluster into 2x2 groups / crosses instead of looking random"}
---

## What it draws
A full-bleed black-and-white checkerboard of 30x30 squares. In many cells, one or more small
squares sit near the cell corners, in the opposite colour of the cell (white dots on black cells,
black dots on white cells). Which corners get a dot varies cell to cell, producing a dithered,
pixel-noise texture over the checkerboard. The whole image reads as a monochrome static/noise
field; no colour is visible (the random background colour is completely covered).

## How the code works
- `setup()` (lines 3-8) sizes 960x960 P2D and calls `generate()` once; `draw()` is empty
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_15 | `cc = 30;` -> `cc = 15;` | large (mean 0.4845, 0.598 of pixels) | 15x15 checkerboard with much bigger squares; dot speckles are proportionally larger and denser, image reads as coarse noise over a big checkerboard | variants/cc_15/frame_00001.png |
| dots_0.35 | `ss*0.2` -> `ss*0.35` in all four corner rects | large (mean 0.262, 0.405 of pixels) | corner dots now cover most of each cell corner; checkerboard is still visible but the texture is coarser and blockier, with big black/white masses | variants/dots_0.35/frame_00001.png |
| offset_0.15 | `ss*0.3` -> `ss*0.15` in all four corner rect positions | large (mean 0.2076, 0.314 of pixels) | dots sit near the cell centres instead of the corners; a regular grid of small dots in the middle of each cell, checkerboard reads more clearly between them | variants/offset_0.15/frame_00001.png |
| thresh_0.65 | `< 0.5` -> `< 0.65` in all four noise tests | subtle (mean 0.0369, 0.057 of pixels) | slightly more cells carry dots (more corners filled per cell); overall look nearly identical to baseline | variants/thresh_0.65/frame_00001.png |
| det_0.01 | `float detN = random(0.05);` -> `float detN = 0.01;` for N=1..4 | moderate (mean 0.1007, 0.156 of pixels) | lower noise detail makes dot placement correlate across neighbouring cells: dots form 2x2 clusters / small crosses and patches of all-dot vs no-dot cells instead of a uniform random speckle | variants/det_0.01/frame_00001.png |
  (`rcol()`, lines 23, 83-86) but is fully covered by the grid.
- Grid: `cc = 30` cells across (line 26, hard-coded over a random value), cell size
  `ss = width/cc` (line 27). Loops run `i,j` from -1 to cc (lines 39-40) so cells bleed past the
  canvas edges (full-bleed).
- Checkerboard: fill 0 or 255 by parity of `i+j` (lines 44-49), drawn as a centred `rect`
  (line 46).
- Corner dots: four independent 2-D Perlin noise fields `des1..4` + `det1..4` (lines 31-38);
  for each cell, each of the four corners gets a small `ss*0.2` square (lines 50-53) if
  `noise(desN + i*detN, desN + j*detN) < 0.5`. The dot fill is the opposite of the cell fill
  (lines 48-49), so dots read as inverted speckles. Randomness enters via the noise offsets
  (seeded), the detail values, and the background colour.
- `arc2()` (lines 58-76) and `getColor()` (lines 87-96) are unused dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic block: the checkerboard + noise-gated corner dots is a clean, parameterisable unit
  (grid size, dot size, corner offset, noise detail/offset, threshold) — a candidate
  `noiseCornerDots` function as above.
- One-off art decisions: hard-coded `cc = 30` (line 26) overriding a random range; strictly
  black/white cell colours regardless of the palette; four independent noise fields per corner
  (could be one field with corner-index offset).
- A clean parameter object: `{grid, dotSize, cornerOffset, noiseDetail, noiseSeed, threshold,
  cellColors: [0, 255], backgroundColor}`.
