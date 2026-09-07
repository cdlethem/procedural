---
sketch: 2018/Generativos/revel2
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 1703
animated: false
techniques: [grid, subdivision]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#F7F7F7", "#3102F7", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: checkerboardRoom, signature: "checkerboardRoom(x, y, w, h, cw, ch, cellColor, jitter) -> void", note: "half-skip checkerboard of jittered columns, one per subdivided room"}
  - {name: shadedDisc, signature: "shadedDisc(x, y, d, fill, haloAlpha) -> void", note: "disc with soft alpha-20 dark halo ring (arc2) and faint white highlight"}
---

## What it draws
A full-bleed checkerboard in electric blue and black: wide blue columns, shorter black rows, so the cells read as horizontal blue stripes interrupted by black dashes. Scattered over it are dozens of translucent blue circles of varying sizes, each with a soft dark halo and a barely visible lighter spot at its upper right; the circles overlap the checkerboard without disturbing it. A faint dark banding darkens the bottom half of the blue cells.

## How the code works
- `setup()` calls `generate()` once; `draw()` is inert, so the sketch is static (key press regenerates).
- `generate()` (lines 32–62) starts with one full-canvas `Rect`. With `sub = 0` (line 37, hard-coded; the random version is commented out) the subdivision loop is skipped, so there is exactly one "room" covering the whole 960×960 canvas. Background is a random palette colour (line 56).
- `room()` (lines 64–120) builds the checkerboard: `cw = random(8,30)` columns, `ch = random(16,50)` rows. Column x-positions are jittered by `random(-0.4, 0.4)` (line 74), but rows are a regular grid, and cell height is `hh = w/ch` (line 68 — computed from width, so cells are wide, non-square). Cells with `(i+j)%2 == 1` are skipped (line 80), producing the checkerboard; the kept cells are shuffled and filled with one random palette colour `c3` (lines 87–109). Each cell gets a `beginShape` quad whose second half is `fill(0,0,0,30)` (lines 110–117), the faint dark banding on the lower part of each cell.
- Circles (lines 92–106): for each cell, with 20% probability a disc is drawn at a random position in the room: first `arc2(...)` (lines 98, 161–179) paints a soft ring of black at alpha 20 out to `1.1*ss` radius (the halo), then a filled ellipse of radius `ss/2` in a second random palette colour `c2` (line 102), then two tiny white arcs at alpha 10 near the upper right (the highlight). Disc diameter `ss = min(w,h)*random(0.3)*random(1)` (line 96).
- Palette (line 185): `{#F7F7F7, #3102F7, #000000}`, picked uniformly by `rcol()`; in this seed the background/cell/circle colours all landed on blue and black.
- Note: the `seed` variable (line 1) is never fed to `randomSeed()`, so runs are not reproducible; baseline `result.json` marks the sketch `deterministic: false`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the room subdivision (split a rect into a cw×ch grid, replace one rect, repeat `sub` times) is a clean recursive-subdivision routine; the checkerboard fill (skip `(i+j)%2==1`, jitter columns, per-cell bottom shadow quad) is a reusable "checkerboard room" primitive; `arc2` (alpha-graded ring built from quads) is a generic soft-halo helper.
- One-off art decisions: the 3-colour palette, the 20% circle probability and 0.3 size scale, the alpha-20/alpha-10 shading constants, the `hh = w/ch` width-derived row height (looks intentional but is arguably a bug), the unused `srect`/`getColor` helpers.
- A clean parameter object would contain: `sub` (subdivision count), `cw`/`ch` ranges, column jitter, cell shadow alpha, circle probability, circle size scale, halo alpha, palette list.
