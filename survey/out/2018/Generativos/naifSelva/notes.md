---
sketch: 2018/Generativos/naifSelva
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1724
animated: false
techniques: [voronoi-delaunay]
primitives: [shape]
palette:
  colors: ["#FAA270", "#B5CA53", "#FE8AB4", "#24ACCE", "#B5140B", "#B083A8", "#167E68", "#015928", "#35B77D", "#003172", "#E87823", "#D8B04A", "#001C77"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "400-1000 (int random)", tried: [200], change: large, effect: "fewer points: sparser field of smaller, simpler shard fragments, less total colour coverage"}
  - {name: amp1, default: "random(1)*random(1) per frame", tried: [0.9], change: moderate, effect: "inner star points near centroid: shards become thin 3-pointed spikes/tridents"}
  - {name: amp2, default: "random(1)*random(1) per frame", tried: [0.9], change: moderate, effect: "edge-midpoint spikes retreat: larger, chunkier, more hexagonal shards with denser coverage"}
  - {name: bb, default: 100, tried: [0], change: large, effect: "mesh no longer overhangs the canvas: off-white background(250) visible at corners and edges"}
  - {name: colors, default: "14-colour palette", tried: ["#FAA270 + #24ACCE only"], change: moderate, effect: "same geometry; only coral and blue shards with pale lerp between the two"}
reusable_candidates:
  - {name: delaunay, signature: "delaunay(PVector[] points) -> Triangle[]", note: "local incremental Delaunay (supertriangle + circumcircle), refactored Triangulator.pde; O(n^2)-ish, fine for ~1k points"}
  - {name: triangleStarShard, signature: "triangleStarShard(Triangle t, float ampIn, float ampEdge, ColorFn col) -> void", note: "fills triangle with per-vertex random palette colours, then overlays a black 7-vertex star (corner + edge midpoints lerped to centroid) leaving angular colour shards"}
  - {name: perVertexRandomFill, signature: "perVertexRandomFill(PVector a, PVector b, PVector c, int[] palette) -> void", note: "beginShape with fill() before each vertex so P2D interpolates colours across the face"}
---

## What it draws
A black field scattered with hundreds of small, angular multicoloured shards —
each shard reads like a 6- or 7-pointed star or irregular polygon, with a smooth
colour gradient across it (orange/coral, teal/green, blue, yellow, pink, purple all
present). Shards vary a lot in size and density: dense clusters of small fragments
next to sparse zones of a few larger ones. There is no visible off-white
background; the black between the shards is part of the drawing.

## How the code works
- `generate()` (naifSelva.pde:84-95) drops `cc = int(random(400, 1000))` random
  points in the canvas plus a `bb = 100` margin (so points extend past all edges).
  Each `addPoint` (78-82) re-triangulates the whole point set with the local
  `Triangulator` (Triangulator.pde, incremental Delaunay: supertriangle,
  circumcircle test, edge stitching) — O(n^2) per point, hence the ~1.7 s first frame.
- `draw()` (12-62) is static: `randomSeed(seed)` is reset every frame, so frames
  1/10/60 are identical (only frame_00001.png kept).
- Per triangle, two shapes are drawn:
  1. The full triangle with `fill(rcol())` set before *each* vertex (36-42), where
     `rcol()` (100-102) picks a random colour from the 14-entry `colors[]` array.
     P2D interpolates between vertex colours, giving each triangle a smooth
     3-colour gradient.
  2. A black (`fill(0)`) star path (44-59): the triangle loop, then a 7-vertex
     star with outer points at corner `p1` and edge midpoints `c1..c3` (each
     lerped toward the centroid by `amp2 = random(1)*random(1)`, line 21) and
     inner points `i1..i3` (vertices lerped toward the centroid by
     `amp1 = random(1)*random(1)`, line 20). `amp1`/`amp2` are drawn once per
     frame, so all triangles share the same star shape this frame. The star is
     filled black over the gradient, leaving the triangle as 3 corner wedges +
     3 edge crescents of visible colour — the "shards".
- `background(250)` (line 13) is effectively invisible: the 100 px point margin
  makes the convex hull cover the whole canvas, and the black star interiors
  dominate each triangle, so the field reads as black.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `int cc = int(random(400, 1000));` -> `int cc = 200;` | large | sparse field of small mostly-triangular shards on black; much less colour coverage than baseline | variants/cc_200/frame_00001.png |
| amp1_0.9 | `float amp1 = random(1)*random(1);` -> `float amp1 = 0.9;` | moderate | shards collapse to thin 3-pointed star/trident shapes, same density, less solid colour | variants/amp1_0.9/frame_00001.png |
| amp2_0.9 | `float amp2 = random(1)*random(1);//0.01;` -> `float amp2 = 0.9;//0.01;` | moderate | edge spikes retreat, shards grow into larger chunky hexagonal/polygonal pieces, denser coverage | variants/amp2_0.9/frame_00001.png |
| bb_0 | `float bb = 100;` -> `float bb = 0;` | large | point cloud confined to canvas: off-white background(250) now visible as a frame at corners/edges, mesh compressed inside | variants/bb_0/frame_00001.png |
| colors_2 | 14-colour `colors[]` -> `{#FAA270, #24ACCE}` | moderate | identical geometry; only coral and cyan-blue shards, pale in-between tints where the two lerp | variants/colors_2/frame_00001.png |

## Modularisation notes
- Generic: the `Triangulator` tab is a self-contained incremental Delaunay and
  could ship as a library function (or be replaced by the already-provided
  `triangulate` jar for large point counts).
- Generic: `triangleStarShard` — the "triangle + per-vertex random colours +
  black star mask" pattern is the whole visual idea; parameterising `amp1`,
  `amp2`, the palette, and the star vertex rule makes it reusable.
- One-off art decisions: the specific 14-colour palette, the margin `bb`, the
  per-frame re-draw of `amp1`/`amp2` (which ties all triangles to one star
  shape), and the O(n^2) re-triangulation per point (a batch triangulate after
  `generate` would be the clean version).
- A clean parameter object: `{ pointCount, margin, palette, ampIn, ampEdge,
  background }`.
