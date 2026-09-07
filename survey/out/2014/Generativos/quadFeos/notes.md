---
sketch: 2014/Generativos/quadFeos
year: 2014
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: false
ms_first_frame: 285
animated: true
techniques: [subdivision, grid, pixel-ops, particles]
primitives: [rect, ellipse, pixels]
palette:
  colors: ["#A92477", "#C42366", "#F32645", "#FF4F01", "#FFBF17"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: blurPasses, default: 500, tried: [50], change: none, effect: "no visible change; quadtree already absent from the captured frame"}
  - {name: cellSteps, default: 50, tried: [5], change: none, effect: "no visible change; per-quad nested squares not visible in capture"}
  - {name: targetCount, default: 200, tried: [50], change: none, effect: "no visible change; quadtree not visible in capture"}
  - {name: splitProb, default: 0.3, tried: [0.9], change: subtle, effect: "no visible structural change; only dot count/positions differ (non-deterministic)"}
  - {name: grainStrength, default: 5, tried: [40], change: moderate, effect: "much coarser, stronger grain over the whole field"}
  - {name: washAlpha, default: 20, tried: [200], change: moderate, effect: "field visibly lighter and flatter; dots almost erased"}
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(targetCount, splitProb) -> Quad[]", note: "stochastic quadtree: start with one full-canvas quad, repeatedly split a random quad into 4 until target count reached"}
  - {name: nestedRectFade, signature: "nestedRectFade(x, y, size, steps, colA, colB)", note: "concentric squares shrinking from size to 0, fill lerped between two colours (halo/bloom effect)"}
  - {name: pixelGrain, signature: "pixelGrain(strength)", note: "add random 0..strength brightness to every pixel"}
---
## What it draws
A nearly uniform pale warm-grey field with very fine grain and faint mottling, plus a
handful (0-8) of tiny 2-10 px dots in palette colours (yellow, orange, red, magenta)
scattered across the canvas. The intended dense composition of nested coloured squares
is not visible in any captured frame (baseline or variants): the 10k rect draws from the
background thread do not appear in the headless capture, so every run reads as a flat
washed-out field. Frame 10/60 differ only in which dots are present.

## How the code works
- `setup()` (L9-12): `size(800,800)` then `thread("generar")`; `draw()` (L14-15) is empty.
  The whole image is generated once in a background thread, not per frame.
- `generar()` (L17-71):
  1. `background(rcol())` (L18) — one of 5 warm palette colours (L1-7).
  2. Stochastic quadtree (L20-36): starts with one quad covering the canvas
     `PVector(0,0,width)`; while the list has < 200 entries, walks it and with
     probability 0.3 per quad per pass replaces one quad by its 4 children (L24-34).
  3. For each quad (L37-57): `cc = 50` concentric squares (`rect`, `rectMode(CENTER)`,
     L42-55) shrinking from the quad size to 0, each filled with
     `lerpColor` between two random palette colours (L49-53) — a halo/bloom per cell.
  4. `noisese()` (L78-86): per-pixel `get`/`set`, adds `random(5)` brightness to every
     pixel (fine grain).
  5. Full-canvas white rect at alpha 20 (L60-62).
  6. Loop of 500 iterations (L63-70): every iteration applies `filter(BLUR, 0.3)` to
     the whole canvas; in the first 40 iterations it also draws one small
     (3-10 px) ellipse in a random palette colour at a random position.
- Empirical finding (all 6 variants): the background+rects never appear in any captured
  frame — every image is the pale field + grain + dots only. The 10k nested-rect draws
  from the `thread()`ed `generar()` do not make it into the headless JAVA2D capture, so
  the sketch degrades to "flat field + grain + dot sprinkle". The only parameters with
  a visible effect under this harness are grain strength and wash alpha.
- `deterministic: false`: no seed handling in the sketch; every run differs. Captured
  frames show the in-progress background thread at fixed times, so the frame content
  depends on thread timing as well.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| blur_50 | `for (int i = 0; i < 500; i++) {` -> `for (int i = 0; i < 50; i++) {` | none (mean 0.0001) | no visible change: same flat pale field; quadtree still absent from the capture | variants/blur_50/frame_00001.png |
| cc_5 | `int cc = 50;` -> `int cc = 5;` | none (mean 0.0) | no visible change: flat field, 2 small magenta dots | variants/cc_5/frame_00001.png |
| quads_50 | `while (quads.size () < 200) {` -> `while (quads.size () < 50) {` | none (mean 0.0037) | no visible change: flat field, 3 small dots (2 magenta, 1 yellow) | variants/quads_50/frame_00001.png |
| prob_0.9 | `if (random(1) < 0.3) {` -> `if (random(1) < 0.9) {` | subtle (mean 0.0236) | subtle: only dot count/positions differ (2 magenta); field unchanged, no quadtree visible | variants/prob_0.9/frame_00001.png |
| grain_40 | `float bri = random(5);` -> `float bri = random(40);` | moderate (mean 0.0628, 3.8% px) | clearly stronger, coarser grain across the whole field | variants/grain_40/frame_00001.png |
| wash_200 | `fill(250, 20);` -> `fill(250, 200);` | moderate (mean 0.1173, 98% px) | field visibly lighter and flatter; dots almost erased | variants/wash_200/frame_00001.png |

## Modularisation notes
- Generic: the quadtree split loop (L20-36), the nested-rect fade (L37-57), the per-pixel
  grain (L78-86), and the palette + `rcol()` helper are all reusable as-is with the
  signatures above.
- One-off art decisions: the 500-iteration `filter(BLUR)` loop (L63-70), which also
  carries the dot sprinkle; the alpha-20 white wash; note that under the headless
  harness the flat look comes from the missing threaded rect draws, not the blur.
- A clean parameter object: `{targetCount, splitProb, cellSteps, palette, grainStrength,
  blurPasses, blurRadius, dotCount, dotSizeRange, washAlpha}`.
