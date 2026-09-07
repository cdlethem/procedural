---
sketch: 2018/Generativos/floripanos
year: 2018
renderer: P3D
size: [960, 960]
libraries: [triangulate]
deterministic: false
ms_first_frame: 1661
animated: true
techniques: [3d-pointcloud, polar]
primitives: [line]
palette:
  colors: ["#FF0000", "#EFF1F4", "#81C7EF", "#2DC3BA", "#BCEBD2", "#F9F77A", "#F8BDD3", "#272928"]
  selection: fixed
composition: centered
parameters:
  - {name: radiusScale, default: 0.4, tried: [0.7], change: subtle, effect: "sphere slightly larger, bristles reach further; same structure"}
  - {name: bristleLen, default: 100, tried: [40], change: none, effect: "no visible change (shorter bristles still overlap the dense core)"}
  - {name: strokeColor, default: "#FF0000", tried: ["#FFFFFF"], change: subtle, effect: "hue shifts red to white/grey; low alpha (60) keeps contrast small"}
  - {name: minDist, default: 2, tried: [8], change: none, effect: "no visible change"}
  - {name: attempts, default: 8000, tried: [2000], change: none, effect: "no visible change (8000 attempts already saturates the hemisphere)"}
reusable_candidates:
  - {name: poissonSphere, signature: "poissonSphere(r, attempts, minDist) -> PVector[]", note: "rejection-sample points on a hemisphere with a minimum 3-D separation (O(n^2) distance test)"}
  - {name: radialBristles, signature: "radialBristles(points, len, color, alpha) -> void", note: "at each point, rotate to its heading and draw a line of length len outward in the radial (xy) direction"}
---

## What it draws
A centred sea-urchin-like starburst of translucent red lines on a near-black background.
Frame 1 shows the mass edge-on as a half-disc of fine bristles (a hemisphere seen from
the side); by frame 60 the mass has rotated to face the viewer and reads as a full
circle of lines radiating outward from the centre, densest near the middle and thinner
at the rim. Dominant colour: dark red on black, brightening slightly where lines overlap.

## How the code works
- `setup()` (l.5): `size(960,960,P3D)`, `smooth(8)`, `pixelDensity(2)`; calls `generate()`.
- `draw()` (l.15) calls `generate()` every frame, so the piece animates.
- `generate()` (l.27): re-seeds random/noise from the fixed `seed` (l.31-32),
  `background(5)` (near black).
- Global transform (l.35-38): translate to centre with `z=-100`, then `rotateX/Y/Z` by a
  small random offset plus `time*random(-1,1)` where `time = millis()` (l.29). `millis()`
  is not seedable, so the rotation differs every run — this is why the sketch is
  non-deterministic and why frames 1/10/60 differ (the mass slowly rotates and tumbles).
- Point sampling (l.43-62): `r = width*random(0.5, 0.7)*0.4` (≈117-166 px). 8000 attempts
  (l.44); angles `a1,a2` uniform in `[0, PI]` give the spherical position
  `(cos a1 cos a2 r, cos a1 sin a2 r, sin a1 r)` (l.45-49). Since `a1 ∈ [0, PI]`, `z ≥ 0`:
  only the upper hemisphere is sampled. Each candidate is rejected if within 2 px (3-D
  `dist`) of any accepted point (l.52-58) — a Poisson-disc-like rejection, O(n²).
- Bristles (l.62-82): for each accepted point, `translate` to it, `rotate(p.heading())`
  (z-axis rotation aligning local +x with the point's radial direction in the xy-plane),
  then `line(0,0,0,100,0,0)` with `stroke(255,0,0,60)` (l.71-73). The result is a 100 px
  translucent red bristle sticking out radially from each surface point; in projection
  these read as lines radiating from the disc centre.
- The "petal" loop (l.75-81: `cc = random(10,28)` spokes around `rr = 60`) has its only
  drawing line commented out (l.80), so it produces nothing.
- The palette array and `getColor()` lerp helpers (l.99-113) are never used by the draw
  path; the actual stroke is the fixed semi-transparent red at l.71.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| radius_0.7 | `float r = width*random(0.5, 0.7)*0.4;` -> `... *0.7;` | subtle | subtle: sphere slightly larger, bristles reach further; same overall structure | variants/radius_0.7/frame_00001.png |
| bristleLen_40 | `line(0, 0, 0, 100, 0, 0);` -> `line(0, 0, 0, 40, 0, 0);` | none | no visible change | variants/bristleLen_40/frame_00001.png |
| stroke_white | `stroke(255, 0, 0, 60);` -> `stroke(255, 255, 255, 60);` | subtle | subtle: bristles read white/grey instead of red; low alpha keeps the shift muted | variants/stroke_white/frame_00001.png |
| mindist_8 | `if (dist(xx, yy, zz, o.x, o.y, o.z) < 2) {` -> `... < 8) {` | none | no visible change | variants/mindist_8/frame_00001.png |
| attempts_2000 | `for (int i = 0; i < 8000; i++) {` -> `... i < 2000; ...` | none | no visible change | variants/attempts_2000/frame_00001.png |

Caveat: `deterministic: false` — the `millis()`-based rotation gives every run a different
frame-1 orientation, so small pixel differences are partly random-orientation noise; per
the observation discipline only the scores and clearly identifiable changes (stroke_white
hue shift) are reported.

## Modularisation notes
- Generic: the hemisphere Poisson-disc sampler (radius, attempts, min distance) and the
  radial-bristle renderer (points, bristle length, colour, alpha) are reusable as the
  library functions listed in the frontmatter. The `getColor()` lerp palette helper is
  generic too but unused here.
- One-off art decisions: fixed red `stroke(255,0,0,60)`, bristle length 100, the
  time-driven global tumble, and the disabled petal loop.
- A clean parameter object: `{ radius, attempts, minDist, bristleLen, strokeColor,
  strokeAlpha, rotateSpeed }` plus a seed; the `millis()`-based rotation should be
  replaced by a seedable time parameter to make renders deterministic.
