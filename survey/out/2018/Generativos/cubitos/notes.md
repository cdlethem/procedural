---
sketch: 2018/Generativos/cubitos
year: 2018
renderer: P3D
size: [960, 960]
libraries: [peasy]
deterministic: true
ms_first_frame: 1545
animated: true
techniques: [3d-pointcloud, grid]
primitives: [point]
palette:
  colors: ["#000000", "#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: fixed
composition: centered
parameters:
  - {name: points_per_frame, default: 100000, tried: [20000], change: none, effect: "no visible change"}
  - {name: stroke_alpha, default: 60, tried: [255], change: subtle, effect: "subtle: cubes darker and denser, more solid-looking"}
  - {name: grid_cell, default: 40, tried: [20], change: none, effect: "no visible change"}
  - {name: pull, default: 0.5, tried: [0.9], change: none, effect: "no visible change"}
  - {name: range, default: 200, tried: [400], change: subtle, effect: "subtle: larger finer lattice, more spread out, fainter"}
  - {name: cam_distance, default: 400, tried: [200], change: subtle, effect: "subtle: closer camera, cubes larger on screen, stronger perspective"}
reusable_candidates:
  - {name: latticePointCloud, signature: "latticePointCloud(count, range, cell, pull) -> float[][]", note: "uniform random points in a cube, each pulled halfway toward its grid cell corner"}
---

## What it draws
A light grey background with a central 3-D lattice of small dark cubic point clusters, seen in
perspective: roughly four or five cubes per row and column, with diagonal trails of smaller cubes
receding toward the far corner. Frame 1 is a faint stipple; by frame 60 the same cubes have
accumulated into solid dark blocks, densest at the centre and near the far-left corner.

## How the code works
- `setup()` (cubitos.pde:7-14): P3D 960x960, `PeasyCam` at distance 400 (line 12). `generate()`
  (45-48) only reassigns the `seed` variable, which is never used to seed the RNG.
- `draw()` (17-31) runs every frame. `if (!render) background(255)` (19): `render` starts `true`
  (5) and is never toggled headless, so the canvas is never cleared — the 100,000 points drawn per
  frame (22) accumulate, which is why frame 60 is much darker than frame 1.
- Each coordinate (23-25) is `random(200)*random(1)-100`: a product of two uniforms gives a
  triangular distribution peaking at 0, so after the -100 shift the density peaks at the far
  corner (-100,-100,-100) and thins toward +100.
- Quantisation (26-28): `x -= (x%40)*0.5` pulls every point halfway back toward the nearest lower
  multiple of 40, concentrating points into 20-unit sub-cubes at each 40-unit cell corner. The
  resulting lattice of little cubes ("cubitos") with gaps between them is the whole composition.
- Colour: `stroke(0, 60)` (21) — black at ~24% alpha. The `colors[]` array and `rcol()`/`getColor()`
  (50-63) are defined but never called from `draw()`; the actual drawing is monochrome black.
- `keyPressed()` (33-38): 'r' toggles clearing, other keys call `generate()`; unused in the harness.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_20000 | `for (int i = 0; i < 100000; i++) {` -> `for (int i = 0; i < 20000; i++) {` | none | no visible change | variants/count_20000/frame_00001.png |
| alpha_255 | `stroke(0, 60);` -> `stroke(0, 255);` | subtle | subtle: cubes darker and denser, more solid-looking | variants/alpha_255/frame_00001.png |
| cell_20 | `x -= (x%40)*0.5;` (and y, z lines) -> `x -= (x%20)*0.5;` etc. | none | no visible change | variants/cell_20/frame_00001.png |
| pull_0.9 | `x -= (x%40)*0.5;` (and y, z lines) -> `x -= (x%40)*0.9;` etc. | none | no visible change | variants/pull_0.9/frame_00001.png |
| range_400 | `float x = random(200)*random(1)-100;` (and y, z lines) -> `random(400)*random(1)-200` | subtle | subtle: lattice larger and finer (10 cells per axis), more spread out, fainter | variants/range_400/frame_00001.png |
| cam_200 | `cam = new PeasyCam(this, 400);` -> `cam = new PeasyCam(this, 200);` | subtle | subtle: closer camera, cubes larger on screen, stronger perspective | variants/cam_200/frame_00001.png |

Note: all six variants preserve the lattice structure, and the change scores are computed against
the faint frame-1 stipple, so structural differences (finer grid, collapsed cube corners, camera
scale) read as smaller than they do in later accumulating frames.

## Modularisation notes
The generic, reusable block is the lattice point generator: uniform random points in
`[-range/2, range/2]` on each axis, each coordinate pulled a fraction `pull` toward the lower
multiple of `cell`. The triangular bias from `random(N)*random(1)` is an art decision (it makes the
far corner denser); a clean parameter object would be `{count, range, cell, pull, alpha, camDist}`.
The never-cleared accumulation (the missing `background()` call) is what turns the sparse stipple
into solid cubes — a one-off behaviour, not something to abstract. The unused colour helpers
(`rcol`/`getColor` with a lerp-between scheme) are dead code here but a reusable palette function
in their own right.
