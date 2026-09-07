---
sketch: 2020/generative/01_04/mantra
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, peasy, toxi]
deterministic: true
ms_first_frame: 1497
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#EE371D", "#4F4EB7", "#1C1E4E", "#EC3789", "#E7CCB2"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(rects, nHorizontal, nVertical) -> Rect[]", note: "randomly split an axis-aligned rect list left/right then top/bottom with 0.4-0.6 splits"}
  - {name: nestedCellGrid, signature: "nestedCellGrid(x, y, w, h, cw, ch, cw2, ch2, gapFrac, colorFn)", note: "two-level grid of inset colored cells inside a rect"}
---

## What it draws
A dense, full-bleed composition of vertical color bands in red, indigo/navy, pink and cream on a pale grey ground. The bands are split into irregular horizontal blocks, and many blocks are subdivided into coarse grids of small inset rectangles (a second, finer grid inside each cell). A few blocks on the right are coarser, holding only 1-2 rows of wide horizontal bars. The overall feel is a Mondrian-like modular grid with heavy vertical rhythm and jittered "ghost" edges where translucent rectangles peek out of the seams.

## How the code works
`settings()` (mantra.pde:17-22) opens a 960x960 P3D window with `smooth(8)`; `setup()` (line 24-26) calls `generate()` once, and `draw()` is empty, so the piece is static.

`generate()` (line 60-116) does:
1. `randomSeed(seed)` / `noiseSeed(seed)` (line 68-69); `background(250)` (line 71) — the pale grey ground.
2. Builds a rect partition: starts with one rect inset by `bb = 20` (line 75-76). `sub = int(random(20))` (line 78): repeatedly picks a random rect and splits it left/right with a 0.4-0.6 ratio (line 79-85) — this is what creates the vertical bands. Then `sub = int(random(60))` (line 87): randomly splits rects top/bottom the same way, but each side is only added with probability 0.4 (line 88-94) — creating the horizontal blocks.
3. For every rect (line 97-109): draws a translucent (`random(255)` alpha) jittered copy first (line 99-101, offset by up to 2x `des`, where `des = random(min(w,h))`), then a solid `rcol()` fill (line 102-103), then calls `grid(...)` (line 104) with 2-8 columns and 2-8 rows, each cell further subdivided into 1-4 x 1-4 sub-cells. 10% of rects get a 1px-wide vertical bar on their left edge (line 105-108).
4. `grid()` (line 118-142) lays a two-level nested grid of inset rects: outer cells inset by `bb = min(cellW, cellH)*0.1`, inner cells inset by `bb2 = min(subW, subH)*0.1` (line 122, 133), every cell filled with `rcol()`.

Colour: `rcol()` (line 159-161) picks uniformly at random from the 5-colour `colors[]` array (line 155). `getColor()` (line 163-172, lerp-based) is defined but unused. Randomness enters at the subdivision counts/splits, the per-rect fill, jitter, grid densities, and the 10% thin-bar chance.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the random rect-splitting (two passes, horizontal then vertical, 0.4-0.6 ratios, probabilistic second pass) is a clean `subdivideRects` candidate; the two-level inset cell grid is a clean `nestedCellGrid` candidate with a pluggable color function.
- One-off art decisions: the specific 5-colour palette (line 155), the 20px outer margin, the 10% thin-bar accent, the ghost-rect jitter, and the P3D renderer (no 3D is actually used — P2D would render identically).
- A clean parameter object: `{margin, nHsplit, nVsplit, splitMin, splitMax, vSplitProb, gridColsRange, gridRowsRange, subColsRange, subRowsRange, cellGapFrac, jitter, thinBarProb, palette}`.
