---
sketch: 2018/Generativos/cubeNoises
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 20554
animated: false
techniques: [3d-pointcloud, noise-field, subdivision]
primitives: [point]
palette:
  colors: ["#A8B4CE", "#5C6697", "#352B4D", "#ED5A67", "#F389A0"]
  selection: noise-driven
composition: scattered
parameters:
reusable_candidates:
  - {name: subdivideSquare, signature: "subdivideSquare(seedRect, iterations) -> Rect[]", note: "repeatedly split a random square into 4 half-side quadrants; area-conserving 2-D subdivision"}
  - {name: noisePointCube, signature: "noisePointCube(center, side, points, densityDetail, colorDetail, palette) -> void", note: "random points in a volume, colour from 3-D noise mapped through a lerped palette, sparsified by a second noise threshold"}
---

## What it draws
On a solid coral-red background, roughly two dozen cubes of very different sizes are scattered
across the canvas, each rotated at an arbitrary 3-D angle. Every cube is built from a dense cloud
of tiny points instead of solid faces: bigger cubes read as semi-transparent glassy blocks with
mottled patches of pink, grey-blue and dark navy flowing across them, while the smallest cubes
dissolve into sparse speckles. The whole composition is flat (no shadows, no perspective depth cue
beyond the rotated silhouettes).

## How the code works
- `setup()` (L3-11): `size(960,960,P3D)`, `smooth(8)`, `pixelDensity(2)` (not available on this
  display, see `result.json` stderr), then `generate()` once; `draw()` is empty, so the piece is
  static.
- `generate()` (L25-51): `background(rcol())` picks one of the 5 palette colours at random for the
  background (coral-red `#ED5A67` here). Subdivision L32-42: start with one `PVector(0,0,width)`
  covering the whole canvas; `sub = int(random(200))` iterations pick a random square, remove it and
  add its 4 half-side quadrants. Each resulting square (L45-50) gets a `cube()` at its centre with
  side `r.z*random(0.4, 0.5)`.
- `cube()` (L53-76): translate to the centre, random `rotateX/Y/Z`. Point count
  `cc = int(pow(ss,3)*2)` (proportional to volume). For each of the `cc` points: uniform random
  position in the cube volume; colour = `getColor(noise(desc + pos*detc) * colors.length * 2)` — a
  3-D Perlin noise field drives an index into the 5-colour palette, lerped between adjacent entries
  (L94-100), which is what produces the mottled pink/blue/navy patches. A second, independent noise
  field `n(x,y,z,det,des) < 0.8` (L73) thins the cloud, and every point is drawn with alpha 80,
  giving the soft, semi-transparent look.
- Randomness: everything (`sub`, the square chosen each split, rotations, point positions, both
  noise offsets) comes from the Processing RNG, which the harness seeds (seed field `seed`), so
  baseline is deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic blocks: `subdivideSquare` (2-D quadrant subdivision, area-conserving — works for any
  seeded square and iteration count) and `noisePointCube` (point-sampled volume with noise-driven
  palette colour and noise thresholding) are both directly reusable.
- One-off art decisions: the exact 5-colour palette, alpha 80, the 0.8 thinning threshold, the
  `random(0.4, 0.5)` cube-to-square ratio, and the red-background choice via `rcol()`.
- A clean parameter object: `{canvas, subdivisions, cubeRatio, pointsPerVolume, densityDetail,
  densityOffset, colorDetail, colorOffset, thinThreshold, alpha, palette}`.
