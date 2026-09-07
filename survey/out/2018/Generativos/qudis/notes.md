---
sketch: 2018/Generativos/qudis
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1533
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#EDBFB7", "#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(200))", tried: [50, 600], change: large, effect: "iteration count controls density: 50 leaves huge flat blocks with a couple of dense clusters; 600 makes the whole canvas busy with many medium cells and dense corners"}
  - {name: splitRatio, default: "random(0.2, 0.8)", tried: ["random(0.45, 0.55)"], change: large, effect: "even split ratios give a more balanced, blockier mosaic with less extreme size contrast"}
  - {name: gap, default: 1, tried: [3], change: subtle, effect: "thicker peach gap lines (3px inset); cell layout unchanged, only 6% of pixels differ"}
  - {name: palette, default: "[#FF3D20, #FC9D43, #3998C2, #3E56A8, #090D0E]", tried: ["[#FF3D20, #FC9D43, #E8B27D, #B34A28, #5C2E1F]"], change: large, effect: "same layout recolored warm: reds/oranges/tans/browns, no cool blue/indigo"}
  - {name: background, default: "#EDBFB7", tried: ["#2A2A2A"], change: subtle, effect: "same layout; gaps render as dark gray lines instead of peach, only 4% of pixels differ"}
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(canvas, iterations, ratioMin, ratioMax) -> Rect[]", note: "random quad-split: each step picks a random cell, splits it at random x/y ratios into 4 children, replaces the cell; guard keeps children > 2px"}
  - {name: palettePick, signature: "palettePick(colors) -> color", note: "uniform random pick from an int color array"}
---

## What it draws
A Bauhaus/Mondrian-style full-bleed partition of the square into flat colored
rectangles of very unequal sizes: a few huge blocks (indigo top-left, orange
center, steel-blue right) alongside dense clusters of tiny cells, mostly in the
top-right and bottom-left corners. Thin 1px gaps of pale peach separate every
cell, and each cell carries a small 2x2 dot in its center, mostly in the
palette's other colors. No strokes, no gradients, no text.

## How the code works
`setup()` (qudis.pde:5-19) sizes a 960x960 P2D canvas, then calls
`generate()`. `generate()` (42-78) sets `randomSeed(seed)`, fills the
background with `#EDBFB7` (line 45), and builds a tessellation:

1. Start with one `Rect` covering the whole canvas (line 48).
2. `sub = int(random(200))` iterations (line 50): each step picks a random
   rect from the list, computes a random split `nw = r.w*random(0.2,0.8)`
   (line 54) and `nh = r.h*random(0.2,0.8)` (line 55), replaces the picked
   rect with four children (lines 57-61) — i.e. a quadtree-style subdivision
   where the cross-point is at a random position, not the center. If a child
   would be <= 2px, the step is skipped (line 56), which is why dense areas
   stop subdividing and large cells stay intact.
3. Drawing loop (65-72): each surviving rect is drawn with
   `rect(r.x+1, r.y+1, r.w-2, r.h-2)` (line 69) — the 1px inset is what
   exposes the peach background as the thin gap grid. Color is
   `rcol()` (106-108), a uniform random pick from the 5-color array
   `colors[]` (line 105). A second 2x2 rect (lines 70-71) in an independent
   random color is drawn at each cell's center.

Randomness enters only through `randomSeed(seed)`: split count, which cell is
picked, split ratios, and all fills. The shader/post-processing code
(`post.glsl`, `arc2`) is fully commented out and unused. `draw()` is empty,
so the piece is static.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_50 | `int sub = int(random(200));` -> `int sub = 50;` | large | far coarser: a few huge flat blocks (indigo top-left, steel-blue right half) plus dense micro-cell clusters only in top-right and bottom-left corners | variants/sub_50/frame_00001.png |
| sub_600 | `int sub = int(random(200));` -> `int sub = 600;` | large | much busier: dense clusters across all edges, medium cells everywhere, no big empty areas | variants/sub_600/frame_00001.png |
| split_045 | `float nw = r.w*random(0.2, 0.8);` -> `float nw = r.w*random(0.45, 0.55);` | large | more balanced, blockier mosaic: sizes more even, less extreme contrast between huge and tiny cells | variants/split_045/frame_00001.png |
| gap_3 | `rect(r.x+1, r.y+1, r.w-2, r.h-2);` -> `rect(r.x+3, r.y+3, r.w-6, r.h-6);` | subtle | same layout as baseline with visibly thicker peach gap lines; cells slightly smaller | variants/gap_3/frame_00001.png |
| palette_warm | `int colors[] = {#FF3D20, #FC9D43, #3998C2, #3E56A8, #090D0E};` -> `{#FF3D20, #FC9D43, #E8B27D, #B34A28, #5C2E1F};` | large | identical layout recolored entirely warm: red/orange/tan/rust/brown, no cool colors | variants/palette_warm/frame_00001.png |
| bg_dark | `background(#EDBFB7);` -> `background(#2A2A2A);` | subtle | same layout; gaps now dark gray lines instead of peach, reads as a darker grid | variants/bg_dark/frame_00001.png |

## Modularisation notes
The generic core is the quad-subdivision loop (lines 47-63): it takes a
starting rect, an iteration count, split-ratio bounds, and a minimum child
size, and returns the surviving cells — a clean `quadSubdivide` candidate.
The inset-gap rendering (line 69) and the center dot (lines 70-71) are
separable style passes over the cell list. The palette is a one-off art
decision (5 named ints + peach background); a clean parameter object would be
`{iterations, ratioMin, ratioMax, minChild, gap, palette, background,
dotSize, dotOn}`. The dead `arc2`/shader code is one-off leftovers, not
candidates.
