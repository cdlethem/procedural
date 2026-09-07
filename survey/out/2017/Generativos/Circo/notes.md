---
sketch: 2017/Generativos/Circo
year: 2017
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1553
animated: false
techniques: [3d-mesh, polar]
primitives: [shape]
palette:
  colors: ["#EBB858", "#EEA8C1", "#D0CBC3", "#87B6C4", "#EA4140", "#5A5787"]
  selection: lerp-between
composition: radial
parameters: []
reusable_candidates:
  - {name: getColor, signature: "getColor(v, palette) -> color", note: "lerps between adjacent palette colors, wrapping (v mod len)"}
  - {name: randomBisect, signature: "randomBisect(startHeight, splits) -> float[]", note: "repeatedly bisect a random entry of a list of segment heights, sum preserved"}
  - {name: polarRing, signature: "polarRing(radius, segments, zProfile, colorRamp) -> void", note: "draws a 3D ring of flat radial quads from a z-height profile"}
---

## What it draws
A near-black canvas with a single 3D ring (annulus band) seen through strong perspective. The ring
is made of many flat, radially arranged segments in muted pinks, reds/salmon, dusty blue, purple and
tan; the colors cycle smoothly around the ring. Because the camera sits near the ring's radius, the
far side of the band compresses into a dense, fine-striped funnel converging toward the center, and
the near and far openings of the ring read as two black oval holes. A faint checkerboard shading
alternates across the segment faces.

## How the code works
`setup()` calls `generate()` once (line 6); `draw()` is empty, so the image is static. In
`generate()`: `background(10)` (line 25) sets the near-black ground; a random field of view
`fov = PI/random(1.01, random(1, 2.6))` (line 27) drives `perspective()` (line 29), so the
foreshortening varies per seed; the scene is translated to center (line 30) and rotated randomly
about Z, X, Y (lines 39-41). `radius = width*random(1., 1.8)` (line 33) makes the ring much larger
than the canvas, so the viewpoint is at/near the ring itself. `hh = width*random(3, 6)` (line 32)
is the band's z-thickness. The band's z-profile is built from one full-height band (line 44,
`hr*2 = 256`) split by `div = int(random(80))` random bisections (lines 45-54), giving a
variable number of bands of different heights whose sum is preserved. For each band (lines
59-101) a per-band color offset `ic` and slope `dc = 3 + (6/res)*int(random(7))` (lines 61-62)
are chosen; then for each of `res = 128` angular steps (line 66) a flat quad spanning
`(x1,y1,z1)-(x1,y1,z2)-(x2,y2,z2)-(x2,y2,z1)` (lines 77-82) is filled with
`getColor(dc*i+ic)` (line 76), which lerps between adjacent colors of the 6-color palette
(lines 109-115), so hue progresses steadily around the ring. A second two-triangle overlay per
step (lines 91-98) fills alternately with `fill(0, 0)` / `fill(0, 20)` and `stroke(255, 40)`,
adding the faint checkerboard shading and hairlines. Randomness enters via fov, radius,
rotation, split count `div`, and per-band `ic`/`dc`; with a fixed seed the result is
deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic: `getColor` (lerp-between-palette sampler, lines 109-115) is directly reusable; the
random-bisection of the height list (lines 43-54) is a reusable "random subdivision" primitive
(sum-preserving); the per-band loop that emits radial quads from a z-profile (lines 59-101) is
the core of a `polarRing(radius, segments, zProfile, colorRamp)` generator. One-off art
decisions: the specific 6-color palette, the extreme radius (1.0-1.8 x width) that puts the
camera at the ring, the random fov range, the near-invisible checkerboard overlay
(fill alpha 0/20, stroke 255/40), and background(10). A clean parameter object:
`{radius, bandThickness, segments, splitCount, colorOffset, colorSlope, fov, rotation,
palette, checkerAlpha}`.
