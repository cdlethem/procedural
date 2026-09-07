---
sketch: 2019/generativos/oscoscosc
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 3346
animated: true
techniques: [blend-modes, distortion, dots-stippling]
primitives: [point]
palette:
  colors: ["#FFFFFF", "#FF0000", "#FFFF00", "#FF00FF", "#F76FC1", "#FF7028", "#AFE36B", "#29A8CC", "#100082"]
  selection: fixed
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: scatterPointCloud, signature: "scatterPointCloud(n, {ySpread, xSkew, warpX, warpY, shear, alpha, weight, accentProb, accentColors, blend}) -> void", note: "N random points through a product-of-uniforms concentration + cosine warps + shear, drawn as ADD-blended points"}
---

## What it draws
Baseline (seed 42), frames 10/60 (identical): a near-black field of fine faint grain dominated by a
bright horizontal band of densely packed white points running across the middle of the canvas; the
band fades smoothly into sparse grain toward its top and bottom edges. A soft vertical column of extra
brightness sits slightly right of center within the band. Saved `frame_00001.png` is a first-frame
capture artifact: dense dark speckle over a white field in the top-left quadrant, the rest blank white.
The sketch re-generates only every 120 frames, so frames 1-119 should be identical; frame 1 evidently
caught the P2D framebuffer mid-flush of the 5M-point draw.

## How the code works
`setup()` calls `generate()` once (L21-29); `draw()` re-calls it with a fresh seed every 120 frames
(L31-37) - a still piece that periodically re-rolls, not a continuous animation.

`generate()` (L47-97): `blendMode(ADD)` on `background(0)`, then `translate` to canvas center
(L49-56). Per-roll random parameters: `osc`/`amp` (L59-61, horizontal modulation frequency, with a
50% chance of a 10x frequency boost), `osc2`/`amp2` (L63-64, vertical modulation), `v1`/`v2`
(L66-67, shear). `alp` is set to 140 then immediately overwritten to 100 (L69-72); the println shows
140 but the effective alpha ceiling is 100.

Main loop, 5,000,000 iterations (L74-96):
- `y = random(-0.5,0.5)*1.6` times two more uniforms (L75-76) - product-of-uniforms concentrates the
  distribution near 0, producing the bright central horizontal band.
- `x = random(-0.5,0.5) * (pow(u,1.4)*2 + cos(y*height*osc)*amp)` (L78-79): `pow` skews x toward
  center; the cosine term makes the horizontal spread oscillate with y. A linear shear in y is added
  (L80), then `y += cos(x*width*osc2)*amp2` (L81) imposes the vertical striation seen in the band.
- Scaled to canvas (L83-84). Stroke: white, alpha `random(alp*0.5, alp)*0.6` (L86-87);
  `strokeWeight(random(1,2))` (L89); with 3% chance each, overridden to red / yellow / magenta at
  alpha 50-100 (L91-93); `point(x, y)` (L95).

ADD blending accumulates brightness where points pile up, so the dense band reads as a glowing
horizon. The `colors[]` palette (L110) with `rcol()`/`getColor()` helpers (L117-129) is declared but
never called - dead code; the imports of triangulate and SimplexNoise (L1-2) are also unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic core: a parametric point scatter - N points from a base uniform distribution, passed through
(a) product-of-uniforms concentration on one axis, (b) cosine warps on both axes, (c) a linear shear,
then drawn as additive points with random alpha/weight and probabilistic colour accents. A library
function `scatterPointCloud` with the signature above would cover it.
One-off art decisions: the specific warp frequencies/amplitudes and their per-roll randomness, the
5M point count, the white-plus-RGB-accent palette, and the every-120-frames re-roll.
Clean parameter object: `seed, n, ySpread, xSkew, warpX{freq,amp}, warpY{freq,amp}, shear{v1,v2},
alpha, weightRange, accentProb, accentColors, blendMode`.
