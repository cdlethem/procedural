---
sketch: 2019/generativos/corbata2
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1532
animated: false
techniques: [grid, symmetry, dots-stippling, lines-hatching]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#FFF2E1", "#EBDDD0", "#F1C98E", "#E0B183", "#C2B588", "#472F18", "#0F080F"]
  selection: random-from-list
composition: tiled
parameters: []
reusable_candidates:
  - {name: rectSub, signature: "rectSub(x, y, w, h, sub, c1, c2)", note: "checkerboard fan of alternating triangle strips from edges to centre; two colours"}
  - {name: cellGrid, signature: "cellGrid(cx, cy, cell, n, palette) -> void", note: "n x n micro-grid of random motif cells (diagonal split, dot, cross, nested rects) inside a square"}
---

## What it draws
A 3x3 grid of diamond-shaped tiles (squares rotated 45 deg) filling the canvas, in a warm
cream/ochre/olive/brown palette. Each tile is a checkerboard of fine hatched triangles in two
random palette colours, with a white square in its centre containing a small n x n grid of
motif cells: diagonal-split squares, tan circles, thin cross lines with dots, and nested
coloured rectangles. Small dark dots and tiny offset shadows give a printed, textile feel.

## How the code works
- `setup()` -> `generate()` (line 23); `draw()` is empty, so the piece is static (regenerate on key press, line 34).
- `generate()` (line 52): `randomSeed`/`noiseSeed` from `seed` (line 4, 54-55); background `rcol()` (line 57).
- Tile count: `div = 2` (line 68) -> `(div+1)^2 = 9` tiles in loops lines 77-78; each tile is `size = width*0.5` (line 60), centred by `translate(width*0.5, height*0.5)` + `rotate(HALF_PI*0.5)` (lines 63-64) + `scale(random(0.9, 1.2))` (line 66), so tiles overlap at the edges (full-bleed, slightly rotated/zoomed grid).
- `rectSub` (line 194): `sub = int(random(10,18))*2` (line 85) alternating triangle fans in two random colours `rcol(), rcol()` around each tile's border.
- White centre square `ss*cc x ss*cc` (line 89) is always 90% of the tile (`ss = size*0.9/cc`, line 61); `cc = int(random(40,90)*0.09)` (line 59) sets the micro-grid resolution (3..8 cells).
- Cell loop (lines 92-172): per cell, three `beginShape` triangles split the square diagonally with black alpha 20 (lines 100-122); 20% chance of an `rcol()` circle (lines 124-127); if `hor` (i%2==0) or `ver` (j%2==0) (line 129) draw a cross line + shadow dot + centre dot (lines 130-142); else draw nested `rcol()` rects with a black-alpha offset copy (lines 146-167).
- `hor`/`ver` are per-tile booleans, 70% probability each (lines 75-76), decided with `randomSeed(seed)` re-set per tile (line 79), so all tiles share the same motif mix but colours vary per cell.
- Colour: `rcol()` (line 259) picks uniformly from the 7-colour warm palette (line 258); black-alpha fills (0,20)/(0,14) and white-alpha (255,80) are the fixed "ink" tones.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `rectSub` is a clean, parameterised reusable primitive (size, subdivision count, two colours) — a "checkerboard fan" fill.
- The per-cell motif loop (lines 92-172) is the art-specific part but is already structured as "one cell, several stochastic motifs with probabilities" — could be a `motifCell(cell, rng, palette)` function with a motif list + probabilities as parameters.
- The 3x3 tiled-rotated composition (lines 63-81) is generic: `tiledRotatedTiles(n, tileSize, angle, fn)`.
- A clean parameter object: `{seed, tiles: div, cellCount: cc, sub: rectSub divisions, palette: colors[], horProb, verProb, circleProb, rotation, zoom}`.
