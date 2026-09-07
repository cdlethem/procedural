---
sketch: 2018/Generativos/muritos
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1849
animated: false
techniques: [grid, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FACD00", "#FB4F00", "#F277C5", "#7D57C6", "#00B187", "#3DC1CD"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(8, 160))", tried: [32], change: moderate, effect: "lower = far fewer, much larger individual boxes; checkerboard of big colored plates instead of fine mosaic"}
  - {name: a1, default: "random(0.6, 0.95)", tried: [0.3], change: moderate, effect: "lower = the wide boxes become thin lines, wall reads as a denser comb/bristle texture"}
  - {name: a2, default: "random(0.1, 0.3)", tried: [0.55], change: moderate, effect: "higher = thin boxes fatten into near-square blocks, mosaic looks more solid/tiled"}
  - {name: mr, default: "HALF_PI*0.14", tried: [0.5*HALF_PI], change: moderate, effect: "larger tilt bound = wall seen more diagonally, stronger one-sided perspective"}
  - {name: fov, default: "PI/random(1.02, 2.6)", tried: [PI/1.02], change: large, effect: "very wide FOV crushes the wall into a small cluster with long stretched box sides radiating out"}
reusable_candidates:
  - {name: boxQuad, signature: "boxQuad(x, y, z, w, h, d, s, c1, c2) -> void", note: "custom box as 6 quads/triangles; side faces split into c1/c2 triangles giving a shaded look under lights()"}
  - {name: checkerWall, signature: "checkerWall(count, cellSize, aspectWide, aspectThin, depth, z) -> void", note: "cc x cc grid of thin boxes, checkerboard orientation (i+j)%2 swaps wide/thin dimensions"}
---

## What it draws
A single flat wall of thousands of tiny colored boxes seen in 3D perspective from an oblique angle: a dense mosaic of small yellow, red, magenta, purple, teal and cyan dashes that fills the right/bottom two-thirds of the frame, tilted diagonally, against a flat teal-green background. The dashes alternate orientation in a checkerboard pattern (wide-thin over thin-wide), giving a woven brick texture.

## How the code works
`setup()` (line 3) opens a 960x960 P3D window, calls `smooth(8)` and `pixelDensity(2)`, then `generate()` (line 22) once; `draw()` is empty, so the image is static. `generate()` paints a random palette color background (line 24, `rcol()` picks uniformly from the 6-color `colors[]` array, line 132/136), calls `lights()` (line 26), then sets up one perspective camera: random FOV between `PI/2.6` and `PI/1.02` (line 30) with the camera pushed to `cameraZ = (height/2)/tan(fov/2)` (line 31); the scene is translated to center (line 34) and randomly tilted about X and Y by at most `HALF_PI*0.14` (line 35) plus a full random Z rotation (line 38). The wall itself is a `cc x cc` grid (line 40, cc random in 8..160) of cells `ss = width*4/cc` apart (line 41); each cell holds one thin box at z = `-ss*3+200` (line 54): width/height are `ss*a1` / `ss*a2` (a1 in 0.6..0.95, a2 in 0.1..0.3, lines 42-43) and depth `ss*6`, with the dimensions swapped on `(i+j)%2==0` cells (lines 50-53) producing the checkerboard of wide vs tall dashes. Each box is drawn by a custom `box()` (line 61) that emits six quads via `beginShape()/endShape(CLOSE)`: the front face gets color c1, the back face c2 (both random palette colors, lines 62-63), and each of the four side faces is a quad whose two far vertices are c2 and two near vertices are c1 — under P3D Gouraud shading this reads as a lit side. No strokes, no blend modes; `noStroke()` at line 44.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_32 | `int cc = int(random(8, 160));` -> `int cc = 32;` | moderate | sparse grid of large individual colored plates on a purple/magenta ground; checkerboard orientation clearly visible | variants/cc_32/frame_00001.png |
| a1_0.3 | `float a1 = random(0.6, 0.95);` -> `float a1 = 0.3;` | moderate | wide boxes shrink to thin lines; wall reads as a dense comb/bristle texture, less checkerboard contrast | variants/a1_0.3/frame_00001.png |
| a2_0.55 | `float a2 = random(0.1, 0.3);` -> `float a2 = 0.55;` | moderate | thin boxes fatten toward squares; texture looks more solid and tiled, purple ground more prominent | variants/a2_0.55/frame_00001.png |
| mr_0.5 | `float mr = HALF_PI*0.14;` -> `float mr = HALF_PI*0.5;` | moderate | wall viewed more diagonally from a lower corner; perspective skew more extreme, top edge crosses upper-left | variants/mr_0.5/frame_00001.png |
| fov_wide | `float fov = PI/random(1.02, 2.6);` -> `float fov = PI/1.02;` | large | near-174-degree FOV crushes the wall into a small lower cluster with long box sides stretched into radiating streaks | variants/fov_wide/frame_00001.png |

## Modularisation notes
The generic core is the checkerboard wall of thin 3D boxes: `checkerWall(count, cellSize, aspectWide, aspectThin, depth, z)` plus the custom `boxQuad` primitive (a box whose side faces are two-tone c1/c2 quads, relying on `lights()` for the shaded look). Art decisions specific to this sketch: the oblique random camera (FOV range, tilt bound `mr`, full Z spin), the z offset `-ss*3+200`, the checkerboard orientation rule, and the flat random background color from the 6-color list. A clean parameter object would be `{count, cellSize, aspectWide, aspectThin, depth, zOffset, fovRange, tiltBound, palette, background}`.
