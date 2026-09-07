---
sketch: 2015/Generativos/bolaPantone
year: 2015
renderer: JAVA2D
size: [1600, 1600]
libraries: []
deterministic: true
ms_first_frame: 3596
animated: false
techniques: [polar, particles, image-source]
primitives: [ellipse]
palette:
  colors: ["#00A0A0", "#0060A0", "#00A060", "#A0A020", "#004060", "#006060", "#004040", "#604000"]
  selection: image-sampled
composition: radial
parameters:
  - {name: count, default: 10000, tried: [20000], change: moderate, effect: "denser ball, more ring overlap, darker muddier centre"}
  - {name: maxRadius, default: 0.6, tried: [0.35], change: moderate, effect: "smaller compact ball (~58% extent), higher local density, larger-looking rings (rim-shrink map evaluated over smaller range)"}
  - {name: sizeRange, default: [1, 40], tried: [[1, 80]], change: moderate, effect: "much larger overlapping rings; solid saturated mass, slightly bumpy edge"}
  - {name: ringWeight, default: 1.5, tried: [4], change: subtle, effect: "thicker rings; ball slightly more solid, similar overall impression"}
  - {name: alphaStep, default: 50, tried: [20], change: subtle, effect: "ring alpha capped at 100 instead of 250; ball paler, washed out"}
  - {name: trailSteps, default: 6, tried: [12], change: subtle, effect: "longer diagonal trails; directional combed streak texture"}
reusable_candidates:
  - {name: imagePalette, signature: "imagePalette(img) -> color[]", note: "deduplicated list of unique pixel colours of an image, in pixel order"}
  - {name: polarScatter, signature: "polarScatter(cx, cy, maxR, count, sizeProfile) -> {x, y, size}[]", note: "count points at uniform-random radius/angle in a disc, radius-dependent size"}
  - {name: ringTrail, signature: "ringTrail(x, y, size, steps, offset, col, alphaStep)", note: "grey weight-graded concentric halo plus a short trail of alpha-stepped stroked rings"}
---

## What it draws
A dense, roughly circular "ball" of thousands of small coloured rings, centred on an off-white (250) background. Each ring carries a short diagonal comet-like trail of up to six offset copies with rising opacity, plus a faint grey concentric halo. Density and ring size both fall off towards the edge, so the ball dissolves into sparse single rings at its rim. Dominant colours are teal and green with magenta, orange, blue and many pale grey/white rings mixed through.

## How the code works
- `setup()` (bolaPantone.pde:3-7): 1600x1600, default JAVA2D. Builds `pallete` = unique pixel colours of `image.jpg` (a Pantone-style swatch sheet) via `getPalleteImage` (43-58: exact-dedup in pixel order, so the list starts with the sheet's white/grey chips). Calls `generar()`, which `saveFrame`s and `exit()`s (39-40), so the sketch is one-shot and static.
- `generar()` (16-41): `background(250)`, then outer loop `i = 0..9999` (18). Each iteration places one ring unit at random polar coords: radius `dis = random(cx*0.6)` (21, uniform in r, so area density falls off as 1/r and the centre is densest), angle `random(TWO_PI)` (22), size `tt = random(1,40) * map(dis, 0, cx*0.6, 1, 0.5)` (23, halved at the rim).
- Inner loop `k = 0..5` (26) draws the unit at `(x+k*2, y+k*2)`, a 2px-per-step diagonal offset:
  - grey halo: `stroke(0,4)`, `noFill`, ten concentric `ellipse`s at the same centre with `strokeWeight(tt*0.3*j)` for j = 0.1..1 (27-32) -> a soft faint grey disc;
  - coloured ring: `strokeWeight(1.5)`, `stroke(palette[i % palette.size()], k*50)` (34-36) -> a 1.5px stroked ring with alpha 0, 50, ..., 250, so the trail becomes opaque along its diagonal.
- Colour choice (35): palette cycled by the global counter `i % palette.size()`, not by position, so colour is uncorrelated with location. Because the palette list starts with the sheet's white/grey chips, a large share of rings comes out pale/white, as seen in the baseline.
- Randomness enters only through `dis`, `ang`, `tt`; the harness seed makes the baseline deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_20000 | `for(int i = 0; i < 10000; i++){` -> `for(int i = 0; i < 20000; i++){` | moderate | denser ball; more ring overlap, centre darker and muddier; same extent | variants/count_20000/frame_00001.png |
| radius_0.35 | `float dis = random(cx*0.6);` -> `float dis = random(cx*0.35);` | moderate | visibly smaller ball (~58% of extent); higher local density, more saturated colour; rings look larger | variants/radius_0.35/frame_00001.png |
| size_80 | `float tt = random(1, 40)*map(dis, 0, cx*0.6, 1, 0.5);` -> `random(1, 80)*...` | moderate | same extent but much larger overlapping rings; solid saturated mass with slightly bumpy edge | variants/size_80/frame_00001.png |
| weight_4 | `strokeWeight(1.5);` -> `strokeWeight(4);` | subtle | rings noticeably thicker (~4px); ball slightly more solid, similar overall impression | variants/weight_4/frame_00001.png |
| alpha_20 | `stroke(pallete.get(i%pallete.size()).col, k*50);` -> `k*20` | subtle | ring alpha capped at 100 instead of 250; ball slightly paler/washed out | variants/alpha_20/frame_00001.png |
| trail_12 | `for(int k = 0; k < 6; k++){` -> `for(int k = 0; k < 12; k++){` | subtle | trails extend ~22px diagonally; directional combed streak texture (towards lower right) | variants/trail_12/frame_00001.png |

## Modularisation notes
- `getPalleteImage` (43-58) is generic: unique-pixel-colour extraction; its linear O(n*m) dedup is the weak point, a hash-set version would be drop-in.
- The polar scatter (19-25) is generic: (cx, cy, maxR, count, sizeProfile(r)) -> list of (x, y, size).
- The ring-trail unit (26-37) is a reusable primitive: (x, y, size, steps, offset, col, alphaStep) -> grey halo + alpha-stepped rings.
- One-off art decisions: the 2px diagonal offset, the k*50 alpha ramp, the grey-halo weight profile (tt*0.3*j), and cycling the palette by global counter rather than by position.
- A clean parameter object: {count, maxRadius, sizeRange, rimShrink, trailSteps, trailOffset, ringWeight, alphaStep, palette, background}.
