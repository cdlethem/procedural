---
sketch: 2019/generativos/cubit
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1494
animated: false
techniques: [grid, 3d-mesh]
primitives: [line]
palette:
  colors: ["#FF0000", "#FFFF00", "#0000FF"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: 20, tried: [10], change: subtle, effect: "coarser grid: larger cubes, coarser denser web"}
  - {name: cubeCount, default: 50, tried: [150], change: subtle, effect: "denser, more overlapping lattice"}
  - {name: strokeWeight, default: 1.4, tried: [3.5], change: subtle, effect: "thicker, heavier lines"}
  - {name: normalAlpha, default: 250, tried: [60], change: none, effect: "no visible change at this diff threshold"}
  - {name: redYellowChance, default: 2/3, tried: [1/3], change: subtle, effect: "blue cubes more prominent in the mix"}
  - {name: smallChance, default: 1/8, tried: [1/2], change: subtle, effect: "many more half/quarter-size cubes interleaved"}
reusable_candidates:
  - {name: wireframeCube, signature: "wireframeCube(x, y, s, dx, dy, face, normalAlpha, faintAlpha) -> void", note: "2-D line-drawn 12-edge cuboid with per-edge strong/faint alpha chosen by visible face"}
---

## What it draws
Black background scattered with ~50 wireframe cubes drawn in thin red, yellow, and blue lines. Each cube is a front square with a back square shifted diagonally (up-left or down-right by one grid cell), connected by four edges, giving an oblique 45° pseudo-3D look. Most cubes form a loose cluster in the centre of the canvas; a few are much smaller, and a few sit isolated in the corners. Some edges of each cube are drawn faint (low alpha), which reads as the face the cube is "facing".

## How the code works
- `setup()` (cubit.pde:21-29) calls `generate()` once; `draw()` is empty, so the piece is static.
- `generate()` (52-105): `randomSeed`/`noiseSeed(seed)` (54-55), black background (57). A 20×20 grid (`cc = 20`, `ss = width/cc`, lines 59-60).
- Loop of 50 cubes (80): random grid cell in the interior (81-82); back-face offset `dx, dy = ±ss` (84-85) so the depth axis is diagonal; `face = int(random(6))` (87) picks the visible face 0-5.
- Colour (89-94): 2/3 chance red or yellow (50/50), else blue — plain RGB strokes, no palette lookup.
- 1/8 chance the cube is half- or quarter-size (97-100); fixed `strokeWeight(1.4)` (102); then `box(x, y, ss, dx, dy, face)` (103).
- `box()` (107-151) draws the 12 edges with `line()`: front square, back square (offset by dx,dy), 4 connectors. Each edge calls `setNormal()` (alpha 250) or `setBold()` (alpha 90) — the names are inverted, "bold" is the faint line. The `face` index decides which 3 edges go faint, faking which face of the cube faces the viewer (110-150).
- Unused dead code: commented-out dot-grid version (63-77), warm `colors[]` palette and `rcol()`/`getColor()` lerp helpers (187-206) that `generate()` never calls; the `triangulate` import (line 1) is also unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_10 | `int cc = 20;` -> `int cc = 10;` | subtle | subtle: coarser 10x10 grid, larger cubes, denser overlapping web with more blue lattice edges | variants/cc_10/frame_00001.png |
| count_150 | `for (int i = 0; i < 50; i++) {` -> `... i < 150; ...` | subtle | subtle: noticeably denser lattice, more overlap and brighter overall | variants/count_150/frame_00001.png |
| strokeWeight_3.5 | `strokeWeight(1.4);` -> `strokeWeight(3.5);` | subtle | subtle: same composition, lines visibly thicker and heavier | variants/strokeWeight_3.5/frame_00001.png |
| normalAlpha_60 | `stroke(red(col), green(col), blue(col), 250);` -> `..., 60);` | none | no visible change (score 2.2% of pixels, mean 0.0066) | variants/normalAlpha_60/frame_00001.png |
| blueRatio_1 | `if (random(3) < 2) {` -> `if (random(3) < 1) {` | subtle | subtle: colour mix shifted, blue cubes more present vs red/yellow | variants/blueRatio_1/frame_00001.png |
| smallRatio_4 | `if (random(8) < 1) {` -> `if (random(8) < 4) {` | subtle | subtle: many more small (half/quarter-size) cubes interleaved in the lattice | variants/smallRatio_4/frame_00001.png |

## Modularisation notes
- Generic: `box()` is a clean wireframe-cuboid primitive (position, size, diagonal offset, visible-face index, two alphas) — a good library function as noted in `reusable_candidates`. Grid-based placement with per-item random size/colour is also generic.
- One-off art decisions: the 2/3 red-yellow vs 1/3 blue colour split, the 1/8 small-cube probability, the fixed 1.4 stroke weight, the 50-cube count, and the always-diagonal ±cell depth offset (a true isometric variant would use fixed (dx,dy)).
- A clean parameter object: `{count, gridN, cellSize, smallChance, strokeWidth, faceAlpha, faintAlpha, colorWeights, depthOffset}`.
