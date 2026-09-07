---
sketch: 2017/Generativos/cybergrids
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1499
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#000000", "#FFFFFF", "#FF7700", "#15FF4A", "#BBBBFF"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: 200, tried: [600, 50], change: large, effect: "higher = far finer, denser mosaic of small multicolour cells; lower = slightly coarser but still fine-grained at 50"}
  - {name: cellRange, default: [0.1, 0.4], tried: [0.4, 1.0], change: large, effect: "larger cells: chunky grid, smooth band gradients instead of fine mosaic"}
  - {name: desScale, default: 8, tried: [30], change: large, effect: "faster colour cycling: wide diagonal colour stripes across big regions"}
  - {name: palette, default: "8-entry {black, white, orange, green, lavender}", tried: ["5-entry warm {#280f04,#e2dcd0,#bf1a2b,#417f5c,#6898c1}"], change: large, effect: "warm brown/red/cream/teal tones replace neon green/orange/black; same layout logic"}
  - {name: splitRange, default: [0.1, 0.9], tried: [0.35, 0.65], change: large, effect: "near-centre splits give a regular repeating banded structure"}
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(rect, nSplits) -> Rect[]", note: "repeatedly pick a random leaf rect and split it into 4 children at one random interior point (lines 44-55)"}
  - {name: gradientCellGrid, signature: "gradientCellGrid(rect, cellsW, cellsH, colorOffset, angle, step) -> void", note: "fill a rect with a grid of cells whose colour walks a cyclic lerped palette along a random direction (lines 58-75)"}
  - {name: cyclicPaletteLerp, signature: "getColor(palette[], v) -> color", note: "wrap v over palette, lerp between adjacent entries for a continuous cyclic ramp (lines 85-91)"}
---

## What it draws
The whole 960x960 canvas is tiled by a nested set of rectangular regions (a quad-tree
subdivision with off-centre split points). Each region is filled with a tight grid of small
square cells whose colours form a smooth gradient along one direction, cycling through a
black / white / orange / green / lavender palette. The baseline (seed 42) reads as large
horizontal bands — a dense multicolour mosaic block top-left, a white-to-grey-to-lavender
band, a black band, a vivid green band, an orange band, and a white band — plus a narrow
right-hand column of thin vertical cell strips. Dominant colours: black, green, orange.

## How the code works
`setup()` (line 3) sets 960x960 P2D, then calls `generate()`. `draw()` is empty (line 12),
so the sketch is static; key presses reseed.

1. Background: one random palette colour (`background(rcol())`, line 39; `rcol()` at 82-84).
2. Subdivision (lines 41-55): start with the full canvas as one `Rect`;
   `sub = int(random(200)*random(1))` (line 44) gives 0-199 splits. Each iteration picks a
   random leaf rect, cuts it into 4 children at a single random point
   (`nw, nh` in 0.1-0.9 of its size, lines 48-49), replaces the leaf with the 4 children.
   Random split points (not centres) produce the ragged band/column layout.
3. Cell fill (lines 58-75): for each leaf rect, `cw/ch` = 10-40% of the rect's
   w/h (min 2) (lines 60-61) set cell count; a random colour start `ic` (64), a random
   angle (65) and step `des` (66) define a 2-D colour offset per cell index
   (`ic + cos(ang)*des*i + sin(ang)*des*j`, line 71), so each region shows a diagonal/
   horizontal/vertical gradient through the palette.
4. Colour: `getColor()` (85-91) wraps `v` over the 8-entry `colors[]` (line 80) and lerps
   between adjacent entries — a continuous cyclic ramp, so gradients blend smoothly and
   loop. The palette has 3 black slots out of 8, which is why black dominates.
5. Renderer: P2D with `smooth(8)`; no blend modes, no transforms — plain `rect()` calls.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_600 | `int sub = int(random(200)*random(1));` -> `...random(600)*random(1));` | large (mean 0.2941, 84% px) | far finer, denser mosaic; nearly every region resolves into small multicolour pixel-noise cells, no large smooth bands | variants/sub_600/frame_00001.png |
| sub_50 | same -> `...random(50)*random(1));` | large (mean 0.2972, 83.8% px) | still fine-grained but with bigger flat zones: large solid-green field, right column of multicolour vertical strips | variants/sub_50/frame_00001.png |
| cells_0.4_1.0 | `int cw = ...random(r.w*random(0.1, 0.4))...` -> `0.4, 1.0` (and `ch` line) | large (mean 0.2483, 74.7% px) | much larger square cells: red/teal/cream checker-like grid top-left, smooth vertical gradient bands (blue-to-green, red-to-cream) below | variants/cells_0.4_1.0/frame_00001.png |
| des_30 | `...random(8))*random(0.1, 1);` -> `...random(30))*random(0.1, 1);` | large (mean 0.2728, 80.9% px) | wide diagonal colour stripes (green/orange/white/lavender/black) sweep across big regions instead of a fine mosaic | variants/des_30/frame_00001.png |
| palette_warm | `int colors[] = {#000000, #FFFFFF, #FF7700, ...}` -> 5 warm colours | large (mean 0.2121, 76.8% px) | warm brown/red/cream/teal/green tones; smooth gradient bands (blue-green-red-cream) plus fine mosaic top-left; no neon green/orange | variants/palette_warm/frame_00001.png |
| split_0.35_0.65 | `float nw = r.w*random(0.1, 0.9);` -> `0.35, 0.65` (and `nh` line) | large (mean 0.289, 79.3% px) | near-centre splits give a regular, repeating horizontal band structure (green/orange/white/black stripes) | variants/split_0.35_0.65/frame_00001.png |

Note: every parameter change scores `large` because the split loop consumes a number of
`random()` calls that depends on `sub` and the resulting layout; changing one value shifts
the whole RNG stream and re-rolls the entire composition, so the diff is dominated by the
re-rolled layout. The parameter-specific effect is visible within each image (cell size,
stripe width, palette, band regularity) as described above.

## Modularisation notes
- Generic, library-worthy: (a) the 4-way random-point quad subdivision (produces an
  irregular mosaic tiling from a seed count); (b) the gradient cell-grid fill
  (rect, cell counts, colour direction/step, palette) — a "cybergrid" primitive;
  (c) the cyclic palette-lerp colour function.
- One-off art decisions: the specific 8-entry palette (3 of 8 slots black), the
  10-40% cell-count range, the `des` step distribution, the off-centre split ratio
  0.1-0.9, and drawing one region at a time with its own random gradient axis.
- Clean parameter object: `{subdivisions, splitRange, cellRange, stepScale, palette,
  backgroundMode}`.
