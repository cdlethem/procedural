---
sketch: 2018/Generativos/cubidata
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1446
animated: false
techniques: [grid]
primitives: [rect]
palette:
  colors: ["#01903B", "#FEE643", "#F3500A", "#0066B8", "#583106", "#F4EEE0", "#000000", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(4, 120)) (10 at seed 42)", tried: [40], change: large, effect: "coarser resolution: 40x40 fine grid reads as a busy pixel-art texture, insets become tiny dots"}
  - {name: insetProb, default: 0.5, tried: [1.0], change: large, effect: "every cell gets a centered inset square; the sparse-dot look becomes a uniform cell-plus-dot pattern"}
  - {name: insetScale, default: 0.2, tried: [0.5], change: moderate, effect: "inset squares grow to half the cell size, dominating their cells; cell fills unchanged"}
  - {name: strokeAlpha, default: 8, tried: [80], change: none, effect: "no visible change overall; hairline grid becomes a visible grey grid but occupies only 2.3% of pixels"}
  - {name: blackProb, default: 0.5, tried: [0.8], change: large, effect: "mostly black canvas with sparse white cells; density of the two colours is directly controlled by this probability"}
reusable_candidates:
  - {name: randomCellGrid, signature: "randomCellGrid(cellCount, innerProb, innerScale, innerFlip) -> void", note: "tiled grid of randomly black/white cells, a fraction of which get a centered smaller counter-colored square"}
---

## What it draws
A full-bleed 10×10 grid of large squares, each randomly solid black or white, with a faint
hairline grid overlaying the whole canvas. Roughly half the cells contain a small square
(20% of the cell size) centered in the cell, again randomly black or white, so each small
square sits on the opposite colour of its parent cell. The background (a random pick from a
six-colour palette: green, yellow, orange, blue, dark brown, off-white) is off-white here,
a black-and-white checkerboard-like mosaic with dot accents.

## How the code works
`setup()` (cubidata.pde:3-8) sizes 960×960 P2D, calls `pixelDensity(2)` (unavailable on the
headless display, so effective density is 1) and runs `generate()` once; `draw()` is empty so
the piece is static. `generate()` (lines 22-45):
- `background(rcol())` (line 23) paints the canvas a random colour from the `colors[]`
  palette (lines 52-55, `random-from-list`).
- `cc = int(random(4, 120))` (line 25) picks the grid resolution; with seed 42 it is 10, so
  cell size `ss = width/cc = 96 px` (line 26).
- `stroke(0, 8)` (line 29) sets a nearly transparent black outline — the faint hairline grid.
- Double loop (lines 33-44) over the `cc`×`cc` cells: each cell is filled black or white
  (50/50, lines 31/39-40 for the small square) and drawn with `rect(i*ss, j*ss, ss, ss)`
  (line 35).
- With 50% probability (line 37) a smaller square of side `ss*0.2` (line 38) is drawn
  centered in the cell (line 41), also randomly black or white, so it contrasts the parent.
Randomness enters via the `seed` field (line 1, set by the harness) and the per-cell
`random(1)` coin flips; no noise is used. `getColor()`/`getColor(float)` (lines 56-64,
palette lerp) and `saveImage()` (lines 47-50) are unused in the static render path.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_40 | `int cc = int(random(4, 120));` -> `int cc = 40;` | large | 40x40 fine grid; reads as busy black-and-white pixel-art with a tiny centred dot in about half the cells; grid lines no longer perceptible relative to cell size | variants/cc_40/frame_00001.png |
| insetProb_1.0 | `if (random(1) < 0.5) {` -> `if (random(1) < 1.0) {` | large | every cell now has a centred inset square; uniform cell-plus-dot pattern instead of sparse dots | variants/insetProb_1.0/frame_00001.png |
| insetScale_0.5 | `float sss = ss*0.2;` -> `float sss = ss*0.5;` | moderate | inset squares grow to half the cell size and dominate their cells; underlying cell fills unchanged | variants/insetScale_0.5/frame_00001.png |
| strokeA_80 | `stroke(0, 8);` -> `stroke(0, 80);` | none | no visible change overall; the hairline grid becomes a visible grey grid over the cells, but it occupies only 2.3% of pixels | variants/strokeA_80/frame_00001.png |
| blackProb_0.8 | `if (random(1) < 0.5) fill(0);` -> `if (random(1) < 0.8) fill(0);` | large | mostly black canvas with sparse white cells; directly inverts the density of the two colours | variants/blackProb_0.8/frame_00001.png |

## Modularisation notes
The whole `generate()` body is one reusable primitive: a tiled random cell grid with an
optional centered inset square. A clean parameter object would be
`{ cellCount, cellFillProb (P(black)), insetProb, insetScale, insetFillProb, bgPalette, gridLineColor, gridLineAlpha }`
returning nothing (draws directly) or a list of rects. Art-specific decisions: the binary
black/white cell colour (vs. the 6-colour palette that is only used for the background),
the 50/50 coin flips, the fixed 0.2 inset scale, and the near-invisible stroke alpha of 8.
The `getColor()` lerp helper is a generic palette-lerp utility already unused here.
