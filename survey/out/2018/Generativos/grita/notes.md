---
sketch: 2018/Generativos/grita
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1543
animated: false
techniques: [curves, lines-hatching]
primitives: [line, shape]
palette:
  colors: ["#E6E6E6", "#000000", "#E6E7E9", "#F0CA4B", "#F07148", "#EECCCB", "#2474AF", "#107F40", "#231F20"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: size, default: 400, tried: [200], change: large, effect: "half radius: texture shrinks to a central diamond, gray background exposed around it"}
  - {name: strokeAlpha, default: 120, tried: [60], change: large, effect: "still full-bleed dark, but individual diagonal hairlines read clearly and the field is slightly lighter"}
  - {name: points, default: 100000, tried: [20000], change: large, effect: "sparser hatching: strokes separate into visible lines with gaps, overall lighter"}
  - {name: scale, default: 1.2, tried: [2.0], change: moderate, effect: "texture spreads out and lightens to mid-gray; all three axis lines become visible crossing at center"}
  - {name: smooth, default: 8, tried: [1], change: subtle, effect: "subtle: strokes slightly coarser/more aliased, still a dense dark field"}
reusable_candidates:
  - {name: lissajous3D, signature: "lissajous3D(points, size, d1, d2, d3, i1, i2, i3) -> Shape", note: "closed 3-D Lissajous curve from three cos components with random phase/frequency"}
---

## What it draws
A near-fully-occluded dark field of very fine, mostly diagonal hairline strokes covering the whole
960x960 canvas; the strokes overlap so densely that the light gray background only shows through
faintly in thin gaps. A single crisp straight black line runs diagonally across the center. The
overall read is a dense hatched/scratched texture, almost black in the middle and slightly lighter
toward the edges.

## How the code works
`setup()` (lines 6-11) creates a 960x960 P3D canvas, then calls `generate()` once; `draw()` (13-14)
is empty, so the image is static. `generate()` (24-56):
- Line 26: `float time = random(10)` picks a rotation scale; lines 33-35 apply `rotateX/Y/Z(PI*time)`
  after centering and `scale(1.2)` (lines 31-32), so the whole 3-D scene is tumbled to an arbitrary
  viewing angle.
- Lines 39-41 draw three axis lines of half-length `size=400` with the default solid black stroke;
  in the baseline only one of them survives visibility as the single straight line across the image.
- Lines 43-48 draw three random frequencies `d1..d3` in [0, 10.1) and phases `i1..i3` in [0, TAU).
- Lines 51-55: `noFill(); stroke(0, 120)` then a single `beginShape()` with 100000 `vertex()`
  calls at `(cos(i1+d1*i), cos(i2+d2*i), cos(i3+d3*i)) * 400` — a 3-D Lissajous curve. Its 2-D
  projection, stroked at half opacity, self-overlaps tens of thousands of times, which is what
  produces the dense dark hatching; the alpha-120 accumulation is what darkens the canvas.
- The `colors[]` palette (line 63) and `rcol()`/`getColor()` (64-77) are never called — dead code.
Randomness enters via `seed` (line 4, set by the harness) through `randomSeed`/`noiseSeed`
(28-29), which fixes the frequencies, phases, and rotation. No noise or blend modes are used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| size_200 | `float size = 400;` -> `float size = 200;` | large | texture shrinks to a rotated dark diamond in the center; light gray background now visible all around it | variants/size_200/frame_00001.png |
| alpha_60 | `stroke(0, 120);` -> `stroke(0, 60);` | large | still a full-bleed dark field, but the individual diagonal hairlines are now clearly distinguishable and the whole is slightly lighter | variants/alpha_60/frame_00001.png |
| points_20000 | `i < 100000` -> `i < 20000` | large | hatching becomes sparse and coarse: distinct separated diagonal strokes with visible gaps, overall lighter | variants/points_20000/frame_00001.png |
| scale_2.0 | `scale(1.2);` -> `scale(2.0);` | moderate | field spreads to fill the canvas and lightens to mid gray; all three solid axis lines are now visible crossing at the center | variants/scale_2.0/frame_00001.png |
| smooth_1 | `smooth(8);` -> `smooth(1);` | subtle | no visible change at this scale; strokes perhaps marginally coarser, still a dense dark field | variants/smooth_1/frame_00001.png |

## Modularisation notes
- The Lissajous curve (lines 43-55) is the generic core: a `lissajous3D` function taking point count,
  size, and the three (frequency, phase) pairs, returning a `PShape` or vertex list.
- The axis cross (39-41) is a one-off decorative element; parameterisable as an on/off flag.
- The random tumble (26, 33-35) is generic: a `random3DRotation` helper.
- A clean parameter object: `{seed, points (100000), size (400), scale (1.2), strokeAlpha (120),
  bg (230), rotateScale (10)}`.
- The unused palette (63-77) could be wired in as per-segment colour if desired, but as written it
  contributes nothing.
