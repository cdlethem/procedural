---
sketch: 2020/generative/01_04/elbol
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate, peasy]
deterministic: true
ms_first_frame: 1659
animated: false
techniques: [subdivision, lines-hatching]
primitives: [shape]
palette:
  colors: ["#99002B", "#EFA300", "#CED1E2", "#D66953", "#28422E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: trees, default: 240, tried: [60], change: subtle, effect: "fewer trees: large dark gaps, individual branch fans stand out"}
  - {name: alpha, default: 220, tried: [255], change: none, effect: "no visible change"}
  - {name: strokeWidth, default: "w*0.001, h*0.0014", tried: ["w*0.004, h*0.005"], change: moderate, effect: "strokes ~4x thicker, trees read as bold lines"}
  - {name: subMax, default: 6, tried: [12], change: subtle, effect: "finer cells, more small ticks"}
  - {name: iterations, default: 30, tried: [12], change: subtle, effect: "coarser cells, longer lines, less fine tick detail"}
reusable_candidates:
  - {name: arbol, signature: "arbol(x, y, w, h, iterations, subMax, alpha) -> void", note: "subdivide a rect into a lattice, draw a tapering line from each cell to its nearest cell below"}
  - {name: lineStr, signature: "lineStr(x1, y1, x2, y2, str1, str2) -> void", note: "filled tapering quadrilateral between two points (width str1 at start, str2 at end)"}
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "uniform pick from a colour list"}
---

## What it draws
A near-black canvas (dark grey, ~#141414) covered in a dense forest of thin, straight,
tapering strokes in pale blue-grey, dark red/maroon, amber/gold and salmon. The strokes
cluster into branch-like fans and ladders of short vertical ticks, denser in the middle
of the canvas and sparser at the edges, giving the impression of wireframe trees or a
swarm of insects seen in X-ray. No filled shapes, no curves — only hairline filled
quadrilaterals that read as lines.

## How the code works
- `settings()` (l.17-22): 960×960 P3D, `smooth(8)`, `pixelDensity(2)` (fails on the
  headless display, harmless).
- `setup()` (l.24-33) calls `generate()` once; `draw()` (l.35-36) is empty, so the
  sketch is static — one image per seed.
- `generate()` (l.58-75): `background(20)` dark grey, `noStroke()`. Loops 240 times:
  picks a random position snapped to a 30 px grid (`xx -= xx%30`, l.70-72) and calls
  `arbol(x, y, w, h)` with `w = width*random(0.6)*0.4` (≤ ~230 px) and
  `h = height*random(1)*random(0.6,1)*0.4` (≤ ~230 px) — the "tree" bounding box.
- `arbol()` (l.77-155): starts with one `Rect` covering the bounding box. Repeats
  30 times (l.80): pick a random rect, split it into `sub × sub` children where
  `sub = int(random(2, random(2,6)))` (l.83, i.e. 2–5), skip cells smaller than 5%
  of the original w/h (l.86), remove the parent. This leaves an irregular quadtree
  lattice of cells. Two extra full-width rects are appended at the base (l.94-95).
  For every cell it scans all other cells (l.117-132) and keeps the nearest one whose
  centre is below it (`ang < 0` on `atan2`, l.121-124), then draws `lineStr` (l.135)
  from centre to centre: a filled tapering quadrilateral (l.163-171) starting at
  width `w*0.001` and ending at `h*0.0014` — i.e. a hairline. All cells of one tree
  share one colour `bas = rcol()` (l.110,134) at alpha 220, `blendMode(NORMAL)`.
  Result: each cell points at its closest lower neighbour → a downward-directed
  graph that reads as branching.
- Colour: `rcol()` (l.180-182) picks uniformly from
  `colors[] = {#99002B, #EFA300, #CED1E2, #D66953, #28422E}` (l.176). The pale blue
  `#CED1E2` and dark red dominate the baseline image; amber appears as accents.
- Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` in `generate()`
  (l.62-63): tree positions/sizes, subdivision choices, target-neighbour selection
  (indirectly), and the per-tree colour. `toxi`/`triangulate`/`peasy` are imported
  but unused in the active code (PeasyCam and a noise-based point cloud are
  commented out, l.5, l.96-107, l.138-152).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| trees_60 | `for (int i = 0; i < 240; i++) {` -> `for (int i = 0; i < 60; i++) {` | subtle | about a quarter as many trees: large dark gaps open up and the remaining branch fans (red, amber, pale blue) are individually legible; same hairline weight and palette | variants/trees_60/frame_00001.png |
| alpha_255 | `fill(bas, 220);` -> `fill(bas, 255);` | none | no visible change (0.0 of pixels differ) | variants/alpha_255/frame_00001.png |
| stroke_4x | `lineStr(x1, y1, x2, y2, w*0.001, h*0.0014);` -> `... w*0.004, h*0.005);` | moderate | strokes ~4x thicker: the trees read as bold lines, the canvas looks markedly busier and brighter, same structure and palette | variants/stroke_4x/frame_00001.png |
| sub_12 | `int sub = int(random(2, random(2, 6)));` -> `... random(2, 12)));` | subtle | cells subdivide finer: more short tick-like marks, texture slightly finer and more uniform | variants/sub_12/frame_00001.png |
| depth_12 | `for (int k = 0; k < 30; k++) {` -> `for (int k = 0; k < 12; k++) {` | subtle | fewer subdivision passes: coarser cells, a few longer lines, less fine tick detail at the bottom of trees | variants/depth_12/frame_00001.png |

## Modularisation notes
- `lineStr` (l.163-171) is fully generic: a tapering filled segment with independent
  start/end widths. Good library candidate as-is.
- `arbol` is the core reusable block: "subdivide a rectangle into an irregular
  quadtree lattice, then connect each cell to its nearest cell below". Its art
  decisions are separable: cell-count cap (30), sub range (2–5), 5% min-size
  cutoff, "nearest below" neighbour rule, single-colour-per-tree at fixed alpha.
- `rcol`/`getColor` are trivial palette helpers; `getColor` (lerp between adjacent
  palette entries, l.186-191) is unused in the active path but is a nice
  palette-interpolation utility.
- A clean parameter object would be: `{trees, iterations, subMin, subMax, minSizeFrac,
  alpha, strokeScaleW, strokeScaleH, palette, background}`. The 30 px grid snap and
  the bounding-box size ranges are one-off art decisions.
