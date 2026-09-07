---
sketch: 2019/generativos/arbarb
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1491
animated: false
techniques: [dots-stippling]
primitives: [line, ellipse]
palette:
  colors: ["#0E1619", "#024AEE", "#FE86F0", "#FD4335", "#F4F4F4"]
  selection: fixed
composition: scattered
parameters:
  - {name: pointCount, default: 40, tried: [80], change: subtle, effect: "a few more blades survive rejection; slightly denser scene"}
  - {name: minDist, default: 20, tried: [60], change: none, effect: "fewer, more widely spread marks (low pixel impact: thin strokes)"}
  - {name: sizeMax, default: 200, tried: [400], change: subtle, effect: "blades taller, depth range stretched"}
  - {name: diskScale, default: 0.1, tried: [0.2], change: none, effect: "ground discs ~2x larger; low pixel impact on 960px canvas"}
  - {name: sub, default: 10, tried: [30], change: none, effect: "3x more dots; lines read as fine dotted dashes"}
  - {name: pwr, default: "random(0.5,0.8)", tried: ["random(1.5,2)"], change: none, effect: "dot spacing bias flips: dots cluster at blade base, tops bare"}
reusable_candidates:
  - {name: scatterWithMinDist, signature: "scatterWithMinDist(n, width, height, minDist, snap, sizeMin, sizeMax) -> PVector[]", note: "random points, y biased low, snapped to grid, rejected if within minDist of a kept point, size mapped from y (fake depth)"}
  - {name: dottedLine, signature: "dottedLine(x, y, length, dotCount, pwr, dotSize) -> void", note: "vertical line with dots at pow(i/(n-1), pwr) fractions of the length; pwr<1 biases spacing toward the top end"}
---

## What it draws
A light gray (near-white) full-bleed background with roughly 25 thin black vertical marks scattered across the canvas. Each mark is a short upright line, dotted with small black dots, standing on a tiny flat black ellipse (a ground disc or shadow). Marks lower in the canvas are taller with larger discs; marks higher up are smaller, which reads as a fake depth / ground-plane effect. Everything is monochrome black; the image is static.

## How the code works
- `settings()` (arbarb.pde:14): 960×960 P3D, `smooth(8)`, `pixelDensity(2)` (stderr: not available for this display).
- `setup()` (21) calls `generate()`; `draw()` (31) is empty, so the picture is a single static frame (regenerated only on key press).
- `generate()` (42): `randomSeed`/`noiseSeed` on `seed` (harness sets 42); `background(230)` gives the light gray field.
- Scatter loop (50–69): 40 candidates; `x = random(width)`, `y = random(random(height), height)` (biased toward the bottom), both snapped to a 5 px grid (54–55). Size `s = map(yy, 0, height, 90, 200)` (57): lower on canvas = bigger, the fake-depth cue. Rejection sampling (59–66): a candidate is kept only if it is at least 20 px from every already-kept point, so the final count is ≤ 40 (~25 visible).
- Draw loop (71–78): `noStroke(); fill(0)`; per point a flat black ellipse `p.z*0.1 × p.z*0.02` (75) as the ground disc, then `three(x, y, s)` (77).
- `three()` (81–95): `stroke(0)` vertical line of length `s` upward from the disc base (83). Then 10 dots of 2×2 px (92–94) placed at heights `pow(i/(sub-1), pwr) * s` with `pwr = random(0.5, 0.8)` per blade (86): the pow spacing compresses dots toward the top end of the line and varies per blade, giving the irregular dotted texture.
- Colour: the active palette `colors[]` (107) with `rcol()`/`getColor()` (111–123) is defined but never called from the draw path — all marks are fixed black on gray, so the palette block above lists the code's active array while the image itself is `fixed` black.
- Randomness enters at: candidate positions (51–52), the y-bias (52), per-blade `pwr` (86). All seeded, hence deterministic.

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_80 | `for (int i = 0; i < 40; i++) {` -> `... i < 80 ...` | subtle | more blades than baseline (≈35 vs ≈25), scene slightly denser in the lower half | variants/count_80/frame_00001.png |
| minDist_60 | `if (dist(xx, yy, o.x, o.y) < 20) {` -> `< 60` | none | subtle: fewer marks (≈20) and more evenly spread; clusters broken up | variants/minDist_60/frame_00001.png |
| sizeMax_400 | `float ss = map(yy, 0, height, 90, 200);` -> `... 90, 400);` | subtle | blades taller, especially bottom row; the y→size depth range is stretched | variants/sizeMax_400/frame_00001.png |
| disk_0.2 | `ellipse(p.x, p.y, p.z*0.1, p.z*0.02);` -> `p.z*0.2, p.z*0.04` | none | subtle: ground discs roughly twice as wide/tall, heavier shadows | variants/disk_0.2/frame_00001.png |
| sub_30 | `int sub = 10;` -> `int sub = 30;` | none | subtle: 3x more dots; blades read as finely dotted dashes instead of sparse dots | variants/sub_30/frame_00001.png |
| pwr_1.5_2 | `float pwr = random(0.5, 0.8);` -> `random(1.5, 2);` | none | subtle: dots now cluster at the base of each blade, upper line bare (confirms pwr<1 biases dots toward the top) | variants/pwr_1.5_2/frame_00001.png |

## Modularisation notes
- Generic / library-ready:
  - `scatterWithMinDist(n, width, height, minDist, snap, sizeMin, sizeMax)`: the position loop (50–69) is a clean reusable "scatter with minimum distance + y→size fake depth" primitive.
  - `dottedLine(x, y, length, dotCount, pwr, dotSize)`: `three()` minus the stroke line (81–95) is a reusable dotted-line primitive; `pwr` is the spacing-bias knob.
- One-off art decisions: 2×2 dot size; disc aspect 0.1/0.02; 5 px grid snap; 20 px minimum distance; 40 candidate count; fixed black on `background(230)`; the y-bias `random(random(height), height)`.
- Unused dead code: `colors[]`, `rcol()`, `getColor()`, `saveImage()` timestamping, `export` flag — none affect the render.
- A clean parameter object: `{n, minDist, snap, sizeRange: [90, 200], dotCount: 10, pwrRange: [0.5, 0.8], dotSize: 2, diskRatio: [0.1, 0.02], background: 230}`.
