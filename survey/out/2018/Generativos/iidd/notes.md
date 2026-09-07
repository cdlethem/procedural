---
sketch: 2018/Generativos/iidd
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 1520
animated: true
techniques: [3d-mesh]
primitives: [shape]
palette:
  colors: ["#FEB63F", "#F29AAA", "#297CCA", "#003151", "#E1DBDB"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 100, tried: [300], change: moderate, effect: "3× more cubes per frame: visibly denser field of small/mid cubes, same overall character"}
  - {name: sizeMax, default: 120, tried: [300], change: large, effect: "random(120)->random(300): giant cubes appear, some faces span most of the canvas; scattered-look becomes few huge forms"}
  - {name: strokeAlpha, default: 20, tried: [180], change: subtle, effect: "no visible change: cube bodies unchanged, edges only marginally darker on a few shapes"}
  - {name: palette, default: "5 colors (#FEB63F,#F29AAA,#297CCA,#003151,#E1DBDB)", tried: ["#003151,#E1DBDB"], change: moderate, effect: "only dark-navy and off-white cubes: calm two-tone look, same geometry"}
  - {name: spread, default: "width", tried: ["width*0.3"], change: large, effect: "cubes confined to a central cluster; canvas corners stay empty gray"}
reusable_candidates:
  - {name: shape1, signature: "shape1(s) — cube of half-size r=s/2 whose 6 faces are each a centre diamond + 4 corner triangles, two random palette colours", note: "the two-tone split-face cube mesh; generic with a colour picker injected"}
  - {name: rcol, signature: "rcol() -> int — random entry of a palette array", note: "trivial random palette lookup"}
---

## What it draws
Frame 1 (seed 42): dozens of 3-D cubes of very different sizes scattered across a light-gray background, some tiny (far away), some large and close. Each cube is two-tone: its face corner triangles are one colour and the central diamond of each face another, drawn from a five-colour palette (amber, pink, medium blue, dark navy, off-white). By frame 60 the canvas is a dense, busy collage: repeated per-frame redraws accumulate without a clear, so rotating cubes leave motion trails and large dark-navy masses pile up over the whole image.

## How the code works
`setup()` (iidd.pde:3-11) opens a 960×960 P3D window and calls `generate()` once; `draw()` (13-16) calls `generate()` **every frame and never clears the background** (`background(4)` is commented out, line 32), so all frames accumulate — that is the trail/accumulation effect seen from frame 10 onward.

`generate()` (26-53): `time = millis()*0.001; time += cos(time)*0.5` (28-29) — wall-clock-driven, the source of the non-determinism (differs between runs). `randomSeed(seed)` (30) reseeds the shape RNG, but `time` is not seeded. The scene is translated to centre (35) and globally rotated by `rotateZ(-HALF_PI*0.5 + time)` (37). `stroke(0, 20)` (41) gives the faint dark edge lines. The main loop (42-52) places 100 cubes per frame: each gets three rotations scaled by `time*random(-1,1)` (44-46), a random translation in a box of ±width on all three axes (47), and a size `s = map(cos(time*random(0.6)), -1, 1, random(40), random(120))` (48-50) — a size between 0 and 120 that oscillates with time.

`shape1(s)` (55-155) draws one cube with half-size `r = s*0.5`: first the 8 corner triangles (60-106), all sharing one `fill(rcol())` (58), then the 6 face diamonds (111-153) with a second `rcol()` (109). Diamond + its 4 corner triangles = one full square face, so each cube is a complete box rendered in two randomly picked palette colours. Note line 147 has a stray empty `beginShape()` (no vertices) which is harmless.

`rcol()` (162-164) picks a random entry from `colors[]` (161): `#FEB63F, #F29AAA, #297CCA, #003151, #E1DBDB`. `getColor()` (165-173) exists but is never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 300; i++) {` | moderate | denser field: many more small and mid-size cubes scattered over the same area, no new look | variants/count_300/frame_00001.png |
| max_300 | `float max = random(120);` -> `float max = random(300);` | large | giant cubes dominate, single faces near canvas-size; the scattered-cubes look becomes a few huge forms | variants/max_300/frame_00001.png |
| stroke_180 | `stroke(0, 20);` -> `stroke(0, 180);` | subtle | no visible change: same cubes, only faintly darker edges on a few shapes | variants/stroke_180/frame_00001.png |
| palette_2color | `int colors[] = {#FEB63F, #F29AAA, #297CCA, #003151, #E1DBDB};` -> `int colors[] = {#003151, #E1DBDB};` | moderate | only dark-navy and off-white cubes; same geometry, much calmer monochrome impression | variants/palette_2color/frame_00001.png |
| spread_0.3 | `translate(random(-width, width), ...) ` (all three axes) -> `random(-width*0.3, width*0.3)` | large | cubes clumped in a central cluster; four canvas corners remain empty gray | variants/spread_0.3/frame_00001.png |

## Modularisation notes
- **Generic / library candidate:** `shape1(s)` — a split-face cube mesh parameterised by size and a colour picker; the two-tone face split (centre diamond vs corner triangles) is the reusable idea, works for any 6-face box.
- **One-off art decisions:** the per-frame re-randomised rotations/sizes driven by `time = millis()` (the "alive" jitter), the 100-shapes-per-frame count, the ±width scatter box, and the no-clear accumulation strategy that turns per-frame redrawing into trails.
- **Clean parameter object:** `{count, sizeMin, sizeMax, spread (fraction of width), strokeAlpha, palette[], seed}` — everything else (rotation jitter, per-cube colour) can stay internal. `time` should be an injected frame phase, not `millis()`, to make the sketch deterministic.
