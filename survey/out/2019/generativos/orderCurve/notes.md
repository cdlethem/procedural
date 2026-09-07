---
sketch: 2019/generativos/orderCurve
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1485
animated: false
techniques: [grid, noise-field]
primitives: [shape]
palette:
  colors: ["#EAE5E5", "#F7EB04", "#7332AD", "#000000", "#92A7D3"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cw, default: "int(random(12,20)*0.9) ~10-16", tried: ["random(24,28)*0.9 ~22-25"], change: large, effect: "narrower cells: grid ~2.5x denser horizontally, same wobble character"}
  - {name: ch, default: "int(random(22,40)*0.9) ~19-36", tried: ["random(44,50)*0.9 ~40-45"], change: large, effect: "shorter cells: ~2x denser vertically, rows read as stacked horizontal strips"}
  - {name: disp, default: 260, tried: [120], change: large, effect: "half displacement: cells nearly rectangular, wavy S-curves collapse to small jitter, stepped edge kinks stand out"}
  - {name: alpha, default: "random(255)", tried: ["random(120)"], change: moderate, effect: "identical geometry, lower alpha: fills wash toward the background, whole image more muted and lower contrast"}
  - {name: detDes, default: "random(0.0001,0.0003)", tried: ["random(0.0005,0.001)"], change: large, effect: "finer displacement noise: cells break into jagged shattered polygons, smooth flow lost"}
  - {name: detAng, default: "random(0.0001,0.0003)*10", tried: ["random(0.0005,0.001)*10"], change: moderate, effect: "finer angle noise: displacement direction jitters locally, edges more irregular instead of long smooth S-curves"}
reusable_candidates:
  - {name: noiseDisplaceGrid, signature: "noiseDisplaceGrid(cw, ch, maxDisp, detDes, detAng, offset) -> PVector[][]", note: "simplex-noise angle+displacement field applied to a rectangular grid's corners"}
  - {name: paletteLerpColor, signature: "paletteLerpColor(colors[], v) -> color", note: "pick v = random float, lerp between adjacent palette entries (v%len and (v+1)%len)"}
  - {name: steppedEdge, signature: "steppedEdge(p1, p2) -> vertices", note: "draws a grid edge with two extra vertices pulled halfway toward the edge center, producing a diagonal notch"}
---

## What it draws
Full-bleed mosaic of wobbly quadrilateral cells on a loose grid (roughly 15 columns x 30 rows of
uneven cells), seed 42. Cell boundaries are long smooth S-curves pulled by a low-frequency noise
field; many edges also show a small diagonal step where the edge line kinks. Cells are filled with
muted semi-transparent colours — slate blue-grey and yellow dominate, with purple, near-black and
pale grey cells scattered in — over a light grey background, so neighbouring fills blend and the
whole image reads soft and dusty.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the image is static (orderCurve.pde:21-32).
- `generate()` seeds RNG/noise from `seed` (harness sets `seed=42`), then paints
  `background(getColor())` (42-47).
- Noise field parameters are drawn randomly each generation: `desAng`/`desDes` (noise offsets) and
  `detAng`/`detDes` (noise detail) (49-52, fields also declared 98-101).
- Grid: `cw = int(random(12,20)*0.9)` (~10-16 cols), `ch = int(random(22,40)*0.9)` (~19-36 rows);
  cell size is `width/cw` x `height/ch`; loops run 20% outside the canvas on all sides so displaced
  cells still cover the edges (54-60).
- Each cell's four corners pass through `def(x,y)` (103-107): simplex noise gives an angle `ang`
  and a displacement magnitude `des` up to 260 px, and the corner is moved to
  `(x+cos(ang)*des, y+sin(ang)*des)` — this is what makes the straight grid wobble into smooth curves.
- Fill colour: `fill(getColor(), random(255))` (68). `getColor()` (130-139) takes a random float,
  takes `v mod 5` and lerps between palette entry `int(v%5)` and the next one, so colours are
  blends of neighbours in `{#EAE5E5, #F7EB04, #7332AD, #000000, #92A7D3}` (124); the random alpha
  0-255 washes them toward the background.
- Edges are not plain lines: the custom `line()` (80-96) emits the end points plus two extra
  vertices pulled halfway toward the edge's midpoint, so each cell edge has a small step/kink.
  `beginShape()/endShape()` (70-75) closes each cell.
- Renderer P3D with `smooth(8)`; no blend modes; `triangulate` is imported but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cw_24_28 | `int cw = int(random(12, 20)*0.9);...` -> `int cw = int(random(24, 28)*0.9);...` | large (mean 0.2008, 0.726) | ~2.5x denser columns; cells noticeably narrower, same wavy noise field and palette | variants/cw_24_28/frame_00001.png |
| ch_44_50 | `int ch = int(random(22, 40)*0.9);` -> `int ch = int(random(44, 50)*0.9);` | large (mean 0.209, 0.763) | ~2x denser rows; cells become short horizontal strips stacked in the noise flow | variants/ch_44_50/frame_00001.png |
| disp_120 | `...detDes)*260;` -> `...detDes)*120;` | large (mean 0.1748, 0.639) | displacement halved: cells nearly rectangular with small jitter; the diagonal step kinks in edges become the dominant texture | variants/disp_120/frame_00001.png |
| alpha_120 | `fill(getColor(), random(255));` -> `fill(getColor(), random(120));` | moderate (mean 0.0835, 0.355) | geometry unchanged; lower max alpha washes colours toward the light-grey background, image reads softer and lower-contrast | variants/alpha_120/frame_00001.png |
| detDes_0.001 | `detDes = random(0.0001, 0.0003);` -> `detDes = random(0.0005, 0.001);` | large (mean 0.1781, 0.655) | displacement field 5-10x finer: cells fragment into jagged polygonal shards, smooth flowing boundaries lost | variants/detDes_0.001/frame_00001.png |
| detAng_0.001 | `detAng = random(0.0001, 0.0003)*10;` -> `detAng = random(0.0005, 0.001)*10;` | moderate (mean 0.1457, 0.512) | direction field 5-10x finer: local jitter in where corners get pulled, edges less smooth, still cell-like | variants/detAng_0.001/frame_00001.png |

## Modularisation notes
- Generic: `def()`/`def`-style noise displacement of a grid (angle+distance from two simplex
  channels) is a clean reusable primitive; `paletteLerpColor` (adjacent-entry lerp with random
  alpha) is also generic; the overhanging loop bounds (-20%/120%) are a nice default for
  displacement-based grid sketches.
- One-off: the `steppedEdge` vertex trick (midpoint pull at 0.5) is a stylistic decision, and the
  specific 5-colour palette plus `*260` max displacement are art choices to expose as parameters.
- Clean parameter object: `{cw, ch, maxDisp, detDes, detAng, palette, alphaMax, edgeStep (0.5),
  margin (0.2)}`.
