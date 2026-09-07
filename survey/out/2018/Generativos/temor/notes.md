---
sketch: 2018/Generativos/temor
year: 2018
renderer: P2D
size: [6500, 6500]
libraries: []
deterministic: true
ms_first_frame: 5974
animated: false
techniques: [noise-field, lines-hatching, dots-stippling, shader]
primitives: [shape, ellipse, line]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: lar, default: "10000*width/960 (~67k steps/layer)", tried: [3000], change: moderate, effect: "fewer walk steps = thinner bands, gaps reveal underlying sharp lines/dots/polygons"}
  - {name: vel, default: 0.71, tried: [4], change: large, effect: "longer step = very wide, smooth stripes covering almost the whole canvas; underlying content nearly hidden"}
  - {name: layers, default: 6, tried: [2], change: large, effect: "fewer walker layers = fewer, thinner bands; sharp dots/lines and dark polygons clearly visible"}
  - {name: shapeSize, default: "0.04 (fraction of width)", tried: [0.15], change: none, effect: "no visible change - shapes are buried under the line walks and the blur"}
  - {name: amp1, default: "random(10)", tried: [1], change: large, effect: "gentler walk angle = hazy translucent pale bands; sharp thin lines, dots, polygons and wavy patterns show through"}
reusable_candidates:
  - {name: flowLinePair, signature: "flowLinePair(x1,y1,x2,y2, steps, detail, amplitude, velocity, colorDrift) -> void", note: "two endpoints walk a 2-D Perlin noise field, drawing a line between them at every step; stroke colour drifts through a lerp'd palette"}
  - {name: stippleRing, signature: "stippleRing(x,y,r1,r2,alpha1,alpha2) -> void", note: "ring of tiny quads between two radii with two alpha levels (arc2)"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], t) -> color", note: "lerps between adjacent palette entries for a continuous colour ramp (getColor)"}
---

## What it draws
Wide, soft diagonal bands of orange and blue/indigo sweeping across a near-black field, like heavily
blurred brushstrokes. In the lower-left the bands thin out and larger flat orange and blue filled
polygons and circles show through between them, with a few small pale specks and thin strokes. The
corners are darkened (vignette) and the edge colours look strongly saturated.

## How the code works
`setup()` (line 5) calls `generate()` once; `draw()` is empty, so the image is static (baseline frames
10/60 are identical to frame 1). `generate()` (line 42) reseeds (`randomSeed(seed)`) and clears to black.

- Six layers (`for j < 6`, line 47). Each layer first scatters 100 filled shapes: a skewed quad built
  from a centre plus angle/distance offsets (lines 54-61), a filled circle of radius `s` (line 66),
  and a `stippleRing` of translucent white quads (`arc2`, line 67). Shape size
  `s = width*random(0.04)*random(1)*random(1)` (line 51) skews small.
- Each layer then runs a pair of noise-guided walkers from two random points (lines 70-77): for
  `lar = 10000*width/960.` steps (~67,000 per layer) it draws a line between the two points (line 93)
  and advances each endpoint by a noise-driven angle
  `noise(des + x*det, des + y*det)*TAU*amp` (lines 95-101), step size `vel = 0.71` (line 87).
  Stroke colour is `getColor(ic + dc*i)`: a walk through the 5-colour palette with lerp between
  adjacent entries (lines 143-149).
- After all layers, `filter(post)` applies `data/post.glsl` (line 107): 90% mix with a 9-tap Gaussian
  blur, 2% grain, brightness 1.2, saturation boosted up to ~3.7x at the corners, and a `dis` vignette
  multiplier that darkens the corners.

The dense thin line-walks are what the blur turns into the wide soft diagonal bands; the flat
polygon/circle regions survive as broad colour blocks where the walks are sparse. The diagonal
orientation is a property of this seed's noise field, not a transform in the code.

Note: `uses_shader` is true but display is `:2` (not xvfb), so the shader output above is what the
renderer actually produced; the visible blur/vignette is the shader working.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| lar_3000 | `float lar = 10000*width/960.;` -> `float lar = 3000*width/960.;` | moderate | bands are thinner and less dense; in the gaps the underlying layer shows clearly - sharp thin lines, dots, small circles and large flat orange/blue polygons on black | variants/lar_3000/frame_00001.png |
| vel_4 | `float vel = 0.71;` -> `float vel = 4;` | large | very wide, smooth diagonal orange/blue stripes with strong gradients cover almost the whole canvas; the sharp underlying content is nearly hidden except a corner | variants/vel_4/frame_00001.png |
| layers_2 | `for (int j = 0; j < 6; j++) {` -> `for (int j = 0; j < 2; j++) {` | large | fewer, thinner soft bands; the sharp layer is clearly visible on top - thin lines, dots, small circles, and a large dark polygon in the lower left | variants/layers_2/frame_00001.png |
| shapeSize_0.15 | `float s = width*random(0.04)*random(1)*random(1);` -> `...random(0.15)...` | none | no visible change - the enlarged shapes are still buried under the line walks and the blur | variants/shapeSize_0.15/frame_00001.png |
| amp1_1 | `float amp1 = random(10);` -> `float amp1 = 1;` | large | hazy, translucent pale orange/red/blue bands; the sharp layer shows through strongly - thin lines, dots, polygons, and wavy contour-like patterns in the blue areas | variants/amp1_1/frame_00001.png |

## Modularisation notes
The walker pair (`flowLinePair`) is the core reusable unit: endpoints + noise detail + amplitude +
step size + palette drift are all independent parameters, and the colour ramp (`paletteLerp`) is
generic. `stippleRing`/`arc2` is a small generic helper. The filled-quad scatter and the GLSL
post-pass (blur amount, grain, vignette strength, saturation curve) are one-off art decisions but
would parameterise cleanly as a `postPass` object: `{blurMix, grain, vignettePower, satBoost}`.
A clean parameter object for the sketch: `{layers, shapesPerLayer, shapeSizeFactor, walkSteps,
noiseDetail, angleAmplitude, stepVelocity, palette, colorDrift}`.
