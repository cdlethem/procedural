---
sketch: 2019/generativos/culin
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 4217
animated: false
techniques: [grid, dots-stippling, distortion]
primitives: [point]
palette:
  colors: ["#141414", "#FEE6DC"]
  selection: fixed
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: attractorField, signature: "attractorField(n, maxRadius, pull) -> PVector[]", note: "n random attractors snapped to a grid, each with a random influence radius"}
  - {name: pullStipple, signature: "pullStipple(points, step, alpha, weightFn) -> void", note: "per-pixel pull toward nearest active attractor + faint point, density forms blobs and depletion rings"}
---

## What it draws
A near-black (dark gray) square covered in extremely fine grain. A few soft, mottled warm off-white patches glow through the darkness, each ringed by a crisp dark circle. The bright patches are patchy and blurry, like light seen through frosted glass; the dark rings are the sharpest features in the image.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (frames 1/10/60 identical).
- `generate()` (culin.pde:46) seeds random/noise, fills background with `background(20)` (dark gray, :51).
- 30 attractor points (:58-69): each placed at a random position snapped to a 60px grid offset by 30px (:62-65), each with a random influence radius `ss = random(600)` stored in the z component (:67-68).
- A double loop steps over every 0.5px of the canvas (:76-77, ~3.6M samples). For each sample, every attractor is checked: if the sample is within the attractor's radius, the sample position is lerped toward the attractor by a random factor `random(1-v*0.3, 1)` where `v = dis/p.z` (:84-87) — i.e. points near the radius edge are pulled in hardest, depleting the band just inside each circle. An angle `a` is computed (:88-92) but only used in a commented-out colour line (:95); it has no visible effect.
- Each sample is then drawn as a `point()` with `strokeWeight(random(2))` and fixed `stroke(254, 230, 220, 10)` — a warm off-white at 4% alpha (:93-96). The visible image is pure accumulation: regions where pulled samples pile up become bright mottled blobs; the depletion bands just inside each radius read as the crisp dark rings.
- The `colors[]` array and `rcol()`/`getColor()` (:112-129) are unused by the active stroke. `detAng`/`desAng`/`detDes` (:43-55) are set but never read. `SimplexNoise` and the triangulate import are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Two reusable pieces: (1) the attractor generator — n random points snapped to a cell grid, each carrying a random radius; (2) the stipple pass — iterate a fine pixel grid, pull each sample toward every attractor inside its radius with a distance-dependent random lerp, and stamp a low-alpha point. The accumulation (low alpha, high sample count, P2D smoothing) is what turns the per-pixel pulls into soft blobs with hard-edged depletion rings; without the low alpha it would be a noise field, with it it becomes a density painting.
One-off art decisions: the specific 0.5px step, 4% alpha, 60px snap grid, radius range 0-600, pull factor 0.3, and the fixed warm stroke on a near-black ground.
A clean parameter object would be: `{n_attractors, radius_range, snap_grid, step, pull_strength, stroke_rgba, stroke_weight_range, background}`.
