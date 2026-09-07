---
sketch: 2018/Generativos/hombros
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2469
animated: false
techniques: [grid, 3d-pointcloud, lines-hatching]
primitives: [line]
palette:
  colors: ["#000000", "#EFF1F4", "#81C7EF", "#2DC3BA", "#BCEBD2", "#F9F77A", "#F8BDD3", "#272928"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 16, tried: [32], change: moderate, effect: "doubling line slices makes the curtain much denser and darker, nearly solid"}
  - {name: cellCount, default: 100000, tried: [30000], change: large, effect: "thinner curtain with large soft light patches where cells are missing; central structure survives"}
  - {name: ss, default: "random(20,120)", tried: ["random(80,120)"], change: moderate, effect: "coarser, more open crystalline line texture; dark horizontal band across the middle"}
  - {name: strokeWeight, default: 0.2, tried: [1], change: moderate, effect: "curtain overall lighter and softer; central cross fainter"}
  - {name: strokeAlpha, default: 20, tried: [60], change: large, effect: "darker curtain; individual diagonal cables become visible as cross-hatching"}
  - {name: scale, default: 0.6, tried: [1], change: moderate, effect: "more dramatic perspective: denser darker curtain, thicker dark band, thinner brighter central line"}
reusable_candidates:
  - {name: gridCubes, signature: "gridCubes(cellSize, count, linesPerCell, lineTemplates) -> void", note: "snap random 3D points to a grid, draw random edge/diagonal line sets inside each cell"}
  - {name: cubeCables, signature: "cubeCables(s, slices, seedGates) -> void", note: "the modulo1 template set: up to 10 long lines spanning a cube per slice"}
---

## What it draws
A monochrome image that reads as a dense curtain of extremely thin, faint vertical strokes
filling the whole 960x960 canvas. Around the middle a small region of visible wireframe
grid structure stands out (a bright core with orthogonal lines), and a darker horizontal
band cuts across the lower middle. Dominant colours: white background, mid-grey overall,
with darker grey patches where lines overlap. No colour is visible anywhere.

## How the code works
- `setup()` (L20-29): 960x960 P3D canvas, `smooth(8)`, `ENABLE_STROKE_PERSPECTIVE`,
  `rectMode(CENTER)`, then `generate()`. `draw()` is empty; regeneration only on key press.
- Camera (L64-69): `translate(width*0.5, height*0.55, -200)`, `rotateX(HALF_PI)` (world XZ
  plane becomes the viewing plane, y becomes depth), small random yaw/pitch in ±0.1, then
  `scale(0.6)`. This is why long lines in world y/z appear as vertical strokes converging
  to a central vanishing point.
- Stroke (L73-74): the only visible colour is `stroke(0, 20)` — black at alpha 20, weight
  0.2. The 7-colour palette (L137) and `rcol()`/`getColor()` (L138-151) are never called
  (the only call site, L71, is commented out), so the output is monochrome.
- Grid + scatter (L76-91): `ss = random(20, 120)` is the cell size. A loop of 100000
  iterations picks a random point in `[-width, width] x [-height, height] x [-height,
  height]`, snaps it to the grid via `x -= x%ss` (L82-84), and calls `modulo1(ss)` to draw
  lines inside that cell.
- `modulo1` (L96-118): the per-cell generator. `cc = 16` slices along x (v mapped -1..1);
  each slice has 10 `line()` calls, each gated by `random(1) < 0.5`, drawing long edges
  and face diagonals of the cube (e.g. L103-106 span the yz-faces at x=mw*v; L109-114 span
  x at varying y or z). These are the "cables" from the comments (L7: cables entre
  edificios). Up to 160 lines per cell, 100000 cells.
- Randomness: seed (L4, L60-61), camera yaw/pitch (L66-67), `ss` (L76), cell positions
  (L78-80), and every line gate (L103-114). The toxi/triangulate imports (L1-2) are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_32 | `int cc = 16;` -> `int cc = 32;` | moderate | much denser, darker curtain, almost solid dark grey; the central cross shows up as light lines against the dark field | variants/cc_32/frame_00001.png |
| cellCount_30000 | `for(int i = 0; i < 100000; i++){` -> `for(int i = 0; i < 30000; i++){` | large | thinner curtain with large soft light patches (missing cells); central grid and dark band still visible | variants/cellCount_30000/frame_00001.png |
| ss_80 | `float ss = random(20, 120);` -> `float ss = random(80, 120);` | moderate | coarser, more open crystalline texture; distinct dark horizontal band across the middle and a central vertical line | variants/ss_80/frame_00001.png |
| strokeWeight_1 | `strokeWeight(0.2);` -> `strokeWeight(1);` | moderate | curtain overall lighter and softer than baseline; central cross fainter | variants/strokeWeight_1/frame_00001.png |
| strokeAlpha_60 | `stroke(0, 20);` -> `stroke(0, 60);` | large | darker curtain; individual diagonal cables now clearly visible as cross-hatching; dark band stronger | variants/strokeAlpha_60/frame_00001.png |
| scale_1 | `scale(0.6);` -> `scale(1);` | moderate | more dramatic perspective: denser, darker curtain, thicker dark horizontal band, thinner brighter central vertical line | variants/scale_1/frame_00001.png |

## Modularisation notes
- Generic: `modulo1`/`gridCubes` — "N random 3D points snapped to a grid, each cell filled
  with a random subset of long edge/diagonal lines" is a reusable 3D line-splat primitive;
  the set of line templates (which corners to connect) is the art decision and can be a
  parameter.
- One-off: the camera transform (rotateX(HALF_PI), scale 0.6, ±0.1 jitter) that turns the
  3D cloud into a vertical curtain; the fixed stroke (black, alpha 20, weight 0.2); the
  100000 cell count.
- Parameter object: `{seed, cellSize (or [min,max] range), cellCount, slices (cc),
  lineTemplates, strokeAlpha, strokeWeight, zoomScale, yawJitter, pitchJitter}`.
