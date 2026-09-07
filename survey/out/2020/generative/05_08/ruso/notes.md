---
sketch: 2020/generative/05_08/ruso
year: 2020
renderer: P3D
size: [720, 720]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1457
animated: false
techniques: [voronoi-delaunay, particles, lines-hatching]
primitives: [rect, line, ellipse, shape]
palette:
  colors: ["#FFFFFF", "#FFB0D0", "#F7DE20", "#245C0E", "#EB6117", "#F72C11", "#C6356B", "#953DC4", "#003399", "#02060D", "#131C26"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: clusters, default: 2, tried: [6], change: moderate, effect: "outer loop count; extra iterations add no clearly visible new clusters (small/dim/off-canvas) but shift the random stream so the existing clusters' facets change"}
  - {name: pointsPerCluster, default: 40, tried: [120], change: subtle, effect: "denser, finer triangulation - smaller facets and more thin wire lines; same silhouette"}
  - {name: size, default: 450, tried: [900], change: subtle, effect: "cluster radius doubled; left cluster fills more of the left half, mid cluster bigger"}
  - {name: w, default: 50, tried: [150], change: none, effect: "solid squares slightly larger; confined to a small area, no visible change to composition"}
  - {name: alphaMax, default: 200, tried: [60], change: none, effect: "no visible change; many overlapping semi-transparent triangles stack to similar overall opacity"}
reusable_candidates:
  - {name: triangulateScatter, signature: "triangulateScatter(cx, cy, radius, n, alphaMax) -> void", note: "scatter n points in a disc, Delaunay-triangulate, fill each tri with a random palette colour + random alpha"}
  - {name: nearestCentroidWires, signature: "nearestCentroidWires(points, centroids, alpha) -> void", note: "for each scattered point, draw a thin line to its nearest triangle centroid and a small dot at that centroid"}
---

## What it draws
A near-empty dark navy canvas (`#131C26`). Two faceted, low-poly "crystal" clusters made of
colourful semi-transparent triangles sit asymmetrically: one large cluster is cropped off the
left edge, and a much smaller, denser cluster floats in the middle-left. Each cluster is
accompanied by a small solid square (a magenta one bottom-left, a tiny orange one near the
small cluster) and a handful of thin dark wires with small dots. The dominant visible colours
are muted reds/oranges, a purple/violet, and dark teal-green against the dark background.

## How the code works
`setup()` calls `generate()` once (ruso.pde:22); `draw()` body is empty (ruso.pde:30-34) so the
piece is static. `generate()` (ruso.pde:44) sets `hint(DISABLE_DEPTH_TEST)`, re-seeds
`random`/`noise` with `seed`, and fills the background `#131C26` (ruso.pde:51). The `sky(horizon)`
call is commented out (ruso.pde:56), so sky.pde contributes nothing.

The core loop `for (i = 0; i < 2; i++)` (ruso.pde:59) builds one cluster per iteration:
- `v = random(1)`, `x = random(width)`, `y = height*lerp(0.5,1,v)`, `w = 50*v` (ruso.pde:60-63)
  place a small solid `rect(x,y,w,w)` in a random palette colour (ruso.pde:65-66). This is why
  the big `v≈1` iteration gives a large square and the small `v` iteration a tiny one.
- `y2 = lerp(height-y, height*0.5, v*0.8)` and `size = 450*v` (ruso.pde:68-69) set the cluster
  centre and radius. 40 points are scattered around (x,y2) at `random` angle `ang` and a nested
  random distance `random(random(random(1)),1)*0.5` (ruso.pde:80-86) — the nested random biases
  points toward the centre, giving a denser core and sparser rim.
- `Triangulate.triangulate(points)` (ruso.pde:88) Delaunay-triangulates them; `beginShape(TRIANGLES)`
  fills each triangle's three vertices with independent `rcol()` colours at `random(200)` alpha
  (ruso.pde:90-102). The per-vertex (not per-triangle) random colour is what makes each face a
  distinct flat facet.
- For each original point, the code finds the nearest triangle centroid (ruso.pde:105-117) and
  draws a thin `stroke(0,50)` line from the point to that centroid plus a 5px `ellipse` dot at the
  centroid (ruso.pde:123-128). These are the dark wires and small dots.

Colour is always a uniform random pick from the 10-colour `colors[]` array via `rcol()`
(ruso.pde:159-161); `getColor()`/`lerpColor` variants (ruso.pde:163-173) are defined but unused.
Randomness enters via `random()` for position, colour, and alpha (all seeded by `seed`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| clusters_6 | `for (int i = 0; i < 2; i++) {` -> `for (int i = 0; i < 6; i++) {` | moderate | still one large cropped left cluster + one small mid-left cluster; the 4 extra iterations add no clearly visible new clusters (their random `v` makes them small/dim or off-canvas) but the shifted random stream changes the visible clusters' facet shapes/colours | variants/clusters_6/frame_00001.png |
| points_120 | `for (int k = 0; k < 40; k++) {` -> `for (int k = 0; k < 120; k++) {` | subtle | same two cluster positions, but clearly denser triangulation: many more, smaller facets and more thin wire lines; the small mid-left cluster looks busier; silhouette unchanged | variants/points_120/frame_00001.png |
| size_900 | `float size = 450*v;` -> `float size = 900*v;` | subtle | clusters noticeably larger (radius doubled): left cluster now reaches further right and lower, mid cluster bigger; same facet style and rough positions | variants/size_900/frame_00001.png |
| w_150 | `float w = 50*v;` -> `float w = 150*v;` | none | solid squares slightly larger (magenta bottom-left square bigger); confined to a small area, no visible change to the overall composition | variants/w_150/frame_00001.png |
| alpha_60 | `fill(rcol(), random(200));` -> `fill(rcol(), random(60));` | none | no visible change: lowering per-vertex alpha (200->60) does not visibly fade the clusters because the many overlapping semi-transparent triangles stack to a similar overall opacity | variants/alpha_60/frame_00001.png |

## Modularisation notes
- **Reusable:** `triangulateScatter` (scatter n points in a biased disc → Delaunay → per-vertex
  random palette fill with random alpha) is a clean, generic primitive; the `nearestCentroidWires`
  overlay (point→nearest-centroid line + centroid dot) is likewise reusable as a "wire overlay".
- **One-off art decisions:** the exact 10-colour palette, the 2-iteration outer loop, the
  `size = 450*v` / `w = 50*v` coupling that ties cluster radius and square size to the same random
  `v`, the `#131C26` background, and the unused `def()` Simplex-noise displacement helper
  (ruso.pde:138-143) which suggests an intended-but-abandoned noise-warp step.
- **Clean parameter object:** `{count (clusters), pointsPerCluster, radius (size coeff),
  squareScale (w coeff), alphaMax, palette[], background, wireAlpha, seed}`.
