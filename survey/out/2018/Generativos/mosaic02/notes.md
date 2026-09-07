---
sketch: 2018/Generativos/mosaic02
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1572
animated: false
techniques: [subdivision, voronoi-delaunay, grid]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#DFAB56", "#E5463E", "#366A51", "#2884BC"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: iterations, default: 100, tried: [200], change: large, effect: "more subdivision steps -> overall finer, denser mosaic; big blocks still present"}
  - {name: selectFraction, default: 0.5, tried: [1.0], change: large, effect: "uniform tile selection -> roughly uniform tile sizes; the huge-blocks-plus-tiny-clusters mix disappears"}
  - {name: palette, default: "#DFAB56 #E5463E #366A51 #2884BC", tried: ["#264653 #2A9D8F #E9C46A #E76F51"], change: large, effect: "same layout, new scheme (dark teal / teal / yellow / coral); white mesh reads stronger over the darker fills"}
  - {name: meshKeep, default: 0.1, tried: [0.5], change: moderate, effect: "5x more of the Delaunay triangles survive -> visibly denser white triangular web"}
  - {name: dotScale, default: 0.1, tried: [0.4], change: none, effect: "no visible change; dots stay tiny relative to their tiles"}
reusable_candidates:
  - {name: biasedQuadtree, signature: "biasedQuadtree(width, height, iterations, bias) -> Rect[]", note: "repeatedly subdivide random rects (first half of list = bias toward larger tiles) into 4 quadrants"}
  - {name: twoToneShadow, signature: "twoToneShadow(x, y, w, h, color, alpha)", note: "per-vertex-alpha quad giving each rect a random diagonal light/dark split"}
  - {name: pointTriangulateMesh, signature: "pointTriangulateMesh(points, groups, keepFraction) -> triangles", note: "split points into N random groups, Delaunay each (z=0), keep a random fraction of triangles, draw translucent"}
---

## What it draws
A full-bleed mosaic of axis-aligned rectangles at very different sizes, packed edge to edge:
large blocks (a quarter of the canvas and bigger) beside dense clusters of tiny tiles. Each
tile is a flat random color from a 4-color palette — mustard/ochre, red, deep green, blue —
with a two-tone diagonal shading (one half of the tile is lighter, split along a random
diagonal). Every tile has a centered ellipse (diameter = half the shorter side) and a small
dot at its center. Over the whole image lies a faint white triangular mesh: a few large
translucent white triangles and thin grey lines connecting some of the ellipse centers.

## How the code works
`setup()` (mosaic02.pde:8) sizes a 960×960 P3D canvas, loads `post.glsl` (the `filter(post)`
call is commented out at line 127, so the shader has no effect on the image), then calls
`generate()` once; `draw()` is empty, so the image is static.

- **Mosaic** (lines 64–70): starts with one rect covering the canvas; 100 iterations pick a
  rect from the *first half* of the list (`rects.get(int(random(rects.size()*0.5)))`, line 68)
  and split it into 4 quadrants (`subdivide`, lines 43–53), removing the parent. The first-half
  bias means earlier (larger) rects get re-subdivided more, producing the mix of huge blocks
  and fine clusters.
- **Tiles** (lines 83–99): each rect is filled with `rcol()`, a random palette color from
  `colors[]` (line 150: #DFAB56, #E5463E, #366A51, #2884BC), with a 0.8 stroke.
- **Diagonal shading** (`shadow`, lines 130–144): a quad over the tile with per-vertex alpha
  180/0 (line 131 picks randomly which diagonal is the lit half), giving each tile a light
  and a dark triangle.
- **Ellipses** (lines 89–95): centered ellipse of diameter `min(w,h)*0.5`, plus a dot at
  `s*0.1`; each center is stored as a PVector.
- **Triangle mesh** (lines 101–122): centers are split into 4 random groups; each group is
  projected to z=0 and Delaunay-triangulated with `Triangulate.triangulate` (line 109,
  triangulate library). Only ~10% of triangles survive (`if(random(1) < 0.9) continue;`,
  line 115), drawn with `stroke(0, 40)` and `fill(255, 40)` — the faint white web over the
  mosaic.
- **Randomness**: `randomSeed(seed)` (line 59); the harness pins the `seed` field to 42, so
  the baseline is deterministic. `keyPressed` regenerates with a new seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subdiv_200 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 200; i++) {` | large | much finer, denser mosaic overall; large blocks remain but many more, smaller tiles | variants/subdiv_200/frame_00001.png |
| bias_1.0 | `random(rects.size()*0.5)` -> `random(rects.size()*1.0)` | large | tiles become roughly uniform in size; the mix of huge blocks and dense tiny clusters is gone | variants/bias_1.0/frame_00001.png |
| palette_cool | `int colors[] = {#DFAB56, #E5463E, #366A51, #2884BC};` -> `int colors[] = {#264653, #2A9D8F, #E9C46A, #E76F51};` | large | identical layout, new scheme: dark teal, teal, yellow, coral; white mesh reads stronger | variants/palette_cool/frame_00001.png |
| tri_0.5 | `if(random(1) < 0.9) continue;` -> `if(random(1) < 0.5) continue;` | moderate | denser white triangular overlay (5x more triangles kept) | variants/tri_0.5/frame_00001.png |
| dot_0.4 | `ellipse(r.x+r.w*0.5, r.y+r.h*0.5, s*0.1, s*0.1);` -> `... s*0.4, s*0.4);` | none | no visible change; center dots stay tiny relative to their tiles | variants/dot_0.4/frame_00001.png |

## Modularisation notes
- `subdivide` + the biased selection loop is a clean generic function: a quadtree with a
  size bias parameter (fraction of list eligible for subdivision). `Rect` is a trivial data
  class.
- `twoToneShadow` is generic and small; the per-vertex alpha trick needs P3D (per-vertex
  color/alpha works in P3D, not always JAVA2D).
- The 4-group triangulate-and-decimate overlay is a nice generic "sparse mesh" effect:
  parameterize group count and keep fraction.
- One-off art decisions: the 4-color palette, ellipse + dot motif, 0.8 stroke weight.
- A clean parameter object: `{canvasSize, iterations, bias, palette, ellipseScale, dotScale,
  shadowAlpha, meshGroups, meshKeep, strokeWeight}`.
