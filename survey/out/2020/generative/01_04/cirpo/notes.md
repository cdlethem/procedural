---
sketch: 2020/generative/01_04/cirpo
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1518
animated: false
techniques: [grid, noise-field, dots-stippling]
primitives: [rect, ellipse]
palette:
  colors: ["#F3B2DB", "#518DB2", "#02B59E", "#DCE404", "#000000", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: arcTileGrid, signature: "arcTileGrid(count, palette, noiseDetail, cellOpts) -> void", note: "cc×cc grid of random-color tiles, each optionally carrying one corner's stack of concentric quarter arcs, corner picked from noise + parity"}
  - {name: concentricDotScatter, signature: "concentricDotScatter(gridStep, skipProb, radius, palette) -> void", note: "sub-grid of two-concentric-circle dots, parity-scaled, randomly skipped"}
---

## What it draws
A 6×6 mosaic of flat-colored tiles in a six-color palette (pink, teal, chartreuse, slate blue, black, white). Each tile is a square that may carry a full or half-size circle in its middle, and at one corner a stack of four concentric quarter-circle arcs (pie-slice wedges) in independent random colors; arcs larger than the tile spill into neighbouring cells. A scatter of small two-tone concentric dots (ring + core) is sprinkled over the whole surface. Flat, no strokes, no gradients — Bauhaus/Memphis-style geometric composition.

## How the code works
- `settings()` (L14-19): P3D 960×960; `generate()` runs once in `setup()` (L21-29), `draw()` is empty → static image.
- `generate()`: seeds `random`/`noise` (L44-45), fills background with a random palette color (L47).
- Grid size: `cc = int(random(12,18)*0.3)*2` (L49) → even count in {6,8,10}; with seed 42 it is 6. Tile size `ss = width/cc` (L50).
- Tile loop (L55-118): each cell gets a `rect` in a random palette color (L59-60); with 50% chance a full inscribed `ellipse` (L62-65), with a further 50% a half-size `ellipse` (L67-70). Then `noi = noise(x*det, y*det)*8` (L73, `det = random(0.008)`, L52); `rnd = int(noi + i%2 + j*2) % 4` (L75) picks a corner, 25% chance of suppressing the arc (L76). For the chosen corner, 4 concentric `arc()` quarter-wedges of radii `ss*2, ss, ss*0.5, ss*0.25` are drawn, each with a fresh random color (L77-116) — the `ss*2` wedge overflows the cell, which is why arcs visibly bleed across tile borders.
- Dot pass (L121-139): a `cc*2 × cc*2` sub-grid; each point skipped with 40% chance (L124); radius alternates by `(i+j+1)%2` parity (L127-130); drawn as two concentric ellipses in random colors (L131-136).
- Color: `rcol()` returns a uniformly random entry of the 6-color `colors[]` (L148, L154-156). No blend modes; P3D used only as the canvas.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic blocks: the arc-tile grid (cell = rect + optional circles + one noise-picked corner arc stack) and the concentric dot scatter are both reusable as library primitives; the per-color randomness makes them trivially parameterizable by palette.
- One-off art decisions: the specific 6-color palette, the `i%2 + j*2` parity bias added to the noise (breaks 4-way symmetry so corners are not uniform), the 0.25 no-arc dropout, and the fixed radius series `2, 1, 0.5, 0.25 × ss`.
- Clean parameter object: `{ count, palette, noiseDetail, pFullCircle, pHalfCircle, pNoArc, dotDensity, dotBaseRadius, dotParityScale }`.
