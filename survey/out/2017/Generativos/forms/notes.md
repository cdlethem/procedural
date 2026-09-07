---
sketch: 2017/Generativos/forms
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 163
animated: true
techniques: [grid, dots-stippling, symmetry]
primitives: [line, ellipse, rect]
palette:
  colors: ["#F46324", "#0111A3", "#FFD65E", "#00C191", "#8BD7D2", "#538BFC", "#F2E1E1", "#C96FDB", "#964CAA", "#EDAC34", "#FF66A5"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: thickBand, signature: "thickBand(x, y, angle, weight, lineColor, capColor) -> void", note: "line across the full diagonal with square cap + filled circle at the origin"}
  - {name: splitCircle, signature: "splitCircle(x, y, s, angle, c1, c2) -> void", note: "one circle painted as two 180-degree arcs in two different colours"}
  - {name: dotGrid, signature: "dotGrid(x, y, cells, spread, dotFrac, shape, rotated45) -> void", note: "cells x cells grid of dots or 45-degree rotated squares"}
  - {name: palettePick, signature: "palettePick(colors[]) -> int", note: "uniform random colour from a fixed list"}
---

## What it draws
A flat, full-bleed collage on a single solid background colour (purple in the seed-42 frame 1): a few huge thick diagonal bands with square ends, solid circles, circles split into two coloured half-discs, and small grids of dots or diamond-shaped squares scattered across the canvas. The composition is sparse in frame 1 (purple field, one pink band, one cream band, ~6 accent shapes); by frame 60 it has become a dense, busy multicolour poster (yellow and pink bands, many split circles, several dot grids in white, teal, orange).

## How the code works
`setup()` calls `generate()` once (forms.pde:5); `draw()` regenerates every 30 frames (line 9), so the "animation" is a new static collage every half second, not continuous motion. `generate()` (lines 22-77) picks a random palette colour for the background (line 23), then loops `cc = int(random(8, random(8, 30)))` times (line 26), drawing one of three shape types at a random position with size `s = random(60, 260)` (line 30) and angle `a = random(TWO_PI)` (line 31):
- `rnd == 0` (lines 33-40): a band — a `line()` from (x, y) along angle `a` with length equal to the canvas diagonal, stroked at weight `s` with square cap, plus a filled circle of diameter `s` at the start point in a second random colour. This produces the thick full-bleed diagonal bands.
- `rnd == 1` (lines 41-49): a split circle — two `arc()` calls covering complementary 180-degree halves in two different random colours (re-drawn until they differ, line 44). This produces the half-and-half discs.
- `rnd == 2` (lines 50-75): a dot grid — an `ccc x ccc` grid (`ccc = int(random(2, 16))`, line 51) of `des = ss/ccc`-spaced cells, each a dot or a square rotated 45 degrees (line 68), with a random 90-degree-multiple block rotation (line 62); dot size `d` is 10-40% of the cell (line 53). This produces the small stippled grids.
Colour is always a uniform random pick from the 11-colour list (lines 80-86, `rcol()`). All randomness enters through `random()`; with the same seed every shape position, type, and colour is fixed, and the per-30-frame regeneration just draws the next composition in the seeded sequence.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The three shape generators are cleanly separable and reusable: `thickBand` (band + cap circle), `splitCircle` (two-arc disc), `dotGrid` (parameterised grid of dots or rotated squares). The `generate()` driver — random count of randomly typed shapes on a random-colour background — is the one-off art decision; a clean parameter object would hold: shape count range, shape-size range, dot-grid cell range, dot-fill fraction, palette (colour list), background selection (from palette vs fixed), and the 45-degree grid-rotation flag.
