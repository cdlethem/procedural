---
sketch: 2020/generative/01_04/troilo
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1478
animated: false
techniques: [grid, curves]
primitives: [rect, ellipse]
palette:
  colors: ["#A5D0A8", "#8CADA7", "#110B11", "#B7990D", "#F2F4CB"]
  selection: random-from-list
composition: margins
parameters: []
reusable_candidates:
  - {name: cornerRings, signature: "cornerRings(x, y, w, h, rings, kind) -> void", note: "arcs or rects shrinking toward a cell corner, corner re-randomised per ring"}
  - {name: lerpPalette, signature: "getColor(palette, v) -> color", note: "lerp between adjacent palette entries with pow(v, 0.6) easing"}
---

## What it draws
A 10x10 grid of square cells covering most of the canvas, with a one-cell-wide olive-yellow margin visible on the right and bottom. Each cell is filled with 20 concentric quarter-circle arcs or nested rectangles that shrink toward the cell's corners; the corner switches from ring to ring, so cells show interlocking spirals of arcs and L-shaped bands. Colours are a muted five-colour set: light green, grey-teal, near-black, dark olive yellow, and pale cream.

## How the code works
- `setup()` calls `generate()` once (line 24); `draw()` is empty (line 34-36), so the piece is static. `keyPressed` regenerates with a new seed (lines 38-44).
- `randomSeed(seed)` / `noiseSeed(seed)` (lines 48-49); background is one random palette colour via `rcol()` (line 51).
- Grid count `cc = int(random(4, 12*random(1)))` (line 53) — 10 for seed 42. Cell size `sw = width/(cc+1)` (lines 54-55), which is why the grid stops one cell short of the right/bottom edges.
- Double loop over cc x cc cells (lines 58-104). With 90% probability a base cell-size rect is filled with `getColor()`, a lerp between two adjacent palette colours (lines 62-63, 126-131).
- `rnd = int(random(2))` (line 64) is chosen once per cell: 0 = arc cell, 1 = rect cell.
- Inner loop k = 0..div-1 with `div = 20` (lines 65-66): `v = 1 - k/div` (line 67) shrinks each ring toward the corner; fill is a fresh random palette colour `rcol()` (line 68). Arc cells draw a quarter-circle `arc()` of diameter `2*sw*v` centred on a randomly chosen cell corner (lines 69-83); rect cells draw a corner-aligned `rect` of size `sw*v x sh*v` (lines 84-100). The corner is re-randomised every ring, producing the spiral effect.
- Palette is the 5-colour array at line 116; `rcol()` picks uniformly (lines 118-120). No transforms, no blend modes. Renderer P3D with `smooth(8)` (lines 18-19).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the corner-ring generator (shrinking arcs or rects toward a corner with per-ring corner re-rolling) is the core reusable primitive; `getColor`'s adjacent-palette lerp with pow easing is a small reusable palette helper; the `width/(cc+1)` margin grid is a one-line convention.
- One-off art decisions: the specific 5-colour palette, the 90% base-rect probability, the 50/50 arc-vs-rect split per cell, 20 rings.
- A clean parameter object would be: `{cols, rings, baseFillProb, arcProb, palette, bgColor}`.
