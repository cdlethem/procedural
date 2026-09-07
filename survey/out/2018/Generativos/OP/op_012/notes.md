---
sketch: 2018/Generativos/OP/op_012
year: 2018
renderer: P2D
size: [6500, 6500]
libraries: []
deterministic: true
ms_first_frame: 3859
animated: false
techniques: [grid, symmetry]
primitives: [rect]
palette:
  colors: ["#FFFFFF", "#011731", "#A12677", "#EE3C7A", "#EE2D30", "#EC4532", "#FFCA2A", "#3DB98A", "#16A5DF"]
  selection: random-from-list
composition: tiled
parameters: []
reusable_candidates:
  - {name: checkerRoundedSquares, signature: "checkerRoundedSquares(cols, rows, cornerAmp, colorsA, colorsB, swapProb) -> void", note: "two-layer offset checkerboard: full-bleed two-tone base layer, then half-cell-offset rounded squares in two other tones; the interstitial diamonds are the base layer showing through"}
---

## What it draws
A full-bleed checkerboard of rounded squares alternating dark navy and gold/yellow on a black
ground. The rounded corners leave diamond-shaped gaps at every four-square intersection: the
gap centres are small black diamonds, surrounded by pale lavender-pink, forming a regular
lattice of pinwheel-like negative space. No text, no strokes; pure flat fills.

## How the code works
`setup()` (op_012.pde:2-9) sizes a 6500x6500 P2D canvas, calls `generate()` once, saves and
exits; `draw()` is empty so the image is static.

`generate()` works in two tiled layers:
1. **Base checkerboard** (lines 25-59): picks grid counts `cw`/`ch` = `int(random(14, random(20, 40)))`
   each (line 25-26), so the baseline (seed 42) lands near 20x20 cells of ~325px. Two colours
   `c1` = lerp toward black 0.6-1.0, `c2` = lerp toward white 0.6-1.0 (lines 31-32) are picked
   from the 9-colour palette (line 99) via `getColor()` (random entry + lerp to the next entry,
   lines 105-114). A random mode `rnd` in {0,1,2} (line 36) chooses the checker axis (columns,
   rows, or diagonal); each cell is a `rect(i*ww, j*hh, ww, hh)` with the matching fill (lines
   37-58). With 10% probability (line 52) a cell is re-randomised between c1/c2, adding
   speckle. This layer fully tiles the canvas.
2. **Offset rounded layer** (lines 61-71): a second checkerboard of two fresh palette colours
   `c3`/`c4`, drawn from `i=-1..cw` at half-cell offset `(i+0.5)*ww` (lines 66-67), each cell
   rounded by `rect(x, y, ww, hh, min(ww,hh)*amp)` with `amp = random(0.1, 0.4)` (line 61).
   Because this layer is shifted by half a cell, its rounded corners cut away exactly at the
   base layer's four-way intersections, exposing the base checker there: the pale
   lavender-pink diamonds are the light `c2` cells, the small black diamonds the dark `c1`
   cells of layer 1.

Randomness enters via: seed field (line 1), grid counts, the two c1/c2 lerps, checker mode
`rnd`, per-cell swap, c3/c4, and `amp`. `arc2` (lines 79-97) is unused in this flow.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The whole sketch is one generic primitive: a two-layer offset checkerboard where the top
layer's corner radius controls the gap geometry. A library function
`checkerRoundedSquares(cols, rows, cornerAmp, [c1, c2, c3, c4], swapProb)` would cover the
baseline behaviour. One-off art decisions: the specific 9-colour palette and the
lerp-to-black/white derivation of the gap colours; the half-cell offset (the thing that
creates the diamond lattice) is a fixed geometric choice, not a parameter. A clean
parameter object: `{cols, rows, cornerAmp, colors: [4], baseSwapProb, checkerMode}`.
