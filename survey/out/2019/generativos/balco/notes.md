---
sketch: 2019/generativos/balco
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1531
animated: false
techniques: [grid, subdivision, dots-stippling]
primitives: [rect, shape]
palette:
  colors: ["#A5AA75", "#7E5C25", "#B8BA89", "#EBE5BB", "#ECDD6A", "#E58F28", "#E72E05"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ss, default: 40, tried: [80], change: large, effect: "global cell scale: bar width, band width/length, bevel grid and dot-grid spacing all double; much coarser composition"}
  - {name: div, default: "width*4/ss (96 cells)", tried: ["width*8/ss"], change: none, effect: "no visible change at seed 42; initial quadtree rect is 4x the canvas so 6 splits leave few giant rects dominating the view"}
  - {name: splits, default: 6, tried: [10], change: large, effect: "finer background mosaic (31 vs 19 gradient quads); also shifts every later random draw, so bar positions change too"}
  - {name: bars, default: 300, tried: [100], change: large, effect: "one third as many bars and bands; olive ground, dot grid and background quads become much more visible"}
  - {name: barH, default: "ss*2.5 (100 px)", tried: ["ss*5 (200 px)"], change: moderate, effect: "bars double in height (tall pillars); bands drop 200 px instead of 100 px, so the diagonal is steeper"}
  - {name: bandLen, default: "w*15 (300 px)", tried: ["w*30 (600 px)"], change: moderate, effect: "bands twice as long; long continuous diagonals sweeping across most of the canvas"}
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(cells, iterations, seed) -> Rect[]", note: "split full canvas (in cell units) into a quadtree of rects with random split points"}
  - {name: gradientRect, signature: "gradientRect(x, y, w, h, col1, col2, winding) -> void", note: "open 4-vertex shape with two per-vertex fills = two-colour gradient quad"}
  - {name: beveledBar, signature: "beveledBar(x, y, w, h, col, bevel) -> void", note: "vertical rect plus white highlight quad on right edge and black quad on bottom corner (pseudo-3D)"}
  - {name: diagonalBand, signature: "diagonalBand(x, y, w, h, len, drop, colA, colB, aA, aB) -> void", note: "translucent parallelogram extending left and down from a bar edge, two-colour fill"}
  - {name: dotGrid, signature: "dotGrid(cell, dot, col, alpha) -> void", note: "sparse 2x2 dot on every cell of the canvas"}
---

## What it draws
A full-bleed warm composition on an olive ground: many translucent diagonal bands of
red-orange, orange, yellow and cream rise gently from left to right, overlapping into
soft gradients. Scattered thin vertical bars in the same palette sit on top, each with
a small white glint on its right edge and a black shadow at its bottom corner, giving a
faint 3D-extruded look. In the background, a few large soft two-colour gradient
rectangles drift diagonally, and a barely visible fine dot grid underlies everything.

## How the code works
`settings()` (L14-19) opens a 960x960 P2D window with `smooth(8)`; `pixelDensity(2)`
fails headless (harmless stderr warning). `setup()` (L21) calls `generate()` once;
`draw()` is empty, so the piece is static (confirmed: baseline frames 10/60 were
dropped as identical).

`generate()` (L52):
1. `randomSeed(seed)` / `noiseSeed(seed)` (L54-55) — the only randomness source; the
   harness sets the `seed` field, so renders are deterministic.
2. Background `#A5AA75` olive (L57).
3. Dot grid (L61-68): with `ss = 40`, a 2x2 white dot at alpha 40 on every 40 px cell —
   the faint stipple seen under the composition.
4. Background quadtree (L70-88): `div = int(width*4/ss)` = 96 cells; one rect covers
   the whole canvas in cell units, then 6 iterations pick a random rect and split it
   into four children at random split points (the original is removed), ending with
   ~19 rects of varied sizes.
5. Each quadtree rect is drawn (L90-122) scaled by `ss`, as an open 4-vertex `beginShape`
   whose first two vertices get one `rcol()` fill and the last two another — Processing
   interpolates the per-vertex fills, producing a two-colour gradient quad. Winding is
   flipped 50/50 (L101-121).
6. Bars + bands (L125-162): 300 iterations. A bar of `w = ss*0.5` (20) by
   `h = ss*2.5` (100) is placed at a position snapped to the 40 px grid
   (L131-134), so bars can also hang off the right/bottom edges. Then: a white
   (255, alpha 220) quad 1.5 px wide (`bb`) on the bar's right edge (L136-142) and a
   black (0, 220) quad at the bottom-left corner (L144-150) — the pseudo-3D bevel.
   Finally a parallelogram (L154-161) runs from the bar's left edge 300 px (`w*15`) to
   the left and drops 100 px (`h`) below: this is the diagonal translucent band, filled
   with two `rcol()` colours at alpha 240/100.
7. Colour: `rcol()` (L196-198) picks uniformly at random from the six-colour
   warm palette (L189: brown `#7E5C25`, sage `#B8BA89`, cream `#EBE5BB`, yellow
   `#ECDD6A`, orange `#E58F28`, red-orange `#E72E05`). `getColor` (L199-207) and
   `arc2` (L165-182) are unused, as is the triangulate import (L1).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_80 | `float ss = 40;` -> `float ss = 80;` | large (mean 0.171, 71.5% of pixels) | everything doubles in scale: fatter bars, much wider/longer diagonal bands, sparser fainter dot grid, bigger background gradient quads — coarser, blockier composition | variants/ss_80/frame_00001.png |
| div_8 | `int div = int(width*4/ss);` -> `int div = int(width*8/ss);` | none (mean 0.0005, 0.0% of pixels) | no visible change — image is pixel-equivalent to baseline (files differ only at sub-pixel level). The initial quadtree rect is already 4x the canvas, so 6 random splits leave a few giant rects that dominate the visible window regardless of the multiplier | variants/div_8/frame_00001.png |
| splits_10 | `for (int i = 0; i < 6; i++)` -> `for (int i = 0; i < 10; i++)` | large (mean 0.153, 65.3% of pixels) | finer background mosaic (31 vs 19 gradient quads, smaller visible patches); bar positions also shift because the extra split iterations consume random numbers earlier in the shared sequence | variants/splits_10/frame_00001.png |
| bars_100 | `for (int i = 0; i < 300; i++)` -> `for (int i = 0; i < 100; i++)` | large (mean 0.166, 72.8% of pixels) | one third as many bars/bands; olive ground, dot grid and the background gradient quads become much more visible between the sparser foreground | variants/bars_100/frame_00001.png |
| barH_5 | `float h = ss*2.5;` -> `float h = ss*5;` | moderate (mean 0.090, 36.7% of pixels) | bars double to 200 px tall (tall pillars); bands drop 200 px instead of 100 px over the same 300 px run, so the diagonal is noticeably steeper | variants/barH_5/frame_00001.png |
| bandLen_30 | `vertex(x-w*0.5-w*15, y+h*0.5+h);` + `vertex(x-w*0.5-w*15, y-h*0.5+bb+h);` -> `w*30` in both | moderate (mean 0.092, 38.6% of pixels) | bands double to 600 px long; long continuous diagonals sweep across most of the canvas, overlapping more | variants/bandLen_30/frame_00001.png |

## Modularisation notes
The reusable core is the pipeline: `dotGrid` + `quadtreeSplit`/`gradientRect` for the
soft background + `beveledBar` + `diagonalBand` for the foreground layer, all driven by
one cell size `ss` and one palette list. The art decisions are the fixed geometry ratios
(`w = ss/2`, `h = 2.5ss`, band length `15w`, drop `h`, bevel `bb = 1.5`), the 6 split
iterations, the 300 bar count, and the 50/50 winding flip. A clean parameter object:
`{cell, splits, bars, barW, barH, bandLen, bandDrop, bevel, palette, dotAlpha}` with a
seed. `quadtreeSplit` and `beveledBar` are the most library-worthy; the band is just a
two-colour quad and could be a `gradientQuad` variant.
