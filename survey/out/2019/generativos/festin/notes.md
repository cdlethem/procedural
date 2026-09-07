---
sketch: 2019/generativos/festin
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1485
animated: false
techniques: [voronoi-delaunay, grid, dots-stippling, lines-hatching]
primitives: [ellipse, shape]
palette:
  colors: ["#333A95", "#F6C806", "#F789CA", "#188C61", "#1E9BF3"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: pointCount, default: 120, tried: [40], change: large, effect: "lower = far larger, sparser triangles, mostly empty dark canvas"}
  - {name: solidProb, default: 0.12, tried: [0.5], change: large, effect: "higher = many more solid-colour triangles filling the mesh"}
  - {name: hatchProb, default: 0.04, tried: [0.2], change: large, effect: "higher = many more black/white striped triangles, now dominating"}
  - {name: webAlpha, default: 40, tried: [120], change: moderate, effect: "higher = grey triangulation web clearly visible across canvas"}
  - {name: minDist, default: 10, tried: [30], change: large, effect: "higher = fewer points kept, larger sparser triangles, more empty regions"}
reusable_candidates:
  - {name: poissonPoints, signature: "poissonPoints(count, minDist, snapX, snapY, w, h) -> PVector[]", note: "random points snapped to a grid with min-distance rejection"}
  - {name: delaunay, signature: "delaunay(points) -> Triangle[]", note: "Delaunay triangulation of a point set (triangulate lib)"}
  - {name: hatchedTriangles, signature: "hatchedTriangles(triangles, prob, steps, offset) -> void", note: "stamp offset black/white triangle copies for a striped look"}
---

## What it draws
A near-black canvas covered by a faint dark-grey triangulation web. A loose diagonal
cluster of bright triangles — yellow, pink, green, blue, indigo — sits mostly in the
centre and a few scattered corners. Several triangles are filled with dense
black-and-white diagonal stripes. Tiny coloured dots mark triangle centroids and the
source vertices.

## How the code works
`setup()` calls `generate()` once (line 23); `draw()` is empty, so the image is static.
- Lines 60-75: place up to 120 random points across the 960x960 canvas, snapped to a
  40x5 px grid (`x -= x%40`, `y -= y%5`), rejecting any point within 10 px of an
  existing one (Poisson-like dispersion).
- Line 78: Delaunay-triangulate the points with the `triangulate` library.
- Lines 81-88: for every triangle, compute the centroid and draw a 4 px dot in a random
  palette colour plus a 2 px black dot on top.
- Lines 90-98: one `beginShape(TRIANGLES)` pass with a faint `stroke(0,40)` and
  `fill(random(255), random(40))` — near-transparent light-grey fills that form the
  ghostly web across the whole canvas.
- Lines 100-110: `noStroke`; ~12% of triangles (`random(1) > 0.12`) are filled with a
  solid random palette colour, and their third vertex is lerped 50% toward white so the
  triangle fades to white along one edge.
- Lines 112-125: ~4% of triangles (`random(1) > 0.04`) are stamped 30 times with a small
  offset (`dx,dy` scaled by 0.4) alternating fill black(0) and near-white(250) — this
  produces the black-and-white striped triangles.
- Line 125: `endShape()` closes the single big TRIANGLES shape.
- Lines 127-131: draw a 3 px palette-coloured dot at every source point (vertex).
- `rcol()` (143-145) picks a random palette colour.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| points_40 | `for (int i = 0; i < 120; i++) {` -> `... i < 40 ...` | large (0.174) | far fewer, much larger triangles; sparse, mostly empty dark canvas, only a handful of coloured and 2 striped triangles | variants/points_40/frame_00001.png |
| solidProb_0.5 | `if (random(1) > 0.12) continue;` -> `> 0.5` | large (0.337) | many more solid colour triangles scattered across the mesh; noticeably more colour and busier overall | variants/solidProb_0.5/frame_00001.png |
| hatchProb_0.2 | `if (random(1) > 0.04) continue;` -> `> 0.2` | large (0.247) | far more black/white striped triangles, now covering large areas and dominating the composition | variants/hatchProb_0.2/frame_00001.png |
| webAlpha_120 | `fill(random(255), random(40));` -> `random(120)` | moderate (0.059) | the grey triangulation web is now clearly visible across the whole canvas; colours and hatching otherwise unchanged | variants/webAlpha_120/frame_00001.png |
| minDist_30 | `if (dist(x, y, o.x, o.y) < 10) {` -> `< 30` | large (0.209) | points pushed apart -> fewer kept, larger triangles, more empty black regions, fewer coloured triangles, web more visible at edges | variants/minDist_30/frame_00001.png |

## Modularisation notes
The point generator (lines 60-75) is generic — count, min-distance and grid snap are all
knobs. The triangulation is the library call. The four drawing passes over the triangle
list (grey web, sparse solid fills, hatched copies, vertex dots) are each self-contained
and parameterised by a probability/count, so they map cleanly to library functions taking
a `Triangle[]` plus a small options object (probability, step count, offset, palette).
A clean parameter object would hold: pointCount, minDist, gridSnap, webAlpha,
solidProb, hatchProb, hatchSteps, hatchOffset, and the palette list.
