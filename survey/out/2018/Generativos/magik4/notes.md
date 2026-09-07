---
sketch: 2018/Generativos/magik4
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 2188
animated: false
techniques: [noise-field, particles, lines-hatching, shader]
primitives: [line]
palette:
  colors: ["#043387", "#0199DC", "#BAD474", "#FBE710", "#FFE032", "#EB8066", "#E7748C", "#DF438A", "#D9007E", "#6A0E80", "#242527", "#FCFCFA"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: pointCount, default: 1000, tried: [300], change: large, effect: "fewer, larger sweeping ribbons; tangle loosens, more gaps"}
  - {name: lar (ribbon steps), default: "random(1000, 10000)", tried: ["random(1000, 3000)"], change: large, effect: "shorter strokes; more thin fragments, less long ribbon"}
  - {name: s (point size), default: "width*random(0.02, 0.12)", tried: ["width*random(0.05, 0.2)"], change: large, effect: "fewer, much bigger ribbons; big flat regions with visible parallel-line striping"}
  - {name: vel (wander speed), default: 0.071, tried: [0.3], change: large, effect: "sparser jagged fragments on the hot-pink ground; ribbons spread out instead of coiling"}
  - {name: amp1 (angle amplitude), default: "random(10)", tried: ["random(2)"], change: large, effect: "smooser, longer curved bands; less tight twisting"}
reusable_candidates:
  - {name: poissonPoints, signature: "poissonPoints(count, sizeRange) -> PVector[]", note: "rejection-sampled non-overlapping circles (magik4.pde:67-82)"}
  - {name: noiseRibbon, signature: "noiseRibbon(x, y, steps, vel, det, des, amp) -> void", note: "two endpoints wandering along simplex-noise angle field, line between them per step (magik4.pde:114-136)"}
---

## What it draws
A chaotic full-bleed tangle of thousands of thin, ribbon-like strokes in a saturated palette dominated by hot pink/magenta, yellow-orange, blue, green and grey-white. The strokes read as flattened ribbons with light and dark edges (a pseudo-3D metallic look), crisscrossing at all angles with no clear structure. A film-grain noise and a soft vignette with slight blur are visible over the whole image.

## How the code works
`setup()` (magik4.pde:7-15) loads `post.glsl` and calls `generate()`; `draw()` is empty so the image is static (keyPress regenerates).

`generate()` (magik4.pde:38-141):
1. Background filled with one random palette color (line 41).
2. 1000 candidate points sampled uniformly (line 67-70) with a rejection pass (73-81): a point is kept only if its distance to every kept point exceeds half the sum of their sizes — a crude Poisson-disk packing of 0.02-0.12*width sized circles.
3. For each kept point (84-137): two endpoints `x1,y1` and `x2,y2` are placed within `amp = random(0.01)*p.z` of the point (87-91), then lerped 0.92 toward each other (97-100), so they start almost coincident. A per-point random start color index `ic` and slow drift `dc` (105-106) drive the stroke colour via `getColor(ic+dc*i)`, which lerps between adjacent palette entries (155-161); the stroke is additionally lerped toward black by `cos(i*PI*0.1)*0.16+0.16` (115), so each ribbon fades through dark bands.
4. Inner loop (114-136), `lar = random(1000, 10000)` steps: draw the line between the two endpoints (116), then move each endpoint by `vel = 0.071*random(0.5,2)` along an angle from `SimplexNoise.noise(des + p*det)` scaled by `amp1`/`amp2` (118-128). Since the endpoints start together and wander on independent noise fields, the segment grows and twists into a ribbon. Faint white (`stroke(255,250)`, 131-132) and black (`stroke(0,40)`, 133-134) edge lines are drawn at the two ends of each step, giving the light/dark rim shading.
5. `filter(post)` (140) applies the GLSL post shader: 3x3 blur mixed at 0.8, grain proportional to darkness, saturation/contrast boosted toward the edges, and a radial vignette (`post.glsl:58-76`).

Randomness enters via the point placement (43-82), per-ribbon noise offsets/details/amps (87-112), and the colour index (105). All under `randomSeed(seed)`, so renders are deterministic per seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | large (mean 0.3367, 0.91) | fewer, bigger ribbons: large sweeping magenta/pink and grey-white bands, yellow patches; the tangle loosens and more of the ground shows between ribbons | variants/count_300/frame_00001.png |
| lar_3000 | `float lar = random(1000, 10000);` -> `float lar = random(1000, 3000);` | large (mean 0.2761, 0.752) | shorter strokes: same density feel but many short, thin fragments and small ribbon shapes instead of long coiling ribbons | variants/lar_3000/frame_00001.png |
| s_0.05_0.2 | `float s = width*random(0.02, 0.12);` -> `float s = width*random(0.05, 0.2);` | large (mean 0.3266, 0.896) | very few, very large ribbons: huge magenta star-blobs and yellow fan areas fill the canvas; the per-step lines read as strong parallel striping | variants/s_0.05_0.2/frame_00001.png |
| vel_0.3 | `float vel = 0.071*random(0.5, 2);` -> `float vel = 0.3*random(0.5, 2);` | large (mean 0.3154, 0.897) | much sparser: scattered thin jagged fragments over a dominant hot-pink ground (the seed-42 background colour, fully covered in the baseline) | variants/vel_0.3/frame_00001.png |
| amp1_2 | `float amp1 = random(10);` -> `float amp1 = random(2);` | large (mean 0.261, 0.72) | smoother, less chaotic: long smooth curved bands (e.g. a wide horizontal purple band) and larger curved ribbon shapes over the pink ground | variants/amp1_2/frame_00001.png |

## Modularisation notes
- Generic: the rejection-sampling point field (67-82) is a reusable Poisson-disk-style sampler; the noise-wandered dual-endpoint ribbon (114-136) is a reusable "noise ribbon" primitive parameterised by (origin, steps, velocity, noise detail, noise domain, angle amplitude, colour ramp); `getColor` (155-161) is a generic cyclic lerp palette.
- One-off art decisions: the 0.92 endpoint lerp (starts ribbons nearly coincident), the `cos`-modulated black fade (115), the faint white/black edge lines (131-134), and the specific `post.glsl` grain/vignette recipe.
- Clean parameter object: `{pointCount, sizeRange, ribbonSteps, velocity, noiseDetail, noiseDomain, angleAmp, colorDrift, edgeAlpha, post: {blurMix, grain, vignette, saturation}}`.
