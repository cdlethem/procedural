---
sketch: 2018/Generativos/gusi
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1489
animated: false
techniques: [lines-hatching, grid]
primitives: [rect, ellipse]
palette:
  colors: ["#FB5D40", "#D48300", "#E5964B", "#008172", "#165253", "#1C1C1A", "#D8D8B9"]
  selection: fixed
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: hatchedRect, signature: "hatchedRect(x, y, w, h, stripeSpacing, stripeWidth, angle)", note: "rotated rect whose body is filled with alternating black/white horizontal stripes instead of a solid fill"}
---

## What it draws
A full-bleed monochrome (black on white) composition of ~240 scattered rectangles of
various sizes, each rotated 0 or 180 degrees. Every rectangle is filled with horizontal
stripes — a thin black bar at the centre plus pairs of thin black and white lines running
the length of the rect — giving the look of densely hatched, slightly sheared blocks
overlapping each other. Stripe density varies per rectangle, so some blocks read as solid
black and others as fine line texture. A tiny dot marks the centre of each rectangle.

## How the code works
`setup()` (gusi.pde:3) sets a 960x960 P2D canvas and calls `generate()` once; `draw()` is
empty, so the sketch is static (frames 10/60 are identical to frame 1).

`generate()` (gusi.pde:23) seeds the RNG from `seed`, fills white, then loops 240 times:

- Position: `random(width)` / `random(height*1.2)`, snapped to a 4px grid with `x -= x%4`
  (lines 33-37) — the loose grid alignment of overlapping edges.
- Size: `s = random(20,160)*4*random(0.2,1)` (line 39) gives a wide spread from a few px
  to ~640px; the rect itself is `s*0.2` wide by `s` tall (line 44).
- Orientation: `rotate(random(PI)*int(random(2)))` (line 42) — the random angle is
  multiplied by an int 0/1, so only 0 or 180 degrees ever appear.
- Hatching: `dd = 2+random(random(40))` (line 45) is the per-rectangle stripe spacing
  (2-42px), `cc = int(s/dd)` the stripe count; the loop (lines 47-52) draws, per stripe,
  a black rect `s*0.42` wide and 1.3px tall, then a white rect `s*0.2` wide at the same
  y. Overlapping pairs leave a thin black line flanked by white — the hatched texture.
  Small `dd` (dense) blocks merge into near-solid black; large `dd` blocks stay lacy.
- A 1px white `ellipse` (line 54) marks each centre.
- Colour is hardcoded: `fill(0)` / `fill(255)` (lines 31, 43, 48-54); the `colors[]`
  palette and `rcol()`/`getColor()` (lines 66-79) are never called — dead code. The
  pre-loop `fill(0, 240)` (line 31) is overwritten inside the loop.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The whole piece is one generic primitive: `hatchedRect(x, y, w, h, stripeSpacing,
stripeWidth, angle)` — a rotated rect filled with alternating black/white stripes —
plus a scatter loop over the canvas. One-off art decisions: the 4px position snap, the
0/180-only rotation (multiplying by `int(random(2))`), the per-rect spacing drawn from
`random(random(40))` (double-random, biased low), and the dead colour palette. A clean
parameter object: `{count, sizeRange, aspectRatio, stripeSpacingRange, stripeWidth,
snapGrid, rotationMode, colors}`.
