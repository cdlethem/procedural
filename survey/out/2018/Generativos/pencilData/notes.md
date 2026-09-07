---
sketch: 2018/Generativos/pencilData
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2274
animated: false
techniques: [subdivision, dots-stippling, curves, shader]
primitives: [rect, point]
palette:
  colors: ["#F0F0F0", "#F8F8F8", "#000000"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: sub, default: 80, tried: [160], change: subtle, effect: "more split iterations: busier tiling with more small cells, same tonality"}
  - {name: divRange, default: "(2,4)", tried: ["(2,6)"], change: subtle, effect: "split range up to 4x4: different subdivision mix, same overall look"}
  - {name: bb, default: 4, tried: [14], change: subtle, effect: "wider gutters: cells read as separate framed panels on paper"}
  - {name: da1, default: 0.01, tried: [0.05], change: subtle, effect: "5x curve frequency: per-cell patterns differ (wavier), some large cells fainter"}
  - {name: stippleFactor, default: 0.8, tried: [2.5], change: subtle, effect: "denser stipple: cells look grayer and more filled in"}
  - {name: stippleAlpha, default: 4, tried: [12], change: subtle, effect: "darker stipple dots: slightly grainier, denser cells"}
reusable_candidates:
  - {name: subdivideQuad, signature: "subdivideQuad(side, iterations, minDiv, maxDiv) -> square[]", note: "recursive random quad-split of a square into a non-overlapping tiling"}
  - {name: stippleFill, signature: "stippleFill(x, y, w, h, areaFactor, alpha) -> void", note: "area-scaled point cloud with center bias (product of two uniforms)"}
  - {name: lissajousPoints, signature: "lissajousPoints(x, y, w, res, da1, da2) -> void", note: "parametric cos/sin point sequence at random incommensurate frequencies"}
  - {name: paperGrainFilter, signature: "paperGrainFilter() -> PShader", note: "post.glsl: 3x3 blur + grain + vignette + contrast, graphite-on-paper look"}
---

## What it draws
Full-bleed mosaic of light-gray squares of varying sizes on white paper — the canvas is
recursively subdivided so some cells stay large (roughly 1/3 of the side) while others
shrink to small tiles. Inside every cell sits a soft radial cloud of fine gray dots
(denser at the center, fading to the edges) and, overlaid, thin pale parametric curves:
wavy lines, spirograph-like rosettes, ellipses, and dense moiré hatching in the big cells.
A post shader adds fine film grain, a soft blur, a slight vignette, and a desaturated
graphite-on-paper tone, so the whole image reads as pencil drawings on paper.

## How the code works
`setup()` (pencilData.pde:4-11) sizes the canvas 960x960 P2D, loads `data/post.glsl`,
and calls `generate()` once; `draw()` (13-14) is empty, so the image is static.
`generate()` (24-76): `randomSeed(seed)` (26), `background(240)` (27).

- **Subdivision (34-46):** start with one square `PVector(0, 0, width)` (x, y, side);
  `sub = int(random(80))` iterations each pick a random cell and split it into
  `div x div` (div = int(random(2,4))) sub-squares, replacing it in the list. Result:
  a tiling of the canvas by squares of 3-4 size levels.
- **Per-cell drawing (48-72):**
  - inset rectangle (gutter `bb = 4`, lines 32, 50-56): `fill(248, 220)` (near-white,
    mostly opaque), `stroke(color(0), 6)` — the pale panel and faint border.
  - **Stipple (58-61):** `ww*hh*0.8` points with `stroke(0, 4)`. Position is cell center
    plus `random(-0.5,0.5) * random(0.1, 1)` in each axis — the product of two uniforms
    is peaked at 0, biasing dots toward the cell center and giving the soft radial falloff.
  - **Lissajous curve (63-71):** `res = int(ww*hh*random(0.8, 2))` points with
    `stroke(color(0), 6)` at `x = (0.1 + (cos(j*da1)*0.5+0.5)) * ww*0.8`,
    `y = (0.1 + (sin(j*da2)*0.5+0.5)) * ww*0.8`, where `da1, da2 = random(0.01)*random(1)`.
    Low incommensurate frequencies over an area-proportional point count: small cells get
    a few slow waves (rosettes, ellipses, hatching); large cells oscillate thousands of
    times and smear into dense moiré.
- **Post filter (74-75):** `filter(post)` with `data/post.glsl`: 3x3 Gaussian blur mixed
  in at 0.95 (post.glsl:63), grain `rand(st*200)` at 0.08 (67), saturation ~8.6-10.2 and
  contrast 1.2 via `csb()` (68), per-channel gamma 1.1/0.98/0.9 (70-72), and a radial
  vignette `dis` (65, 68). This produces the paper grain, softening, and edge darkening.

Randomness enters only through `randomSeed(seed)` and the `random()` calls in the
subdivision and per-cell loops; the seed is set by the harness (`seed` field, line 1).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_160 | `int sub = int (random(80));` -> `int sub = int (random(160));` | subtle | busier tiling: more, smaller cells (big cells split again); overall tonality unchanged | variants/sub_160/frame_00001.png |
| div_2_6 | `int div = int(random(2, 4));` -> `int div = int(random(2, 6));` | subtle | different subdivision mix (some 4x4 splits); composition and tonality the same | variants/div_2_6/frame_00001.png |
| bb_14 | `float bb = 4;` -> `float bb = 14;` | subtle | wide white gutters: cells read as separate framed panels on paper | variants/bb_14/frame_00001.png |
| da1_0.05 | `float da1 = random(0.01)*random(1);` -> `float da1 = random(0.05)*random(1);` | subtle | per-cell curve patterns differ (wavier oscillations); some large cells fainter; composition same | variants/da1_0.05/frame_00001.png |
| stipple_2.5 | `j < ww*hh*0.8` -> `j < ww*hh*2.5` | subtle | denser stipple: cells look grayer and more filled in | variants/stipple_2.5/frame_00001.png |
| pointAlpha_12 | `stroke(0, 4);` -> `stroke(0, 12);` | subtle | darker stipple dots: slightly grainier, denser cells | variants/pointAlpha_12/frame_00001.png |

## Modularisation notes
- **Generic:** the quad-subdivision (34-46) is a clean standalone function: given a side
  length, iteration count, and split range, return the tiling. The stipple fill and the
  Lissajous point sequence are also reusable as-is with (x, y, w, h, areaFactor) and
  (x, y, w, res, da1, da2) respectively. The paper-grain post shader is a generic
  "graphite on paper" filter.
- **One-off art decisions:** the 4 px gutter, `fill(248, 220)`, drawing both stipple and
  curve in *every* cell, the specific shader constants (grain 0.08, blur 0.95, gamma),
  and the area-proportional point budgets.
- **Parameter object:** `{seed, iterations, divMin, divMax, gutter, cellFillAlpha,
  stippleFactor, stippleAlpha, curveFreqMax, curveResFactor, grain, blur, vignette}`.
