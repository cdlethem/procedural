---
sketch: 2018/Generativos/quadis
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1455
animated: false
techniques: [subdivision]
primitives: [rect]
palette:
  colors: ["#B14027", "#476086", "#659173", "#9293A2", "#262A2C", "#D38644"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: scl, default: "random(0.2, 0.5)", tried: ["random(0.5, 0.8)"], change: moderate, effect: "larger center rects = coarser mosaic, fewer larger blocks, thinner strips"}
  - {name: sub, default: "int(random(300*random(1)))", tried: ["int(random(3000*random(1)))"], change: moderate, effect: "more iterations = finer, busier patchwork of smaller rects"}
  - {name: colors, default: "#B14027,#476086,#659173,#9293A2,#262A2C,#D38644", tried: ["#FF6B6B,#4ECDC4,#FFE66D,#1A535C,#F7FFF7,#FF9F1C"], change: large, effect: "only the palette changes; geometry identical (same seed), muted -> vivid"}
  - {name: det, default: "random(1)", tried: [100], change: none, effect: "no visible change: noise colouring (vertexCol) is dead code, Rect.draw() commented out"}
  - {name: orientation bias, default: "random(1) < 0.5", tried: ["random(1) < 0.0"], change: subtle, effect: "forcing one pinwheel orientation slightly reshuffles the layout (random stream shift); staggered look retained"}
  - {name: staggeredQuadSplit, signature: "staggeredQuadSplit(rect, scale) -> Rect[5]", note: "replace a rect by a center rect of (w*scale, h*scale) plus four surrounding strips, offset by half a strip in one of two pinwheel orientations"}
  - {name: lerpPalette, signature: "lerpPalette(colors, v) -> Color", note: "map scalar v to lerp between adjacent palette entries (cyclic)"}
---

## What it draws
A full-bleed mosaic of flat, axis-aligned rectangles in a muted palette: dusty blue,
teal/sage green, rust orange, tan, warm grey and near-black. The composition is
asymmetric: two very large rectangles dominate the upper-right (dusty blue) and
lower-right (teal), while the left half is a busy patchwork of smaller rects with
staggered, pinwheel-like offsets (vertical rust strips crossing horizontal grey
strips in L/T junctions). No strokes, no gradients, no curves; purely hard-edged
color blocks.

## How the code works
- `setup()` (lines 3-8): 960x960 P2D, `smooth(8)`, `pixelDensity(2)`, calls `generate()` once; `draw()` is empty, so the piece is static (frame 10/60 identical to frame 1).
- `generate()` (lines 48-105) is a randomized quadtree-style subdivision: starts with one rect covering the whole canvas (line 51). `sub = int(random(300*random(1)))` (line 57) — up to 300 iterations, mean ~150. Each iteration picks a random rect (line 60), shrinks it to a center rect of size `scl` (line 58, `random(0.2, 0.5)`), and replaces it with 5 rects (lines 86-92): the center plus four surrounding strips. The four strips are offset by half their width/height in one of two mirror-image pinwheel directions chosen with 50% probability (lines 74-84) — this is what produces the staggered brickwork look.

- `background(0)` inside the loop (line 70) has no visible effect: the final pass repaints the entire canvas.
- Final pass (lines 96-104): `noStroke()`, each remaining rect is filled with `getColor(random(colors.length))` (line 101) — a random position on the 6-colour palette, lerped between adjacent entries (lines 118-124). The noise-driven per-vertex colouring (`vertexCol`, lines 43-46, with `des`/`det`) exists but is dead code: `Rect.draw()` is commented out (line 103), so `det`/`des` have no visible effect.
- Palette (line 113): rust, dusty blue, sage, grey, near-black, tan (coolors.co link in comment, line 112).
- Randomness: seed set by harness; all choices (which rect to subdivide, orientation, final colour) come from `random()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| scl_0.5_0.8 | `  float scl = random(0.2, 0.5);` -> `  float scl = random(0.5, 0.8);` | moderate | coarser mosaic: bigger flat blocks (large teal bottom, dusty-rose centre, blue-grey right), thinner offset strips | variants/scl_0.5_0.8/frame_00001.png |
| sub_3000 | `  int sub = int(random(300*random(1)));` -> `  int sub = int(random(3000*random(1)));` | moderate | finer, busier patchwork: many more smaller rects, especially upper-left; a few large rects still survive on the right | variants/sub_3000/frame_00001.png |
| palette_bright | `int colors[] = {#B14027, ...};` -> `int colors[] = {#FF6B6B, #4ECDC4, #FFE66D, #1A535C, #F7FFF7, #FF9F1C};` | large | identical geometry, vivid palette (teal, orange, mint, yellow, coral) replaces the muted one | variants/palette_bright/frame_00001.png |
| det_100 | `  det = random(1);` -> `  det = random(100);` | none | no visible change (pixel-identical): noise-based colouring is dead code | variants/det_100/frame_00001.png |
| orient_0.0 | `    if (random(1) < 0.5) {` -> `    if (random(1) < 0.0) {` | subtle | same staggered mosaic, slightly different layout (single pinwheel orientation + shifted random stream) | variants/orient_0.0/frame_00001.png |

## Modularisation notes
- Generic: the subdivision itself (`staggeredQuadSplit`) — pick-a-rect, split into center + 4 offset strips, 50/50 orientation — is a clean, self-contained operator that takes (rect list, scale, iterations) and returns a rect partition; the pinwheel offset is the distinctive feature worth keeping as a parameter (orientation probability).
- Generic: `lerpPalette` — cyclic palette lerp from a scalar.
- One-off art decisions: the specific 6-colour muted palette, the `scl` range (0.2-0.5), the iteration-count distribution (`random(300*random(1))`), the P2D + smooth(8) rendering.
- Dead code to drop in a library port: `vertexCol`/`des`/`det` noise colouring, `rcol()`, `shuffleArray()`, `saveImage()`, the in-loop `background(0)`.
- A clean parameter object: `{seed, iterations, scaleRange: [0.2, 0.5], orientationBias: 0.5, palette, paletteMode}`.
