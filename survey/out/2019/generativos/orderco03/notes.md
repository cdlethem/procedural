---
sketch: 2019/generativos/orderco03
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1909
animated: false
techniques: [noise-field, grid, distortion]
primitives: [shape]
palette:
  colors: ["#F23602", "#300F96", "#C9FFF6", "#F72C81", "#09EFA6", "#FAC62A"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cw, default: "int(random(12,20)*20*0.8)", tried: [50], change: large, effect: "more, narrower columns of cells"}
  - {name: ch, default: "int(random(12,30)*15*0.8)", tried: [60], change: large, effect: "more, flatter rows of cells"}
  - {name: ampScale, default: 500, tried: [100], change: large, effect: "lower = straighter cells, noise bowing nearly gone"}
  - {name: overlapAlpha, default: 120, tried: [255], change: moderate, effect: "higher = flatter opaque patches, less colour mixing in overlaps"}
  - {name: multLow, default: 0.5, tried: [0.9], change: large, effect: "higher = fewer tiny confetti specks, more uniform cells"}
  - {name: gridScale, default: 1.4, tried: [1.0], change: large, effect: "lower = smaller cells, more mint background visible"}
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, desAng, detAng, desAmp, detAmp, desDes, detDes, ampScale) -> PVector", note: "simplex-noise angle + amplitude field that warps a point (def(), lines 209-214)"}
  - {name: noisePalette, signature: "noisePalette(seed1, seed2, detail1, detail2, i, j) -> int", note: "noise-driven index into a colour list with lerp between neighbours (getColor(float), lines 242-248)"}
  - {name: powGrid, signature: "powGrid(cw, ch, pw1, pw2, ph1, ph2) -> quad[]", note: "grid corners placed with per-row/column power exponents so spacing compresses/expands across the canvas (lines 87-103)"}
---

## What it draws
A full-bleed warped checkerboard of quadrilaterals on a mint-green background. Large
cells in orange, purple, yellow, pink, teal and white sit in a gently bowed,
organic grid; some cells are flat black or white. Scattered across the whole image
are tiny speckled squares in black and palette colours, like confetti. The whole
grid is slightly tilted and stretched so no cell is axis-aligned.

## How the code works
- `settings()` (15-20): 960x960 P3D window.
- Background (48): `background(getColor())` picks one palette colour at random via noise (seed 42 gives the mint-green ground).
- Transform (50-51): `translate(-20%, -20%)` then `scale(1.4)` so the grid overflows the canvas (full-bleed, tilted look comes from the distortion, not the transform).
- Grid resolution (60-61): `cw = int(random(12,20)*20*0.8)` and `ch = int(random(12,30)*15*0.8)` — seed-dependent number of columns/rows.
- Spacing (65-73, 88-93): `pw1/pw2` and `ph1/ph2` are exponents in `1..1.2` (or their reciprocal), interpolated across rows/columns. Corner positions use `pow(i/cw, pwrw)*width*mult` (100-103), so the grid compresses toward one edge.
- Speckles (98): `mult = random(120)*random(0.5,1)` is a per-cell scale from ~0.6 to ~120; large `mult` makes a cell cover a big area, small `mult` makes it a tiny dot — that is the confetti field.
- Distortion (100-103, 209-214): every corner is displaced by `def()`, a simplex-noise field giving an angle and an amplitude (`*500`), so each quad edge bows smoothly.
- Colour (125-130): each cell gets a random palette colour from `rcol()`; with 50% probability it is overridden to pure black or white according to the `(i+j)%2` checkerboard parity.
- Blending (131-144): each quad is drawn with `beginShape()`/`vertex()` via `line2()` (197-200); the two "first" edges are filled at full opacity and the two "next" edges at `alpha 120`, so where big cells overlap they mix translucently — that is why the green background shows through and big patches look layered.
- `c1`/`c2` from `getColor(noise(...))` (112-113) are computed but never used in the fill (commented-out branch); the visible colouring is `rcol()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cw_50 | `int cw = int(random(12, 20)*20*0.8);...` -> `int cw = 50;` | large (0.4004, 0.861) | noticeably finer grid: many more narrow columns of cells, same confetti speckles, mint background still dominant | variants/cw_50/frame_00001.png |
| ch_60 | `int ch = int(random(12, 30)*15*0.8);...` -> `int ch = 60;` | large (0.2572, 0.781) | more horizontal strips, cells flatter/wider, grid busier | variants/ch_60/frame_00001.png |
| amp_100 | `...noise(desAmp+x*detAmp, desAmp+y*detAmp)*500;` -> `... *100;` | large (0.1838, 0.538) | distortion much reduced: cells nearly straight quads, the wavy organic bowing is almost gone | variants/amp_100/frame_00001.png |
| alpha_255 | `fill(col, 120);` -> `fill(col, 255);` | moderate (0.0688, 0.292) | overlaps opaque: flatter solid patches, less colour mixing where cells overlap; same layout | variants/alpha_255/frame_00001.png |
| mult_0.9 | `float mult = random(120)*random(0.5, 1);` -> `... random(0.9, 1);` | large (0.2734, 0.759) | far fewer tiny confetti specks: cells bigger and more uniform, composition reads as a regular warped grid | variants/mult_0.9/frame_00001.png |
| scale_1.0 | `scale(1.4);` -> `scale(1.0);` | large (0.2868, 0.809) | cells smaller overall, more mint background shows between/beside them, pattern no longer overflows as much | variants/scale_1.0/frame_00001.png |

## Modularisation notes
- `def()` (209-214) is a clean, generic noise-displacement field: 6 des/det pairs + amplitude scale. A library `noiseDisplace(x, y, params) -> {x, y, ang}` covers it.
- The `pow()` corner mapping (100-103) with per-axis exponent ramps is a reusable "compressed grid" generator; the `mult` speckle scale is an art decision but parameterises naturally (range + distribution).
- `getColor(float)` (242-248) is a nice generic noise-palette-lerp; here it's dead code — the actual fill is random-from-list with a black/white parity override, which is a one-off art decision.
- A clean parameter object: `{cw, ch, pwRange, phRange, multRange, ampScale, alpha2, parityOverrideProb, palette, backgroundFromPalette}`.
