---
sketch: 2020/generative/01_04/grosores
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 4138
animated: false
techniques: [packing, noise-field, polar, dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#8C8C8C", "#000000", "#FFFFFF", "#FFE600", "#99002B", "#CED1E2", "#D66953", "#28422E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: attempts, default: 14000, tried: [30000], change: moderate, effect: "denser field: more coins, small coins fill the gaps between the big clusters"}
  - {name: detSize, default: "random(0.02)", tried: ["random(0.004)"], change: large, effect: "slower radius field: fewer very large coins, more even size spread, loose clusters dissolve"}
  - {name: detAmp, default: "random(0.03)", tried: ["random(0.012)"], change: moderate, effect: "smoother amplitude modulation: same density but big coins regroup into different patches"}
  - {name: stackLayers, default: 10, tried: [20], change: moderate, effect: "taller coins: double the visible disc layers, stronger tiered look, same layout"}
  - {name: dotsPerSpoke, default: 40, tried: [80], change: moderate, effect: "denser, more saturated gold sunburst on each top face, same layout"}
reusable_candidates:
  - {name: noiseCirclePack, signature: "noiseCirclePack(attempts, sizeScale, minGapFactor, rng) -> PVector[]", note: "rejection-sampled non-overlapping circles whose radius is drawn from layered noise fields"}
  - {name: radialStippleDisc, signature: "radialStippleDisc(x, y, r, spokeCount, dotsPerSpoke, color) -> void", note: "disc built from radial spokes, each a run of small random dots"}
  - {name: coinStack, signature: "coinStack(x, y, r, layers, shrink, colors) -> void", note: "z-stacked shrinking ellipses giving a 3-D coin/stack look in P3D"}
---

## What it draws
A flat mid-grey background scattered with ~100–200 "coin stacks" of very different sizes, from
tiny specks to discs roughly a tenth of the canvas. Each stack is a cylinder seen from slightly
above: a ring of 10 slightly offset, shrinking ellipses in black or white, with a soft dark
outline, and a top face that is a black or white disc covered in gold/yellow radial spokes —
a sunburst of fine dots fanning out from the centre. Stacks cluster in loose patches: some
areas of the canvas hold many overlapping-sized stacks, others are nearly bare grey.

## How the code works
- `settings()` (14-19): 960×960 P3D, smooth, `pixelDensity(2)` (unavailable on this display, per stderr).
- `generate()` (44-132) is the whole piece; `draw()` is empty, so the piece is static.
- Point field (53-87): 14,000 rejection-sampled attempts over an extended canvas
  (`width*random(-0.5,1.5)`). Each candidate's radius comes from two noise layers:
  `SimplexNoise.noise(x*detSize, y*detSize)` with `detSize = random(0.02)`, shaped by
  `pow(ns, 2.2)+0.2` (line 68, sharpens small values), multiplied by
  `pow(noise(x*detAmp, y*detAmp), 0.5)*940` with `detAmp = random(0.03)` (line 69) and a
  `random(0.4,1)` jitter (line 70). A candidate is kept only if its distance to every kept
  point exceeds `(s+other.z)*0.5` (75-81) — a non-overlapping circle packing whose radii are
  noise-driven, so big coins tend to group where both noise fields are high.
- A second "glow point" loop (89-108) uses `blendMode(ADD)` and `getColor()` from the 4-colour
  palette, but its bound is `i < 000000` — zero iterations. Dead code; the palette array
  (173-176) is never actually painted.
- Coin stacks (112-129): for each kept point, 10 layers are drawn with P3D z-offsets
  (`translate(x, y, j*5)`, line 119), each layer a grey semi-transparent undersize ellipse
  (`fill(0,120)`, `s+2`, line 121-122), a black-or-white disc `fill(int(random(2)*255))`
  (line 123-124), then a `circle()` call on the top layer; radius shrinks `s *= 0.95` per
  layer (line 127). The whole scene is pre-rotated by small random `rotateX/rotateY`
  (61-62), which flattens the ellipses slightly and gives the from-above 3-D look.
- `circle()` (134-163) builds the sunburst: `res = r*PI*0.5` spokes, each a thin quadrilateral
  from centre to a random rim point (142-153), and along each spoke 40 small gold dots
  `fill(255*random(0.5,1), 230*random(0.4,1), 0)` (155-161) — the radial gold texture seen on
  every top face.
- `hint(DISABLE_DEPTH_TEST)` (46) means draw order, not depth, decides overlaps.

## Experiments
| variant | substitution | change score | observation | image |
| count_30000 | `for (int i = 0; i < 14000; i++)` -> `... 30000 ...` | moderate | denser field — more coins overall, small coins fill the gaps; big clusters persist but composition differs | variants/count_30000/frame_00001.png |
| detSize_0.004 | `float detSize = random(0.02);` -> `random(0.004);` | large | radius field varies more slowly — fewer very large coins, sizes more even across the canvas, loose clusters dissolve | variants/detSize_0.004/frame_00001.png |
| detAmp_0.012 | `float detAmp = random(0.03);` -> `random(0.012);` | moderate | same coin density, but the big coins regroup into different patches (large white coin top-left, large coin mid-right) | variants/detAmp_0.012/frame_00001.png |
| stack_20 | `for (int j = 0; j < 10; j++)` -> `... 20 ...` | moderate | coins clearly taller: twice as many visible disc layers, stronger tiered/conical look, darker rims; layout identical | variants/stack_20/frame_00001.png |
| stipple_80 | `for (int i = 0; i < 40; i++)` -> `... 80 ...` | moderate | top-face gold sunburst denser and more saturated, spokes read as uniform texture; layout identical | variants/stipple_80/frame_00001.png |
## Modularisation notes
- Generic: `noiseCirclePack` (rejection sampling with noise-driven radii) is the core reusable
  primitive; `coinStack` and `radialStippleDisc` are presentable but the exact shrink factor and
  gold-dot colours are art decisions.
- One-off decisions: the two magic noise scales (`random(0.02)`, `random(0.03)`), the `pow(ns,2.2)+0.2`
  shaping, `*940` amplitude, the `rotateX/Y ±0.2` camera tilt, the 10-layer/0.95-shrink stack,
  40 dots per spoke.
- The dead glow loop (89-108) and the unused `colors[]` palette are dead weight; a clean
  parameter object would be: `{attempts, radiusNoiseScale, amplitudeNoiseScale, amplitude, jitter,
  minGapFactor, stackLayers, stackShrink, spokesPerDisc, dotsPerSpoke, tilt}`.
- P3D is only used for z-stacking ellipses; a 2D renderer with manual vertical offset and
  elliptical aspect ratio could reproduce the look without the 3D pipeline.
