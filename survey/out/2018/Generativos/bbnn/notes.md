---
sketch: 2018/Generativos/bbnn
year: 2018
renderer: P3D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2648
animated: false
techniques: [subdivision, 3d-mesh, grid]
primitives: [shape]
palette:
  colors: ["#FECBE0", "#FEC602", "#F29202", "#27CC8C", "#022EC2"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: sub, default: "int(random(10000))", tried: [200], change: moderate, effect: "fewer subdivision iterations -> coarser, larger tiles; mosaic smaller/sparser, dominated by a few large solid blocks in the upper-left"}
  - {name: ms_factor, default: 0.4999, tried: [0.5], change: subtle, effect: "0.4999->0.5 removes the thin grid gaps; faces meet exactly and reveal 3D overlap/edge thickness (z-fighting) on the right edge"}
  - {name: palette, default: "bright 5-color", tried: ["night 5-color"], change: moderate, effect: "swap to the dark blue/gray/black night palette; same layout, all tiles recoloured"}
  - {name: camz, default: "-width*3", tried: ["-width*1"], change: none, effect: "no visible change; orthographic projection is insensitive to camera distance"}
  - {name: init_size, default: "width*random(1,3)", tried: ["width*0.5"], change: moderate, effect: "half initial size -> smaller mosaic compacted to the upper-left, more visible 3D depth and z-fighting/flicker on the faces"}
reusable_candidates:
  - {name: octreeSubdivide, signature: "octreeSubdivide(seed, iters) -> Box[]", note: "start from one box; each iter replace a random box with 8 half-size octant children (volume-conserving, non-uniform depth)"}
  - {name: drawPartialCube, signature: "drawPartialCube(x,y,z,s,faces) -> void", note: "draw N of 6 cube faces at random axis signs; 0.4999 shrink gives gapped mosaic grid"}
  - {name: randomPaletteColor, signature: "rcol(colors[]) -> int", note: "uniform random pick from a fixed colour list"}
---

## What it draws
A large mosaic of flat square tiles of varying sizes, tilted in 3D space, filling the upper-left ~60% of the canvas. Tiles are flat-coloured from a 5-colour set (pale pink, bright yellow, orange, green, blue) with faint dark grid lines between them. The mosaic has a notched, jagged lower-right edge; the rest of the canvas is a dark navy background. With seed 42 it reads as a single tilted plane of patchwork squares rather than an obviously volumetric object.

## How the code works
Static P3D sketch: `setup()` sizes 3250x3250 (line 4), calls `generate()` once, saves and exits (lines 7-11). `draw()` does nothing, so there is no animation.

`generate()` (lines 81-120): dark navy background `#00033D` (82), orthographic camera (84), `noStroke()` then a faint black stroke alpha 40 (87-88). The scene is pushed to `z=-width*3` (90) and given three independent random rotations `rotateX/Y/Z(random(TAU))` (91-93) — this is what tilts the whole structure into a slanted plane under the ortho projection.

Structure: start with one box at the origin sized `width*random(1,3)` (96). The `sub` loop runs a random count up to 10000 (98); each iteration picks a random box, replaces it with 8 child boxes at the 8 octant corners — each child centred at `±s/4` and sized `s/2` (103-111) — then removes the parent (113). This is a volume-conserving octree subdivision; the random box choice and random iteration count give non-uniform subdivision depth, hence tiles of widely varying sizes.

Rendering (116-119) calls `Box.show()` for every surviving box. `show()` (37-78) translates to the box position, draws the face at half-size `ms=s*0.4999` (38 — the 0.4999 shrink leaves thin gaps that read as grid lines), picks three random face signs `v1/v2/v3` (42-44), fills with one random palette colour `rcol()` (46), and draws three quads — one per axis (48-65); the fourth face block is commented out (67-75). `rcol()` (129-131) returns a uniform random colour from the 5-colour `colors[]` (128). The notched/jagged edge is the boundary of the surviving boxes combined with the per-box random face choice.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_200 | `int sub = int(random(10000));` -> `int sub = 200;` | moderate | coarser, larger tiles; mosaic smaller/sparser, dominated by a few large solid blocks in the upper-left | variants/sub_200/frame_00001.png |
| gap_0.5 | `float ms = s*0.4999;` -> `float ms = s*0.5;` | subtle | subtle: same layout/colours, grid gaps gone; faces meet exactly and reveal 3D overlap/edge thickness (z-fighting) on the right edge | variants/gap_0.5/frame_00001.png |
| palette_night | `colors[] = {#FECBE0,#FEC602,#F29202,#27CC8C,#022EC2}` -> `{#0F101E,#11142B,#28398B,#323E78,#4254A3}` | moderate | same layout, all tiles recoloured to the dark blue/gray/black night palette | variants/palette_night/frame_00001.png |
| camz_1 | `translate(0,0,-width*3);` -> `translate(0,0,-width*1);` | none | no visible change (orthographic projection ignores camera distance) | variants/camz_1/frame_00001.png |
| init_0.5 | `new Box(0,0,0,width*random(1,3));` -> `new Box(0,0,0,width*0.5);` | moderate | smaller mosaic compacted to the upper-left, more visible 3D depth and z-fighting/flicker on the faces | variants/init_0.5/frame_00001.png |

## Modularisation notes
- **Generic / library-worthy:** the octree subdivision (start from one box, repeatedly replace a random box by 8 half-size octant children) is a clean reusable structure generator — `octreeSubdivide(seed, iters)`. It is independent of rendering.
- **Generic / library-worthy:** `drawPartialCube` (draw a random subset of cube faces with a per-face shrink factor) is a reusable 3D-mesh primitive; the shrink factor is a natural "grid gap" parameter.
- **Generic:** `rcol()` (uniform random pick from a colour list) is a trivial but reusable palette sampler.
- **One-off art decisions:** the specific 5-colour palette, the navy background, the 3-face (not full-cube) draw, the camera at `z=-3*width` with three random rotations, and the stroke-alpha-40 outline are all authorial choices, not general structure.
- **Clean parameter object:** `{seed, initSize, subIter, msShrink, palette[], bg, camZ, rotX, rotY, rotZ, faceCount, strokeAlpha}`.
