---
sketch: 2017/Generativos/Cuadricula
year: 2017
renderer: P3D
size: [920, 920]
libraries: []
deterministic: true
ms_first_frame: 1597
animated: false
techniques: [grid, noise-field]
primitives: [shape]
palette:
  colors: ["#EBB858", "#EEA8C1", "#D0CBC3", "#87B6C4", "#EA4140", "#5A5787"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: rw, default: "random(2,200)", tried: [40], change: null, effect: ""}
  - {name: rh, default: "random(2,100)", tried: [30], change: null, effect: ""}
  - {name: det, default: "random(0.005)", tried: [0.02], change: null, effect: ""}
  - {name: hh, default: "dw*2.0", tried: ["dw*8.0"], change: null, effect: ""}
  - {name: stroke, default: "0,90", tried: ["0,255"], change: null, effect: ""}
  - {name: ic, default: "random(colors.length)", tried: [0], change: null, effect: ""}
reusable_candidates:
  - {name: noiseDisplacedGrid, signature: "noiseDisplacedGrid(cols, rows, noiseScale, amp, palette) -> quads", note: "rectangular grid of quads with per-vertex Perlin z-displacement"}
  - {name: lerpPalette, signature: "lerpPalette(v, colors[]) -> color", note: "cyclic lerp between adjacent palette entries, line 67-73"}
---

## What it draws
A full-bleed mosaic of small colored rectangular tiles arranged in rows and columns, with
thin dark grid lines between them. The tile columns undulate gently: each vertical band
sways left-right in a wavy pattern, so the grid reads as a flat quilted surface. The
palette is a mix of mustard yellow, salmon/pink, muted red, grey-blue, lavender-grey and
beige, with colors shifting mostly along the columns.

## How the code works
`setup()` (line 3-8) calls `generate()` once; `draw()` (line 10-17) is empty apart from
commented-out code, so the sketch is static. `generate()` (line 29-60) clears to black
(line 30), then picks a random row count `rh` in [2,100) and column count `rw` in
[2,200) (lines 32-33) — the actual values differ per seed. A noise scale `det` is drawn
from [0,0.005) (line 35); `des` (line 36) is dead code, never used. Cell size is
`dw = width/rw`, `dh = width/rh` (lines 38-39), and `hh = dw*2` (line 40) is the z
displacement amplitude. Stroke is near-black with low alpha `stroke(0,90)` (line 42).
The double loop (lines 43-58) iterates rows j, columns i; per row a random palette
offset `ic` (line 44) and step `dc = 3 + random(0.02)` (line 45) are drawn. Each cell is
a closed quad (beginShape, lines 52-57) whose four corner vertices get a z offset of
`noise(x*det, y*det)*hh` (lines 53-56) — the wavy columns come from the 2-D Perlin
field sampled at each corner. Fill is `getColor(dc*i+ic)` (line 51): the palette value
advances with column index, and `getColor` (lines 67-73) wraps the value modulo 6 and
lerps between two adjacent palette colors, so hue shifts smoothly across columns while
each row starts at a random offset. The palette (line 62) is a fixed 6-color list from
coolors.co. Randomness enters via `rh`, `rw`, `det`, and the per-row `ic`/`dc`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The generic core is the grid generator: a cols x rows loop emitting closed quads with
per-vertex Perlin z-displacement (`noiseDisplacedGrid(cols, rows, noiseScale, amp, palette)`).
`lerpPalette(v, colors[])` is a small reusable cyclic color-lerp helper. One-off art
decisions: the 6-color palette, the low-alpha dark stroke, the per-row random palette
offset `ic`, and the `dc*i` progression (color as a function of column). A clean
parameter object would be `{cols, rows, noiseScale, amplitude, palette, paletteOffset,
colorStep, stroke: [r,g,b,a], size}`.
