---
sketch: 2020/generative/05_08/balcon
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2716
animated: false
techniques: [3d-pointcloud, noise-field, distortion, 3d-mesh, polar]
primitives: [point, shape]
palette:
  colors: ["#382F30", "#B11D1B", "#EDDCE2", "#E46517"]
  selection: lerp-between
composition: centered
parameters: []
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(PVector p, float det, float scale) -> PVector", note: "simplex-noise-driven 3D displacement of a point (def()); note: its `amp` argument is unused, scale is hardcoded to 200"}
  - {name: spherePoints, signature: "spherePoints(count, radius) -> PVector[]", note: "uniform random points on a sphere via two random angles"}
  - {name: paletteLerp, signature: "paletteLerp(float[] colors, float v) -> int", note: "maps scalar v to adjacent palette colours lerped with pow(t, 0.6)"}
---

## What it draws
The view is from inside a large cube looking at its interior walls, like a balcony
looking down an empty room. The three visible walls are flat, semi-transparent panels
in pale pink and muted orange, set against a pale pink background; a small white
quadrilateral (background seen through the transparent near wall) sits in the middle.
A very dense cloud of hundreds of thousands of tiny points fills the box: a dark
maroon lumpy mass in the centre, with a broad red-and-orange tendril sweeping to the
lower right, fading into sparse speckle that covers the whole wall.

## How the code works
- `settings()` (balcon.pde:13-18): 960x960 P3D, `smooth(8)`, `pixelDensity(2)`
  (silently unavailable on the headless display).
- `setup()` (line 20) and `draw()` (line 30) both call `generate()`, which starts with
  `randomSeed(seed)`/`noiseSeed(seed)` (lines 47-48), so every frame is bit-identical:
  the sketch is effectively static.
- Camera (lines 52-70): perspective with `fov = PI/1.14`, camera distance
  `(height/2)/tan(fov/2)`, then translate to centre and small random rotations
  `rotateX/Y(±random(0.45))`, `rotateZ(±random(0.45)*4)` — this is why the cube looks
  tilted and the near wall is open.
- Cube (lines 58-110): `size = width*2`; `beginShape(QUADS)` builds 6 faces. Each face
  is two quads: the back half (z = -size*0.5) filled `rcol()` (random palette colour)
  with random alpha, the front half alpha 0 (invisible). That produces the flat
  pale-pink/orange wall panels and the white gap.
- Point cloud (lines 112-145): 2 passes x 400,000 points. Each point is sampled on a
  sphere (random `a1 in [0,TAU)`, `a2 in [0,PI)`, radius `amp*ss` with `amp = 0.7`,
  `ss = size*0.5`), then displaced 4 times by `def()` (lines 161-168): an offset in
  direction (a1, a2) from `SimplexNoise(x*det, y*det, z*det)` with magnitude
  `noise(z*det, x*det, z*det)*200`. The `det` values are `random(0.002)*0.4` (fine
  noise) and the `amp1/2/3` parameters passed in are **not used** inside `def()` —
  displacement scale is fixed at 200.
- Colour (line 141): `stroke(getColor(a1*m2 + a2*m1), random(200, 255))`. `getColor(v)`
  (lines 186-192) wraps `v` modulo the palette length and lerps between the two
  neighbouring palette colours with `pow(v%1, 0.6)`, so hue follows the point's
  original spherical angles, scaled by `m1/m2 in [0.5, 1.5]`.
- Palette (line 177): `#382F30` (dark maroon), `#B11D1B` (red), `#EDDCE2` (pale pink),
  `#E46517` (orange). Background and wall panels pick a single random palette colour
  each (`rcol()`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `def()` noise displacement (parameterize the hardcoded 200, drop the dead
  `amp` argument), the sphere point sampling, and `getColor()` palette lerp. Together
  they form a "displaced 3D point cloud" primitive: sample N points on a sphere,
  displace with k noise octaves, colour by a scalar function of the original angles.
- One-off art decisions: the interior-cube framing (rotated perspective camera +
  semi-transparent back walls), the specific 4-colour palette, and the 2x400k density.
- A clean parameter object: `{seed, pointCount, passes, sphereRadius(=0.7), det[],
  dispScale(=200), m1, m2, rotRange, strokeAlpha, palette, boxScale(=2.0)}`.
