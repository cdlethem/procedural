---
sketch: 2019/generativos/lavita
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3486
animated: true
techniques: [noise-field, grid]
primitives: [line]
palette:
  colors: ["#F23602", "#300F96", "#C9FFF6", "#F72C81", "#09EFA6", "#FAC62A"]
  selection: noise-driven
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: noiseColorField, signature: "noiseColorField(palette, detail, offset) -> color[][]", note: "per-pixel 2-D noise remapped through a lerp'd palette"}
  - {name: angleLineField, signature: "angleLineField(angleNoise, length, alpha, blend) -> void", note: "short additive lines at every grid point pointing along a noise angle"}
---

## What it draws
A full-bleed square of large, soft, heat-map-like colour blobs on black: teal/cyan on the
left, orange in a rounded patch top-left and a broad band across the middle, deep purple
on the right and bottom, yellow in the lower right. The surface has a faint grainy texture
from many overlapping short strokes, and a thin black margin around the edge. Frames 10/60
are solid black: the sketch is static (empty `draw()`), the difference is a P3D headless
rendering artifact, not animation.

## How the code works
`settings()` opens a 960x960 P3D window (lavita.pde:14-19). `setup()` calls `generate()`
(lavita.pde:21-29); `draw()` is empty (lavita.pde:31-32), so the image is drawn once.

`generate()` (lavita.pde:42-93):
1. Seeds random/noise from `seed` (44-45), then `randPallets()` (108-117) picks a random
   3-5 colour subset of the 6-colour list `#F23602, #300F96, #C9FFF6, #F72C81, #09EFA6,
   #fac62a`.
2. Sets up noise parameters: `detCol = random(0.0004, 0.0006)*1.4` is the detail of the
   colour field; `desAng = random(10000)` offsets the angle field; `desCol` offsets the
   colour field (55-60).
3. `background(0)` then `blendMode(ADD)` (51-68) — everything is additive over black.
4. Double loop over every pixel from `bb=20` to `width/height-bb` in steps of 1 (71-73):
   - `nc = noise(desCol + x*detCol, desCol + y*detCol)` — the smooth low-frequency field
     that becomes the visible blob structure (76).
   - One 20-vertex `LINES` shape per grid point: `lar=20` steps (78-79), each step
     advances one pixel along an angle `ang` sampled from `SimplexNoise.noise` at a
     very coarse scale (80-88), so each pixel emits a short wiggly line.
   - `n2 = SimplexNoise.noise(nc*0.2, k*0.0001)` is essentially a function of `nc` only,
     so stroke colour `getColor(n2*30 + ang*0.05)` is a palette-lerp remap of the smooth
     colour field (82-83, 135-141: `getColor` lerps between adjacent palette entries).
   - Stroke alpha is 36 (83); the ~940x940 overlapping additive lines accumulate into
     the saturated soft blobs.
5. The thin black frame comes from the `bb=20` margin (71-73).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The whole sketch is two generic blocks: (a) a per-pixel 2-D noise field remapped through a
lerp'd palette, and (b) an additive field of short per-pixel lines whose colour follows the
field. One-off art decisions: the specific palette list, the coarse angle-noise scale, alpha
36, the `bb` margin, and the fixed 20-vertex line length. A clean parameter object would be
`{palette, colorDetail, colorOffset, alpha, lineLength, margin, blend}`. Note `detDef`/`def()`
(96-101) and the commented-out `PVector p = def(x, y)` (84) are dead code.
