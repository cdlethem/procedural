---
sketch: 2017/Generativos/grill
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1554
animated: false
techniques: [grid, distortion]
primitives: [shape]
palette:
  colors: ["#fca50f", "#fc35d4", "#3a6ff4", "#2bbc93"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: powerWarp, signature: "powerWarp(float[] values, float min, float max, int cuts, float maxPwr, Random r) -> float[]", note: "random monotonic power-curve warp of a 1-D coordinate array (defs)"}
  - {name: paletteCycle, signature: "paletteCycle(float v, int[] colors) -> color", note: "wraps v modulo palette length and lerps between adjacent colours (getColor)"}
---

## What it draws
A full-bleed 960×960 composition of about six horizontal bands of flat, distorted
quadrilaterals with no strokes. The band boundaries are smooth tilted S-curves rather
than straight lines. One band (second from the top) is dense with fine vertical colour
stripes cycling rapidly through pink/magenta, blue, orange and teal; the other bands are
made of a few large, near-monochrome warped cells — olive-gold top-left, teal-green and
gold mid-left, orange to the right, pink and blue at the bottom. Dominant colours:
olive-gold, pink/magenta, blue.

## How the code works
`setup()` (lines 3–8) creates a 960×960 P2D canvas, sets `smooth(8)`, calls
`generate()`; `draw()` (line 10) is empty, so the image is static.

`generate()` (lines 18–89) fills a black background (line 19, never visible — the grid
covers everything) and builds a row × column grid of quads:

- `div` = number of rows, `int(random(4, random(4, 64)))` (line 24); `sh = width/(div-1)`
  (line 25).
- Two arrays `y1`, `y2` (lines 27–32) hold the linear positions of the div+1 row
  boundary lines, then each is warped by `defs(y, 0, height, cc=4, maxpwr=random(1,6))`
  (lines 34–35). `defs` (lines 91–112) repeats `cc` times: pick a random cut point `cy`,
  split the normalised array at the cut, apply `pow(v, pwr)` to each side, rejoin — a
  smooth monotonic re-spacing. This is what turns the row boundaries into tilted curves.
- Per row `j` (lines 38–73): `sub` = random column count (line 39), `ic = random(100)`
  base colour offset (line 40), `dc = 4*r*r` per-column colour step in [0,4) (line 41).
- Two arrays `x1`, `x2` hold linear column positions, warped by `defs(..., cc=2, maxpwr=2)`
  (lines 51–52) — the horizontal warp of cell edges.
- Inner loop (lines 54–72): each cell is a quad whose top edge samples the row-top
  boundary at warped `x1` positions and bottom edge the row-bottom boundary at warped
  `x2` positions (lines 55–62), so adjacent cells share the same curved boundary.
  Fill is `getColor(ic + dc*i)` (line 65), `noStroke()`.
- `getColor` (lines 125–131) wraps `v` modulo the 4-colour palette
  `{#fca50f, #fc35d4, #3a6ff4, #2bbc93}` (line 120, from coolors.co) and lerps between
  adjacent entries. Large `dc` ⇒ the column index sweeps the palette many times ⇒ the
  fine striped band; small `dc` ⇒ a row stays in one hue region.

The commented block (lines 77–88) is an older `rect`-based version of the same grid.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `defs` (lines 91–112) is a self-contained 1-D coordinate warp: takes a linear array,
  a range, a number of random power-curve cuts and a max exponent. Fully reusable as
  `powerWarp(values, min, max, cuts, maxPwr)` with an injected Random for determinism.
- `getColor` (lines 125–131) is a generic cyclic palette interpolator: `paletteCycle(v,
  colors)` — wraps any scalar through a colour list.
- The row/column grid with independent top/bottom warps (x1 vs x2, y1 vs y2) is the core
  generative idea: a "warped grid" primitive — two independent 1-D warps per axis per
  row band, cells as quads. Reusable as `warpedGrid(rows, cols, rowWarp, colWarp, fillFn)`.
- One-off art decisions: the specific coolors.co palette, `dc = 4*r*r` (biased small so
  most rows stay flat while some stripe), per-row random `sub` (uneven column density),
  and `maxpwr = random(1,6)` vs `2`.
- A clean parameter object: `{rows, colsPerRow: int[] or (min,max), rowWarpCuts,
  rowWarpMaxPwr, colWarpCuts, colWarpMaxPwr, palette: int[], colorStep: float[] (per row
  dc), colorOffset: float[] (per row ic), size}`.
