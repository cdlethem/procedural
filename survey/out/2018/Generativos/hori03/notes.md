---
sketch: 2018/Generativos/hori03
year: 2018
renderer: P3D
size: [960, 560]
libraries: []
deterministic: false
ms_first_frame: 1522
animated: true
techniques: [noise-field, 3d-mesh, shader]
primitives: [shape]
palette:
  colors: ["#1D1923", "#BBC0AC", "#5A8590", "#C3A651", "#8C3503"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(200)*random(0.2,1)) ~20-200", tried: [30], change: large, effect: "fewer, thinner ribbons; more gold background showing in the gaps"}
  - {name: hFrac, default: 0.14, tried: [0.04], change: moderate, effect: "thinner, more delicate ribbons; finer overall texture"}
  - {name: sub, default: "int(random(120))", tried: [24], change: large, effect: "much coarser blocks; larger, flatter colour cells per ribbon"}
  - {name: det, default: "random(0.06)", tried: ["random(0.15)"], change: large, effect: "smoother, more regular colour bands; cleaner flow than the busier baseline"}
  - {name: ampFrac, default: "h*random(10)", tried: ["h*random(2)"], change: large, effect: "flatter ribbons; larger angular blocks, less depth undulation"}
  - {name: zOffset, default: -200, tried: [-50], change: moderate, effect: "ribbons closer to camera; larger scale, stronger perspective, more background visible"}
reusable_candidates:
  - {name: noiseRibbon, signature: "noiseRibbon(x0, x1, y, h, subdivisions, detail, amplitude, phase) -> 3D quad strip", note: "subdivided quad strip whose top/bottom edges undulate with 1-D Perlin noise"}
  - {name: paletteRamp, signature: "paletteRamp(palette, v) -> color", note: "map a continuous index onto a palette, lerping between adjacent entries"}
  - {name: postBlurVignette, signature: "postBlurVignette(blurMix, grain, satBoost) -> PShader", note: "post.glsl: 3x3 gaussian blur + grain + edge saturation boost + vignette"}
---

## What it draws

A full-bleed mustard-gold field crossed by many wavy vertical ribbons of colour, tilted
diagonally in 3D. Each ribbon is a strip of small rectangular blocks in a five-colour palette
(dark plum, pale sage, muted teal, gold, rust orange) whose colours drift along the strip's
length. The whole image is soft and slightly blurred with a subtle darkened vignette at the
corners. Frame 60 keeps the same composition but the block colours have drifted a little, so
the sketch is a slow colour shimmer, not a structural animation.

## How the code works

- `settings()` (L8-14): 960x560, P3D, `smooth(8)`, `pixelDensity(2)` (warning: density 2
  unavailable on the headless display).
- `setup()` loads `post.glsl` and calls `generate()`; `draw()` calls `generate()` every frame
  (L16-23). Because `randomSeed(seed)` / `noiseSeed(seed)` are reset at the top of `generate()`
  (L40-41), the random sequence is identical each frame, so the geometry is stable; only the
  unseeded `millis()` terms drift: the gentle scale/rotation (L44-47) and the colour drift
  terms (L58-59). That is why `deterministic: false` and frames differ subtly.
- `generate()`: background is one random palette colour (L42, `rcol()` L89-91; seed 42 gives
  the mustard gold). The scene is centred, pushed back z=-200, and scaled/rotated X/Y/Z by
  smooth noise (L43-47), producing the diagonal 3D tilt.
- Ribbon count: `cc = int(random(200)*random(0.2, 1))` ~ 20-200 ribbons (L50). For each:
  height `h` up to 14% of canvas width (L53), random y (L54), split into
  `sub = int(random(120))` blocks (L56-57). Each block is a quad (L68-75) whose two top
  vertices get z-offsets `noise(des + j*det)*amp` (L60-62, 66-67): a 1-D Perlin field makes
  the ribbon undulate in depth, which the 3D perspective renders as a wavy band.
- Colour: every block is filled with `getColor(dc*(j+i))` (L69, L72), where `dc1`/`dc2` are
  random 0-100 offsets that also drift with `time` (L58-59). `getColor(float v)` (L95-100)
  takes `v mod 5` and lerps between two adjacent palette colours, so colour changes stepwise
  with smooth blends along each ribbon.
- `filter(post)` (L78): the GLSL applies a 3x3 gaussian blur at mix 0.9, 2% film grain,
  brightness 1.2, a saturation boost and vignette that grow toward the corners
  (`post.glsl` L58-74). Display is `:2` (not xvfb), and the baseline shows the soft blur, so
  the shader renders correctly.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_30 | `int cc = int(random(200)*random(0.2, 1));` -> `int cc = 30;` | large (0.1694) | fewer, thinner ribbons; more gold background showing in the gaps | variants/cc_30/frame_00001.png |
| hfrac_0.04 | `float h = swidth*random(1)*random(0.14);` -> `...random(0.04);` | moderate (0.148) | thinner, more delicate ribbons; finer texture | variants/hfrac_0.04/frame_00001.png |
| sub_24 | `int sub = int(random(120));` -> `int sub = int(random(24));` | large (0.1817) | much coarser blocks; larger, flatter colour cells per ribbon | variants/sub_24/frame_00001.png |
| det_0.15 | `float det = random(0.06);` -> `float det = random(0.15);` | large (0.1508) | smoother, more regular colour bands; cleaner flow than the busier baseline | variants/det_0.15/frame_00001.png |
| amp_2 | `float amp = h*random(10);` -> `float amp = h*random(2);` | large (0.1583) | flatter ribbons; larger angular blocks, less depth undulation | variants/amp_2/frame_00001.png |
| zoff_50 | `translate(width/2, height/2, -200);` -> `translate(width/2, height/2, -50);` | moderate (0.145) | ribbons closer to camera; larger scale, stronger perspective, more background visible | variants/zoff_50/frame_00001.png |

Note: the sketch is non-deterministic (unseeded `millis()` terms in the rotation and colour
drift), so small render-to-render differences are possible; all scores above are moderate or
large, so the reported effects are real.

## Modularisation notes

- Generic: the per-ribbon builder (subdivided 3D quad strip + Perlin z-offset + palette-ramp
  fill) is self-contained (L52-77) and could become `noiseRibbon(...)` taking count, height
  fraction, subdivisions, noise detail/phase/amplitude and a palette. The palette-ramp helper
  (L95-100) and the post-filter GLSL (blur/grain/vignette) are directly reusable.
- One-off art decisions: the specific five-colour palette, random background pick, camera
  tilt (L43-47), the exact count ranges (L50, L53, L56).
- A clean parameter object: `{seed, ribbonCount, heightFrac, maxSubdivisions, noiseDetail,
  noiseAmp, zOffset, palette, blurMix}`.
