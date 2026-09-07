---
sketch: 2018/Generativos/torta
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1493
animated: false
techniques: [grid, curves, lines-hatching, dots-stippling]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#FFFCF7", "#FDDA02", "#EE78AC", "#3155A3", "#028B88"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "int(random(600)*random(0.2,1))", tried: [200], change: moderate, effect: "fewer tiles -> sparser, more blue background"}
  - {name: size, default: "width*random(0.1,0.2)", tried: [0.4], change: large, effect: "larger tiles -> more coverage and overlap"}
  - {name: div, default: "int(random(2,12))", tried: [28], change: subtle, effect: "denser line grids on grid-tiles; overall near-identical"}
  - {name: scatter, default: 40, tried: [200], change: large, effect: "5x denser arc-dust layer across whole canvas"}
  - {name: palette, default: "cream/yellow/pink/blue/teal", tried: ["teal/coral/purple/cream/navy"], change: large, effect: "full recolor, ~94% of pixels"}
reusable_candidates:
  - {name: facetedTile, signature: "facetedTile(x, y, s, rotation, col, alpha) -> void", note: "draws a beveled 4-trapezoid 'shadowed' square via beginShape/vertex"}
  - {name: polkaSquare, signature: "polkaSquare(s, baseCol, dotCol) -> void", note: "filled square with 4 corner dots clipped to the tile"}
  - {name: gridOverlay, signature: "gridOverlay(s, div, col) -> void", note: "div x div line grid across a square tile"}
  - {name: arcScatter, signature: "arcScatter(count, w, h, col) -> void", note: "random thin quarter-arcs scattered across the whole canvas"}
---

## What it draws
A flat blue field scattered with rotated squares of several sizes, each decorated in a
different way: some are solid yellow or pink with four large cream dots at their corners
(polka pattern), some are covered in a fine line grid (yellow or pink), some are plain
translucent blue. Thin stroked ellipse rings, a few small filled circles (teal, pink, green)
and a dense dusting of tiny one-quarter-arc marks are sprinkled across the whole canvas.
Colours come from a five-colour palette (cream, yellow, pink, blue, teal) picked at random.

## How the code works
`setup()` sets 960x960 P2D, calls `generate()` once (line 8); `draw()` is empty so the piece
is static (line 11). `generate()` (line 23) paints a random palette-colour background
(`background(rcol())`, line 24) then loops `cc` times where
`cc = int(random(600)*random(0.2, 1))` (line 27) — roughly 120-600 tiles. Each tile picks a
random `x`,`y`, a size `s = width*random(0.1, 0.2)` (96-192 px, line 31) and a random rotation
(line 38, via `translate`/`rotate` inside `pushMatrix`).

Per tile several independent coin-flips decide the decoration:
- 50% (line 40) first draws `srect(...)` (line 42-43): a beveled "drop-shadow" square built
  from four trapezoid `beginShape` strips in near-transparent black (alpha 8-20), giving each
  tile a faceted edge; plus a tiny rect and tiny ellipse.
- 30% (line 50) makes the tile stroke-only, otherwise filled (`col1`, line 56).
- 50% (line 59) draws a stroked ellipse ring; otherwise (line 64) it draws the filled `rect`
  and then, 20% (line 68) overlays four cream circles at the corners (the polka look) and
  optional arcs, 30% (line 80) overlays a dense scatter of tiny arcs, and 40% (line 94)
  overlays a `div x div` line grid with `div = int(random(2,12))` (line 95).
After each tile a fixed 40-iteration loop (line 114) scatters thin quarter-arcs across the
whole canvas (`arc`, line 122) at random low alpha — the "dust" layer.

Colour always comes from `rcol()` (line 177) which returns a random entry of the 5-entry
`colors[]` array (line 175); a commented alternative 5-colour palette sits at line 176.
Randomness enters only through `random(...)`; with the harness seed 42 the output is
deterministic. No blend modes, no shaders.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `int cc = int(random(600)*random(0.2, 1));` -> `int cc = int(random(200)*random(0.2, 1));` | moderate | much sparser: far fewer tiles, large areas of plain blue background; same tile types, just fewer | variants/cc_200/frame_00001.png |
| size_0.4 | `float s = width*random(0.1, 0.2);` -> `float s = width*random(0.2, 0.4);` | large | tiles twice as big; heavy overlap, covers most of the canvas, denser polka/grid squares | variants/size_0.4/frame_00001.png |
| div_28 | `int div = int(random(2, 12));` -> `int div = int(random(4, 28));` | subtle | grid-tiles show finer, denser line grids; rest of composition near-identical (grids only affect a subset of tiles) | variants/div_28/frame_00001.png |
| scatter_200 | `for (int j = 0; j < 40; j++) {` -> `for (int j = 0; j < 200; j++) {` | large | arc-dust layer 5x denser; tiny arcs now clearly cover the background and sit on top of tiles | variants/scatter_200/frame_00001.png |
| palette_alt | `int colors[] = {#FFFCF7, #FDDA02, #EE78AC, #3155A3, #028B88};` -> `{#01AFD8, #009A91, #E46952, #784391, #1B2D53};` | large | full recolor: purple background, tiles in teal/coral/purple/cream/navy; ~94% of pixels differ | variants/palette_alt/frame_00001.png |

## Modularisation notes
The four decorative sub-routines are cleanly separable and reusable:
- `srect` (line 127) is a generic faceted/beveled square — a good `facetedTile` primitive.
- The polka-square, grid-overlay and tiny-arc-scatter blocks (lines 64-103, 112-123) are
  self-contained and could become `polkaSquare`, `gridOverlay`, `arcScatter`.
One-off art decisions: the specific 5-colour palette (line 175), the size range 0.1-0.2 (line
31), the coin-flip probabilities (0.5/0.3/0.2/0.4) and the per-tile count `cc` (line 27).
A clean parameter object would hold: tileCount, sizeRange, palette[], gridDivisions range,
scatterArcs, and the per-decoration probabilities, so the whole composition is reproducible
and retunable.
