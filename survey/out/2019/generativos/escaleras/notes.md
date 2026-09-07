---
sketch: 2019/generativos/escaleras
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1733
animated: false
techniques: [grid, 3d-pointcloud]
primitives: [shape]
palette:
  colors: ["#E65EC9", "#5265E8", "#F2F481", "#81F498", "#52D8E8"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(20, 40)", tried: [24], change: large, effect: "coarser grid: bigger boxes and bigger sheets, more black background visible"}
  - {name: keepProb, default: 0.1, tried: [0.5], change: large, effect: "5x more cells kept; frame nearly fully covered, black background mostly gone"}
  - {name: sub, default: 8, tried: [16], change: moderate, effect: "same sheet layout but each sheet built from smaller boxes; finer texture"}
  - {name: boxScale, default: 0.94, tried: [0.7], change: moderate, effect: "smaller boxes; black seams appear between boxes inside each sheet"}
  - {name: planeType, default: "int(random(3))", tried: [0], change: large, effect: "all sheets on the i==j plane; strong parallel diagonal bands with large black areas"}
  - {name: palette, default: "E65EC9/5265E8/F2F481/81F498/52D8E8", tried: ["B2354A/3A48A5/D69546/683910/46BCC9"], change: large, effect: "warm dark palette: brick, orange, blue, brown, teal instead of bright magenta/blue/yellow/green/cyan"}
reusable_candidates:
  - {name: voxelDiagonalSheet, signature: "voxelDiagonalSheet(cell, sub, type, mirror, scale) -> draws axis-diagonal sheet of boxes", note: "one cell: keep 8x8 (or sub x sub) small boxes on one of the 3 planes i==j, j==k, k==i, with per-axis mirroring"}
  - {name: randomCellKeep, signature: "randomCellKeep(grid, p) -> list of kept cell indices", note: "sparsify a 3-D grid by keeping each cell with probability p"}
---

## What it draws
Black background packed with thousands of small 3-D boxes in magenta, blue, yellow, green and cyan,
grouped into flat diagonal sheets and slabs at different depths. The sheets interpenetrate like stacked
mosaic tiles, so the whole frame reads as a dense 3-D voxel mosaic with occasional dark gaps.

## How the code works
`setup()` calls `generate()`; `draw()` is empty so the image is static (escaleras.pde:21-32).
`generate()` (line 34) sets a black background and `lights()` for shading, then builds a
`cc x cc x cc` 3-D grid with `cc = int(random(20, 40))` and cell size `ss = width/cc` (lines 39-40).
The grid is centred with `translate(width*0.5, height*0.5)` (line 42). For every cell, 90 % are skipped
(`if (random(1) < 0.9) continue;`, line 51). Each kept cell picks a plane type `int(random(3))`
(line 57) and three independent per-axis mirror flags (lines 59-61); it then fills the cell's
`sub x sub x sub` (sub = 8, line 55) sub-lattice with a small `box(sss*0.94)` (line 76) only where two
coordinates are equal — `iii==jjj` (type 0), `jjj==kkk` (type 1) or `kkk==iii` (type 2) (lines 71-73) —
so each cell contributes one flat diagonal sheet of ~64 boxes. One colour is picked per cell by
`rcol()`, a uniform random draw from the 5-colour `colors[]` list (lines 101-105). Randomness enters
through the cell-keep probability, plane type, mirror flags and colour; the seed field `seed` (line 4)
is set by the harness. `toxi.SimplexNoise` is imported (line 1) but never used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_24 | `int cc = int(random(20, 40));` -> `int cc = 24;` | large | coarser, larger boxes; sheets read as bigger flat slabs with more black gaps between them | variants/cc_24/frame_00001.png |
| keep_0.5 | `if (random(1) < 0.9) continue;` -> `if (random(1) < 0.5) continue;` | large | five times more sheets kept; frame almost completely covered in colour, black background nearly gone | variants/keep_0.5/frame_00001.png |
| sub_16 | `int sub = 8;` -> `int sub = 16;` | moderate | same sheet positions as baseline but each sheet made of smaller boxes; finer, more tiled texture | variants/sub_16/frame_00001.png |
| box_0.7 | `box(sss*0.94);` -> `box(sss*0.7);` | moderate | black seams/gaps appear between the boxes; sheets look like mosaics of separated tiles | variants/box_0.7/frame_00001.png |
| type_0 | `int type = int(random(3));` -> `int type = 0;` | large | every sheet on the same diagonal plane (i==j); strong parallel diagonal bands across the frame, large black areas | variants/type_0/frame_00001.png |
| palette_warm | `int colors[] = {#E65EC9, #5265E8, #F2F481, #81F498, #52D8E8};` -> `int colors[] = {#B2354A, #3A48A5, #D69546, #683910, #46BCC9};` | large | same geometry, warm/dark palette: brick red, orange, blue, brown, teal | variants/palette_warm/frame_00001.png |

## Modularisation notes
Generic: the cell loop with probability-keep + diagonal-sheet fill is a clean reusable "voxel sheet
grid" function (signature `voxelDiagonalSheet` above); the random palette draw is a standard
`randomFromList`. One-off art decisions: the exact keep probability (0.1), sub = 8, box scale 0.94,
the 5-colour palette, and forcing exactly one of the three diagonal plane types per cell. A clean
parameter object: `{cc, keepProb, sub, boxScale, palette, planeType: 'random3'|0|1|2, mirror: bool}`.
