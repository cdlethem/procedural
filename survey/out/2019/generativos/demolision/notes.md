---
sketch: 2019/generativos/demolision
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: false
ms_first_frame: 1508
animated: true
techniques: [subdivision, 3d-mesh, noise-field]
primitives: [shape]
palette:
  colors: ["#F15005", "#7C8EFA", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: colors, default: "#F15005,#7C8EFA,#FFFFFF", tried: ["#00C853,#2962FF,#FFEB3B"], change: large, effect: "palette swap to green/blue/yellow; layout identical"}
  - {name: iterations, default: 500, tried: [250], change: large, effect: "fewer subdivision steps -> fewer, larger rects, coarser tiling"}
  - {name: noiseDetail, default: 2, tried: [5], change: subtle, effect: "more noise octaves; no clear visible difference at frame 1"}
  - {name: fov, default: "PI/random(1.2,3)", tried: ["PI/1.2"], change: large, effect: "wider fixed FOV -> plates loom larger, sharper vanishing point, whole view reframed"}
  - {name: tiltX, default: "HALF_PI*random(0.4,0.9)", tried: ["HALF_PI*0.2"], change: large, effect: "shallower tilt -> near top-down view, flat plane receding to a low horizon"}
  - {name: slabThickness, default: "h*0.05", tried: ["h*0.5"], change: moderate, effect: "10x thicker slabs -> chunky stacked-block towers instead of thin slabs"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(Rect seedRect, int iterations) -> ArrayList<Rect>", note: "repeatedly split one random surviving rect into 4 quadrants to build a fractal full-bleed tiling"}
  - {name: extrudeTower, signature: "extrudeTower(float x, float y, float w, float h, int levels, float wobble) -> void", note: "stack full-size thin slabs (even) and tiny cubes (odd) along Z with per-level noise rotation into a wobbly stepped tower"}
---

## What it draws
A tilted 3D view of a full-bleed field of flat plates in three flat colours — orange, periwinkle blue and white — on a near-black background. The plates are cut into a fractal patchwork of rectangles of many sizes; many of them rise into low stepped towers made of stacked slabs, so the surface reads like a shattered, extruded terrain that recedes toward the top of the frame. The whole scene is slowly rotating (animated): frame 1 and frame 60 are the same layout but at a slightly different angle.

## How the code works
`setup()` and `draw()` both call `generate()` (lines 21-34), so the scene is rebuilt every frame. `generate()` (54-148):
- Seeds RNG + noise with the `seed` field (59-60), sets a dark `background(20)`, `noStroke()`, `lights()` + `ambientLight(60,60,60)` for flat-ish shading (62-67).
- Camera (70-79): `translate(width*0.5, height*0.7)`, a random perspective `fov = PI/random(1.2,3)`, `rotateX(HALF_PI*random(0.4,0.9))` to tilt the ground plane edge-on, and a slow time-based `rotateZ(random(TAU)+time*random(-0.1,0.1))`. This is the receding 3D look and the slow animation.
- Subdivision (82-103): starts with one giant rect (`width*3`), then a 500-iteration loop: each step picks a random surviving rect, splits it into its 4 quadrants and removes the parent. Result is a recursive quad-subdivision / fractal tiling of rectangles.
- Tower extrusion (107-145): `noiseDetail(2)`, then for each final rect it computes a height `hh` from the rect size and a level count `div`; a `div*2` loop alternates a full-size thin slab `box(r.w, r.h, h*0.05)` (even `j`) with a tiny cube `box(h*0.02,...)` (odd `j`), translating up in Z and applying a small random + noise-driven rotation (`rx,ry,rz` from `noise(time)`) each level — producing wobbly stepped towers.
- Colour (113, 162-165): each rect gets `rcol()`, a uniform random pick from the 3-colour list `#F15005 / #7C8EFA / #ffffff`. `import`ed triangulate / SimplexNoise are not actually used; the built-in `noise()` drives the wobble.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| colors_greenblue | `int colors[] = {#F15005, #7C8EFA, #ffffff};` -> `{#00C853, #2962FF, #FFEB3B};` | large | palette swap to green/blue/yellow; same layout, only colours differ | variants/colors_greenblue/frame_00001.png |
| iterations_250 | `for (int i = 0; i < 500; i++)` -> `i < 250` | large | coarser tiling: fewer, larger rectangles; a big orange slab dominates the centre | variants/iterations_250/frame_00001.png |
| noiseDetail_5 | `noiseDetail(2);` -> `noiseDetail(5);` | subtle | no clear visible change at frame 1; same dense tiling as baseline | variants/noiseDetail_5/frame_00001.png |
| fov_wide | `float fov = PI/random(1.2, 3);` -> `PI/1.2;` | large | wider view: plates loom larger and recede to a sharper vanishing point; whole frame reframed | variants/fov_wide/frame_00001.png |
| tilt_topdown | `rotateX(HALF_PI*random(0.4, 0.9));` -> `HALF_PI*0.2;` | large | near top-down: flat plane receding to a low horizon, mostly blue foreground with a distant band of plates | variants/tilt_topdown/frame_00001.png |
| slab_thick | `box(r.w, r.h, h*0.05);` -> `box(r.w, r.h, h*0.5);` | moderate | thicker slabs: chunky stacked-block towers instead of thin slabs | variants/slab_thick/frame_00001.png |

## Modularisation notes
- `subdivideRects` (lines 82-103) is a clean, self-contained fractal-tiling generator: given a seed rect + iteration count it yields a set of non-overlapping quads. Generic and reusable; the only art decision is the 4-quadrant split ratio (fixed 0.5 here).
- `extrudeTower` (lines 110-145) is the distinctive art move: alternating full slab / tiny cube with per-level noise rotation. The slab/cube ratio and wobble magnitude are the tunable parameters.
- `rcol` / `getColor` (162-175) are trivial palette helpers; `getColor` does a lerp between adjacent palette colours and could be a shared `palette.lerp` utility.
- A clean parameter object for this sketch: `{ iterations, fov, tiltX (rotateX), towerLevels (div range), slabThickness (h*0.05), wobble (noise rotation), palette[] }`. The camera block (70-79) is the biggest single visual lever (tilt + fov).
