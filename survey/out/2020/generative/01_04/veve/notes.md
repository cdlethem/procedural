---
sketch: 2020/generative/01_04/veve
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2495
animated: false
techniques: [grid, noise-field, distortion, lines-hatching]
primitives: [shape]
palette:
  colors: ["#FFDF2B", "#B20E0E", "#38251C", "#1A4CAF", "#1E6028"]
  selection: lerp-between
composition: scattered
parameters: []
reusable_candidates:
  - {name: simplexDisplace, signature: "simplexDisplace(x, y, offset, amp, zSeed) -> PVector", note: "3-D simplex noise (toxi) offsets each sample point by up to amp px per axis"}
  - {name: greedyChain, signature: "greedyChain(points) -> int[][]", note: "greedy nearest-neighbour spanning chain visiting every point exactly once"}
  - {name: fanStroke, signature: "fanStroke(p1, p2, density, alpha) -> void", note: "draws a segment as a fan of thin ADD-blended quads, radius envelope r = rad*(1-v)*(1+0.4cos(2v*TAU))"}
---

## What it draws
On a black background, a cloud of small radiating fan- or leaf-shaped bursts scattered across the
canvas, denser toward the centre. Each fan is a burst of very thin slivers in yellow, red-orange,
green and blue, with white glints where overlapping slivers accumulate. The captured frame 1 is
almost pure white (P3D first-frame capture artifact); frames 10 and 60 are identical and show this
coloured final image, so the sketch is static.

## How the code works
`settings()` (lines 16-21): 960x960 P3D, `smooth(8)`, `DISABLE_DEPTH_TEST` in `generate()` (line 50).
All drawing happens once in `setup()` -> `generate()`; `draw()` is empty, so the image is static.

- `generate()` (lines 46-85): black background, then `randomSeed`/`noiseSeed(seed)`. A 33x33 grid
  (step `des = 0.125` over [-2, 2], line 63) places 1089 points at `width*(0.5 + ii*0.21)` with
  +/-12% jitter, each randomly pulled toward the centre (lerp, lines 69-70), giving the dense-centre
  scattered layout.
- `connects()` (lines 130-165): greedy nearest-neighbour chain - repeatedly link the closest
  reached/unreached pair until every point is visited; each of the 1088 chain segments is drawn only
  with probability 0.4 (line 161).
- `lines()` (lines 167-229): per drawn segment, `blendMode(ADD)`, ~`dis*rand(30,40)*0.6` samples
  along the segment. Each sample is displaced by `def()` (lines 88-93), a toxi `SimplexNoise` offset
  of up to 12 px per axis. At every sample two thin quads (~0.4-0.6 px wide) are drawn, filled with
  two adjacent palette colours at alpha 18 and 10.8; the quads are offset perpendicular to the
  segment by a radius `r = rad*(1-v)*(1+0.4*cos(2*v*TAU))` that shrinks toward the end, and a second
  pair is rotated by `v*TAU*10`. The shrinking, wiggling radial offset is what makes each segment
  read as a radiating fan/leaf.
- Colour: active palette line 109 is 5 colours (yellow, dark red, dark brown, blue, dark green).
  Per segment a base `dc = random(5)`; the colour index advances with `v` along the segment and
  `getColor()` (lines 121-127) lerps between adjacent palette entries with a `pow(v%1, 0.3)` gamma.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `def()` noise displacement (parameterisable amplitude/detail), `connects()` greedy chain,
  the fan-stroke construction (density, radius envelope, alpha are all local variables).
- One-off art decisions: the specific 5-colour palette, the `random(1) < 0.4` draw probability,
  the pull-toward-centre lerp, the `v*TAU*10` rotation on the second quad pair, the 0.21 grid
  spacing and 0.12 jitter.
- A clean parameter object: `{gridStep, jitter, centrePull, drawProb, fanDensity, fanRadius, alpha,
  noiseAmp, noiseDetail, palette, paletteGamma}`.
