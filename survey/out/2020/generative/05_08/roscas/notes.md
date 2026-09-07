---
sketch: 2020/generative/05_08/roscas
year: 2020
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 2408
animated: false
techniques: [voronoi-delaunay, packing, grid]
primitives: [line, ellipse]
palette:
  colors: ["#DD1616", "#72522A", "#EDF4F9", "#EA9FB6", "#202DA3", "#FAFAFA", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: poissonPackedPoints, signature: "poissonPackedPoints(width, height, seedCount, gapMul, ringMul) -> PVector[]", note: "place N non-overlapping grid-snapped seed points by rejection sampling, then densify in an annulus around each seed to form radial clusters"}
  - {name: sketchyDelaunayMesh, signature: "sketchyDelaunayMesh(points, passes, jitterAmp, strokeColor, alpha, weight) -> void", note: "Triangulate.triangulate + redraw the mesh with multiple accumulating random-vertex-jitter passes for a hand-drawn, layered line look"}
---

## What it draws
An off-white (near-white) canvas filled edge to edge with a dense web of thin, faint dark-gray
lines forming a Delaunay triangle mesh. The mesh is much denser in several radial "fan" /
umbrella-shaped clusters (many thin lines radiating from a small solid black center dot) and looser
with large triangles in the open areas between clusters. A few small solid black dots mark the
cluster centers and are scattered at point positions. The lines read as hand-drawn / sketchy, as if
the same mesh were traced several times with slight wobble. Overall it is monochrome: off-white
ground with near-black linework.

## How the code works
`settings()` (roscas.pde#13-18): 960x960 P2D, `smooth(8)`, `pixelDensity(2)`. `generate()` runs in
`setup()` and again every frame in `draw()`, but it re-seeds (`randomSeed(seed)`, `noiseSeed(seed)`,
#47-48) so the output is identical every frame (hence frames 1/10/60 are all identical).

- `background(250)` (#49) -> the off-white ground.
- Seed points (#53-70): loop `i < 60`. Each point placed at `width*random(-0.5,1.5)` x `height*random(-0.5,1.5)`
  then snapped to a 30px grid (`xx -= xx%30`, #56-57). Size `ss = width*random(random(0.01,0.1),0.6)*0.3*random(1)` (#58).
  Rejection packing: a candidate is kept only if it is not within `(ss+other.z)*0.51` (#62) of any existing point.
  This lays down the large "anchor" points that become the cluster centers.
- Cluster densification (#73-92): loop `18000*5` = 90000 trials of *small* points
  `ss = width*random(random(0.01,0.1),0.6)*0.03` (#76). A candidate is added only if it falls in the
  annulus `[(ss+other.z)*0.6, (ss+other.z)*0.8)` around some existing point (#82-87) and is not too close.
  This is what produces the dense radial "fan" clusters around the anchor points.
- `Triangulate.triangulate(points)` (#94) -> the Delaunay triangle list.
- The colored `arc(...)` block (#146-155) calls a custom `arc` (#253-268) with alphas `0` and `4`, so it is
  effectively invisible. The palette `colors[]` / `rcol()` (#276-278) therefore has **no visible effect** in the
  baseline — the output is monochrome. (The other `rcol()` calls at #140-143 fill nothing; the ellipses are commented out.)
- Main visible drawing (#203-237): `stroke(0,30)` faint near-black, `strokeWeight(1.2)`, `noFill()`.
  Outer loop `k < 4` redraws the whole triangle mesh as line strips. Each pass jitters every triangle vertex by
  `amp = sqrt(random(1))*k*random(0.6,1)` (#222) in a random direction, and the offset is applied **in place** on the
  shared `Triangle` objects (#223-234), so the displacement *accumulates* across the 4 passes. Pass 0 is exact; later
  passes are progressively more displaced -> the multi-traced, slightly "exploded", hand-drawn mesh.
- Dots (#239-250): `fill(0)`, `ellipse(xx, yy, ss*0.06, ss*0.06)` at each point -> the small black dots
  (largest at the anchor/cluster centers).

Randomness enters via the point placement (both loops) and the per-pass vertex jitter. Colour is *not*
used visibly (alpha 0/4). No blend modes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic / library-worthy: the two-stage point placement (grid-snapped non-overlapping seeds + annulus
  densification) is a reusable Poisson-disk-like "seeded packed points" generator, independent of the drawing.
  The Delaunay + multi-pass jittered redraw is a reusable "sketchy mesh" renderer (pass count, jitter amplitude,
  stroke color/alpha/weight are the knobs).
- One-off art decisions: the exact magic constants (30px grid snap, 0.51 / 0.6 / 0.8 packing multipliers,
  the `0.3` / `0.03` size scales, 4 jitter passes, `stroke(0,30)` alpha), the off-white ground, and the
  dead colored `arc` / `rcol()` code (leftover from an earlier colored version).
- A clean parameter object: `{seed, canvas, gridSnap, seedCount, seedGapMul, clusterTries, clusterSizeMul,
  clusterInnerMul, clusterOuterMul, meshPasses, meshJitterAmp, strokeAlpha, strokeWeight, dotScale,
  palette, showColorArcs}`.
