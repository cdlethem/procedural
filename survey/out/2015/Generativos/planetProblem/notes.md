---
sketch: 2015/Generativos/planetProblem
year: 2015
renderer: P3D
size: [640, 640]
libraries: []
deterministic: false
ms_first_frame: 1564
animated: true
techniques: [3d-mesh, grid, shader]
primitives: [shape, line]
palette:
  colors: ["#141414", "#FF0000", "#00FF00"]
  selection: random-from-list
composition: centered
parameters:
  - {name: bodyCount, default: 400, tried: [100], change: none, effect: "no visible change - 2-px cubes occupy ~0.5% of pixels"}
  - {name: sphereRadius, default: "width*random(0.2,0.3)", tried: ["width*random(0.4,0.5)"], change: moderate, effect: "larger disk; red/green cube swarm sits on it, clearly visible"}
  - {name: gridSpacing, default: 20, tried: [80], change: none, effect: "no visible change - grid near-invisible (stroke 16 on background 20)"}
  - {name: bodySize, default: 2, tried: [8], change: subtle, effect: "subtle: red/green cubes read as distinct squares instead of specks"}
  - {name: bodyOffset, default: 8, tried: [30], change: none, effect: "no visible change - cubes/spokes shift slightly outward from sphere rim"}
  - {name: background, default: 20, tried: [120], change: large, effect: "mid-grey field; dark grid becomes clearly visible across the canvas"}
reusable_candidates:
  - {name: radialGrid, signature: "radialGrid(spacing, color, w, h)", note: "axis-aligned line grid drawn every frame as background"}
  - {name: orbitingBodies, signature: "orbitingBodies(count, radius, size, palette)", note: "N small boxes placed on random axes at a fixed distance from center, with a short line along each axis"}
  - {name: chromaticVignette, signature: "postShader(resolution, time) -> shader", note: "post pass: R/G/B channels offset by distance from center (chromatic smear), time-driven grain, quadratic radial darkening"}
---

## What it draws
A bright magenta sphere sits at the center of a near-black field, ringed by hundreds of tiny red and green cubes scattered around it like a swarm of satellites. Thin dark lines radiate from the center under the cubes, and a faint square grid is visible in the background. The whole image has a grainy, slightly smeared look with a darkened corner vignette. Between frame 1 and frame 60 the scene rotates slowly, so the cube swarm shifts.

## How the code works
- `setup()` (planetProblem.pde:4-11): 640x640 P3D, `smooth(8)`, loads `post.glsl` (full-screen filter) and a planet shader (loaded but `shader(splanet)` is commented out at line 33, so it is unused).
- `draw()` (13-52): `randomSeed(seed)` is re-asserted every frame (line 15), so the cube placement and sphere colour are the same sequence every frame; only the frameCount-driven rotation changes the view.
- Background grid (17-22): `background(20)` then `stroke(16)` lines every 20 px in both axes, giving the faint grid.
- Camera (24-30): translate to center, then rotateX/Y/Z by frameCount * (0.002, 0.00073, 0.00007) — very slow tumble, which is the only animation.
- Planet (32-35): `fill(random(256) x3)` — with seed 42 this comes out magenta — and `sphere(width * random(0.2, 0.3))`, i.e. radius ~128-192 px. `lights()` (line 30) gives it shading; with default light the sphere reads flat magenta.
- Swarm (37-49): loop of 400 iterations; each pushes a matrix, rotates by three `random(TWO_PI)` angles, draws `stroke(0); line(0,0,s+8,0)` (the dark spokes) then a 2-px `box` at distance `s+8`, coloured 50/50 red or green (`random(1) < 0.5`).
- Post pass (51, post.glsl:21-32): samples R/G/B at slightly different offsets scaled by `distance(uv, center)^1.1` (chromatic smear that grows outward), mixes in black grain driven by `rand(uv+time)` (time-varying), and multiplies by a quadratic radial darkening (vignette).
- `keyPressed()` (54-56): reseeds.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_100 | `for (int i = 0; i < 400; i++) {` -> `for (int i = 0; i < 100; i++) {` | none | no visible change - at 2 px the cubes occupy only ~0.5% of pixels | variants/count_100/frame_00001.png |
| sphere_0.45 | `float s = width*random(0.2, 0.3);` -> `float s = width*random(0.4, 0.5);` | moderate | sphere fills ~65% of height; red/green cubes clearly visible as a swarm on the disc | variants/sphere_0.45/frame_00001.png |
| grid_80 | `for (int i = 0; i <= 640; i+=20) {` -> `for (int i = 0; i <= 640; i+=80) {` | none | no visible change - grid is near-invisible at stroke 16 on background 20 | variants/grid_80/frame_00001.png |
| box_8 | `box(2);` -> `box(8);` | subtle | subtle: red/green cubes read as distinct ~8 px squares instead of specks | variants/box_8/frame_00001.png |
| offset_30 | `line(0, 0, s+8, 0);` + `translate(s+8, 0, 0);` -> `s+30` in both | none | no visible change - cubes and spokes sit slightly farther out from the sphere rim | variants/offset_30/frame_00001.png |
| background_120 | `background(20);` -> `background(120);` | large | mid-grey field; dark grid clearly visible across the canvas; sphere and swarm unchanged | variants/background_120/frame_00001.png |

## Modularisation notes
- One-off art decisions: the exact rotation speeds, the 50/50 red/green choice, the sphere-size range `random(0.2, 0.3)`, the background grey level.
- Clean parameter object: `{ gridSize, sphereRadius, bodyCount, bodySize, bodyColors, spokeLength, post: {smear, grain, vignette} }`.
