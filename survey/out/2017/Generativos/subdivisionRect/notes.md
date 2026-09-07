---
sketch: 2017/Generativos/subdivisionRect
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 518
animated: false
techniques: [subdivision, blend-modes]
primitives: [shape]
palette:
  colors: ["#1e3888", "#47a8bd", "#f5e663", "#ffad69", "#9c3848"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: splitQuad, signature: "splitQuad(quad, interiorPoint) -> Quad[4]", note: "replace a quad by 4 quads, each = interior point + 1 corner + 2 adjacent edge midpoints (8-ring construction)"}
  - {name: randQuad, signature: "randQuad(points, inset) -> PVector", note: "bilinear random point inside a quad, params clamped to [inset, 1-inset]"}
  - {name: randomQuadSubdivision, signature: "randomQuadSubdivision(w, h, iterations, inset) -> Quad[]", note: "start from one full-bleed quad, repeatedly pick a random cell and split it into 4"}
  - {name: paletteLerp, signature: "paletteLerp(colors, t) -> color", note: "lerp between adjacent palette entries, t in [0, colors.length)"}
---

## What it draws
Full-bleed mosaic of irregular quadrilateral cells of strongly varying size, tiling the whole
canvas with no background visible except thin black seams between cells. Cells cluster into
fan-like bursts around interior points (each parent cell replaced by 4 wedges), with some
regions of large cells (top) and very fine dense cells (bottom-right). Dominant colours are
yellow, teal/cyan and orange, mixed with dark blue and maroon; additive blending makes
overlapping areas glow brighter, almost white where many cells stack.

## How the code works
- `setup()` (lines 1-7): 960x960, `smooth(8)`, `rectMode(CENTER)`, calls `generate()` once;
  `draw()` is empty (line 10-12) so the piece is static.
- `generate()` (lines 24-80): black background (line 25). Seeds one quad covering the canvas
  inset by `bb = 4` (lines 29-34).
- Subdivision loop (lines 37-69): runs `cc = int(random(100, 5000))` times. Each iteration
  picks a random existing quad (line 39), samples a random interior point with `randQuad`
  (line 45, defined lines 82-92: bilinear lerp between edges a-b and c-d with parameters in
  `[des, 1-des]`, where `des = random(0.4)*random(0.5, 1)` in [0, 0.4) pulls the point away
  from two opposite edges), computes the 4 edge midpoints (lines 51-54), builds an 8-point
  ring of corners and midpoints alternating (lines 55-57), then creates 4 new quads, each =
  the interior point + one original corner + the two adjacent edge midpoints (lines 60-67),
  and removes the parent (line 68). Net +3 cells per iteration, so the mosaic stays full-bleed.
- Colour pass (lines 70-79): `blendMode(ADD)`; each quad gets `getColor(random(5))` — a lerp
  between two adjacent entries of the 5-colour palette (lines 111, 116-122), fill alpha
  `random(100, 200)`, black stroke weight 1 (line 76), and each quad is drawn twice
  (lines 78-79), doubling the additive brightness.
- All randomness is seeded (`--seed 42`), so the whole mosaic is deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic / reusable: `randQuad` (inset bilinear sampling of a quad), the 8-ring 4-way split
  (`splitQuad`), and the driver loop "start from one cell, repeatedly split a random cell"
  (`randomQuadSubdivision(w, h, iterations, inset)`) — a generic random quad subdivision with
  no sketch-specific content. `getColor`/`paletteLerp` is a standard palette-blend helper.
- One-off art decisions: the specific 5-colour palette, `blendMode(ADD)` + drawing every quad
  twice, fill alpha range 100-200, `cc` in [100, 5000), the black 1px stroke, and `bb = 4`
  margin.
- Clean parameter object: `{w, h, iterations, inset, palette, fillAlpha: [min, max],
  blendMode: ADD|BLEND, stroke: {color, weight, on}, drawTwice: bool, margin}`.
