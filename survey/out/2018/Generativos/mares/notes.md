---
sketch: 2018/Generativos/mares
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2830
animated: false
techniques: [grid, noise-field, flow-field]
primitives: [ellipse, line, shape]
palette:
  colors: ["#474169", "#946694", "#FF194E", "#FF8E7A", "#FFEA6A"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ss, default: "random(20, random(120))", tried: ["random(80, 90)"], change: large, effect: "fixed larger cell size = bigger, coarser scales in more orderly diagonal bands"}
  - {name: max, default: "random(random(2), 6)", tried: ["random(random(2), 12)"], change: large, effect: "scales grow and size clumping gets more dramatic (very large next to small)"}
  - {name: det, default: "random(0.01)", tried: ["random(0.05)"], change: moderate, effect: "finer noise = smaller, busier size blobs"}
  - {name: speckle_prob, default: 0.08, tried: [0.5], change: large, effect: "dark arc speckles on half the cells; overlay makes the scale field look denser and busier"}
  - {name: hair_count, default: 1000, tried: [3000], change: subtle, effect: "no visible change; 1-px alpha-80 hair strokes are too faint to distinguish"}
  - {name: fish_count, default: "int(random(200))", tried: ["int(random(500))"], change: none, effect: "no visible change; with seed 42 the drawn count is likely still < 200 [INFERENCE]"}
reusable_candidates:
  - {name: noiseScaleGrid, signature: "noiseScaleGrid(cellSize, noiseDetail, sizeScale, angle) -> void", note: "hex-grid of arc-wedge 'scales' whose radius is noise-modulated"}
  - {name: flowTrail, signature: "flowTrail(x, y, length, detail, color) -> void", note: "chain of tapering ellipses following a 2-D noise flow field"}
  - {name: arcWedge, signature: "arcWedge(x, y, r1, r2, a1, a2, col, alp1, alp2) -> void", note: "annular wedge built from per-slice quads (arc2)"}
---

## What it draws
Full-bleed field of overlapping scallop/fish-scale shapes covering the whole 960x960 canvas, in a
warm palette of red-pink, salmon, yellow, and lilac over a dark purple ground. Each scale is a fan
of wedge shapes with a small darker center dot; scale sizes vary smoothly in blobs (noise-driven),
so the pattern reads as clusters of big and small scales. Scattered across it are a handful of
elongated tan/khaki leaf-like streaks made of overlapping dots, and a very faint white crosshatch
of short straight lines at the grid points.

## How the code works
`generate()` (mares.pde:21) runs once in `setup()`; `draw()` is empty, so the piece is static.
- Background `#474169` (line 23); `randomSeed(seed)` (line 25).
- Cell size `ss = random(20, random(120))` (line 27) defines a hex grid: `hh = sqrt(ss^2*0.75)`,
  `cc = int(height*1.4/hh)` columns/rows (lines 28-29), centered and rotated by `random(TAU)`
  (lines 31-32) so the grid runs at an angle.
- Loop 1 (lines 40-49): at every grid point a single straight line of length `ss`, angle snapped to
- Loop 2 (lines 52-81): the scales. Size `s = ss*noise(des+xx*det, des+yy*det)^0.8*max` (line 57)
  with `det = random(0.01)` (line 34) and `max = random(random(2), 6)` (line 37) — smooth noise
  gives the blob-like clumping of scale sizes. 8% of cells get 1-5 extra dark thin arcs
  (lines 59-67, `arc2` with near-black alpha 2). Then every cell gets: a full annular wedge
  `arc2(xx,yy,s,s*2,0,TAU)` white alpha 2 (line 70), an ellipse of diameter `s` filled with
  `rcol()` (random palette color, lines 66-68: lilac/red/salmon/yellow) with black alpha-10 stroke
  (lines 71-73), an inner wedge alpha ~170 (line 76), a small `s*0.12` ellipse (line 78) and a tiny
  dark center arc (line 79). The overlapping `s`-to-`2s` wedges on the hex grid are what produce
  the scallop look.
- `pelos()` (lines 105-128): 1000 noise-flow "hair" polylines (1-90 px long, alpha ~80,
  `noiseDetail(1)`) adding faint wispy texture.
- `peces()` (lines 130-161): ~`random(200)` "fish": each a chain of 20-100 ellipses following a
  noise flow field (line 150), size tapering along the chain (line 151), color interpolated through
  the palette along the chain via `getColor(ic + dc*j)` (line 153). These are the tan leaf-like
  streaks.
- Unused: `flower()` (line 163, commented out at 93-100), `arcCol()` (182), `srect()` (224).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_85 | `float ss = random(20, random(120));` -> `random(80, 90);` | large | scales are noticeably bigger and coarser; diagonal banding of the hex grid reads more clearly; same palette, fewer, larger scallops | variants/ss_85/frame_00001.png |
| max_12 | `float max = random(random(2), 6);` -> `random(random(2), 12);` | large | scales grow overall; size variation becomes much more dramatic, with very large scallops clumped against small ones | variants/max_12/frame_00001.png |
| det_0.05 | `float det = random(0.01);` -> `random(0.05);` | moderate | size clumping is finer and busier: blobs of large/small scales are smaller-scale and more erratic | variants/det_0.05/frame_00001.png |
| speckle_0.5 | `if (random(1) < 0.08) {` -> `if (random(1) < 0.5) {` | large | thin dark arcs and semi-transparent wedges appear over most scales, darkening and cluttering the field; the underlying scale grid is obscured | variants/speckle_0.5/frame_00001.png |
| pelos_3000 | `for (int i = 0; i < 1000; i++) {` -> `i < 3000` | subtle | no visible change; the faint 1-px hair strokes (alpha ~80) are imperceptible at either density | variants/pelos_3000/frame_00001.png |
| peces_500 | `int cc = int(random(200));` -> `int(random(500));` | none | no visible change; the number of tan leaf-like fish streaks is unchanged [INFERENCE: the seed-42 draw still lands below 200] | variants/peces_500/frame_00001.png |

## Modularisation notes
- `arc2` (line 204) is a clean generic primitive: annular wedge drawn as per-slice filled quads
  with independent inner/outer alpha — reusable as-is.
- The scale loop (lines 52-81) is the core reusable block: hex-grid positions + noise-modulated
  radius + per-cell layered drawing. Art-specific decisions: the 4-color palette (line 265), the
  8% dark-arc speckle, the 3-direction line crosshatch, and the exact per-cell layer stack.
- `pelos()` and `peces()` are the same flow-field walker pattern (advance by
  `noise(...)*TWO_PI*2`, draw at each step) differing only in what they draw (line vs ellipse chain)
  and in tapering — one function with a "drawer" callback would cover both.
- A clean parameter object: { cellSize, gridAngle, noiseDetail (size), noiseDetail (flow),
  sizeScale (max), speckleProb, hairCount, hairAlpha, fishCount, palette, background }.
