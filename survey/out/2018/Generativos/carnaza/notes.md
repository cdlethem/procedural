---
sketch: 2018/Generativos/carnaza
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1961
animated: false
techniques: [grid, dots-stippling, lines-hatching, polar]
primitives: [rect, ellipse, line]
palette:
  colors: ["#01903B", "#FEE643", "#F3500A", "#0066B8", "#583106", "#F4EEE0"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: gridDots, signature: "gridDots(cellCount, dotRatio, fillOptions) -> void", note: "grid cells each filled with a probability-gated centred dot (black/white)"}
  - {name: crossHatch, signature: "crossHatch(cellX, cellY, cellSize, lines, color) -> void", note: "two families of parallel lines offset by one cell, forming a crosshair pattern"}
  - {name: thickCircle, signature: "thickCircle(cx, cy, radius, weight, color) -> void", note: "ellipse stroked at weight ~= radius, reads as a solid disc with a soft dark rim"}
---

## What it draws
A dark-brown full-bleed canvas with a faint square grid (about 6 cells across).
Small black and cream dots are scattered at the centres of individual grid cells.
One large solid orange-red circle dominates the upper centre, and to the right of
centre there is a compact blue crosshair made of thin horizontal and vertical lines
spanning roughly one cell. A few dots sit on or near the crosshair lines.

## How the code works
`setup()` (carnaza.pde:3-8) calls `generate()` once; `draw()` is empty, so the
image is static (frames 10/60 are identical). `seed` (line 1) is reassigned by
`keyPressed` but never passed to `randomSeed`; the harness pins it, and the
render is deterministic.

`generate()` (lines 22-120):
1. `background(rcol())` (line 23): background is one colour drawn at random from
   the 6-colour `colors[]` list (line 148) — here dark brown `#583106`.
2. Grid: `cc = int(random(4, 50))` cells (line 25); each cell is stroked as a
   `rect` with near-invisible alpha (`stroke(0, 8)`, line 30-34), producing the
   faint grid.
3. Dots: for each cell, with probability 0.5 a small ellipse of diameter
   `sss = ss*0.2` (line 27) is drawn at the cell centre (lines 39-44), filled
   black or white 50/50 (lines 37-38). The rotation (line 41) is in 45-degree
   steps and has no visible effect on the circle.
4. Overlay shapes: `c2` iterations (line 50), each a random type `rnd` 0-3:
   - rnd 0 (lines 54-72): a rectangle of random width/height in cells, with one
     dimension forced to 1 cell (lines 62-63) — a thin strip — drawn with a
     +2px dark offset copy behind a `rcol()` fill (a drop-shadow effect).
   - rnd 1 (lines 73-87): an ellipse in CORNERS mode spanning several cells with
     `strokeWeight(ss)` (lines 78, 81-84): the stroke is so thick it fills the
     interior, reading as a large solid disc in a `rcol()` colour with a faint
     dark rim (the +2px offset copy). This is the big orange circle.
   - rnd 2 (lines 88-105): a crosshair at a grid vertex — 8 horizontal and 8
     vertical lines each (lines 94-98 dark offset, 100-104 in `rcol()`), i.e.
     the blue line pattern.
   - rnd 3: nothing.
`arc2` (lines 123-141) is dead code, never called. Palette selection is
`rcol()`, a uniform random pick from the 6-colour list (lines 149-151).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the grid + probability-gated centred dots (a `gridDots` function with
  cell count, dot ratio, fill colours); the crosshair line cluster (`crossHatch`);
  the thick-stroke disc (`thickCircle`); the offset-shadow rectangle trick.
- One-off art decisions: the specific 6-colour palette, the 4-way random type
  dispatch, the +2px dark offset for the pseudo-drop-shadow, the forced 1-cell
  strip dimension.
- A clean parameter object: `{ cellCount, dotRatio, dotFill, dotProbability,
  overlayCount, palette, backgroundColour, gridAlpha }`.
