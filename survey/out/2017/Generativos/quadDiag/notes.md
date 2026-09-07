---
sketch: 2017/Generativos/quadDiag
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 175
animated: false
techniques: [subdivision]
primitives: [rect]
palette:
  colors: ["#f7bd37", "#ffe50c", "#db1922", "#d9366d", "#b41c59", "#542462", "#272f7a", "#1d5468", "#82cb9d"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: iterations, default: 1000, tried: [300], change: large, effect: "fewer, larger surviving quads; sparse clusters with big empty gray regions"}
  - {name: rotateProb, default: 0.2, tried: [0.5], change: large, effect: "far more 45-degree diamonds; mosaic dominated by rotated squares"}
  - {name: rotateScale, default: "sqrt(2)*0.5", tried: [1.0], change: moderate, effect: "rotated child covers the whole parent square; big solid diamonds, denser fine clusters"}
  - {name: splitScale, default: 0.5, tried: [0.3], change: large, effect: "smaller children leave gaps between them; sparser clusters, more gray ground visible"}
  - {name: background, default: 200, tried: [0], change: none, effect: "no visible change; the quad mosaic covers the canvas so the background is hidden"}
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(quads, iterations, rotateProb, splitScale, rotateScale) -> Quad[]", note: "iteratively split random quads into 4 children or rotate+shrink one; draw survivors"}
  - {name: randomQuad, signature: "randomQuad(x, y, s, angle, colors) -> drawn rect", note: "axis- or 45-degree-rotated square filled from a palette list"}
---

## What it draws
A full-bleed mosaic of flat squares on a light-gray ground, mixing axis-aligned blocks
with 45°-rotated diamond squares. Sizes range from large flat regions (hundreds of px)
down to dense clusters of tiny squares and diamonds. Colours come from a 9-colour
palette: yellow/amber, red, magenta/pink, purple, teal-dark, mint green, and deep blue
are the dominant hues.

## How the code works
- `setup()` (L1-5): 960x960, `rectMode(CENTER)`, calls `generate()` once; `draw()` is empty,
  so the sketch is static (key 's' saves, any other key regenerates).
- `generate()` (L21-55): fills with gray `background(200)` (L22), translates to canvas
  centre (L23). Seeds one quad covering the whole canvas (`new Quad(0, 0, width, 0)`,
  L28 — in CENTER rect mode a width-wide square centred at the origin; `diag` computed
  at L25 is unused).
- The main loop (L32-50) runs 1000 iterations: picks a random quad, biased toward
  earlier list entries via `int(random(quads.size()*random(1)))` (L33). With
  probability 0.2 (L35) it spawns one rotated child — same centre, size
  `s*sqrt(2)*0.5` ≈ 0.707·s, angle `a+HALF_PI/2` (L36) — and immediately draws the
  parent (L38); otherwise it splits the quad into 4 corner children of size
  `s*0.5` (L40-47, offset along the diagonals by `ms*0.5*sqrt(2)`), adds them, and
  removes the parent without drawing it (L49).
- After the loop, every surviving quad is drawn (L51-54). Each `Quad.show()` (L70-77)
  translates/rotates and fills a CENTER-mode rect with a random palette colour
  (`rcol()`, L58-60, from the 9-colour list at L57).
- Net effect: quads that were rotated-and-frozen become solid diamonds (often with
  smaller rotated diamonds inside, since a diamond can be picked again); quads that kept
  splitting tile their area in 4-way splits, producing the fine-grained clusters.
  Rotation (45°) and the split both align to the diagonals, so all diamonds sit at 45°.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| iterations_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | large | sparse: a few large solid squares (yellow, purple, green/pink) and small square/diamond clusters scattered on the light-gray ground, lots of empty space | variants/iterations_300/frame_00001.png |
| rotateProb_0.5 | `if (random(1) < 0.2) {` -> `if (random(1) < 0.5) {` | large | still full-bleed but far more 45-degree diamonds; large solid diamonds (teal, blue, yellow) dominate and the fine clusters are diamond-heavy | variants/rotateProb_0.5/frame_00001.png |
| rotateScale_1.0 | `q.s*sqrt(2)*0.5, q.a+HALF_PI/2);` -> `q.s*1.0, q.a+HALF_PI/2);` | moderate | rotated children now cover their whole parent square, so the "diamond in a square" motif becomes solid diamonds filling the area; overall layout similar, slightly denser fine clusters | variants/rotateScale_1.0/frame_00001.png |
| splitScale_0.3 | `float ms = q.s*0.5;` -> `float ms = q.s*0.3;` | large | split children are smaller and no longer touch, so the mosaic is sparser with gray gaps between squares; large solid diamonds stand out more against the gaps | variants/splitScale_0.3/frame_00001.png |
| background_0 | `background(200);` -> `background(0);` | none | no visible change; the quad mosaic fully covers the canvas so the background colour is hidden | variants/background_0/frame_00001.png |

## Modularisation notes
- Generic: the iterative "pick random quad, either rotate+freeze or 4-way split" process is
  a clean library function (`quadSubdivide`) parameterised by iteration count, rotate
  probability, split scale, rotate scale, and palette; the frozen-parent draw-at-pick step
  is the key aesthetic mechanism (deciding which quads are "solid" vs "split").
- One-off art decisions: the specific 9-colour palette, the 0.707·s rotate scale
  (`sqrt(2)*0.5` keeps the diamond inside the parent), the seed quad covering the canvas
  from centre, the index-bias in quad selection, gray background(200).
- A clean parameter object: `{iterations, rotateProb, splitScale, rotateScale, colors[],
  background, seedQuad}`.
