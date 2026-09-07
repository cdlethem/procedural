---
sketch: 2017/Generativos/datatata
year: 2017
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2273
animated: false
techniques: [polar, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: random-from-list
composition: radial
parameters:
  - {name: cc, default: 200, tried: [100], change: large, effect: "sparser dashes: fewer, more separated streaks, larger empty black center"}
  - {name: rings, default: 5, tried: [3], change: moderate, effect: "thinner overall starburst, fewer intersecting tubes, structure otherwise unchanged"}
  - {name: dashThickness, default: "random(1,4)", tried: ["random(1,12)"], change: large, effect: "much fatter dashes: bold wide streaks, denser white mass and a dark hole at the center"}
  - {name: crossSectionRes, default: 360, tried: [120], change: large, effect: "chunkier, more angular/faceted rectangles; bolder streaks and coarser central dust"}
  - {name: radius, default: "width*random(1,2)", tried: ["width*random(0.5,1)"], change: large, effect: "smaller rings: finer, tighter central cluster of dust, fewer huge corner streaks"}
reusable_candidates:
  - {name: dashRing, signature: "dashRing(radius, count, thickness, resolution) -> void", note: "polar chain of small 3D quads (rectangular dashes) traced around a rotated circle in 3D space"}
---

## What it draws
On a black full-bleed canvas, several rings of small white and black rectangular dashes appear to orbit a common center in 3D, seen through a strong perspective camera. The result reads as intersecting "tubes" or a starburst tunnel: dense clusters of tiny dashes near the center, larger stretched dashes where a ring passes close to the camera, and long radial streaks across the corners. Strictly black-and-white, no mid-tones.

## How the code works
- `setup()` (lines 3-8) sizes the P3D window 960x960, then calls `generate()` once; `draw()` is empty (line 11 regeneration commented out), so the piece is static.
- `generate()` (lines 24-65) redraws: `background(0)` black (line 28). It computes a random field-of-view `PI/random(1,3)` (line 30) and a matching `cameraZ`, then sets a very close near plane (`cameraZ/100.0`) via `perspective` (lines 31-33) — the extreme near plane is what stretches nearby dashes into long streaks.
- Translated to canvas center (line 36), a loop over `k < 5` (line 38) draws five rings. Each ring gets random `rotateX/Y/Z(TWO_PI)` (lines 39-41), so the rings intersect at arbitrary orientations.
- Per ring: `cc = 200` dashes (line 43), ring radius `r = width*random(1,2)` (line 44) — i.e. 960-1920 px, larger than the canvas, so parts of each ring sit in front of the camera. `da = TWO_PI/cc` (line 46).
- Inner loop (lines 51-63): for each of the 200 angles, translates to `(cos(ang)*r, sin(ang)*r)`, orients the dash tangent to the ring (`rotateZ(ang); rotateX(PI*0.5)`, lines 58-59), then calls `circle(rr, random(1,4))` (line 61) where `rr` is 80-100% of `r` (line 45).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_100 | `int cc = 200;` -> `int cc = 100;` | large | sparser dashes: fewer, more separated streaks with a large empty black core; note: halving the loop also shifts the random stream, so ring orientations re-rolled | variants/cc_100/frame_00001.png |
| rings_3 | `for (int k = 0; k < 5; k++)` -> `... k < 3 ...` | moderate | thinner overall starburst: fewer intersecting tubes, same dash structure and scale | variants/rings_3/frame_00001.png |
| thick_12 | `circle(rr, random(1, 4));` -> `circle(rr, random(1, 12));` | large | dashes 3x fatter: bold wide streaks, dense white mass and a distinct dark hole at center | variants/thick_12/frame_00001.png |
| res_120 | `int res = 360;` -> `int res = 120;` | large | chunkier, more angular/faceted rectangles; bolder streaks, coarser central dust (per-face fill count also drops, shifting the random stream) | variants/res_120/frame_00001.png |
| radius_0.5 | `float r = width*random(1, 2);` -> `... random(0.5, 1);` | large | smaller rings: finer tighter cluster of dust at center, much fewer huge corner streaks | variants/radius_0.5/frame_00001.png |

## Modularisation notes
- Generic: `circle(s, a)` is a reusable "dashed tube cross-section" primitive (a closed loop of small quads with per-face binary fill); `generate()`'s ring placement (polar dashes on a randomly rotated circle with perspective) is the reusable `dashRing` building block.
- One-off art decisions: the exact count of 5 rings, radius range `width*random(1,2)`, the aggressive `cameraZ/100.0` near plane, and the binary black/white face fill.
- Clean parameter object: `{rings: 5, dashesPerRing: 200, radiusRange: [width*1, width*2], dashThicknessRange: [1, 4], crossSectionResolution: 360, fovRange: [PI/3, PI], nearFactor: 100, faceFill: () => random(2) ? WHITE : BLACK}`.
