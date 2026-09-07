---
sketch: 2018/Generativos/puntis6
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1876
animated: false
techniques: [subdivision, voronoi-delaunay, dots-stippling, polar, grid]
primitives: [rect, shape, ellipse, line, point]
palette:
  colors: ["#6E4ECE", "#333333", "#9F9EA8", "#DDA852", "#E6E6ED"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: sub, default: "int(random(100)*random(1))", tried: [20], change: large, effect: "fewer splits -> coarser quadtree, far fewer and larger cells"}
  - {name: rockPoints, default: 30, tried: [12], change: moderate, effect: "coarser, chunkier facets (fewer larger triangles)"}
  - {name: rockScale, default: 0.65, tried: [0.9], change: moderate, effect: "rocks grow to nearly touch the white ring"}
  - {name: darkBandAlpha, default: 20, tried: [120], change: none, effect: "no visible change"}
  - {name: ringCount, default: 9, tried: [24], change: none, effect: "no visible change; rings too faint (stroke alpha 3)"}
  - {name: palette, default: "#6E4ECE,#333333,#9F9EA8,#DDA852,#E6E6ED", tried: ["#2196F3,#FF5722,#4CAF50,#FFEB3B,#FFFFFF"], change: subtle, effect: "facets recolored blue/orange/green/yellow/white, same composition"}
reusable_candidates:
  - {name: rock, signature: "rock(cx, cy, s, cc) -> void", note: "faceted disc: cc uniform circular points, Delaunay triangulation, per-triangle palette fill + white stipple + ADD-blended overlay + radial black shading; reads as a gem/stone"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2) -> void", note: "annular band built from radial quads between two radii"}
  - {name: quadtreeSubdivide, signature: "subdivideQuads(quad, iterations, minHalf) -> ArrayList<PVector>", note: "random quadtree: repeatedly split one random quad into 4 until minHalf too small"}
  - {name: pointsCir, signature: "pointsCir(cc, x, y, s) -> ArrayList<PVector>", note: "uniform disc sampling via r = R*sqrt(random)"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform random pick from a fixed palette array"}
---

## What it draws
On a black background, an irregular grid of cells of very different sizes (a quadtree tiling: a few large cells, and dense clusters of tiny cells, e.g. top-right and bottom-right). Inside each cell sits a faceted gem-like "rock": a polygonal blob made of flat triangular facets in purple, dark grey, light grey, gold and off-white, with white speckle stipple. Each rock is enclosed by a thin white ring and a dark halo, with faint concentric ellipse rings around it, and a few small satellite dots connected to the ring by thin white lines. Some cells also show a faint rectangular grid line around them.

## How the code works
`setup()` calls `generate()` once (puntis6.pde:6-12); `draw()` is empty, so the piece is static (baseline frames 10/60 identical to 1).
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_20 | `int sub = int(random(100)*random(1));` -> `int sub = 20;` | large | coarser quadtree: far fewer, much larger cells (one giant cell top-left); rocks scale with their cells | variants/sub_20/frame_00001.png |
| rock_pts_12 | `rock(cx, cy, q.z*0.65, 30);` -> `rock(cx, cy, q.z*0.65, 12);` | moderate | chunkier rocks: fewer, larger flat facets; same tiling and rock size | variants/rock_pts_12/frame_00001.png |
| rock_scale_0.9 | `rock(cx, cy, q.z*0.65, 30);` -> `rock(cx, cy, q.z*0.9, 30);` | moderate | rocks noticeably larger, nearly touching the white rim; the dark gap around them disappears | variants/rock_scale_0.9/frame_00001.png |
| darkband_120 | `arc2(cx, cy, q.z*0.1, q.z*0.8, 0, TAU, color(0), 20, 0);` -> `color(0), 120, 0` | none | no visible change (band is mostly covered by the rock drawn after it; only a thin sliver stays visible) | variants/darkband_120/frame_00001.png |
| rings_25 | `for (int j = 1; j < 10; j++) {` -> `j < 25` | none | no visible change; the concentric rings are too faint (stroke alpha 3) to read even at 2x density | variants/rings_25/frame_00001.png |
| palette_cool | `int colors[] = {#6E4ECE, ...}` -> `{#2196F3, #FF5722, #4CAF50, #FFEB3B, #FFFFFF}` | subtle | facets clearly recolored to blue/orange/green/yellow/white; composition, sizes and brightness unchanged | variants/palette_cool/frame_00001.png |
- Subdivision loop (lines 37-48): `sub = int(random(100)*random(1))` iterations; each picks a random quad and, if its half-size is >= 20, replaces it by four half-size quads. Result is a random quadtree partition of the canvas; cells below 40px stop splitting.
- Per-quad drawing (lines 51-135):
  - Faint cell border: `rect` stroke white alpha 14, fill `rcol()` alpha 10 (55-57) — the barely visible grid lines.
  - Subtle white vertex-gradient shading over the cell (59-66).
  - 9 concentric ellipse rings, stroke white alpha 3 (69-75).
  - Dark halo annulus: `arc2(..., color(0), 20, 0)` (80).
  - The rock: `rock(cx, cy, q.z*0.65, 30)` (81) — utils.pde:117-208: 30 uniformly sampled circular points, Delaunay via `Triangulate.triangulate`; per triangle: palette fill (`rcol()`) with white stroke alpha 20 (141-148); area-proportional white stipple `point`s (150-161); `blendMode(ADD)` palette overlay for glow (176-186); radial black shading from an off-centre point for depth (189-205).
  - Bright rim: `arc2` white-ish alpha 40 plus an `ellipse` outline at 0.9*q.z (83-88).
  - Satellites: `cc = int(random(5))` (0-4) points (96), rejection-sampled within 0.3*q.z of the centre with mutual min-distance `ss*1.2` (99-114); each drawn as an ellipse + `arc2` halo, connected to the rim by a thin white `line` (116-134).
- Colour: `rcol()` (200-204) picks uniformly from the 5-colour palette `{#6E4ECE, #333333, #9F9EA8, #DDA852, #E6E6ED}`.
- `Tipitos` (small person sprites) are loaded in setup (Tipitos.pde) but only used by the commented-out `islands()` (puntis6.pde:181) — they never reach the output.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, library-worthy: `rock` (faceted disc — the core visual primitive), `arc2` (annulus band), `quadtreeSubdivide` (random quadtree), `pointsCir` (uniform disc sampling), `rcol` (palette pick), the stipple loop (area-proportional random points in a triangle, shared by `rock`/`basicBack`).
- One-off art decisions: the exact alphas (14/10/3/20/40), the 0.65 rock scale vs cell, satellite count 0-4 and its ring-line motif, the specific 5-colour palette, the 40px min-cell threshold.
- A clean parameter object would hold: seed, canvas size, subdivision iterations, min cell size, rock radius factor (of cell), rock point count, ring count, satellite count, palette, and per-element alpha weights.
