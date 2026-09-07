---
sketch: 2018/Generativos/reretete3
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2175
animated: false
techniques: [subdivision, grid, 3d-mesh, noise-field, shader]
primitives: [rect]
palette:
  colors: ["#303a52", "#574b90", "#9e579d", "#fc85ae"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(200)*random(0.1,1))", tried: [180], change: large, effect: "more, smaller tiles; busier mosaic"}
  - {name: max, default: 20, tried: [80], change: large, effect: "fewer, larger tiles; more flat open areas"}
  - {name: ss, default: 4, tried: [8], change: large, effect: "coarser voxel cell; chunky pixelated texture"}
  - {name: extrusionHeight, default: "min(r.w,r.h)*random(1,8)*0.5", tried: ["*random(1,2)*0.5"], change: large, effect: "flatter, lower extrusions; more black background visible"}
  - {name: noiseDetail, default: 0.02, tried: [0.1], change: large, effect: "coarser noise; broad smooth rolls instead of fine streaks"}
  - {name: rotateX, default: -PI/6, tried: [-PI/3], change: large, effect: "steeper top-down view; more tile tops visible"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(seed, iters, minSize) -> Rect[]", note: "recursive quad-split of one big rect into a mosaic"}
  - {name: noiseExtrudeFrame, signature: "noiseExtrudeFrame(rect, cell, detail, height) -> boxes", note: "noise-displaced voxel shell on a rect's perimeter"}
---

## What it draws
A full-bleed, isometric 3-D mosaic of rectangular tiles. Each tile is a flat
colour patch (dark navy, indigo, magenta, pink) that is extruded upward into a
frame of small boxes whose top is bumpy and streaky, like ridged, glitchy
terrain. The whole scene is tilted from above and colour-graded to vivid
magenta/pink with a strong vignette that darkens the corners.

## How the code works
- `setup()` (line 5): `size(960,960,P3D)`, then calls `generate()`; `draw()` is
  empty (line 15) so the image is produced once and is static.
- `generate()` (line 35) seeds with `seed`, `background(0)`.
- Subdivision (lines 41-58): starts with one big rect spanning beyond the
  canvas (-0.8w..1.6w), then loops `sub` times (line 43,
  `int(random(200)*random(0.1,1))`). Each pass picks a random rect and splits
  it into 4 at a random interior point (30-70% of w and h, rounded to
  multiples of 4, line 48-51), discarding any piece below `max` (20, line 44).
  Result is a mosaic of non-overlapping rects covering the plane.
- 3-D transform (lines 60-68): `ortho()`, centre, `rotateX(-PI/6)`,
  `rotateY(PI*0.2)`, pushed to z=-1000; ambient + directional light, no
  specular.
- Per rect (lines 70-99): a flat `rect()` backplate filled with a random
  palette colour (`rcol()`, line 130-133 picks from the 4-colour array). Then a
  voxel shell is built: cell size `ss=4` (line 76), extrusion height
  `h = min(r.w,r.h)*random(1,8)*0.5` (line 77). A z/y/x loop draws `box(ss-1)`
  only on the perimeter (line 87 skips the interior), and each box is pushed in
  z by `noise(...)*30` (line 91,93) so the top surface is bumpy; noise detail
  `det=random(0.02)` (line 81). ~40% of rects re-roll colour per voxel
  (`rndColor`, line 83), with 12% per-voxel re-roll (line 90).
- Post shader (line 101-102, `post.glsl`): adds 2% random grain, boosts
  brightness (1.4) and saturation (up to ~3.8 near the edges), contrast (1.9),
  and multiplies by a radial falloff `dis` that darkens toward the corners
  (vignette). The blur() in the shader is commented out.
- Randomness enters via the subdivision count/positions, the per-rect fill, the
  voxel colours, and the noise field; all seeded by `seed`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_180 | `int sub = int(random(200)*random(0.1, 1));` -> `int sub = 180;` | large (0.29, 0.83) | more, smaller tiles; busier mosaic with more varied block sizes | variants/sub_180/frame_00001.png |
| max_80 | `float max = 20;` -> `float max = 80;` | large (0.16, 0.49) | fewer, larger tiles; more flat open areas, bigger block faces | variants/max_80/frame_00001.png |
| ss_8 | `int ss = 4;` -> `int ss = 8;` | large (0.29, 0.85) | coarser voxel cell; chunky pixelated grid of big coloured squares | variants/ss_8/frame_00001.png |
| h_2 | `float h = ...*random(1, 8)*0.5;` -> `...*random(1, 2)*0.5;` | large (0.18, 0.56) | flatter, lower extrusions; more black background visible, fewer tall blocks | variants/h_2/frame_00001.png |
| det_0.1 | `float det = random(0.02);` -> `float det = random(0.1);` | large (0.17, 0.57) | coarser noise; broad smooth rolling waves instead of fine streaks | variants/det_0.1/frame_00001.png |
| rotX_PI3 | `rotateX(-PI/6);` -> `rotateX(-PI/3);` | large (0.26, 0.83) | steeper top-down view; more tile tops visible, blocks compressed vertically | variants/rotX_PI3/frame_00001.png |

## Modularisation notes
The two genuinely reusable blocks are (1) the recursive quad-subdivision that
turns one rect into a mosaic (`subdivideRects`), and (2) the noise-displaced
voxel shell on a rect perimeter (`noiseExtrudeFrame`). The `arc2` helper
(lines 110-128) and the `getColor`/`lerpColor` colour ramp (lines 134-142) are
unused dead code. The P3D camera setup, lighting, and the `post.glsl` grade are
art-specific one-offs. A clean parameter object would hold: subdivision `iters`
and `minSize`, voxel `cell` size, extrusion `height` range, `noiseDetail`,
`noiseAmp`, per-voxel colour probability, camera angles, and the palette array.
