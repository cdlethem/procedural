---
sketch: 2018/Generativos/gtgt
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1537
animated: false
techniques: [grid, noise-field]
primitives: [rect, shape]
palette:
  colors: ["#F8F8F8", "#F0B8C1", "#9FC8E6", "#FCC702", "#323232"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: div, default: "random int in 2-99 (≈48 at seed 42)", tried: [20], change: large, effect: "coarser grid: 20x20 visibly large tiles instead of a fine mosaic; forcing div also shifts all downstream random draws"}
  - {name: det, default: "random(0.1)", tried: [0.001], change: large, effect: "100x lower noise frequency: diagonal directions become weakly correlated between neighbours, but at this fine cell size the layout still reads as random per cell"}
  - {name: threshold, default: 0.5, tried: [0.2], change: moderate, effect: "diagonals now run predominantly in one direction (only ~20% of cells take the other diagonal)"}
  - {name: lerpT, default: 0.5, tried: [0.1], change: subtle, effect: "triangles keep the raw second palette colour instead of a washed 50% midpoint; slightly higher contrast, identical layout"}
  - {name: colors, default: "pastel 5-colour list", tried: ["{#0D1B2A, #1B263B, #415A77, #778DA9, #E0E1DD}"], change: large, effect: "identical structure, dark navy/steel/cream palette; much darker overall impression"}
reusable_candidates:
  - {name: noiseSplitGrid, signature: "noiseSplitGrid(div, det, des, colors) -> void", note: "each grid cell is painted a random palette colour, then split along a diagonal chosen by 2-D noise; the triangle side gets lerpColor(cell, other, t)"}
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "random pick from a palette list, re-rolled to guarantee two distinct colours"}
---

## What it draws
A full-bleed mosaic of a fine square grid (a few dozen cells per side at seed 42). Every cell
shows a square of one pastel colour with a right triangle over one of its two halves; the
triangle runs along a diagonal whose direction varies from cell to cell, giving a
patchwork-quilt look. Colours: off-white, pink, light blue, yellow, and dark charcoal;
the triangle halves are always a washed-out midpoint of two of the palette colours.

## How the code works
`setup()` (lines 3-8) sets a 960x960 P2D canvas, `smooth(8)`, `pixelDensity(2)` (rejected
by the headless display, see stderr), and calls `generate()` once; `draw()` is empty so the
sketch is static (regeneration is only on a key press, lines 14-20).

`generate()` (lines 22-60):
- `background(0)` (line 23) is never visible — the grid fully covers the canvas.
- `div = int(random(2, 100))` (line 25) sets the number of cells per side; `ss` is the cell
  size. `det = random(0.1)` (line 28) scales pixel coordinates into noise space, and
  `des = random(10000)` (line 29) offsets the noise field.
- Nested loops over `j`, `i` (lines 32-59): for each cell, two random palette colours
  `c1`/`c2` are picked via `rcol()` (lines 36-38), re-rolling `c2` while it equals `c1`.
  The whole cell is filled `c1` with `rect` (lines 39-40), then a right triangle covering
  one half is drawn with `beginShape`/`vertex` (lines 43-57). The diagonal direction comes
  from `noise(des+xx*det, des+yy*det) < 0.5` (line 43): below the threshold the triangle
  uses the bottom-left corner, above it the bottom-right corner. `fill` is switched to
  `lerpColor(c2, c1, 0.5)` just before the last vertex (lines 47, 54), so the triangle
  renders in that 50% blend; the exposed half of the cell keeps `c1`.
- Palette (line 66): off-white, pink, light blue, yellow, dark charcoal; `rcol()` (line 67)
  picks uniformly at random. `getColor()` (lines 70-78) is defined but never used.

Randomness enters through the `seed` field (set by the harness to 42), `div`, `det`, `des`,
and the per-cell `rcol()` draws. Because `det` multiplies pixel coordinates, the baseline
noise value changes roughly per cell, so the diagonals look effectively random per cell.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_20 | `float div = int(random(2, 100));` -> `float div = 20;` | large | 20x20 grid of large tiles, same pastel patchwork; cells clearly bigger than the baseline's fine mosaic | variants/div_20/frame_00001.png |
| det_0.001 | `float det = random(0.1);` -> `float det = 0.001;` | large | same fine mosaic, different diagonal layout; some weak neighbour-to-neighbour consistency in diagonal direction, no obvious large-scale banding at this cell size | variants/det_0.001/frame_00001.png |
| threshold_0.2 | `if (noise(des+xx*det, des+yy*det) < 0.5) {` -> `... < 0.2) {` | moderate | strong bias: most cells share one diagonal direction, the minority flipped the other way; same density | variants/threshold_0.2/frame_00001.png |
| lerp_0.1 | `fill(lerpColor(c2, c1, 0.5));` -> `fill(lerpColor(c2, c1, 0.1));` (applied in both branches) | subtle | no visible change in structure; triangles look less washed-out, closer to their raw palette colour, marginally more contrast | variants/lerp_0.1/frame_00001.png |
| palette_cool | `int colors[] = {#F8F8F8, #F0B8C1, #9FC8E6, #FCC702, #323232};` -> `int colors[] = {#0D1B2A, #1B263B, #415A77, #778DA9, #E0E1DD};` | large | identical mosaic structure in a dark navy/steel/grey/cream palette; dark overall impression | variants/palette_cool/frame_00001.png |

## Modularisation notes
The generic core is `generate()`: a grid where each cell is painted a random palette colour
and then split along a noise-selected diagonal with a second colour (or a lerp of the two).
That is a reusable `noiseSplitGrid(div, det, des, colors, t)` — the `div`/`det`/`des`/`t`
knobs and the palette list are the art decisions. One-off details: the re-roll-until-distinct
`rcol` pair, the mid-shape `fill()` switch (a Processing idiom worth replacing with an
explicit triangle colour), the unused `getColor`, and the `saveImage`/keyPress scaffolding.
A clean parameter object: `{div, det, des, colors, lerpT, threshold}`.
