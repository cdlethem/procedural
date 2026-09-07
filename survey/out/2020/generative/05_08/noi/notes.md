---
sketch: 2020/generative/05_08/noi
year: 2020
renderer: P2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 5125
animated: false
techniques: [noise-field, dots-stippling, particles]
primitives: [point]
palette:
  colors: ["#C701FF", "#F14000", "#F90304", "#87E33D", "#000000", "#FFFFFF"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: pointCluster, signature: "pointCluster(cx, cy, radius, count, color, shadeWidth, alpha) -> void", note: "dense radial point cloud: points at random angle, double-random radius, jittered by a random 2D vector, colour lerped toward black/white by the jitter"}
---

## What it draws
A full-bleed granular texture: dozens of overlapping soft point clouds scattered over a flat
purple/magenta background. The clusters read as fuzzy orange-red and greenish smudges whose
edges dissolve into the purple ground, giving a noisy, stippled, almost photographic-grain
look with no crisp shapes.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static
(noiseSeed/randomSeed set from `seed`, lines 42-43; baseline `deterministic: false`).
`background(#C701FF)` (line 45) lays the purple ground. A loop over 120 clusters (line 46)
picks a random center `(cx, cy)` (lines 47-48) and a per-cluster scale `amp = random(0.15, 0.25)`
(line 49), then a base colour `col = rcol()` from the 3-colour palette
`{#F14000, #F90304, #87E33D}` (lines 81, 85-87). Each cluster draws 8000 iterations
(line 53); per iteration a random angle and a double-random distance
`width*random(random(0.2, random(0.8, 1)), 1)*amp` (line 55) place points in a
centrally-concentrated disc. An inner loop of 10 (line 58) jitters each point by
`PVector.random2D()` (line 59) and re-lerps the colour toward `#000000` by the jitter x and
toward `#ffffff` by the jitter y, scaled by `shw = 0.8` (lines 60-61), then strokes it with
alpha 90 (line 62). The result of line 57's distance-based lerp toward black is overwritten
by the inner-loop lerp, so the visible shading comes only from the per-point jitter.
`triangulate` and `toxi` are imported but never used. `pixelDensity(2)` warns as unavailable
on this display.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The whole visual is one generic block: `generate()`'s cluster loop is a pure
"scatter N dense radial point clouds with jitter-shaded colours" function — the
`reusable_candidates.pointCluster` signature above captures it, with the outer 120-loop
becoming a `count` argument. Art-specific decisions to keep outside the library: the
palette list, the purple background, the double-random radius distribution (which gives the
concentrated core), the two-step black/white jitter shading, and alpha 90. The unused
`triangulate`/`toxi` imports and the commented-out palettes are dead weight. A clean
parameter object: `{clusters, pointsPerCluster, ampMin, ampMax, jitter(shw), alpha, palette,
background}`.
