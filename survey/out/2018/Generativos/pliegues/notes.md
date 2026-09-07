---
sketch: 2018/Generativos/pliegues
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1544
animated: false
techniques: [subdivision, grid]
primitives: [line, rect, ellipse]
palette:
  colors: ["#2B2827", "#959CD3", "#4EB9AF", "#DBC9D5", "#B2B2B2"]
  selection: random-from-list
composition: margins
parameters:
  - {name: ss, default: "random(10, 24)", tried: [10], change: large, effect: "thinner margin frame and finer background grid; rectangle composition unchanged"}
  - {name: sub, default: "int(random(4, 37))", tried: [37, 8], change: large, effect: "37 = much denser mosaic, no big blocks survive; 8 = few big blocks, one small dense cluster"}
  - {name: stroke, default: "lerp white->#B2B2B2 0.4-0.6", tried: ["255"], change: large, effect: "grid lines and seams become pure white, far more prominent"}
  - {name: strokeWeight, default: 1.2, tried: [4], change: none, effect: "no visible change; grid lines are covered by the filled rects except in the margin, where the difference is negligible"}
  - {name: colors[], default: "{#2B2827, #959CD3, #4EB9AF, #DBC9D5}", tried: ["{#1A1A2E, #E94560, #F5D547, #0F3460}"], change: large, effect: "same composition in navy / dark-navy / red-coral / yellow"}
---

## What it draws
A Mondrian-like composition: the canvas is subdivided into a nested mosaic of
axis-aligned rectangles in four flat colors (near-black, lavender, teal, pale pink),
with large blocks in the corners and increasingly dense, tiny fragments clustered
toward the center-right. Every rectangle carries a single small white dot at a
random position. A thin grid of whitish lines runs across the whole canvas (spacing
~10-24 px), and a gray (#B2B2B2) margin frame of the same width surrounds the
rectangle block. Static single frame (frames 10/60 identical).

## How the code works

`setup()` (l.3-9) sizes 960x960 P2D, then calls `generate()` once; `draw()` is
empty, so the piece is static (a keypress regenerates with a new seed, l.14-20).
- `generate()` (l.32-71) reseeds with the harness `seed` (l.33) and paints a
  gray `#B2B2B2` background (l.34).
- Grid: `ss = random(10, 24)` (l.36) sets both the grid spacing and the margin.
  With `strokeWeight(1.2)` and a stroke lerped 40-60% from white toward the gray
  background (l.37-38), it draws full-height and full-width lines every `ss` px,
  each offset by `random(-1, 1)` (l.39-42). This is the background grid and the
  visible frame.
- Subdivision: starts with one inner rectangle inset by `ss` (l.44-45).
  `sub = int(random(4, 37))` iterations (l.47): each picks a random rect (l.49),
  splits it at `nw = w*random(0.35, 0.65)`, `nh = h*random(0.35, 0.65)`
  (l.51-52) into four children (l.53-56) and removes the parent (l.57). Random
  selection means some rects get split repeatedly, producing the dense clusters
  of tiny fragments next to large untouched blocks.
- Filling (l.60-70): `noStroke()`, each rect filled with `rcol()` — a uniform
  random pick from the 4-color `colors[]` array (l.78-81) — drawn 2px inset
  (l.65), so the grid lines peek through as seams. A 4px white `ellipse` is
  placed at a random point inside each rect (l.66-69).
- `getColor()` (l.82-90, a noise/value-driven palette lerp) is unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_10 | `float ss = random(10, 24);` -> `float ss = 10;` | large (mean 0.2656, 0.834 of pixels) | thinner gray margin frame and finer, denser background grid; the rectangle mosaic is the same layout | variants/ss_10/frame_00001.png |
| sub_37 | `int sub = int(random(4, 37));` -> `int sub = 37;` | large (mean 0.2363, 0.667 of pixels) | whole canvas densely subdivided into mid-size fragments; large corner blocks no longer survive | variants/sub_37/frame_00001.png |
| sub_8 | `int sub = int(random(4, 37));` -> `int sub = 8;` | large (mean 0.2712, 0.696 of pixels) | very sparse: a handful of huge blocks (big teal field on the right) plus one small dense fragment cluster | variants/sub_8/frame_00001.png |
| stroke_255 | `stroke(lerpColor(color(255), color(#B2B2B2), random(0.4, 0.6)));` -> `stroke(255);` | large (mean 0.199, 0.641 of pixels) | grid lines and inter-rect seams are crisp white instead of faint; composition unchanged | variants/stroke_255/frame_00001.png |
| weight_4 | `strokeWeight(1.2);` -> `strokeWeight(4);` | none (mean 0.0048, 0.022 of pixels) | no visible change; rect fills cover the grid lines, so the weight only affects the margin band | variants/weight_4/frame_00001.png |
| palette_warm | `int colors[] = {#2B2827, #959CD3, #4EB9AF, #DBC9D5};` -> `int colors[] = {#1A1A2E, #E94560, #F5D547, #0F3460};` | large (mean 0.2485, 0.611 of pixels) | identical composition recolored: dark navy, navy, red-coral, yellow | variants/palette_warm/frame_00001.png |

## Modularisation notes
- `splitRects` (l.44-58) is fully generic: a guillotine/quadtree subdivision
  with configurable iteration count and split-ratio range; no art-specific
  coupling.
- `gridLines` (l.36-42) is generic: spacing + jitter parameters; the stroke
  color (white-to-background lerp) is an art decision.
- The 2px inset when filling rects (l.65) and the per-rect white dot (l.66-69)
  are one-off art decisions; the palette list and its uniform-random selection
  are swappable.
- A clean parameter object: `{spacing, gridJitter, lineWeight, lineColor,
  iterations, ratioRange, palette, fillInset, dotSize}`.
