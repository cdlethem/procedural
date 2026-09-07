---
sketch: 2019/generativos/llgg
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1519
animated: false
techniques: [subdivision, grid, noise-field, lines-hatching]
primitives: [rect]
palette:
  colors: ["#F20707", "#FCCE4A", "#D0DFE8", "#F49FAE", "#342EE8", "#FFFFFF", "#000000"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: sub, default: 60, tried: [15], change: large, effect: "fewer iterations = much coarser layout, few large blocks, far fewer stripe/bar decorations"}
  - {name: detCol, default: "random(0.002, 0.003)", tried: ["random(0.0005, 0.001)"], change: large, effect: "lower noise detail = large coherent colour regions; striped blocks dominate visually"}
  - {name: fillAlpha, default: "random(255*random(1), 255)*random(0.5, 1)", tried: ["random(255*random(1), 255)"], change: moderate, effect: "fully opaque blocks: flat saturated colours, no lower-layer bleed-through"}
  - {name: stripeProb, default: 0.1, tried: [0.4], change: large, effect: "4x probability = stripes/edge bars on most blocks, image dominated by stripe texture"}
  - {name: stripeCount, default: "int(random(4, 11)*random(0.5, 1.8))", tried: ["int(random(10, 24))"], change: moderate, effect: "more, finer stripes inside striped blocks; block layout otherwise unchanged"}
reusable_candidates:
  - {name: recursiveRectSubdivide, signature: "recursiveRectSubdivide(n, splitFracs, selectBias) -> Rect[]", note: "iteratively split random rects at random fractional cut points into 4 quadrants"}
  - {name: noisePaletteColor, signature: "noisePaletteColor(x, y, detail, palette) -> color", note: "2-D noise mapped onto a palette with lerp between adjacent entries"}
---

## What it draws
A full-bleed Mondrian-like mosaic of flat rectangles in a red / orange / purple palette (with pale blue, pink and near-black accents). Blocks range from large solid areas to small tiles; several blocks are overlaid with thin vertical or horizontal stripes, and a few carry a thin solid bar along one edge. No strokes, no gradients inside a block — colour is flat per block, semi-transparent over the 240-grey background.

## How the code works
`generate()` (llgg.pde:54) runs once in `setup()`; `draw()` is empty, so the piece is static. Flow:

1. `rects` starts as the full canvas (l.61-62). A loop of `sub = 60` iterations (l.63-81) picks a rect at a random index biased toward the start of the list (l.66), and replaces it conceptually by appending four quadrants cut at a random fraction from `subs = {0.25, 0.33333, 0.5, 0.66666, 0.75}` for width and height independently (l.71-77). The parent is never removed and `r.sub` is never set (l.79-80 commented out), so earlier (larger) rects stay in the list and are painted first; later smaller rects paint over them. This is why big blocks dominate the look while fine detail accumulates on top.
2. Colour (l.83-88): each rect is filled with `getColor(noise(r.x*detCol, r.y*detCol)*colors.length*2)` where `detCol = random(0.002, 0.003)`. `getColor` (l.131-137) takes the noise value, wraps it modulo the 5-colour palette `colors[]` (l.124), and lerps between two adjacent palette entries — a noise-driven colour field sampled per block. Fill alpha is `random(255*random(1), 255)*random(0.5, 1)` (l.87), so blocks are semi-transparent, letting lower layers bleed through (the washed-out blocks in the top-left of the baseline).
3. Decorations (l.90-94): with probability 0.1 per rect, a thin bar (10% of the rect's width or height) is painted black or white at alpha 200 along a random edge.
4. Stripes (l.96-112): with probability 0.1 per rect, the rect gets `cc = int(random(4,11)*random(0.5,1.8))` stripes across its long axis, each `ss*amp` wide with `amp = random(0.1, 0.9)` (l.97-99) — the vertical/horizontal stripe bands visible in the baseline.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_15 | `int sub = 60;` -> `int sub = 15;` | large | much coarser layout: a handful of big flat blocks (yellow, orange, red, purple, pale green-grey) instead of the baseline's fine mosaic; only a few blocks carry stripes or edge bars | variants/sub_15/frame_00001.png |
| detCol_0.001 | `float detCol = random(0.002, 0.003);` -> `random(0.0005, 0.001);` | large | noise colour field is much larger-scale: big coherent regions (purple, orange, red, pale band top); a tall central column of dense dark/orange horizontal stripes and vertical stripes top-right become the dominant feature | variants/detCol_0.001/frame_00001.png |
| alpha_opaque | `random(255*random(1), 255)*random(0.5, 1)` -> `random(255*random(1), 255)` | moderate | blocks are fully opaque: same layout, but the baseline's washed-out, translucent top-left blocks are now flat saturated purple/blue; overall flatter, more contrasty colour | variants/alpha_opaque/frame_00001.png |
| stripeProb_0.4 | `if (random(1) < 0.1) {` -> `if (random(1) < 0.4) {` | large | stripes and edge bars on most blocks: dense vertical/horizontal stripe bands and black edge bars everywhere; image reads as striped texture rather than solid mosaic | variants/stripeProb_0.4/frame_00001.png |
| stripeCount_10_24 | `int cc = int(random(4, 11)*random(0.5, 1.8));` -> `int cc = int(random(10, 24));` | moderate | striped blocks contain noticeably more and finer stripes (e.g. dense thin vertical stripes bottom-right, fine horizontal stripes top-right); block layout otherwise the same | variants/stripeCount_10_24/frame_00001.png |

## Modularisation notes
- **Generic**: the recursive-quadrant-subdivision loop (l.54-81) is a standalone layout generator — parameters: iteration count, cut-fraction set, selection bias. The noise-to-palette mapping (l.131-137) is a reusable colour function.
- **One-off art decisions**: the specific 5-colour palette (l.124), the 0.1 probabilities and sizes of the edge bars and stripes, the alpha formula (l.87).
- **Clean parameter object**: `{iterations, cutFractions[], selectBias, colorDetail, palette[], alphaJitter, barProb, barSize, stripeProb, stripeCountRange, stripeWidthRange}`.
