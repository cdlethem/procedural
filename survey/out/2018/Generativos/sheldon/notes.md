---
sketch: 2018/Generativos/sheldon
year: 2018
renderer: P3D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1532
animated: false
techniques: [3d-pointcloud, voronoi-delaunay]
primitives: [point, ellipse, line]
palette:
  colors: ["#EFF1F4", "#81C7EF", "#2DC3BA", "#BCEBD2", "#F9F77A", "#F8BDD3", "#272928"]
  selection: random-from-list
composition: centered
parameters:
  - {name: pointAttempts, default: 200, tried: [400], change: none, effect: "no visible change: 200 attempts already saturate the sphere at min-distance 30, so extra trials are rejected"}
  - {name: minDist, default: 30, tried: [60], change: none, effect: "no visible change: cluster keeps the same shape and point density within the 200-attempt budget"}
  - {name: sphereRadius, default: "width*random(0.5,0.7)*0.7", tried: ["*1.0"], change: subtle, effect: "larger sphere: fills more of the frame, points reach near the edges; same density/look, just scaled up"}
  - {name: pointStrokeWeight, default: "4*random(0.2,4)", tried: ["4*random(0.2,8)"], change: none, effect: "dots are visibly larger (a few big prominent dots) but pastel-on-white is low contrast so pixel diff stays none"}
  - {name: meshStrokeAlpha, default: 20, tried: [200], change: subtle, effect: "triangle mesh edges turn bold near-black, revealing the full low-poly wireframe; drop-lines stay faint"}
  - {name: baseFillAlpha, default: 40, tried: [150], change: none, effect: "no effect: per-vertex fill() in the mesh loop overrides this base fill"}
reusable_candidates:
  - {name: pointCloudOnSphere, signature: "pointCloudOnSphere(attempts, radius, minDist) -> PVector[]", note: "rejection-sampled points on a sphere surface keeping pairwise min distance"}
  - {name: droplineMesh, signature: "droplineMesh(points, baseZ) -> void", note: "2-D Delaunay-triangulate points, draw translucent faces + vertical drop-lines to a base plane"}
---

## What it draws
A single centred, roughly spherical cluster of pastel dots floating over a white field.
The dots vary in size and colour (teal, sky-blue, pink, yellow, mint, a few near-black),
each ringed by a thin outline circle. Behind and between them a very faint, translucent
low-poly triangular mesh fills the sphere, and faint near-vertical drop-lines run from the
points down toward a lower plane, giving the cluster a 3D "hanging over a surface" look.

## How the code works
`setup()` (sheldon.pde:5) calls `generate()` once; `draw()` is empty (lines 15-16) so the
sketch is static. `generate()` (line 26):
- Seeds `randomSeed`/`noiseSeed` from `seed` (lines 28-29), white `background(255)` (line 30).
- Centres the view with `translate(width*0.5, height*0.55, -100)` and adds tiny random
  `rotateX/Y/Z` in [-0.1, 0.1] (lines 32-35).
- Point cloud (lines 40-69): up to 200 attempts, each point on a sphere of radius
  `r = width*random(0.5,0.7)*0.7` (line 40) via spherical angles (lines 44-46); kept only if
  >= 30 units from every previously kept point (rejection, lines 48-55). Each kept point is
  drawn as a filled `point` with random weight `4*random(0.2,4)`, alpha 240 (lines 58-60),
  plus a 12px outline `ellipse` ring at the same spot (lines 62-67).
- The kept points are 2-D Delaunay-triangulated with `Triangulate.triangulate` (line 77).
- Mesh pass 1 (lines 83-96): translucent random-colour triangles, per-vertex fill alpha < 30
  (the base `fill(255,40)` at line 84 is overridden per vertex). Mesh pass 2 (lines 99-110)
  sparsely redraws a few triangles pushed to `z*0.9`.
- Drop-lines (lines 113-121): for every triangle vertex a near-black (alpha 4) line from
  (x,y,z) down to (x,y,0) — the hanging filaments.
- Colour is always `rcol()` = random index into the 7-colour `colors[]` (lines 131-132);
  `getColor()` (a lerp variant) is defined but unused.
- All randomness is seeded from `seed` → deterministic for a given seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_400 | `for (int i = 0; i < 200; i++) {` -> `for (int i = 0; i < 400; i++) {` | none | no visible change; 200 attempts already saturate the sphere at min-distance 30, so extra trials are rejected | variants/count_400/frame_00001.png |
| mindist_60 | `if(dist(xx, yy, zz, o.x, o.y, o.z) < 30){` -> `< 60){` | none | no visible change; the cluster keeps the same shape and point density | variants/mindist_60/frame_00001.png |
| radius_1.0 | `float r = width*random(0.5, 0.7)*0.7;` -> `... *1.0;` | subtle | sphere is noticeably larger: fills more of the frame, points reach near the edges; same point density and look, just scaled up | variants/radius_1.0/frame_00001.png |
| strokeWeight_8 | `strokeWeight(4*random(0.2, 4));` -> `... 0.2, 8));` | none | dots are visibly larger (several big prominent dots) but pastel-on-white is low contrast, so the pixel diff stays none | variants/strokeWeight_8/frame_00001.png |
| triStroke_200 | `stroke(0, 20);` -> `stroke(0, 200);` | subtle | the faint triangle mesh edges become bold near-black, revealing the full low-poly wireframe over the point cloud; drop-lines stay faint | variants/triStroke_200/frame_00001.png |
| fillAlpha_150 | `fill(255, 40);` -> `fill(255, 150);` | none | no visible change (pixel-identical): the per-vertex `fill(rcol(), random(30))` inside the mesh loop overrides this base fill | variants/fillAlpha_150/frame_00001.png |

## Modularisation notes
Generic, reusable blocks:
- `pointCloudOnSphere`: the rejection-sampled spherical sampler (lines 40-57) is fully
  parameterised by attempts / radius / min-distance and is the cleanest candidate for a
  library fn. Note it saturates: at min-distance 30 the sphere fills within ~200 attempts, so
  raising the attempt count has no effect (confirmed by count_400 = none).
- `droplineMesh`: triangulate + translucent faces + drop-lines-to-base (lines 77-121) is a
  self-contained "mesh over a plane" effect, parameterisable by base-Z, line alpha, face alpha.

One-off art decisions: the fixed 7-colour pastel palette, the tiny random per-view tilts, the
two-pass face drawing (incl. the `z*0.9` pass), and the 12px ring outline on every point.
Also note the base `fill(255,40)` at line 84 is dead code — the per-vertex `fill()` in the
mesh loop always overrides it (fillAlpha_150 = none).

A clean parameter object would hold: point attempt count, sphere radius scale, min-distance,
point-size range, palette, per-point alpha, face fill alpha, mesh stroke alpha, drop-line
alpha, base plane Z, and view tilt.
