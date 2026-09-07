---
sketch: 2020/generative/05_08/ficall
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 5621
animated: false
techniques: [3d-pointcloud, noise-field]
primitives: [point]
palette:
  colors: ["#060606", "#534A3B", "#6A4224", "#AC7849", "#EEE7DE"]
  selection: random-from-list
composition: scattered
parameters:
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(PVector p, float detail, float amp) -> PVector", note: "displaces a point by simplex-noise-driven spherical offset (def(), lines 119-123)"}
  - {name: pointCloudCluster, signature: "pointCloudCluster(PVector center, float size, int count, color c, float alpha) -> void", note: "N random points in a cube, displaced by a noise field, single semi-transparent colour (box(), lines 85-114)"}
---

## What it draws
A 3D point-cloud sculpture on a black ground. Dozens of dense, soft clusters of tiny semi-transparent dots form an abstract, vaguely figure-like mass in the middle of the frame: a large ash-grey/off-white cloud dominates the center, a bright off-white clump sits top-right, and rust-brown / dark-brown patches appear at the top-left, mid-right and bottom-right. The dots are so dense that each cluster reads as a smoky, sculptural volume rather than individual points.

## How the code works
- `setup()` (line 22) and `draw()` (line 32) both call `generate()`; `generate()` re-seeds `randomSeed`/`noiseSeed` (lines 56-57) every time, so every frame is identical — the sketch is effectively static despite `static_mode: false`.
- Camera: `background(0)` (line 59), `perspective()` with fov = PI/2.6 (lines 61-64), then the scene is centered and scaled 1.8× (lines 67-68), `strokeWeight(0.8)` (line 69).
- 30 clusters (lines 75-80): each `box(x, y, z)` is placed at a random (x, y, z) within ±25% of the canvas size (line 70, `d = 0.25`).
- `box()` (lines 85-114): cluster half-size `s = 40*random(0.4, 1.8)` (line 86, i.e. 16-72 px). It picks ONE colour per cluster via `rcol()` — a uniform random pick from the 5-colour palette (lines 138-141) — with alpha 90 (line 89), then emits 200000 points (line 92) at random positions inside a cube of half-size `s` (lines 93-95).
- `def()` (lines 119-123) is what shapes the clouds: for each point it samples `SimplexNoise` at `pos * det` (with `det = random(0.01)`, line 88) to get two angles `a1, a2` (scaled by TAU*2) and an amplitude `noise * 100`, then offsets the point by the spherical vector `(cos a1 cos a2, sin a1 cos a2, sin a2) * amp`. The high-frequency, per-point noise scatters each cube into an organic, noise-carved cloud.
- The `else` branch (lines 100-111, 20000-point spherical shell) never runs: `random(1) < 1` (line 91) is always true.
- Colour: palette is near-black `#060606`, dark brown `#534A3B`, brown `#6A4224`, tan `#AC7849`, off-white `#EEE7DE` (line 138); the `getColor()` lerp variants (lines 143-153) are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic / library candidates**: `def()` is a self-contained 3D noise-displacement field (`noiseDisplace(p, detail, amp)`); `box()` is a parameterised point-cloud cluster generator (center, half-size, point count, single colour + alpha, displacement field). The `colors[]` + `rcol()` pair is a standard random-from-list palette.
- **One-off art decisions**: the 30 clusters at ±25% placement, cube (rather than spherical) sampling, `strokeWeight(0.8)`, alpha 90, the 1.8× view scale and fov, and this specific brown/off-white palette.
- **Clean parameter object**: `{clusterCount: 30, placeRadius: 0.25, clusterSize: 40, sizeRange: [0.4, 1.8], pointsPerCluster: 200000, noiseDetail: 0.01, displacementAmp: 100, alpha: 90, strokeWeight: 0.8, viewScale: 1.8, palette: [...]}`.
