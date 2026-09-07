---
sketch: 2020/generative/01_04/circulus
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate, peasy]
deterministic: true
ms_first_frame: 2239
animated: false
techniques: [polar, noise-field, 3d-pointcloud]
primitives: [point, line]
palette:
  colors: ["#0F0F0F", "#7C7C7C", "#4C4C4C"]
  selection: noise-driven
composition: radial
parameters:
  - {name: res, default: "int(random(80,340)*2)", tried: ["*2"], change: subtle, effect: "slightly denser rings, no visible structural change"}
  - {name: colors, default: "#0F0F0F,#7C7C7C,#4C4C4C", tried: ["#EA2E73,#F7AA06,#1577D8"], change: large, effect: "gray field becomes mustard-yellow with white dotted rings and black center; structure unchanged"}
  - {name: sub, default: 20, tried: [40], change: subtle, effect: "strokes read as longer hair-like lines, texture more diffuse, wavy bands weaker"}
  - {name: shrink, default: 0.84, tried: [0.95], change: moderate, effect: "longer tails overlap into a dense crosshatch with bright starburst spots"}
  - {name: ringStep, default: 0.03, tried: [0.06], change: moderate, effect: "halves the ring count: more distinct spaced rings, larger dark center, airier"}
reusable_candidates:
  - {name: pointRing, signature: "pointRing(cx, cy, radius, count, noiseDetail, palette) -> void", note: "concentric ring of noise-colored points; per-point color lerps through palette via 2-D noise"}
  - {name: spiralTail, signature: "spiralTail(origin, angle, length, steps, shrink, palette) -> void", note: "decaying chain of rotated line segments (length *= 0.84 per step) forming a short spiral whisker"}
---

## What it draws
A dense grayscale mandala on a gray field with black corners. Thousands of tiny line
segments are arranged in concentric wavy rings radiating from the center; the overlapping
semi-transparent strokes build up a gray tone and moiré-like rippling bands. A tight dark
cluster (nearly black ringed blobs) sits at the center, and the rings get sparser and more
dashed toward the edges. Overall a radial, circular, slightly 3D-tilted composition in
three grays.

## How the code works
`setup()` calls `generate()` once (static; `draw()` is empty, frames 10/60 identical).
`generate()` (line 49) sets `randomSeed`/`noiseSeed` from `seed`, picks a random `time`
offset (line 56), translates to center with `z=-200` and applies small random `rotateX`/
`rotateY` (lines 58-60), giving the slight 3D tilt. With `hint(DISABLE_DEPTH_TEST)` and a
black background, it loops rings: `for i = 0.02..1 step 0.03` (~34 rings) and calls
`aro(0,0, i*20, width*0.7*i, res, col, detCol)` (lines 75-78) with `res = int(random(80,340)*2)`
points per ring (line 73).

`aro()` (line 81) walks `res` points around the ring at angle `a = v*TAU + tt` (line 90).
Each point: a colored `point()` whose color comes from 2-D noise sampled at the point
position, `getColor(noise(...)*9)` (line 93) lerping through the 3-gray palette
(line 146) with gamma `pow(...,0.6)` (line 158); then a tail of `sub = 20` (line 104)
repeated steps where each step rotates in 3D by `time`- and angle-dependent amounts
(lines 107-108), draws a short line of length `dd` (two strokes: random gray at alpha 50
and a color-lerp toward white at alpha 50, lines 109-112), plus 8 small diagonal
cross-lines along it (lines 113-119), then translates and shrinks `dd *= 0.84` (line 121)
so the tail is a decaying spiral whisker. Finally a brighter white point with
oscillating weight (lines 123-126). Randomness enters via `random` for the ring count,
time offset, tail rotations, and the 50-alpha gray strokes; noise drives the ring
point colors. The wavy bands and center dark cluster emerge from the overlapping
alpha-blended strokes, not from any explicit blending mode.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| res_x2 | `int res = int(random(80, 340)*2);` -> `int res = int(random(80, 340)*2)*2;` | subtle | slightly denser rings and white dotted bands; structure same as baseline | variants/res_x2/frame_00001.png |
| palette_color | `int colors[] = {#0F0F0F, #7C7C7C, #4C4C4C};` -> `int colors[] = {#EA2E73, #F7AA06, #1577D8};` | large | gray field becomes mustard-yellow with white dotted rings, black center blobs; geometry identical | variants/palette_color/frame_00001.png |
| sub_40 | `int sub = 20;` -> `int sub = 40;` | subtle | strokes read as longer thin hair-like lines, texture more diffuse, wavy bands weaker | variants/sub_40/frame_00001.png |
| shrink_0.95 | `dd *= 0.84;` -> `dd *= 0.95;` | moderate | longer tails overlap into a dense crosshatch; bright starburst spots appear, center smaller | variants/shrink_0.95/frame_00001.png |
| ringstep_0.06 | `for (float i = 0.02; i <= 1; i+=0.03) {` -> `for (float i = 0.02; i <= 1; i+=0.06) {` | moderate | half as many rings: distinct spaced rings, larger dark center cluster, airier overall | variants/ringstep_0.06/frame_00001.png |

## Modularisation notes
Generic: the ring-of-noise-colored-points loop and the decaying spiral tail are reusable
as-is (see candidates); the palette lerp `getColor(v)` is a small self-contained utility.
One-off art decisions: the fixed 3-gray palette, the 34-ring radius ramp `width*0.7*i`,
the 3D tilt/translate, the `time`-coupled rotations, and the 8 cross-lines per step.
A clean parameter object: `{ringCount: 34, ringStep: 0.03, pointsPerRing: res,
noiseDetail: detCol, tailSteps: 20, tailShrink: 0.84, alpha: 50, palette: colors[],
tilt: [rx, ry]}`.
