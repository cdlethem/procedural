---
sketch: 2019/generativos/tesse/tesse004
year: 2019
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1580
animated: false
techniques: [grid, noise-field]
primitives: [shape]
palette:
  colors: ["#E8E3B3", "#E94E6B", "#F08BB2", "#41BFF9"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: dx, default: "w*0.2", tried: [0.0], change: moderate, effect: "no S-offset: ribbons become stacked wavy bands"}
  - {name: res, default: 40, tried: [12], change: large, effect: "coarser walk: wavy edges turn angular and spiky"}
  - {name: amp, default: "random(0.8,1)*2.6", tried: ["random(0.8,1)*0.8"], change: moderate, effect: "lower amplitude: gentler, flatter waves"}
  - {name: sw, default: "random(6,16)", tried: [4], change: large, effect: "4 columns: much wider, flatter stacked bands"}
  - {name: colors, default: "4-colour pastel", tried: ["{#000000,#eeeeee,#ffffff}"], change: large, effect: "same geometry, monochrome black/white/grey"}
reusable_candidates:
  - {name: createLine, signature: "createLine(x1, y1, x2, y2, res) -> PVector[]", note: "noise-steered random walk fitted (rotate + scale) to span a segment; ends wavy, middle straight"}
  - {name: drawMosaic, signature: "drawMosaic(x, y, w, h, lineA, lineB, inv)", note: "one closed tile from 4 wavy edges; dx = w*0.2 offset of the top/bottom edges makes the S/ribbon silhouette"}
---

## What it draws
Full-bleed seamless tiling of S-shaped wavy ribbons on a roughly 10-column x 17-row grid. Each ribbon spans one grid cell: wavy top and bottom edges, and left/right ends shifted by one fifth of the cell width so neighbouring ribbons interlock like a woven checkerboard. Four colours cycle across the grid — pale cream yellow, light blue, deep pink-red, soft pink — so adjacent ribbons never share a colour. Static: frames 1/10/60 are identical.

## How the code works
- `settings()` (L12-17): 960x960 P2D canvas.
- `setup()` (L19) calls `generate()` (L48) once; `draw()` is empty, so the image is static.
- `generate()`: `randomSeed(seed)` (L51); background = one random palette colour via `rcol()` (L52, L181). Grid: `sw = random(6,16)` columns (L55), `sh = random(6,16)*2` rows (L57), so cells are wider than tall; a random sub-cell translate (L60) shifts the whole grid.
- Cell loop (L70-95): for each cell, colour index `ind = abs((i+j)%4 + j/2)` (L83) selects the fill via `getColor(ind)` (L187-192), which `lerpColor`s between two adjacent palette entries; for integer `ind` the fraction is 0, so each tile gets exactly one of the four palette colours, cycled by row/column parity. `drawMosaic(x, y, ww, hh, line1, line2, (j%2)>=1)` (L85) draws the tile; `inv` flips the silhouette on alternating rows.
- `createLine()` (L98-130) is called twice (L66-67) to build `line1`/`line2`: a random walk of `res = 40` steps where the step angle is `noise(...)*TAU*amp*a` (L112) and `a = abs(i/res-0.5)*2` is 0 at the middle and 1 at the ends — so each curve is straight in its centre and wavy at both ends, with amplitude `amp = random(0.8,1)*2.6` (L107). The walk is then rotated and scaled to span exactly `(0,0)->(ww,0)` (L117-127).
- `drawMosaic()` (L132-153): one `beginShape()` built from four `vline()` edges (L155-170), each mapping one of the two shared wavy curves onto a side of the cell (rotated + scaled per side). `dx = w*0.2` (L136) shifts the top edge relative to the bottom edge, producing the S/ribbon shape. Because every tile reuses the same two global curves, adjacent tiles share identical edge geometry and the tiling is seamless; `inv`/`rev` mirror the curves so neighbouring ribbons interlock.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| dx_0.0 | `float dx = w*0.2;` -> `float dx = w*0.0;` | moderate (mean 0.0836, 0.256 of pixels) | S-offset removed: ribbons become stacked wavy bands, the woven interlock is gone; same 4 colours | variants/dx_0.0/frame_00001.png |
| res_12 | `int res = 40;` -> `int res = 12;` | large (mean 0.1651, 0.513 of pixels) | wavy edges become angular and spiky with small bumps; smooth curves gone | variants/res_12/frame_00001.png |
| amp_0.8 | `float amp = random(0.8, 1)*2.6;` -> `float amp = random(0.8, 1)*0.8;` | moderate (mean 0.1336, 0.42 of pixels) | waves much gentler and flatter; S-ribbon structure and colours unchanged | variants/amp_0.8/frame_00001.png |
| sw_4 | `int sw = int(random(6, 16));` -> `int sw = 4;` | large (mean 0.2412, 0.754 of pixels) | 4 columns: cells much wider, tiles read as wide flat stacked bands | variants/sw_4/frame_00001.png |
| palette_mono | `int colors[] = {#E8E3B3, #E94E6B, #F08BB2, #41BFF9};` -> `int colors[] = {#000000, #eeeeee, #ffffff};` | large (mean 0.4192, 0.92 of pixels) | identical geometry, now monochrome: black / white / light grey waves | variants/palette_mono/frame_00001.png |

## Modularisation notes
- Generic / library candidates: `createLine` (noise-steered walk fitted to a segment — reusable for any wavy-edge tiling) and `drawMosaic` (assemble a closed tile from a small set of shared wavy edge curves with an offset `dx`; the shared-curves trick is what makes it tessellate seamlessly).
- Art-specific decisions: the 4-colour palette and the `ind = abs((i+j)%4 + j/2)` colour cycling; the `dx = w*0.2` ribbon offset and the row-flipping `inv` flag; the 2x row count making cells wider than tall.
- A clean parameter object: `{cols, rows, cellOffset (dx fraction of w), res, amp, palette[], colorRule, seed}` — with `createLine(res, amp)` and `tileFromEdges(w, h, dx, edges, inv)` as the two core functions.
