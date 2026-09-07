---
sketch: 2018/Generativos/ostras
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1558
animated: false
techniques: [packing, polar]
primitives: [shape]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: trials, default: 10000, tried: [3000], change: large, effect: "fewer packing trials -> sparser field, fewer oysters, more black gaps"}
  - {name: maxsize, default: 0.8, tried: [1.6], change: large, effect: "max radius width*1.6 -> much bigger oysters, giant fans dominate"}
  - {name: spokeDensity, default: 0.5, tried: [0.25], change: moderate, effect: "half the spokes -> chunky pinwheel slices with visible gaps instead of dense fan"}
  - {name: wobbleExponent, default: 0.3, tried: [1.5], change: moderate, effect: "stronger cos modulation -> clearly lobed/scalloped outlines, petal-like blobs"}
  - {name: palette, default: "FF3D20/FC9D43/3998C2/3E56A8/090D0E", tried: ["687FA1/AFE0CD/FDECB4/F63A49/FE8141"], change: moderate, effect: "pastel blue/mint/cream/pink scheme, same geometry"}
reusable_candidates:
  - {name: poissonScatter, signature: "poissonScatter(width, height, trials, maxRadius) -> PVector[]", note: "rejection-sampled non-overlapping random circles (Poisson-disk-like)"}
  - {name: fanRosette, signature: "fanRosette(x, y, r, spokes, wobbleExponent, palette) -> void", note: "radial fan of triangles with cos-modulated rim radius, per-spoke lerped palette"}
  - {name: lerpPalette, signature: "lerpPalette(colors, v) -> int", note: "continuous index into palette with lerpColor between adjacent entries"}
---

## What it draws
On a black background, dozens of flat "oyster" rosettes of widely varying sizes are scattered
across the canvas, most of them overlapping only at the rim. Each rosette is a slightly
scalloped disc filled with a dense fan of thin triangles radiating from its centre, alternating
between warm reds/oranges and cool blues; the largest fans (hundreds of spokes) look like
soft pink-and-orange pinwheels, small ones read as striped pinwheel coins. A post shader
softens edges (blur), adds a faint film grain and a vignette that darkens the corners and
boosts saturation toward the centre.

## How the code works
- `setup()` (lines 3-10): 960x960 P2D, loads `post.glsl`, calls `generate()` once; `draw()` is
  empty, so the image is static (keyPress regenerates interactively).
- Point placement (lines 28-42): 10000 rejection-sampling trials; each trial picks a random
  position and radius `s = width*random(0.8)`, and keeps it only if it does not overlap any
  already-accepted circle (dist check, line 36). This is the packing: big circles placed
  early carve out the large fans, small ones fill the gaps, hence the size range from
  edge-touching giants down to tiny specks.
- Rosette drawing (lines 44-68): for each kept circle, radius `r = p.z*0.5`, spoke count
  `sub = max(4, PI*r*0.5)` (more spokes on bigger oysters, line 47). Each spoke is a triangle
  (lines 58-65) between two consecutive rim points and the centre. Rim radius is
  `r*pow(map(cos(des+ang),-1,1,0,1), 0.3)` (line 57): the random phase `des` and the low
  exponent 0.3 make the rim a gently wavy, lobe-shaped circle rather than a perfect one.
- Colour: `getColor(v)` (lines 85-91) takes a continuous value, wraps it into the 5-entry
  palette `colors[]` (line 77) and `lerpColor`s between adjacent entries, so each fan sweeps
  smoothly through the whole palette around its rim. Two independent streams (`ic1/dc1`,
  `ic2/dc2`, lines 50-53) colour the two edges of each triangle, giving the striped look.
- `filter(post)` (line 70): `post.glsl` mixes in a 3x3 Gaussian blur (weight 0.9), 2%
  per-pixel grain, brightness 1.2, and a radial `csb()` pass that raises saturation and
  multiplies brightness by a vignette `dis = 1 - dist^2.4 * 0.5`, darkening the corners.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| trials_3000 | `for (int i = 0; i < 10000; i++) {` -> `... i < 3000 ...` | large (mean 0.1736, 0.494) | much sparser field: fewer, bigger fans, large black gaps between clusters | variants/trials_3000/frame_00001.png |
| maxsize_1.6 | `float s = width*random(0.8);` -> `width*random(1.6)` | large (mean 0.2108, 0.548) | oysters noticeably larger; giant fans cover most of the canvas, tiny ones still fill gaps | variants/maxsize_1.6/frame_00001.png |
| spokes_0.25 | `int sub = max(4, int(PI*r*0.5));` -> `PI*r*0.25` | moderate (mean 0.0662, 0.269) | half the spokes: chunky pinwheel slices with visible dark gaps between spokes; small oysters read as 8-point pinwheels | variants/spokes_0.25/frame_00001.png |
| wobble_1.5 | `...pow(map(cos(des+ang), -1, 1, 0, 1), 0.3);` -> exponent `1.5` | moderate (mean 0.105, 0.246) | rim lobes amplified: oyster outlines clearly scalloped/petal-like (3-6 lobes) instead of near-circular | variants/wobble_1.5/frame_00001.png |
| palette_alt | `int colors[] = {#FF3D20, #FC9D43, #3998C2, #3E56A8, #090D0E};` -> `{#687FA1, #AFE0CD, #FDECB4, #F63A49, #FE8141}` | moderate (mean 0.1047, 0.356) | identical geometry, colours become muted slate-blue/mint/cream/pink pastels, much lower contrast against black | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: the rejection-sampled circle packing (lines 28-42) is a clean standalone function
  `poissonScatter(trials, maxRadius)` returning accepted centres+radii; the `lerpPalette`
  helper (lines 85-91) is a reusable continuous palette sampler.
- One-off art decisions: the fan-of-triangles rovette rendering with the cos^0.3 rim wobble,
  the dual colour streams per triangle, the 5-colour palette, and the whole `post.glsl`
  look (blur/grain/vignette). A clean parameter object would contain: trials, maxRadius,
  spokeDensity (PI*r*k), wobbleExponent, wobblePhase (per oyster, random), palette, and
  post-filter settings (blurMix, grain, vignette power).
