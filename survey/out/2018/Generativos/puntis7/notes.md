---
sketch: 2018/Generativos/puntis7
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2086
animated: false
techniques: [subdivision, voronoi-delaunay, dots-stippling, grid, polar]
primitives: [rect, ellipse, line, point, shape]
palette:
  colors: ["#6E4ECE", "#333333", "#9F9EA8", "#DDA852", "#E6E6ED"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: sub, default: "int(random(100)*random(1))", tried: [400], change: large, effect: "more subdivision iterations: much finer mosaic of smaller cells"}
  - {name: rockPoints, default: 30, tried: [90], change: moderate, effect: "more disc points: finer, grainier facets"}
  - {name: ringCount, default: 10, tried: [24], change: none, effect: "no visible change at this alpha"}
  - {name: stipplePerArea, default: 1.8, tried: [4.0], change: moderate, effect: "denser stipple grain inside facets"}
  - {name: outerRingAlpha, default: 40, tried: [160], change: subtle, effect: "slightly brighter white rim ring"}
reusable_candidates:
  - {name: rock, signature: "rock(cx, cy, size, pointCount) -> void", note: "Delaunay-faceted stippled disc with radial darkening (gem)"}
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, alp1, alp2) -> void", note: "tapered ring band as many small quads, alpha ramp alp1->alp2"}
  - {name: pointsCir, signature: "pointsCir(count, x, y, size) -> PVector[]", note: "uniform random points in a disc via sqrt(r) radius"}
  - {name: quadSubdivide, signature: "quadSubdivide(init, iterations, minSize) -> PVector[]", note: "random quad tree: repeatedly split a random quad into four"}
---

## What it draws
A full-bleed mosaic of black-bordered squares in many different sizes on a black ground: some cells hold a single large rock, others are subdivided into grids of many tiny rocks. Each rock is a round faceted gem made of small triangular facets in purple, gold, silver and dark grey, with a fine stippled grain. Large rocks sit inside a thin white circular ring, are surrounded by faint concentric white circles, and carry a few small white node dots joined to the rim by thin radial spokes.

## How the code works
- `setup()` (puntis7.pde:6-12) opens a 960x960 P2D window, `smooth(8)`, loads the `tipitos` image folder (only used by the commented-out `islands()` path) and calls `generate()`.
- `generate()` (puntis7.pde:27): `background(0)`, reseed, then builds a random quad tree (lines 34-48): one full-canvas quad `(10, 10, width-20)`; `sub = int(random(100)*random(1))` times, pick a random quad and if its size >= 20 replace it with four half-size quads. Result: the mosaic of differently sized squares.
- Per final quad (puntis7.pde:51-135):
  - faint cell rect: `stroke(255,14)`, `fill(rcol(),10)` (55-58) - the barely visible square borders.
  - two-tone split quad, top transparent / bottom `fill(255,16)` (59-66) - subtle top/bottom shading.
  - 9 concentric white ellipse rings, radius `cs*j` with `cs = q.z/10` (69-75).
  - black inner shadow ring `arc2(...)` (80) and the gem: `rock(cx, cy, q.z*0.65, 30)` (81).
  - white outer ring `arc2` + full `ellipse` stroke (85-88) and a 2px center dot (90-92).
  - up to 5 mutually non-overlapping random node points inside the rock (95-114); each node draws a thin line outward from near the node to the ring edge (122-130) plus a small ellipse and an `arc2` glow dot (131-133).
- `rock()` (utils.pde:117-208): `pointsCir()` samples `cc` points in a disc, `Triangulate.triangulate()` makes the Delaunay mesh; each triangle is filled with `rcol()` (random from the 5-colour palette, puntis7.pde:201-204) with faint white stroke (141-148), then `area*1.8` stipple points are scattered inside each triangle (151-161), then the triangles are re-filled in ADD blend (177-186), and finally a per-vertex radial darkening (`dist^2/r^2 * 60` black alpha) rounds the gem (189-204).
- Colour: 5-colour palette (purple `#6E4ECE`, dark grey, light grey, gold `#DDA852`, off-white) chosen per triangle by `rcol()` (random-from-list); nearly all strokes/fills are near-white or black at low alpha over the black background, which is why the gems glow.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_400 | `int sub = int(random(100)*random(1));` -> `int sub = int(random(400)*random(1));` | large | much finer quad-tree mosaic: many more, smaller cells, most subdivided into dense grids of tiny rocks, only a few big rocks remain | variants/sub_400/frame_00001.png |
| rockPoints_90 | `rock(cx, cy, q.z*0.65, 30);` -> `rock(cx, cy, q.z*0.65, 90);` | moderate | same layout; rocks have many finer facets, grainier texture, purple reads more dominant | variants/rockPoints_90/frame_00001.png |
| rings_24 | `for (int j = 1; j < 10; j++) {` -> `for (int j = 1; j < 24; j++) {` | none | no visible change: extra rings stay below visibility at alpha 3 | variants/rings_24/frame_00001.png |
| stipple_4.0 | `for (int j = 0; j < area*1.8; j++) {` -> `for (int j = 0; j < area*4.0; j++) {` | moderate | same layout; visibly denser white stipple grain inside each rock | variants/stipple_4.0/frame_00001.png |
| ringAlpha_160 | `arc2(cx, cy, q.z*0.9, q.z*0.8, 0, TAU, color(240), 40, 0);` -> `... color(240), 160, 0);` | subtle | white rim ring around each rock slightly brighter; layout unchanged | variants/ringAlpha_160/frame_00001.png |

## Modularisation notes
- `rock()` (utils.pde:117) is the core reusable piece: disc-sampled Delaunay facets + area-proportional stippling + ADD re-fill + radial darkening. Parameter object: `{center, size, pointCount, facetPalette, stipplePerArea, shadeStrength}`.
- `arc2()` (utils.pde:211) is a generic tapered ring-band primitive (radius ramp + alpha ramp); the sketch uses it for inner shadow, outer rim glow and node glows.
- `pointsCir()` (pointsFunctions.pde:25) is a standard uniform-in-disc sampler; `quadSubdivide` (puntis7.pde:34-48) is a one-line-per-iteration random quad tree - both trivially library-able.
- One-off art decisions: the per-quad dressing order (cell rect, split shading, ring count, node spokes), the 10px margin of the initial quad, the 5-colour palette, and the node-count `random(5)`.
