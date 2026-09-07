---
sketch: 2019/generativos/sansa
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 4625
animated: false
techniques: [noise-field, polar, curves, blend-modes, distortion]
primitives: [shape]
palette:
  colors: ["#023138", "#071270", "#0D344C", "#C61800"]
  selection: noise-driven
composition: radial
parameters:
  - {name: div, default: "int(random(0.8,1)*12) ≈ 10 rings", tried: [5], change: moderate, effect: "5 rings: fewer, much larger rings; bigger petals, more prominent central flower"}
  - {name: alp, default: 0.5, tried: [1.0], change: moderate, effect: "double stroke alpha: same structure, brighter and more saturated, far fewer black gaps"}
  - {name: det, default: "random(0.8,0.1)*0.02 (0.002-0.016)", tried: [0.05], change: moderate, effect: "3-25x noise frequency: lines noticeably more squiggly, feathery fringed petal edges, busier centre"}
  - {name: colors, default: "#023138,#071270,#0D344C,#C61800", tried: ["#F7743B,#9DAAAB,#6789AA,#4F4873,#3A3A3A"], change: large, effect: "bright palette under ADD blending: lavender/cream/tan/orange wash with large blown-out near-white areas; same structure, completely different hue"}
  - {name: sub, default: "r2*PI*14 lines/ring", tried: [6], change: large, effect: "14->6 lines per radius unit: sparse wide petals with thick black gaps between them, stained-glass look"}
  - {name: spacingPow, default: 3, tried: [1], change: moderate, effect: "cubic -> linear ring spacing: rings evenly spaced, central flower smaller, no dense centre"}
reusable_candidates:
  - {name: noiseLine, signature: "noiseLine(x1, y1, x2, y2, detail) -> polyline", note: "simplex-noise-walked line from (x1,y1) whose end lands on (x2,y2) after rotate+rescale; reusable as a distortion primitive"}
  - {name: radialRings, signature: "radialRings(rings, radius, spacingPow, linesPerUnit) -> ring specs", note: "concentric radii with power-law spacing; each ring gets line count proportional to its outer radius"}
---

## What it draws
A centered, flower-like mandala on a near-black background. Concentric rings of wavy,
petal-shaped lobes radiate from a small multi-petal flower at the exact center; rings are
densely packed near the center and grow larger toward the edges. The visible colours are
orange, red and pink (with near-white hot spots where strokes overlap densely); black shows
through in the gaps between lobes.

## How the code works
- `setup()` (L21-29) calls `generate()` once; `draw()` is empty, so the image is static.
  Window is 960×960 P3D with `smooth(8)` (L14-19).
- `generate()` (L34-86): `randomSeed`/`noiseSeed` from `seed` (L38-39); near-black
  `background(0,1,2)` (L42). `div = int(random(0.8,1)*12)` (L61) picks 9–11 rings.
- Ring loop (L63-81): ring `j` spans radii `r1`→`r2` mapped from `(j/div)^3` and
  `((j+1)/div)^3` to `0..width*0.75` (L64-67) — the cubic spacing packs rings tight at the
  center and sparse outside. Each ring draws `sub = int(r2*PI*14)` radial lines (L68), one
  per angle `a1` (L71).
- Colour per line: `getColor(noise(ic + dc*j + cos(i*TAU/sub + j*0.2)) * colors.length*2)`
  (L72) — 1-D noise sampled along the ring, so neighbouring lines share similar hues that
  drift around each ring and between rings; `getColor` (L158-164) lerps between adjacent
  palette entries.
- Each line is drawn twice via `noiseLine` (L76, L79): once faintly (`stroke(col, 40*alp)`,
  NORMAL, L74-76) and once additively (`stroke(col, 180*alp)`, `blendMode(ADD)`, L77-79).
  The palette is dark (teals/navy/red), but dense ADD overlap on near-black accumulates
  into the bright orange/red/pink glow.
- `noiseLine` (L104-142): walks from the segment's start, advancing 0.1 px per step
  (`lar*0.8` steps) in a direction given by
  `SimplexNoise.noise(dx + seed*0.02 + ix*det, dy + iy*det)*2-1` mapped to an angle plus the
  segment's base angle (L115-120). The point cloud is then rotated so its net direction
  matches the segment and rescaled so its total length equals the segment length (L128-132),
  producing a wavy line from (x1,y1) to (x2,y2). Because neighbouring radial lines sample
  correlated noise, they bulge in the same direction, forming the petal/lobe envelopes.
- `det` (L50, 0.002–0.016) is the noise frequency: higher = more squiggle per petal.
- `triangulate` is imported but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_5 | `int div = int(random(0.8, 1)*12);` -> `int div = 5;` | moderate | 5 rings instead of ~10: rings much larger, petals bigger, central flower more prominent | variants/div_5/frame_00001.png |
| alp_1.0 | `float alp = 0.5;` -> `float alp = 1.0;` | moderate | same structure, brighter: strokes more opaque, glow saturates most of the canvas, few black gaps | variants/alp_1.0/frame_00001.png |
| det_0.05 | `float det = random(0.8, 0.1)*0.02;` -> `float det = 0.05;` | moderate | lines visibly more squiggly, petal lobes fringed/feathery, busier texture especially near the centre | variants/det_0.05/frame_00001.png |
| palette_sunset | `int colors[] = {#023138, #071270, #0D344C, #C61800};` -> `{#F7743B, #9DAAAB, #6789AA, #4F4873, #3A3A3A};` | large | same structure, entirely different colours: lavender, cream, tan, orange; bright palette + ADD blending blows large areas to near white | variants/palette_sunset/frame_00001.png |
| sub_6 | `int sub = int(r2*PI*14);` -> `int sub = int(r2*PI*6);` | large | far fewer radial lines per ring: sparse, wide petals separated by thick black bands, stained-glass look | variants/sub_6/frame_00001.png |
| spacing_1 | `pow((j+0)*1./div, 3)` / `pow((j+1)*1./div, 3)` -> linear (both v1, v2) | moderate | evenly spaced rings: no cubic compression at the centre, central flower smaller, uniform ring widths | variants/spacing_1/frame_00001.png |

## Modularisation notes
- `noiseLine` (L104-142) is fully generic: any two endpoints plus a noise detail value.
  It is the core reusable primitive (a "noise-displaced line" for any line-art sketch).
- The ring generator (L63-81) is a generic radial composition: `rings`, outer radius,
  power-law spacing exponent (here 3), and a line-count density per radius.
- One-off art decisions: the double draw with alpha 40/180 under NORMAL+ADD, the palette,
  `background(0,1,2)`, and the noise-driven per-line hue (L72).
- A clean parameter object: `{seed, rings, outerRadius, spacingPow, linesPerUnit, detail,
  alpha, palette, ringNoiseOffset, centerJitter}`.
