---
sketch: 2018/Generativos/quadis5
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1528
animated: false
techniques: [grid]
primitives: [shape]
palette:
  colors: ["#B14027", "#476086", "#659173", "#9293A2", "#262A2C", "#D38644"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 100, tried: [300], change: large, effect: "more overlapping squares; later large flat squares cover much of the composition"}
  - {name: sizeExponents, default: "1-9", tried: ["1-4"], change: large, effect: "only large squares (480-60 px); canvas covered by a few big flat/mosaic blocks, no fine detail"}
  - {name: gridRange, default: "2-16", tried: ["2-6"], change: subtle, effect: "subtle: mosaic tiles slightly larger/coarser, layout otherwise identical"}
  - {name: gap, default: 3, tried: [8], change: subtle, effect: "subtle: wider dark gaps make mosaic tiles look like thinner strips/dots"}
  - {name: mosaicProbability, default: 0.95, tried: [0.2], change: large, effect: "most squares become flat single-colour fills; mosaics only on a minority"}
reusable_candidates:
  - {name: mosaicSquare, signature: "mosaicSquare(x, y, size, cols, rows, gap, color, seed) -> void", note: "flat square plus inset sub-grid of small quads with per-tile white gradient and diagonal shadow"}
---

## What it draws
A dark charcoal canvas scattered with overlapping squares of many sizes, from large
(half the canvas) down to a few pixels. Most squares are not flat: they are mosaics of
small rectangles in a regular sub-grid separated by thin dark gaps, each square a single
palette colour (orange, slate blue, muted green, grey, brick red). Each square carries a
soft diagonal shadow cast to one corner, and large squares show a faint light-to-dark
diagonal shading across their face.

## How the code works
`setup()` (L3-8) sizes 960x960 P2D and calls `generate()` once; `draw()` is empty, so the
image is static (confirmed: baseline frames 10/60 identical to frame 1). `generate()` (L21-137):
- Background is one random palette colour via `rcol()` (L22); with seed 42 it lands on the
  near-black `#262A2C`.
- Loop of 100 squares (L25). Size `ss = width / pow(2, int(random(1,9)))` (L26): powers of
  two from 480 down to ~4 px. Position is random then snapped to a grid of its own size:
  `x -= x%ss` (L27-30), so squares tile/overlap on aligned lattices.
- Shadow: `dd = ss*random(1)` (L32) is the diagonal offset. Two quads filled `fill(0,50)`
  at the top-right and bottom-left corners fade to `fill(0,0)` at the far diagonal corner
  (L45-61), producing the soft cast-shadow look.
- The main square is filled `rcol()` (L63-69). Two overlay quads add face shading: a black
  alpha-10 gradient from the bottom-right corner (L71-79) and a white alpha-10 gradient
  from the top-left (L81-89).
- If `ss > 10 && random(1) < 0.95` (L91): an inset frame ring (`fill(0,12)`, L96-104) then
  the mosaic: `cw` x `ch` tiles (each `int(random(2,16))`, L106-107) with gap `sb = 3`
  (L93). Each tile is a quad of the square's colour (L118-124) plus a white alpha-4
  gradient quad (L125-132). Small squares (ss <= 10) or the 5% failure stay flat.
- Palette `colors[]` (L145): 6 muted colours; `rcol()` picks uniformly at random (L146-148).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int c = 0; c < 100; c++) {` -> `c < 300` | large (0.2264, 0.853) | canvas much busier; big flat squares (orange, red, blue, green, grey) drawn later cover most of the field, small mosaics still visible between them | variants/count_300/frame_00001.png |
| sizeExp_1_4 | `int(random(1, 9))` -> `int(random(1, 4))` | large (0.2188, 0.768) | only large squares remain (480 down to 60 px); whole canvas covered by a few big flat or coarse-mosaic blocks, no tiny squares | variants/sizeExp_1_4/frame_00001.png |
| gridDensity_2_6 | `int(random(2, 16))` -> `int(random(2, 6))` (cw and ch) | subtle (0.0158, 0.065) | subtle: mosaic squares have fewer, larger tiles (coarser texture); square positions, sizes and colours unchanged | variants/gridDensity_2_6/frame_00001.png |
| gap_8 | `int sb = 3;` -> `int sb = 8;` | subtle (0.018, 0.077) | subtle: gaps between mosaic tiles noticeably wider, tiles read as thinner strips or dots; overall layout unchanged | variants/gap_8/frame_00001.png |
| patternProb_0.2 | `random(1) < 0.95` -> `random(1) < 0.2` | large (0.2674, 0.9) | most squares are now flat single-colour fills; mosaic sub-grids appear on only a minority of squares; composition reads as large colour blocks | variants/patternProb_0.2/frame_00001.png |

## Modularisation notes
- Generic: the mosaic-square primitive (inset frame + cw x ch sub-grid with gap + per-tile
  gradient) is self-contained (L91-135) and would work as a library function given
  (x, y, size, cols, rows, gap, color). The corner-fade shadow quads (L45-61) are a small
  reusable "cast shadow" effect. Size snapping `x -= x%ss` (L29-30) is a one-liner worth
  extracting as grid-aligned placement.
- One-off art decisions: the fixed 6-colour muted palette, the 100-iteration count, the
  power-of-two size distribution (exponents 1-9), the 0.95 mosaic probability, and the
  double-diagonal shadow orientation.
- A clean parameter object: {count, sizeExponents: [1,9], mosaicProbability, gridRange:
  [2,16], gap, shadowAlpha, insetScale, palette, background}.
