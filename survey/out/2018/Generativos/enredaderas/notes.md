---
sketch: 2018/Generativos/enredaderas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1557
animated: false
techniques: [grid, lines-hatching]
primitives: [rect, ellipse, line]
palette:
  colors: ["#FE4D9F", "#EE1C25", "#2F3293", "#3CB74C", "#0272BE", "#BDCBD5", "#FEFEFE"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 40, tried: [20], change: moderate, effect: "coarser grid: 48px cells, sparser dot grid, circles twice as big, wider vine jogs"}
  - {name: vineCount, default: 40, tried: [100], change: moderate, effect: "much denser web of orthogonal lines, background nearly covered"}
  - {name: strokeWeight, default: 3, tried: [8], change: moderate, effect: "same paths, thicker and softer strokes with a glow (smooth(8)), bolder look"}
  - {name: vineSteps, default: 100, tried: [300], change: moderate, effect: "walks run 3x longer, paths fill the whole canvas in a dense maze"}
  - {name: circleCount, default: 8, tried: [30], change: moderate, effect: "many more scattered circles from tiny dots to mid-size, same vines"}
reusable_candidates:
  - {name: vineWalk, signature: "vineWalk(grid, steps, speedMax, rng, colors) -> PVector[]", note: "random orthogonal walk on a grid, one direction per step, speed 1..7 cells"}
  - {name: dotGrid, signature: "dotGrid(cols, dotSize, color) -> void", note: "center-rect grid of small squares as a background lattice"}
---

## What it draws
A light-grey field with a faint 40x40 lattice of small grey dots. Over it: 40
rectilinear "vine" polylines (right-angle only) in red, green, blue, pink and
white, each a random orthogonal walk that meanders across the whole canvas;
and 8 solid circles of varying size in the same palette, scattered randomly.
Frames 10/60 are identical to frame 1: the sketch is static (it only
regenerates on key press).

## How the code works
`setup()` -> `generate()` (enredaderas.pde).
- L23: `background(190)` — light grey field.
- L25-34: `rectMode(CENTER)`, `cc = 40` cells (L26), `dd = width/cc = 24px`
  (L27); a nested loop draws 1600 small 4px squares (L32) in `fill(200)`,
  slightly lighter than the background — the faint dot grid.
- L36-45: 8 circles at random grid-snapped centers (`xx -= xx%dd`, L39-40),
  sizes 1..2 cells (`ss = int(random(1,3))*dd`, L41), fill from `rcol()`
  (uniform pick from the 7-color array, L91).
- L47-83: 40 vine polylines. Each starts at a random x on the bottom row
  (`yy = cc`, L51), walks 100 steps (L56); each step moves `vel` cells (1..7,
  L53) in one of 4 cardinal directions (`dir*HALF_PI`). Direction changes are
  50/50 random turns (L60-71); with 50% probability the walk keeps its
  direction, which biases the paths into long straight runs that occasionally
  jog — the characteristic "hedge" look. Points are stored, then drawn as an
  open `beginShape()`/`vertex()` polyline (L76-81), `noFill()`,
  `strokeWeight(3)` (L55), with the stroke color re-rolled per vertex (L79)
  — this produces the subtle color dithering where a single line flickers
  between palette colors.
- Randomness enters via `seed` (L1), which the harness reassigns; `random()`
  drives circle placement, walk starts, velocities, turns, and colors. `P2D`
  renderer with `smooth(8)`; `pixelDensity(2)` fails headless (harmless
  warning).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20 | `int cc = 40;` -> `int cc = 20;` | moderate | coarser 20x20 grid (48px cells): sparser dot lattice, circles roughly twice as large, vine steps wider and jogs bigger; overall more open, chunkier composition | variants/cc_20/frame_00001.png |
| vines_100 | `for (int j = 0; j < 40; j++) {` -> `for (int j = 0; j < 100; j++) {` | moderate | 2.5x more vine walks: dense web of orthogonal lines covering nearly the whole background, circles partly buried in the tangle | variants/vines_100/frame_00001.png |
| strokeWeight_8 | `strokeWeight(3);` -> `strokeWeight(8);` | moderate | same 40 paths (same seed) but strokes ~2.7x thicker with a soft glow from `smooth(8)`; bolder, more saturated lines, same circle set | variants/strokeWeight_8/frame_00001.png |
| steps_300 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 300; i++) {` | moderate | 3x longer walks: each vine winds across the entire canvas multiple times, forming a dense maze-like lattice; circles barely visible | variants/steps_300/frame_00001.png |
| circles_30 | `for (int i = 0; i < 8; i++) {` -> `for (int i = 0; i < 30; i++) {` | moderate | ~4x more circles scattered throughout, ranging from tiny dots to mid-size discs adding color accents; vines unchanged | variants/circles_30/frame_00001.png |

## Modularisation notes
- Generic: the orthogonal grid walk (`vineWalk`) is the core reusable piece —
  parameters: grid size, start cell, steps, max speed, turn probability,
  color list, per-vertex color re-roll on/off. The dot grid and the
  snapped-circle scatter are trivial one-liners.
- Art decisions: the 7-color palette, the 50/50 turn bias (what makes paths
  look like hedges rather than pure Brownian noise), per-vertex color
  re-rolling, and starting every walk from the bottom row.
- A clean parameter object: `{grid, dotSize, background, circleCount,
  circleSizes, vineCount, vineSteps, maxSpeed, strokeWeight, palette,
  perVertexColor: bool}`.
