---
sketch: 2020/generative/05_08/cafa
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 5853
animated: false
techniques: [3d-pointcloud, noise-field, distortion]
primitives: [point]
palette:
  colors: ["#FFFFFF", "#FFB0D0", "#FAC261", "#F7DE20", "#B8BF34", "#D87623", "#F72C11", "#953DC4", "#003399", "#02060D"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(PVector p, float detail, float amp) -> PVector", note: "simplex-noise-driven 3D displacement of a point (def())"}
  - {name: pointBall, signature: "pointBall(x, y, z, radius, count, flatten, detail, amp, color, alpha) -> void", note: "random points on a (flattened) spherical shell, noise-displaced, drawn as POINTS"}
---

## What it draws
On a black background, dozens of soft point-cloud shapes in bright colors
(olive green, pink, purple, yellow, orange, blue, white, red). Some are dense
filled ellipses or teardrop blobs; others are thin arcs, crescents, U-shapes
and rings. The speckled grain of individual points is visible throughout, and a
faint dark-purple haze sits near the center.

## How the code works
`setup()` calls `generate()` (line 22); `draw()` calls it again every frame
(line 32), but `randomSeed(seed)`/`noiseSeed(seed)` (lines 56-57) make every
frame identical, so the sketch is effectively static. The scene is a P3D
perspective camera (fov = PI/2.6, lines 61-64) translated to center and scaled
1.8x, with `strokeWeight(0.8)` (lines 66-69). 300 balls are placed at random
positions in a cube of +/-480 px around the center (lines 70-77). Each `ball()`
(line 100) picks a base radius `s = 40*random(0.4,1.8)` (line 102) and one
random palette color at alpha 90 (line 105), then emits 20000 points (line
109): random angles `a1,a2 in [0,TAU)` define a spherical shell whose x/y
radius is `ns = s*random(1)*0.3` (flattened ellipsoid) and whose z radius is
`s` (lines 110-114). Every point is then displaced by `def()` (lines
123-128), which samples 3-D simplex noise at `det*0.2` scale and adds an
offset up to `amp` (max 200 px) — this is what stretches the shells into arcs,
teardrops and crescents. Points are drawn in one `beginShape(POINTS)`
per ball; color is constant per ball, so overlap only varies by alpha
accumulation. `box()` (line 82) is an unused variant.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `def()` is a reusable 3-D noise displacement (needs a noise scale
  and amplitude); `ball()` is a parameterizable "point ball" (center, radius,
  point count, x/y flatten factor, noise detail, amplitude, color, alpha);
  the per-ball random palette pick with alpha is a small palette helper.
- One-off art decisions: the 300-balls-in-a-cube scatter, the 1.8 scene scale
  and fov, the specific 10-color palette, the fixed 20000 points per ball.
- Clean parameter object: {ballCount, boxHalfExtent, radiusRange, pointsPerBall,
  flatten, noiseDetail, ampMax, alpha, palette, sceneScale, fov}.
