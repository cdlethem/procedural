---
sketch: 2018/Generativos/grids
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1580
animated: false
techniques: [grid, noise-field, dots-stippling]
primitives: [shape, ellipse]
palette:
  colors: ["#EF7D40", "#A071A5", "#596FC3", "#00BEEE", "#F6DFCF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(1,7)", tried: [2], change: large, effect: "backdrop becomes a 2x2 grid of giant circles; the square grid dominates"}
  - {name: sr, default: "random(0.7,0.94)", tried: [0.4], change: moderate, effect: "primary squares shrink to 40%; secondary (sr2) squares + circle backdrop show through"}
  - {name: det, default: "random(0,0.1)", tried: [0.001], change: moderate, effect: "lower detail = smoother, near-uniform square sizes with gentle size gradients"}
  - {name: arcSize, default: "random(20)", tried: [60], change: subtle, effect: "coarser, more visible arc specks; overall composition unchanged"}
  - {name: sc2, default: "random(0.01,0.2)", tried: [0.35], change: subtle, effect: "slightly larger intersection dots; overall look unchanged"}
  - {name: sr2, default: "random(0.1,1)", tried: [1.0], change: moderate, effect: "inner square at full noise size = chunky solid squares, less two-square effect"}
reusable_candidates:
  - {name: rrect, signature: "rrect(x, y, w, h, amp)", note: "octagonal rounded rectangle via beginShape; corner cut = min(w,h)*amp"}
  - {name: noiseRoundedSquares, signature: "noiseRoundedSquares(cells, noiseSeed, noiseDetail, scaleA, scaleB)", note: "two noise-sized rounded squares per grid cell (lines 64-85)"}
  - {name: scatterArcs, signature: "scatterArcs(count, maxSize, weight)", note: "random 1px arcs, sweep <= HALF_PI, as a speckle layer (lines 52-62)"}
  - {name: pickColor, signature: "pickColor(colors[]) -> int", note: "uniform random palette pick (rcol)"}
---

## What it draws
Full-bleed flat-colour composition in a candy palette of orange, periwinkle blue, cyan, mauve and cream. The background is a coarse grid of large overlapping circles in random palette colours, dusted with a fine grain of tiny 1px arc specks. Over that sits a regular grid of rounded (octagonal) squares whose sizes are modulated by 2D noise, plus a second smaller rounded square in each cell; at every grid intersection a small filled dot and a thin ring mark the point.

## How the code works
Static sketch: `setup()` (grids.pde:3-9) sizes 960x960 P2D and calls `generate()` once; `draw()` is empty.

`generate()` (lines 22-102) paints five layers, each colour chosen by `rcol()` (line 125) which picks uniformly from the 5-colour palette at line 124:

1. **Triangle chaos** (27-40): 10000 random triangles, radius `random(60)`, random orientation, random palette colour. Almost entirely covered by later layers.
2. **Circle grid** (42-50): `cc = int(random(1, 7))` cells per side; one full-cell-diameter circle per cell, each a different palette colour. Produces the large overlapping-circle backdrop.
3. **Arc speckle** (52-62): 10000 arcs, size `random(20)`, sweep `random(HALF_PI)`, 1px stroke, no fill — the fine grain visible over the circles.
4. **Noise rounded-square grid** (64-85): `sub` = random odd number of cells (up to ~200); per cell two rounded squares via `rrect` (109-121), sizes from `noise(des + x*det, des + y*det)` (line 80) scaled by `sr = random(0.7, 0.94)` (line 72) and `sr2 = random(0.1, 1)` (line 73). This is the dominant motif.
5. **Dots + rings** (87-101): at each grid point a small filled ellipse (`sc2 = random(0.01, 0.2)`, line 88) and a stroked ring (`sc1 = (1-sr*0.5)*random(0.7, 0.9)`, line 87), both sized by the same noise field (line 93).

Randomness enters via the harness `seed` field (line 1) and all `random()` calls; noise uses offset `des = random(10000)` and detail `det = random(0.1*random(1))` (lines 69-70). No blend modes, no transforms beyond per-shape vertex math.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_2 | `int cc = int(random(1, 7));` -> `int cc = 2;` | large | backdrop is now a 2x2 grid of giant circles (orange/cyan top, mauve/periwinkle bottom); the noise square-grid sits on top and dominates | variants/cc_2/frame_00001.png |
| sr_0.4 | `float sr = random(0.7, 0.94);` -> `float sr = 0.4;` | moderate | primary rounded squares shrink to 40%; the secondary (sr2) squares and the circle backdrop now dominate, with more backdrop visible between cells | variants/sr_0.4/frame_00001.png |
| det_0.001 | `float det = random(0.1*random(1));` -> `float det = 0.001;` | moderate | lower noise detail makes square sizes vary smoothly across the canvas (gentle size gradients, near-uniform within a region) instead of per-cell variation | variants/det_0.001/frame_00001.png |
| arcs_60 | `float s = random(20);` -> `float s = random(60);` | subtle | arcs up to 3x larger; the grain becomes coarser and more visible as individual arc specks, but the overall composition is unchanged | variants/arcs_60/frame_00001.png |
| sc2_0.35 | `float sc2 = random(0.01, 0.2);` -> `float sc2 = 0.35;` | subtle | slightly larger filled dots at the grid intersections; the overall look is essentially unchanged | variants/sc2_0.35/frame_00001.png |
| sr2_1.0 | `float sr2 = random(0.1, 1);` -> `float sr2 = 1.0;` | moderate | inner square now drawn at full noise size (was 0.1-1) so it nearly covers the outer square: chunky, more solid squares with less of the concentric two-square effect | variants/sr2_1.0/frame_00001.png |

## Modularisation notes
The generic blocks: `rrect` (octagonal rounded rect), the noise-driven rounded-square grid (layers 4+5 together, sharing one noise field), the arc-speckle scatter, and `rcol` palette picking are all reusable library functions. One-off art decisions: the exact 5-colour palette, the 5-layer stacking order (triangle chaos + circle grid as underlays), and the choice of `cc` (1-7) for the backdrop circle grid. A clean parameter object: `{palette, cells (sub), noiseSeed (des), noiseDetail (det), squareScaleA (sr), squareScaleB (sr2), dotScale (sc2), ringScale (sc1), arcCount, arcMaxSize, backdropCells (cc), triangleCount}`.
