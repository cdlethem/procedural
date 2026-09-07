---
sketch: 2015/Generativos/quadis2
year: 2015
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 216
animated: false
techniques: [grid, subdivision]
primitives: [rect, shape]
palette:
  colors: ["#4D275E", "#3EE0C2", "#B8FF52", "#FCD245", "#FE8F2C"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: capas, default: "int(random(10))", tried: [9], change: large, effect: "fixed 9 layers: denser, finer mosaic with many small cells over the large ones"}
  - {name: ccc, default: "random(2, 200)", tried: [500], change: large, effect: "5x more cells per layer: very busy confetti-like texture, tiny cells dominate"}
  - {name: halfSplitThreshold, default: 6, tried: [2], change: large, effect: "80% of cells diagonally half-split instead of 40%; surface covered in two-tone triangles"}
  - {name: strokeAlpha, default: 2, tried: [80], change: moderate, effect: "dark outlines around every cell become visible, reading as grid seams"}
  - {name: sizeDecay, default: 2, tried: [1.5], change: large, effect: "smaller layers stay larger (width/1.5^(i-1)): more uniform mid-scale cells, fewer tiny ones"}
reusable_candidates:
  - {name: quadLayer, signature: "quadLayer(layer, cellCount, palette) -> void", note: "snap cells to a halving grid, draw filled square plus optional diagonal half in a second random colour"}
---

## What it draws
A full-bleed 800×800 mosaic of flat squares in five saturated colours (deep purple,
turquoise, lime green, amber, orange). Many squares are split along a diagonal into a
second colour, so the surface reads as a patchwork of whole and half-toned cells at
several sizes. No gradients, no strokes visible; the whole canvas is covered edge to
edge, larger cells in the back with smaller ones stacked on top.

## How the code works
Single tab `quadis2.pde`. `setup()` (L9-12) sizes 800×800 and calls `generar()` once;
`draw()` is empty, so the piece is static (regenerates only on keypress, L17-20).

`generar()` (L22-56):
- `capas = int(random(10))` (L24): number of layers, 0-9.
- `ccc = random(2, 200)` (L25): density multiplier.
- Outer loop `i = 1..capas` (L26): `tt = width / 2^(i-1)` (L29) so the cell size halves
  per layer (800, 400, 200, 100, 50, 25, ...). `cc = (capas-1)*ccc + 1` (L27) is the cell
  count per layer (does not depend on `i`).
- Inner loop (L28): each cell's corner is snapped to the layer's grid,
  `xx = int(random(width/tt))*tt` (L30-31), so cells align and tile without gaps.
- Each cell: `stroke(0,2)` `noFill()` rects at weights 6→1 (L34-37) — an almost
  invisible dark outline (alpha 2); then `noStroke()` and a filled `rect` in a random
  palette colour (L38-42). With 40% probability a filled `triangle` in another random
  palette colour covers one half of the square (L43-53: bottom-right or bottom-left
  half, chosen by `r < 8` vs else), producing the diagonal two-tone cells.
- Colour: `rcol()` (L63-65) picks uniformly at random from the 5-colour `paleta[]`
  (L1-7). No blend modes; painter's order only (earlier layers overpainted later).

Randomness enters via: layer count, cell count, per-cell grid position, and 3-4
independent colour picks per cell. Seed 42, deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| capas_9 | `int capas = int(random(10)); ` -> `int capas = 9;` | large | denser, finer mosaic: many more medium and small cells stacked over the large ones, busier than baseline | variants/capas_9/frame_00001.png |
| ccc_500 | `float ccc = random(2, 200);` -> `float ccc = 500;` | large | extremely busy confetti texture; tiny cells cover the whole canvas, no large flat areas left | variants/ccc_500/frame_00001.png |
| half_2 | `if (r < 6) {` -> `if (r < 2) {` | large | almost every cell is diagonally two-toned; far fewer solid monochrome squares, surface dominated by triangles | variants/half_2/frame_00001.png |
| stroke_80 | `stroke(0, 2);` -> `stroke(0, 80);` | moderate | same composition but dark outlines now clearly visible around cells, reading as grid seams | variants/stroke_80/frame_00001.png |
| decay_1.5 | `float tt = (width/pow(2, i-1));` -> `float tt = (width/pow(1.5, i-1));` | large | cell size shrinks more slowly per layer; result is a uniform field of mid-scale cells, much fewer tiny fragments than baseline | variants/decay_1.5/frame_00001.png |

## Modularisation notes
Generic block: the "layer of snapped cells" loop (L26-55) is a reusable primitive —
given (layerIndex, cellSize, count, palette), snap random positions to the cell grid
and paint each cell as a solid square plus an optional 50% triangle in a second colour.
One-off art decisions: the specific 5-colour palette, the 2:1:1 plain/half/half
probability split (L41-53), the near-invisible 6-pass stroke, and the fixed 2× halving
per layer. A clean parameter object: `{layers, cellsPerLayer, palette, halfSplitRatio,
strokeAlpha, sizeDecay (2.0)}`.
