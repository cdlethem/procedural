---
sketch: 2019/generativos/buo
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1575
animated: false
techniques: [3d-mesh, subdivision, grid]
primitives: [rect, shape]
palette:
  colors: ["#FCF949", "#A0ABB2", "#030504", "#2924B7"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "random(2,20)", tried: [5], change: moderate, effect: "fewer subdivisions = larger cells, much sparser layout"}
  - {name: cc, default: "random(10,80)*random(0.2,1)", tried: [1], change: moderate, effect: "1-3 boxes per cell = a few large flat slabs instead of dense clusters"}
  - {name: colors, default: "#FCF949,#A0ABB2,#030504,#2924B7", tried: ["#FF5500 (blue->orange)"], change: subtle, effect: "same layout; only the blue faces/window-grids recolor to orange"}
  - {name: boxGrid, default: "int(random(1,10))", tried: [14], change: none, effect: "finer window grids not perceptible (no visible change)"}
  - {name: depth, default: "r.z*0.2", tried: [1.0], change: moderate, effect: "boxes clearly deeper/taller, more 3D volume"}
  - {name: pointLight, default: "1200,1200,1200", tried: [300], change: none, effect: "no effect on render (byte-identical)"}
reusable_candidates:
  - {name: quadtreeSubdivide, signature: "quadtreeSubdivide(cells, steps) -> Cell[]", note: "split one random cell into 4 half-size quadrants, N times"}
  - {name: boxGrid, signature: "boxGrid(x,y,z,w,h,d,cw,ch,cd,gap,c1,c2,c3)", note: "a w*h*d block split into a cw*ch*cd grid of gapped sub-cubes (the 'window' look)"}
  - {name: cube, signature: "cube(x,y,z,w,h,d,c1,c2,c3)", note: "six filled quads: front/back=c1, left/right=c2, top/bottom=c3"}
---

## What it draws
A near-black field crossed by faint thin lines forming an irregular nested grid (a quadtree). At many of the grid cells' centres sit clusters of small 3D boxes: some single solid boxes, some tall "buildings" whose visible face is a grid of little window-lites (gaps between sub-cubes). Dominant colours are near-black, deep blue and pale grey, with bright yellow accents. A few clusters are large and dark (a big dark-blue box lower-left, a grey slanted structure), many are small and busy. A very bright white point light near the centre makes nearby faces glow; the rest of the scene sits in shadow. It reads as an abstract, deconstructed city seen from above at an oblique angle.

## How the code works
`setup()` -> `generate()` (buo.pde:21-52). `randomSeed`/`noiseSeed` from `seed` (harness pins it to 42; buo.pde:54-55).

- Background is `rcol()` — a random index into the 4-colour palette (buo.pde:57, 227-230); here the near-black `#030504`.
- Lighting (buo.pde:60-83): `noLights()`, one dim grey `directionalLight(80,80,80, 0,-1,0)`, a very bright white `pointLight(1200,1200,1200, 0,0,0)` at the origin (the central hot spot), and a random `lightFalloff`.
- Quadtree (buo.pde:86-102): start with one full-canvas cell `(5,5,width-10)`. `sub = int(random(2,20))` subdivision steps; each step picks a random cell, splits it into 4 half-size quadrants, and removes the parent. Yields `1 + 3*sub` cells -> the faint grid.
- Faint grid (buo.pde:106-115): `stroke(255,40)`, `strokeWeight(1)`; each cell drawn as a thin `rect` outline.
- Per-cell 3D cluster (buo.pde:118-155): `translate` to the cell centre, then a random 3D orientation `rotateX/Y/Z(random(TAU))`. `cc = int(random(10,80)*random(0.2,1))` (~2-79) cubes per cell, inside one `beginShape(QUADS)`/`endShape`.
- Each cube (buo.pde:133-152): `ww` in `[0.5,1.5]*cell`, `hh` in `[0,1]*cell`, `dd` in `[0,0.2]*cell` (shallow depth); random scale 1 / 0.5 / 0.1 (0.1 chosen 50% of the time). 60% -> one solid `cube()` with three random face colours; 40% -> `boxes()`, a window-grid of `int(random(1,10))` sub-cubes per axis with a 2-5px gap (buo.pde:158-180).
- `cube()` (buo.pde:182-218) emits six filled quads: front/back = c1, left/right = c2, top/bottom = c3.
- Colour: `rcol()` picks a random palette index (buo.pde:228-230); it also drives the background.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_5 | `int sub = int(random(2, 20));` -> `int sub = int(random(2, 5));` | moderate | much sparser: fewer, larger quadtree cells, only a few clusters (small yellow window-building, a grey slab, a small blue/yellow box); large empty areas | variants/sub_5/frame_00001.png |
| cc_1 | `int cc = int(random(10, 80)*random(0.2, 1));` -> `int cc = int(random(1, 3)*random(0.2, 1));` | moderate | each cell holds only 1-3 boxes, so clusters become a few large flat slabs/plates rather than dense clusters of small boxes | variants/cc_1/frame_00001.png |
| colors_orange | `int colors[] = {..., #2924B7};` -> `..., #FF5500};` | subtle | same layout; the deep-blue faces and blue window-grids are now orange; diff score labels it subtle | variants/colors_orange/frame_00001.png |
| boxGrid_14 | `boxes(..., int(random(1, 10)), ...)` -> `int(random(6, 14))` | none | no visible change; finer window grids not perceptible at this scale | variants/boxGrid_14/frame_00001.png |
| depth_1.0 | `float dd = random(r.z*0.2);` -> `float dd = random(r.z*1.0);` | moderate | boxes clearly deeper/taller: window-buildings and slabs gain 3D volume; the big lower-left building reads as a deep block | variants/depth_1.0/frame_00001.png |
| pointLight_300 | `pointLight(1200, 1200, 1200, 0, 0, 0);` -> `pointLight(300, 300, 300, 0, 0, 0);` | none | no visible change (byte-identical to baseline); the central point light does not alter the render | variants/pointLight_300/frame_00001.png |

## Modularisation notes
- Generic (library candidates): the quadtree subdivision (cells + step count), the `boxGrid` windowed block (axis counts + gap + 3 face colours), and the `cube` 6-quad box.
- One-off art decisions: the 4-colour palette; the random 3D rotation per cell; the 1/0.5/0.1 scale coin; the 60/40 solid-vs-window-grid mix; the bright central point light.
- Clean parameter object: `{seed, palette[], sub, ccRange, cellScaleOptions, gridResolution, depthFactor, solidFraction, lights:{dir, point, falloff}}`.
