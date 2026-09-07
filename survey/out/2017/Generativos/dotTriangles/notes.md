---
sketch: 2017/Generativos/dotTriangles
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 430
animated: false
techniques: [subdivision, grid, noise-field, dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#FFFFFF", "#000000", "#BCBDAC", "#CFBE27", "#F27435", "#F02475", "#3B2D38"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: sub, default: "random(1, 140)", tried: ["random(100, 140)"], change: large, effect: "deeper subdivision -> many small triangles instead of a few large ones"}
  - {name: sep, default: "random(1, 8)", tried: ["random(5, 8)"], change: large, effect: "wider dot spacing -> larger, sparser dots; same triangle layout"}
  - {name: det, default: 0.002, tried: [0.02], change: moderate, effect: "finer noise -> mottled grainy dot sizes, smooth per-triangle gradient lost; same layout"}
  - {name: invert, default: 0.5, tried: [0.9], change: large, effect: "almost all triangles black with white dots; only a few white ones remain"}
  - {name: seedRing, default: 6, tried: [3], change: large, effect: "canvas no longer covered: large empty white area, composition compressed into a diagonal band of bigger triangles"}
reusable_candidates:
  - {name: triangleHalftone, signature: "triangleHalftone(cx, cy, size, angle, spacing, noiseScale) -> dots", note: "hex-packed dot grid clipped to a triangle, dot size modulated by 2-D noise"}
  - {name: triangleSubdivide, signature: "triangleSubdivide(tris, iterations) -> tris[]", note: "replaces a triangle by 4 children (center + 3 vertices), random selection each step"}
  - {name: pointInTriangle, signature: "pointInTriangle(pt, v1, v2, v3) -> bool", note: "sign-of-cross-product test, standard"}
---

## What it draws
Full-bleed black-and-white composition of many triangles tiling the whole canvas. Roughly half the
triangles are solid black with white stippled dots, the other half are white (unfilled) with black
stippled dots. Dot sizes vary smoothly across each triangle via low-frequency noise, so each triangle
reads as a soft tonal gradient rendered in halftone. Triangle sizes are uneven: a few very large ones
dominate the centre while many smaller ones crowd the periphery.

## How the code works
- `setup()` (L2-7): 960x960, smooth(8), `generate()` once; `draw()` is empty so the image is static (L9-11).
- `generate()` (L23-94): white background; translate to centre + random offset of up to ±50 px and one random global rotation (L27-29).
- Seed triangles (L31-38): 6 triangles on a hexagonal ring, each at angle `k*60° - 30°`, radius `ss*0.25` with `ss = width*random(1.8, 2.4)` (~1728-2304), so each initial triangle is ~864-1152 px wide — together they overcover the canvas.
- Subdivision (L40-46): `sub = int(random(1, 140))` random steps; each step picks a random triangle, removes it and adds its `sub()` children: one half-size inverted triangle at the centre plus three half-size triangles at the vertex midpoints (L132-142). Because selection is random, subdivision depth is uneven across the image — the origin of the mixed triangle sizes.
- Stippling (L56-93): per triangle, compute the 3 vertices `p1..p3` at radius `r = s*0.5` (L58-70). With probability 0.5 a solid black triangle is filled first and the fill switched to white (L73-78), so half the triangles are black-with-white-dots and half are dots-on-white.
- Dots (L79-92): a hex-packed grid with random per-triangle spacing `sep = random(1, 8)` (L60), row offset `sep*0.5`, rotated to the triangle's own angle `a` (L85-86). Dot diameter `sss = 0.1 + ss*noise(xx*0.002, yy*0.002)` (L87, `ss = sep*random(0.7, 0.9)`): very coarse noise (scale 0.002) makes dot size vary slowly, giving the smooth per-triangle gradient. Only dots inside the triangle are kept via `PointInTriangle` (L88, L100-106).
- Colour: only black/white are used. `colors[]`, `rcol()`, `getColor()` (L145-159) are defined but never called — dead palette code.
- The `seed` int variable (L1, L24) is never used for seeding; determinism comes from the harness random seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_100 | `int sub = int(random(1, 140));` -> `int sub = int(random(100, 140));` | large | dense mosaic of small stippled triangles across the whole canvas; the few large central triangles of the baseline are gone | variants/sub_100/frame_00001.png |
| sep_5 | `float sep = random(1, 8);` -> `float sep = random(5, 8);` | large | same triangle layout, but dots are much larger and sparser everywhere, giving a chunky halftone | variants/sep_5/frame_00001.png |
| det_0.02 | `float det = random(0.002);` -> `float det = random(0.02);` | moderate | same layout; dot size now varies quickly over the triangle, so the soft gradient reads as a fine mottled grain instead | variants/det_0.02/frame_00001.png |
| invert_0.9 | `if (random(1) < 0.5) {` -> `if (random(1) < 0.9) {` | large | composition is overwhelmingly black triangles with white dots; only a handful of white triangles remain, image reads as dark | variants/invert_0.9/frame_00001.png |
| ring_3 | `for (int k = 0; k < 6; k++) {` -> `for (int k = 0; k < 3; k++) {` | large | three seed triangles no longer overcover the canvas: a large empty white area (top-left) and the triangles form a diagonal band of comparatively large shapes | variants/ring_3/frame_00001.png |

## Modularisation notes
- Generic / library-worthy: the per-triangle halftone fill (hex dot grid + noise-modulated dot size + triangle clip) is fully self-contained (L56-92 + L100-106); the random-walk triangle subdivision (L40-46, L132-142) is a clean generic operator on a triangle list.
- One-off art decisions: the 6-triangle hexagonal seed ring and its oversize scale (L32-38); the 50/50 black/white inversion per triangle (L74); the global random rotation/offset; the dead colour palette.
- A clean parameter object: `{ seedRing: 6, seedScale: [1.8, 2.4] * width, subdivisions: int, dotSpacing: [1, 8], dotSizeGain: 0.7-0.9, noiseScale: 0.002, invertProbability: 0.5 }`.
