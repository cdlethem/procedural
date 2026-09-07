---
sketch: 2019/generativos/corbata
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1490
animated: false
techniques: [grid, symmetry, dots-stippling, lines-hatching]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#FFF2E1", "#EBDDD0", "#F1C98E", "#E0B183", "#C2B588", "#472F18", "#0F080F"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: "3..8 (int(random(40,90)*0.09))", tried: [12], change: large, effect: "cells per tile: 12 gives a fine dense mosaic of tiny cells"}
  - {name: div, default: 2, tried: [3], change: moderate, effect: "tile grid: 3 -> 4x4 = 16 smaller tiles, denser X of borders"}
  - {name: rotation, default: "HALF_PI*0.5 (45 deg)", tried: ["HALF_PI*0.25 (22.5 deg)"], change: moderate, effect: "tilted square grid instead of diamonds, shallower border bands"}
  - {name: borderSub, default: "20..34 (random(10,18)*2)", tried: [60], change: moderate, effect: "finer, denser chevron ring, narrower woven border band"}
  - {name: circleProb, default: 0.2, tried: [0.5], change: moderate, effect: "circles dominate, fewer olive squares"}
  - {name: palette, default: "warm 7-colour list", tried: ["{#E1E8E0,#F5CE4B,#FC5801,#025DC4,#02201A,#489B4D}"], change: moderate, effect: "sage background, greener squares, yellow-orange circles; overall look stays similar"}
reusable_candidates:
  - {name: rectSub, signature: "rectSub(x, y, w, h, sub, c1, c2) -> void", note: "tile border built from alternating triangles fanning from the center to each edge; 2-colour chevron/checker ring"}
  - {name: cellMosaic, signature: "cellMosaic(cell, cellSize, circleProb, palette) -> void", note: "grid of cells, each either a circle, a stacked-rect stack, or a dot + hairline, with offset shadow shapes for a folded-paper feel"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform random pick from a fixed int[] palette"}
---

## What it draws
A 9-tile mosaic rotated 45° on a cream ground: each diamond tile wears a chevron/checker
border in olive and cream, and its interior is a small grid of cells that are either a big
apricot circle crossed by a hairline, an olive square with a smaller square and dark dot inside,
or a near-white square holding a small dark dot and a thin line. Faint grey offset shadows give
every cell a folded-paper, slightly embossed look. Dominant colours: cream/ivory, olive-khaki,
apricot-tan, with small dark-brown accents.

## How the code works
`setup()` -> `generate()` (corbata.pde:21-23); `draw()` is empty so the image is static.
- Canvas 960x960 P2D, `pixelDensity(2)` (settings:14-19). `background(rcol())` (57).
- Tile count: `div = 2` (68) gives a 3x3 grid; each tile is `size = width*0.5` = 480 px (60),
  placed at `(k-div*0.5)*size` (81). The whole grid is rotated 45° (`rotate(HALF_PI*0.5)`, 64)
  and scaled by `random(0.9, 1.2)` (66), so corner tiles crop off-canvas (full-bleed).
- Cells per tile: `cc = int(random(40, 90)*0.09)` (59) -> 3..8; cell size `ss = size*0.9/cc` (61).
  At seed 42 the visible tiles are 4x4 grids.
- `rectSub(0,0,size,size,int(random(10,18))*2, rcol(), rcol())` (83, 173-207) draws the tile
  border: `sub` pairs of triangles along each edge, alternating two random palette colours,
  fanning from the tile center -> the chevron/checker ring.
- A white `rect(ss*cc)` (85) covers the tile interior, then a double loop over `cc x cc` cells
  (87-88) positions each cell at `ss*(i-cc*0.5+0.5)` (89-90).
- Every cell first gets two half-transparent triangles: `fill(0,20)` over half the cell and
  `fill(0,0)` (invisible) over the other half (95-109), plus a white `fill(255,80)->(255,0)`
  triangle bottom-right (111-117) -> the embossed/folded shading.
- 20% of cells draw a big circle `ellipse(xx,yy,ss*0.8)` in `rcol()` (119-122) -> the apricot circles.
- Cells on even columns (if `hor`) or even rows (if `ver`) draw a 50%-chance hairline through
  the center (126-127), a small offset `fill(0,14)` shadow ellipse (130-133), and a tiny
  `rcol()` dot `ss*0.1` (136-137).
- All other cells draw a full-cell `rcol()` rect (142), an offset `fill(0,20)` shadow rect plus
  two smaller `rcol()` rects `sss` and `sss*0.1` (143-153), and the white corner triangle
  (156-162) -> the olive squares with stacked squares and dark centers.
- Colour: `rcol()` (238-240) picks uniformly from the 7-colour warm palette (237).
  `randomSeed(seed)` is reset per tile (79) so all 9 tiles use the same RNG stream, but tile
  contents differ because the stream is consumed differently per tile; `hor`/`ver` (75-76)
  are per-run booleans (0.7 chance each).
- `triangulate` and `toxi SimplexNoise` are imported but never used; `arc2` (209-226) is
  dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_12 | `int cc = int(random(40, 90)*0.09);` -> `int cc = 12;` | large | each tile is now a 12x12 grid of tiny cells (small squares, dots, little circles) - a fine dense mosaic; tile borders still visible | variants/cc_12/frame_00001.png |
| div_3 | `int div = 2;` -> `int div = 3;` | moderate | 4x4 = 16 smaller tiles instead of 9; chevron borders form a denser X-grid; each tile's interior cells are smaller | variants/div_3/frame_00001.png |
| rot_22p5 | `rotate(HALF_PI*0.5);` -> `rotate(HALF_PI*0.25);` | moderate | tiles tilt 22.5 deg instead of 45: diamonds become a slightly rotated square grid; border bands run diagonally at a shallower angle | variants/rot_22p5/frame_00001.png |
| border_60 | `rectSub(0, 0, size, size, int(random(10, 18))*2, rcol(), rcol());` -> `rectSub(0, 0, size, size, 60, rcol(), rcol());` | moderate | chevron border much finer and denser (60 segments); border becomes a narrow tightly-woven ring; tile interiors unchanged | variants/border_60/frame_00001.png |
| circle_0.5 | `if (random(1) < 0.2) {` -> `if (random(1) < 0.5) {` | moderate | circles become the dominant cell type; far fewer olive squares than baseline | variants/circle_0.5/frame_00001.png |
| palette_cool | `int colors[] = {#FFF2E1, ...#0F080F};` -> `int colors[] = {#E1E8E0, #F5CE4B, #FC5801, #025DC4, #02201A, #489B4D};` | moderate | structure identical; background reads pale sage, squares more olive-green, circles yellow-orange; overall impression stays close to baseline because white cell ground dominates; no clear blue visible | variants/palette_cool/frame_00001.png |

## Modularisation notes
- Generic / reusable: `rectSub` is a clean, parameterised border-ring function (position, size,
  segment count, two colours) and could ship as-is. The per-cell "shadow triangle + content"
  pattern is a generic embossed-cell primitive. `rcol`/palette list is a standard sampler.
- One-off art decisions: the 45° global rotation, the 0.9-1.2 scale jitter, the three specific
  cell contents (circle / stacked rects / dot+hairline) and their probabilities, the even-row/col
  hairline rule, and the chosen warm palette.
- Clean parameter object: `{ tiles: div, cellCount: cc, tileSizeFrac: 0.5, rotation: HALF_PI*0.5,
  borderSub: 20..34, circleProb: 0.2, hairlineProb: 0.5, palette: int[], scaleJitter: [0.9, 1.2] }`.
