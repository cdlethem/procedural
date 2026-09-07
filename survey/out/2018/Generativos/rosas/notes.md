---
sketch: 2018/Generativos/rosas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1509
animated: false
techniques: [grid, distortion]
primitives: [shape]
palette:
  colors: ["#F00050", "#FF4E02", "#F9E702", "#028DF9", "#1629C6"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(4, random(560))", tried: [100], change: large, effect: "coarser grid: fewer, much larger gradient tiles, same left-edge crush"}
  - {name: maxPow, default: "random(80)", tried: [10], change: large, effect: "milder warp: far corner keeps visible cells instead of sub-pixel crush; grid more uniform"}
  - {name: det, default: "random(0.01)", tried: [0.005], change: none, effect: "no visible change; det is never used in the drawing (no noise in the piece)"}
  - {name: colors, default: "[#F00050,#FF4E02,#F9E702,#028DF9,#1629C6]", tried: ["[#010187,#0A49FF,#FF854E,#FFCAE3,#FFFFFF]"], change: large, effect: "same warp, lighter palette: deep blue, bright blue, salmon-orange, pale pink, white"}
  - {name: smooth, default: 8, tried: [1], change: none, effect: "no visible change (mean 0.0028, 0 pixels above threshold); edge antialiasing too subtle at this cell size"}
reusable_candidates:
  - {name: warpedGrid, signature: "warpedGrid(n, pxE0, pxE1, pyE0, pyE1, palette) -> void", note: "n x n quad grid whose spacing is compressed by per-row/column pow() exponents; per-vertex random palette fills give each quad a smooth two-colour gradient"}
---

## What it draws
Full-bleed mosaic of square-ish cells, each a smooth two-colour gradient (magenta-red, orange, yellow, blue, dark blue). The grid is strongly warped: cells are near-square in one region and crushed into thin strips toward the opposite corner/edge, giving a perspective-floor or folded-tile look. No strokes, no background visible (the background quad is fully covered).

## How the code works
- `setup()` (L3-8): 960x960 P2D, `smooth(8)`, `pixelDensity(2)`, calls `generate()` once; `draw()` (L10-11) is empty, so the piece is static (re-run only via key press).
- `generate()` (L21-89): `randomSeed(seed)` (L23) makes it deterministic per seed. A full-canvas quad background is filled with a random palette colour (L25-32), then completely covered.
- Cell count `cc = int(random(4, random(560)))` (L33): the grid is `cc x cc`; here it lands mid-range (~hundreds of cells visible).
- Warp: exponents `px1, px2` (L36-39) and `py1, py2` (L41-44) are random in `[1, maxPow)` with 50% chance of being flipped to `[1/maxPow, 1)`; `maxPow = random(80)` (L35). For each cell the x-edges are `pow(vx, map(row, px1, px2))` (L60-63) and y-edges `pow(vy, map(col, py1, py2))` (L64-67), so the exponent changes along each axis — spacing is stretched at one corner and crushed at the other, producing the perspective-like warp.
- Each cell (L78-86) is one unclosed 4-vertex `beginShape`/`endShape` quad; `fill(rcol())` is called before each vertex pair, and the P2D renderer interpolates the per-vertex colours across the quad, so every cell is a smooth gradient between two palette colours (this is why the image looks like gradient tiles, not flat polygons).
| cc_100 | `int cc = int(random(4, random(560)));` -> `int cc = int(random(4, random(100)));` | large | much coarser grid: only a few dozen large gradient tiles; same left-edge crush, cells fill the canvas | variants/cc_100/frame_00001.png |
| maxPow_10 | `float maxPow = random(80);` -> `float maxPow = random(10);` | large | warp is milder: top-right corner stays a readable grid of small cells instead of collapsing into a thin band; overall spacing more even | variants/maxPow_10/frame_00001.png |
| det_0.005 | `float det = random(0.01);` -> `float det = random(0.005);` | none | no visible change; `det` is declared but never used (no noise in the drawing) | variants/det_0.005/frame_00001.png |
| palette_light | `int colors[] = {#F00050, #FF4E02, #F9E702, #028DF9, #1629C6};` -> `{#010187, #0A49FF, #FF854E, #FFCAE3, #FFFFFF};` | large | identical warp and cell layout; colours become deep blue, bright blue, salmon, pale pink, white — same gradient-tile structure | variants/palette_light/frame_00001.png |
| smooth_1 | `smooth(8);` -> `smooth(1);` | none | no visible change (mean 0.0028, 0 pixels above threshold); antialias level not perceptible at this cell size | variants/smooth_1/frame_00001.png |
- Colour: `rcol()` (L119-121) picks uniformly from `colors[]` (L116). `getColor()` (L122-131) is a lerp variant, never called.
- Dead code: `det = random(0.01)` and `des = random(1000)` (L49-50) are never used — there is no noise in the drawing; `arc2()` (L96-114) is also unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the warped-grid generator is a clean library function — parameters `n` (cells per side), the four pow exponents (or two endpoints per axis), canvas size, and a colour function `cell -> (colA, colB)`. The per-vertex-fill quad (L78-86) is a small reusable primitive: "quad with bilinear colour interpolation".
- One-off art decisions: the specific 5-colour hot palette (L116) and its two commented alternatives (L117-118); the `random(1)<0.5` flipping of exponents to reciprocals (L37,39,42,44) which chooses the warp direction per run; the random `cc` range.
- A clean parameter object: `{n, px: [e0, e1], py: [e0, e1], palette: Colour[], colourMode: "random-pair"}`. Nothing else is needed — no noise, no animation state.
