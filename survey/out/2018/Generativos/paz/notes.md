---
sketch: 2018/Generativos/paz
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1553
animated: false
techniques: [3d-pointcloud, 3d-mesh, shader, distortion]
primitives: [shape]
palette:
  colors: ["#000000", "#F0F0F0"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: bigCount, default: 200, tried: [400], change: large, effect: "double the large black boxes -> bigger, denser dark mass concentrated in the top half with a horizontal white band"}
  - {name: bigSize, default: 80, tried: [40], change: large, effect: "smaller large boxes stop merging into one mass -> many separate varied-size cubes with white gaps"}
  - {name: medSize, default: 10, tried: [4], change: none, effect: "shrinking the 800 medium boxes: no visible change (absorbed by the big masses and the blur)"}
  - {name: smallSize, default: 2, tried: [8], change: none, effect: "growing the 800 small specks: no visible change (below the blur/contrast resolution)"}
  - {name: background, default: 240, tried: [120], change: large, effect: "darker background -> field goes near-white to mid-grey; the box cloud is unchanged, contrast with white boxes drops"}
reusable_candidates:
  - {name: boxCloud, signature: "boxCloud(count, size, spread, twoTone) -> void", note: "scatter randomly-rotated 3D boxes in a cube [-spread,spread]^3; optional 50/50 black/white fill"}
  - {name: vignetteContrast, signature: "vignetteContrast(src, blur, falloff, bright, sat, noise) -> PShader", note: "post.glsl: gaussian blur + radial vignette + tiny noise + brightness/saturation/contrast, then multiply by vignette"}
---

## What it draws
A single static black-and-white image (seed 42). A loose, scattered cloud of 3D boxes sits in the
upper-middle of a light grey field: a handful of large solid black cube-masses (the big overlapping
boxes), a dense sprinkling of small black and white cubes, and a few tiny black specks. The whole
cloud fades and darkens toward the edges (vignette), giving a high-contrast, almost printed/halftone
look. The lower-left corner is empty background. No colour: pure black, white, and light grey.

## How the code works
`settings()` (paz.pde:9-13) makes a 960x960 P3D window, `smooth(8)`, `pixelDensity(2)`.
`setup()` (15-18) loads `data/post.glsl` into `post` and calls `generate()` once. `draw()` (20-21) is
empty, so nothing animates; `keyPressed` (23-29) regenerates on any non-`s` key. Frames 10/60 are
identical to frame 1 (static).

`generate()` (41-89):
- `randomSeed(seed)` (43) makes the whole thing deterministic from `seed` (a global set to
  `int(random(999999))` at line 1, overridden by the harness `seed` field). `background(240)` (45)
  paints the light-grey field.
- `translate(random(width), random(height))` (47) shifts the whole cloud by a random 2D offset — this
  is why the cluster sits off-centre (upper-middle) at seed 42. `ambientLight(255,255,255)` (50) +
  `noStroke()` (51): flat-lit, no edges.
- Three loops, each scattering randomly-rotated boxes (`rotateX/Y/Z(random(TAU))`) inside
  `random(-500, 500)` in all three axes:
  - 200 large boxes `box(80)` (52-61), all `fill(0)` black — the big dark masses.
  - 800 medium boxes `box(10)` (63-72), `fill` is 0 or 240 chosen 50/50 by `random(1)<0.5` (65).
  - 800 small boxes `box(2)` (74-83), same 50/50 black/white fill (76) — the fine specks.
  Where randomness enters: the seed (positions, rotations, and the black/white choice for the small
  boxes). The large boxes are always black.
- `filter(post)` (88) applies the GLSL. In `post.glsl`: a 3x3 gaussian blur (mix 0.9, line 63), a
  radial vignette `dis = 1 - pow(dist(st,0.5),2.4)*0.5` (65), ~2% random noise (67), then
  `csb(sum, 1.2, 1.1+(1-dis)*2.6, 1.0)*dis` (68): brightness 1.2, distance-driven saturation, and a
  final multiply by the vignette. The blur + brightness + contrast push the near-white background to
  white and the black boxes stay black, so the scene reads as hard B/W; the `*dis` multiply darkens
  toward the corners (the visible vignette).

Note: `colors[]` (147), `rcol()`, `getColor()` (149-161) and `arc2/arc3/lineDashed` (96-145) are
dead code in this sketch — `generate()` never calls them, so the 5-colour array is not part of the
rendered palette.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count200_400 | `for (int i = 0; i < 200; i++) {` -> `for (int i = 0; i < 400; i++) {` | large | dark mass gets bigger and denser, now filling the top half with a clear horizontal white band and a mostly-white lower area; more black coverage than baseline | variants/count200_400/frame_00001.png |
| box80_40 | `box(80);` -> `box(40);` | large | the large boxes no longer merge into one mass; instead many separate, varied-size black cubes with lots of white gaps, spread over the upper two-thirds | variants/box80_40/frame_00001.png |
| box10_4 | `box(10);` -> `box(4);` | none | no visible change; shrinking the 800 medium boxes is absorbed by the big masses and the blur, image reads the same as baseline | variants/box10_4/frame_00001.png |
| box2_8 | `box(2);` -> `box(8);` | none | no visible change; growing the 800 small specks is below the blur/contrast resolution, image reads the same as baseline | variants/box2_8/frame_00001.png |
| bg240_120 | `background(240);` -> `background(120);` | large | field goes from near-white to mid-grey; the black/white box cloud is unchanged, so the whole image reads darker with less contrast between field and the white boxes | variants/bg240_120/frame_00001.png |

## Modularisation notes
- Generic / library-ready:
  - `boxCloud(count, size, spread, twoTone, fillPair)` — the repeated loop (scatter + random 3-rotation
    + optional 50/50 two-tone fill). Called three times with different `count`/`size`; a single
    parameterised function replaces all three loops.
  - The post shader (blur + vignette + noise + csb + vignette-multiply) is a self-contained `PShader`
    worth exporting as a named "printed contrast vignette" filter.
- One-off art decisions: the specific three tiers (200x80 black, 800x10, 800x2), the fixed
  `random(-500,500)` spread, the `translate(random(width),random(height))` offset, and the exact
  shader constants (blur 0.9, pow 2.4, bright 1.2, sat 2.6, noise 0.02).
- Clean parameter object: `{ seed, bigCount, bigSize, medCount, medSize, smallCount, smallSize,
  spread, offset, twoTone, bg, shader:{blur, falloffPow, bright, satGain, noise} }`.
