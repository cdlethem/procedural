---
sketch: 2020/generative/05_08/vovo
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1788
animated: false
techniques: [noise-field, flow-field, grid]
primitives: [rect]
palette:
  colors: ["#FFFFFF", "#FFB0D0", "#F7DE20", "#245C0E", "#EB6117", "#F72C11", "#C6356B", "#953DC4", "#003399", "#02060D"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: det, default: 0.001, tried: [0.004], change: moderate, effect: "higher field detail = fine horizontal striations in the ground, sharper thinner curves"}
  - {name: ang, default: 200, tried: [90], change: subtle, effect: "no visible change; curves and ground essentially the same"}
  - {name: amp, default: 120, tried: [30], change: large, effect: "shorter strokes = crinkled bright-red ground, lines become thin, jagged and broken"}
  - {name: grid_step, default: 2.5, tried: [5], change: large, effect: "sparser grid = brighter red ground with individually visible dashes, curves in the same positions"}
  - {name: colors, default: "10-colour red/white palette", tried: ["{#21CFF2,#003BBB,#F6E9F1,#F994F3}"], change: moderate, effect: "ground turns dark navy, curves pale white-lavender with faint blue halo"}
  - {name: strokeWeight, default: 0.3, tried: [1], change: moderate, effect: "heavier black stroke darkens the ground, curves brighter and crisper"}
reusable_candidates:
  - {name: noiseVectorField, signature: "noiseVectorField(x, y, z, detail, amp, seedOffset) -> PVector", note: "def(): two simplex-noise angle streams + one amplitude stream displaced as a 3D vector field"}
  - {name: paletteLerp, signature: "paletteLerp(v, colors[]) -> int", note: "getColor(v): wrap v over the palette, lerpColor between neighbours with pow(v%1, 0.6) easing"}
---

## What it draws
A full-bleed dense field of thousands of thin short strokes in near-black, dark red and maroon,
like a dark woven texture. Out of this field a few bright glowing curves emerge: a long S-curve
running from the top edge down to the lower-left, an arc on the left edge, a rounded arc on the
lower right, and a small closed loop at the bottom. The bright lines are pink-white where they
cross, sitting on a ground that reads dark maroon-red.

## How the code works
`setup()` calls `generate()` once and `draw()` is empty, so the image is static.
`generate()` (line 54) reseeds with the harness-injected `seed`, fills the background white,
then double-loops a regular grid with 2.5 px step from -80 to width/height+80 (lines 69-70).
For every grid point `def(i, j, 0, det, ang)` (lines 85-90) displaces it by a simplex-noise
vector field: two noise calls form pseudo-angles a1/a2, a third scales the offset amplitude
(`det = random(0.001)`, line 64). At each displaced point the sketch translates, rotates by a
single shared angle `ang = random(200)` (line 65, applied at line 76) and draws one rect of
width `random(1.6, 2)` and length `amp = SimplexNoise.noise(...) * 120` (line 75), i.e. 0-120 px
long. Fill comes from `getColor(noise(i*detCol, j*detCol)*8 + jitter)` (line 77, 114-119): a
noise-driven walk over the 10-colour palette (line 105) lerped between neighbours; stroke is
black with alpha `random(200)` (line 78). Because the grid step (2.5) is smaller than the stroke
length, the rects overlap into a continuous texture; where the noise field makes many long rects
point the same way they merge into the bright glowing curves (the white and red end of the
palette: #FFFFFF, #FFB0D0, #F72C11, #C6356B). Randomness enters via the seed, the shared
rotation angle, per-rect width, per-rect colour jitter, and stroke alpha.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.004 | `float det = random(0.001);` -> `float det = random(0.004);` | moderate (mean 0.05, 13.5% px) | ground texture changes to fine horizontal striations and reads slightly lighter red; the bright curves stay in the same positions but are thinner, sharper and glow less | variants/det_0.004/frame_00001.png |
| ang_90 | `float ang = random(200);` -> `float ang = random(90);` | subtle (mean 0.033, 4.9% px) | no visible change; same curves, ground marginally darker red | variants/ang_90/frame_00001.png |
| amp_30 | `SimplexNoise.noise(i*detAng, j*detAng, seed*0.02)*120;` -> `...*30;` | large (mean 0.200, 97.4% px) | completely different: crinkled, terrain-like bright-red ground with a large dark area in the centre; the bright lines become thin, jagged and broken | variants/amp_30/frame_00001.png |
| grid_5 | `j+=2.5` / `i+=2.5` -> `j+=5` / `i+=5` | large (mean 0.237, 95.3% px) | ground becomes a lighter red made of individually visible short dashes (less stroke overlap); bright curves in the same positions | variants/grid_5/frame_00001.png |
| palette_blue | `int colors[] = {#FFFFFF, #FFB0D0, ...};` -> `int colors[] = {#21CFF2, #003BBB, #F6E9F1, #F994F3};` | moderate (mean 0.109, 46.2% px) | ground turns dark navy/near-black blue; curves become pale white-lavender with a faint blue halo; same shapes | variants/palette_blue/frame_00001.png |
| stroke_1 | `strokeWeight(0.3);` -> `strokeWeight(1);` | moderate (mean 0.096, 48.8% px) | ground much darker (heavier black strokes accumulate); curves brighter and crisper pink-white | variants/stroke_1/frame_00001.png |

## Modularisation notes
- `def()` is a generic simplex-noise vector field (detail + amplitude params) and is the main
  reusable candidate; it is the thing that creates the flowing curves.
- The grid-of-oriented-strokes loop is generic: given a step size, a field function, a length
  function and a colour function, it produces a "stroke field" texture; the 2.5 px step, the
  120 amplitude scale and the shared single rotation angle are art decisions layered on top.
- `getColor(v)` (noise-driven palette lerp with wraparound) is a small reusable helper.
- One-off: the specific 10-colour palette (line 105), the black stroke with random alpha, and
  the `ang` shared rotation (all rects rotated identically, which is what makes the field
  coherent enough to form lines).
- A clean parameter object: `{ seed, step, fieldDetail, fieldAmp, strokeLen, rotation, palette,
  strokeAlphaMax }`.
- The experiments confirm the split: curve *positions* are set entirely by the displacement
  field (invariant under palette, grid, stroke changes); the *ground texture* is set by stroke
  length, grid density and stroke weight; the *hue* by palette.
