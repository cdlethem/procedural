---
sketch: 2018/Generativos/tutela
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 1477
animated: true
techniques: [grid, noise-field]
primitives: [rect, shape]
palette:
  colors: ["#EC629E", "#E85237", "#ED7F26", "#C28A17", "#114635", "#000000"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: "random(4,10)", tried: [], change: null, effect: ""}
  - {name: bb, default: 2, tried: [], change: null, effect: ""}
  - {name: s2Scale, default: "random(0.5)", tried: [], change: null, effect: ""}
  - {name: palette, default: "warm 6-color list", tried: [], change: null, effect: ""}
  - {name: shadeAlpha, default: 40, tried: [], change: null, effect: ""}
reusable_candidates:
  - {name: roomCell, signature: "roomCell(cx, cy, size, inner, offset, alphas)", note: "outer rect + noise-offset inner rect + two alpha-shaded trapezoid connectors (the 'room' motif)"}
  - {name: noiseDrift, signature: "noiseDrift(x, y, t, amp) -> (dx, dy)", note: "noise field sampled at (x, y, t) minus 0.5, scaled by (s1-s2)"}
---

## What it draws
A full-bleed 9x9 grid of square cells, each filled with a saturated colour drawn
from a warm palette (pinks, reds, oranges, mustard, dark green, black). Inside
each cell a smaller square floats at a noise-driven offset, connected to the
top and bottom edges of its cell by trapezoids shaded in translucent black, so
each cell reads as a small room or box receding in depth. Cells are separated
by thin light-grey gaps (the background colour shows through a 2px margin).
The inner squares vary in size and position from cell to cell; across frames
they drift slowly (animated), and every 120 frames the whole grid is re-rolled.

## How the code works
- `setup()` (tutela.pde:3-9) sets 960x960 P2D, `smooth(8)`, and calls `generate()`;
  `draw()` (tutela.pde:11-13) calls `generate()` every frame, so the piece is an
  animation, not a one-shot.
- `generate()` (tutela.pde:23): `time = millis()*0.001` (line 25); re-seeds every
  120 frames (line 28); `randomSeed(seed)` (line 31); background `#DEE1DA` (line 33).
- Grid: `cc = int(random(4, 10))` cells per side (line 35, 9 for seed 42), cell size
  `dd = width/cc` (line 36), margin `bb = 2` (line 38).
- Nested `j`/`i` loops (lines 41-75) over the grid:
  - outer rect: size `s1 = dd - bb`, centred in the cell (lines 44-48), filled with
    `rcol()`, a uniform pick from the 6-colour palette (lines 132-135).
  - inner square: `s2 = s1*random(0.5)` (line 51), centred on the cell centre but
    displaced by the noise field: `x2 = x1+(s1-s2)*(noise(x1,y1,tt)-0.5)` and
    `y2 = y1+(s1-s2)*(noise(y1,x1,tt)-0.5)` (lines 52-53), with `tt = time*random(2)`
    (line 50) — this is what makes the inner squares drift over time and makes
    frame-to-frame output non-deterministic (noise z depends on `millis()`).
  - two `beginShape` quads (lines 57-64, 66-73) join the outer rect's top and bottom
    edges to the inner rect's top and bottom edges, filled black with low alpha
    (40/20 and 20/80), producing the shaded "walls" of the room illusion.
- `stroke(0, 20)` (line 40) gives the faint outlines on the rects.
- `arc2()` (lines 109-127) and the commented-out blocks (76-101) are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- The per-cell "room" motif (outer rect + noise-offset inner rect + two alpha-shaded
  trapezoid connectors) is fully generic and could be a library cell function
  `roomCell(cx, cy, size, inner, offset, alphas)`; the noise offset itself is a
  small `noiseDrift(x, y, t, amp)` helper.
- The grid driver (cell count, margin, centred rect mode) is trivial and reusable
  as a `tiledGrid(cc, margin)` context.
- One-off art decisions: the 6-colour warm palette (line 132), the specific alpha
  pairs (40/20, 20/80) that tune the depth illusion, the 2px margin, and the
  120-frame re-roll cadence.
- A clean parameter object would be: `{cells: int, margin: px, innerScaleMax: float,
  noiseAmp: float, palette: int[], alphas: [a1, a2, b1, b2], rerollFrames: int}`.
