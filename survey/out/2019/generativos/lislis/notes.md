---
sketch: 2019/generativos/lislis
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1944
animated: true
techniques: [grid, noise-field, lines-hatching, blend-modes]
primitives: [line]
palette:
  colors: ["#152425", "#1D3740", "#06263E", "#074B7D", "#094D88", "#1D6C9E", "#ff2000", "#ff2010"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cw, default: "int(random(2, 12))", tried: [3], change: large, effect: "3 wide columns (~300 px each) instead of ~7 thin ones; bands wider, coiling and dark gaps more visible"}
  - {name: ch, default: 8000, tried: [2000], change: large, effect: "fewer rows: sparser accumulation, big black voids between ribbon-like bands"}
  - {name: det, default: "~0.001 (random(0.08,0.1)*0.012)", tried: ["~0.004 (4x)"], change: large, effect: "more chaotic heading walk: tangles more, additive saturation (white/cyan flash) much stronger"}
  - {name: alpha, default: 28, tried: [100], change: large, effect: "higher per-line alpha: bands saturate to solid hue faster, darker ground, isolated bright red bands"}
  - {name: colors, default: "9-colour blue/red palette", tried: ["4-colour green/red/orange/blue palette"], change: large, effect: "obvious palette swap: cyan/green/orange/blue strata instead of blue/red"}
reusable_candidates:
  - {name: noiseLine, signature: "noiseLine(x1, y1, x2, y2, det) -> void", note: "simplex-noise angle walk (lar*0.4 steps of 2 px), then rotated and stretched so the net displacement spans the segment"}
  - {name: getColor, signature: "getColor(v, colors[]) -> int", note: "palette index lerp with pow(v%1, 10.8) easing, so colour snaps between adjacent palette entries"}
  - {name: rowColorBand, signature: "rowColorBand(j, ic, dc, colors[]) -> int", note: "1-D noise over the row index selects the stroke colour, producing horizontal colour bands"}
---

## What it draws
A full-bleed grid of vertical columns (about 7, each ~130 px wide) on a near-black navy ground. Each
column is packed with dense horizontal bands of saturated blue and red-orange; the band edges are wavy,
coiled, almost ribbon-like, and thin white hairline curves (individual line traces) cross the bands.
Gaps between bands stay dark. Red and blue bands alternate in horizontal strata across the whole image.
Note: `frame_00001.png` is a P3D first-present artifact (a cyan-on-white flash); the true image is
`frame_00010.png` / `frame_00060.png`, which are identical to each other (empty `draw()`, static after
`setup()`).

## How the code works
Single tab `lislis.pde`. `settings()` opens a 960x960 P3D window (`smooth(8)`, `pixelDensity(2)` which
falls back on the headless display). `setup()` calls `generate()` once; `draw()` is empty, so the image
is static after the first frame.

- `generate()` (l.34-62): near-black background `background(0,2,4)` (l.40), then `blendMode(ADD)` (l.42).
  A grid of `cw = int(random(2,12))` columns by `ch = 8000` rows with a 20 px margin (l.44-48).
  For every row `j` (l.55-61) the stroke colour is `getColor(noise(ic+dc*j)*colors.length*2)` at alpha
  28 (l.58): 1-D noise over the row index, so colour varies slowly along y and whole horizontal strata
  share a colour (the red/blue banding). Then each of the `cw` cells in the row draws a `noiseLine`
  across the cell (l.59).
- `noiseLine()` (l.80-118): walks a polyline of `lar*0.4` steps (lar = cell width), 2 px per step, with
  heading `(SimplexNoise.noise(dx + seed*0.02 + ix*det, dy + iy*det) * 2 - 1) * PI * 30 + desAng`
  (l.92). `det ~ 0.001` is the noise detail and `PI*30` lets the heading swing up to ~15 full turns, so
  the walk coils into the dense ribbon blobs. After the walk, all points are rotated by `-ang+desAng`
  and scaled by `lar/dis` (l.100-108), reorienting the coiled walk so its net displacement is horizontal
  and stretched to exactly the cell width.
- Colour (l.127-139): 9-entry palette of dark blue/teal plus two bright reds; `getColor(v)` lerps between
  adjacent palette entries with `pow(v%1, 10.8)`, easing to 0, so the result is mostly one palette entry
  with sharp occasional jumps. With ADD blending and 8000 overlapping rows, saturated blue/red strata
  build up where many lines of the same hue overlap; thin white traces are single lines added on top of
  already-bright bands.
- Randomness: seed from `randomSeed(seed)`/`noiseSeed(seed)` (l.36-37); `cw`, `det`, `ic`, `dc` drawn
  from the seeded RNG; per-point heading from `SimplexNoise`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cw_3 | `int cw = int(random(2, 12));` -> `int cw = 3;` | large (mean 0.2425, 0.792 of pixels) | three wide columns of dense blue/red bands; right column more coiled with dark gaps; large white additive flash in the top centre | variants/cw_3/frame_00001.png |
| ch_2000 | `int ch = 8000;` -> `int ch = 2000;` | large (mean 0.2357, 0.791 of pixels) | full-bleed flowing blue/red ribbon bands in three columns with a large black void in the middle and bright white wavy hairline traces | variants/ch_2000/frame_00001.png |
| det_0.004 | `float det = random(0.08, 0.1)*0.012;` -> `float det = random(0.32, 0.4)*0.012;` | large (mean 0.5883, 0.984 of pixels) | most extreme: white/cyan flash fills the top two thirds, tangle of saturated red/orange and blue bands below, yellow/orange at the bottom edge | variants/det_0.004/frame_00001.png |
| alpha_100 | `stroke(getColor(noise(ic+dc*j)*colors.length*2), 28);` -> `stroke(getColor(noise(ic+dc*j)*colors.length*2), 100);` | large (mean 0.3335, 0.829 of pixels) | dark: near-black ground with faint blue grid-like bands, two bright red horizontal bands mid-image, bright blue bands lower down, thin blue hairlines | variants/alpha_100/frame_00001.png |
| palette_green | `int colors[] = {#152425, #1D3740, #06263E, #074B7D, #094D88, #1D6C9E, #ff2000, #1D6C9E, #ff2010};` -> `int colors[] = {#50A85F, #DD2800, #F2AF3C, #5475A8};` | large (mean 0.2733, 0.72 of pixels) | obvious palette swap: cyan/turquoise dominates with orange bands, white flash lower centre, black wedge-shaped gaps between coiled bands | variants/palette_green/frame_00001.png |

Note on scores: render.py diffs the variant's `frame_00001.png` against the baseline's
`frame_00001.png`. The baseline's frame 1 is itself a P3D first-present artifact (cyan/white flash,
see "What it draws"), so these scores measure changes in that first-present state; they agree with
what is visible in each variant's frame 1 (all clearly differ from the baseline frame 1).

## Modularisation notes
- `noiseLine(x1,y1,x2,y2,det)` is the core reusable primitive: a noise-angle random walk, then
  rotate+stretch to span an arbitrary segment. Generic parameters: `det` (noise detail), step length
  (2 px), step count (`lar*0.4`), heading gain (`PI*30`).
- `getColor(v, colors[])` + `rowColorBand(j, ic, dc)` is a generic "noise-banded palette along one axis"
  helper.
- One-off art decisions: the 8000-row x random-columns grid, the 20 px margin, alpha 28, ADD blending,
  the specific 9-colour blue/red palette, and the `PI*30` heading gain.
- A clean parameter object: `{columns, rows, margin, alpha, blend, det, stepLen, stepFraction, headingGain, palette, ic, dc}`.
