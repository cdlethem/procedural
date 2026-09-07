---
sketch: 2020/generative/01_04/arbolbox
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, peasy, toxi]
deterministic: true
ms_first_frame: 8972
animated: false
techniques: [subdivision, grid, particles, blend-modes, noise-field]
primitives: [rect, point, line]
palette:
  colors: ["#99002B", "#EFA300", "#CED1E2", "#D66953", "#28422E", "#141414"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: rectCount, default: 90, tried: [30], change: large, effect: "fewer trees -> sparser composition, more dark ground, less additive glow"}
  - {name: subdivisions, default: 30, tried: [10], change: large, effect: "fewer subdivision passes -> larger, more uniform cells, less fine structure"}
  - {name: pointDensity, default: 5.8, tried: [1.5], change: large, effect: "lower spray density -> darker image, glow suppressed, thin line struts become prominent"}
  - {name: lineAlpha, default: 120, tried: [255], change: none, effect: "no visible change; struts are ~0.3px thin quads so 120->255 alpha is imperceptible"}
  - {name: palette, default: "99002B,EFA300,CED1E2,D66953,28422E", tried: ["1B2A4A,3A86FF,8ECAE6,FFB703,FB8500"], change: moderate, effect: "geometry identical (deterministic), hue shifts from red/gold/green to blue/gold; same layout, different colour"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(x, y, w, h, iterations) -> Rect[]", note: "stochastic rect subdivision; repeatedly pick a rect and split it into sub x sub smaller cells"}
  - {name: nearestNeighborLines, signature: "nearestNeighborLines(rects, angleFilter) -> lines", note: "connect each rect centre to its nearest neighbour in the upper half-plane; draws faint quad struts"}
---

## What it draws
On a near-black ground, dozens of large semi-transparent rectangles of various sizes
overlap across the full canvas, in gold/amber, dusty red/pink, pale cream, and muted
green. The overlaps blend additively into brighter glowing patches, especially a warm
gold-orange mass on the left and a pale cream cluster in the centre. Faint thin diagonal
lines criss-cross some rectangles, and a fine speckled grain of tiny coloured dots covers
most of the surface, giving the whole thing a textured, stained-glass / pixel-noise look.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the sketch is static
(arbolbox.pde:35-36).

- `generate()` (58-74): `background(20)` dark ground; a loop of 90 iterations (71-73)
  calls `arbol(...)` at a random position with a random `w` (up to ~`width*0.3`) and
  `h` (up to ~`height*0.36`).
- `arbol()` (76-149): seeds one starting `Rect` (78), then a subdivision loop (79-92)
  picks a random rect, splits it into a random 2-5 by 2-5 grid of child rects, discards
  the parent, and stops adding children once a cell drops below 5% of the original
  w/h (85). After 30 passes the list holds the terminal cells.
- Lines (105-131): `blendMode(NORMAL)`, a random base colour `bas` from `rcol()`; for
  each rect it finds the nearest other rect whose centre lies in the upper half-plane
  (118-126) and draws a thin filled quad `lineStr` (157-165) between the two centres at
  `fill(bas,120)` — the faint criss-crossing struts.
- Points (134-146): `blendMode(ADD)`; a random noise detail `det` and a random palette
  offset `col`; it sprays `w*h*5.8` random points (138-145) inside the rect, each with
  `strokeWeight` from squared 2-D simplex noise (141) and a colour lerped from black
  toward a random palette colour (143) — the additive speckled grain that makes overlaps
  glow.

Randomness enters at the 90 placements (72), every subdivision pick/split (80-82), the
base colour (107), the point spray (138-143), and palette choice (136). Additive blend
(134) is what brightens overlapping regions.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| rectCount_30 | `for (int i = 0; i < 90; i++) {` -> `i < 30` | large (0.1905, 0.534) | sparser: only a handful of clusters, much more dark ground shows through, less glow | variants/rectCount_30/frame_00001.png |
| subdivisions_10 | `for (int k = 0; k < 30; k++) {` -> `k < 10` | large (0.2892, 0.766) | fewer subdivision passes -> larger, blockier, more uniform rectangle cells; structure less fine-grained | variants/subdivisions_10/frame_00001.png |
| pointDensity_1.5 | `w*h*5.8` -> `w*h*1.5` | large (0.2926, 0.697) | much darker: additive grain thinned so the glowing mass is gone and the thin criss-crossing line struts become the dominant feature | variants/pointDensity_1.5/frame_00001.png |
| lineAlpha_255 | `fill(bas, 120);` -> `fill(bas, 255);` | none (0.0059, 0.004) | no visible change; struts are sub-pixel-thin so raising their alpha is imperceptible | variants/lineAlpha_255/frame_00001.png |
| palette_cool | `colors[] = {#99002B,...}` -> blue/gold set | moderate (0.0962, 0.45) | identical geometry (deterministic seed) but recoloured: blue and gold now dominant instead of red/gold/green | variants/palette_cool/frame_00001.png |

## Modularisation notes
- `subdivideRects` (the 79-92 loop) is a clean, self-contained stochastic subdivision
  that could ship as a library function returning a `Rect[]`; the 5%-floor (85) and the
  2-5 split range (82) are the tunable knobs.
- `nearestNeighborLines` (114-131) is a generic "connect to nearest neighbour within an
  angle cone" that depends only on the rect centres; reusable for any set of points.
- The additive noise-grain spray (134-146) is a good "texture a region with a noise-
  weighted point cloud" utility: params are region, point density, noise detail, and a
  palette lerp.
- One-off art decisions: the exact 90-rect count and size formula (72), the dark
  `background(20)`, and the specific `colors[]` (170). A clean parameter object would
  hold: seed, rectCount, rectSizeRange, subdivisions, minCellFrac, splitRange,
  lineAlpha, pointDensity, noiseDetail, palette.
