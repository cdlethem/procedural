---
sketch: 2016/Generativos/circlesAndGrids
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 250
animated: false
techniques: [grid, lines-hatching, curves, dots-stippling]
primitives: [line, ellipse, rect]
palette:
  colors: ["#F0F0F0", "#141414", "#F05028", "#F00AC8", "#C8F00A", "#0AF0C8"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: str, default: "random(12, 180)", tried: ["random(60, 180)"], change: large, effect: "thicker, coarser diagonal black stripes; black bands dominate"}
  - {name: div, default: "int(random(2, 40*random(1)))", tried: ["int(random(2, 12))"], change: moderate, effect: "coarser grid; sub consumes one fewer random, so downstream colours/elements shift too"}
  - {name: drawCircle_cc, default: "int(random(4, random(10, 50)))", tried: ["int(random(4, random(10, 90)))"], change: large, effect: "more intersection dots; extra circles shift the random stream, so blocks and white arcs change too"}
  - {name: ccBlocks, default: "int(random(0.05)*div*div)", tried: ["int(random(0.15)*div*div)"], change: moderate, effect: "more and larger coloured blocks; stripes/grid/arcs unchanged"}
  - {name: drawCircle2_cc, default: "int(random(20))", tried: ["int(random(40))"], change: subtle, effect: "many more white circles + thin intersection rings, but strokes cover few pixels"}

reusable_candidates:
  - {name: circleIntersections, signature: "circleIntersections(PVector(x1,y1,d1), PVector(x2,y2,d2)) -> [x1,y1,x2,y2] | null", note: "closed-form intersection points of two circles, null when disjoint/tangent"}
  - {name: intersectionPrimitives, signature: "intersectionPrimitives(center, maxDist, count, sizeRange, drawAt) -> void", note: "generate random circles around a center and emit a primitive at every pairwise intersection"}
## What it draws
A full-bleed 960x960 composition dominated by diagonal black-and-white stripes running from
bottom-left to top-right, overlaid with a thin orange grid and small white squares at every
grid intersection. On top of that sit several thick white circles (some cropped by the
canvas) with tiny crosshair marks at their centers, thin white circles marking where the big
circles intersect each other, and a cluster of saturated filled blobs — orange, magenta,
teal, and yellow-green — scattered in the center and lower half, some of them rectangular
blocks aligned to the grid.

## How the code works
`setup()` (l.1-4) calls `generate()` once; `draw()` is empty, so the piece is static.
`generate()` (l.20-80) layers five elements in order:

1. **Diagonal stripes** (l.23-48): `str = random(12, 180)` sets the spacing; two passes of
| str_60_180 | `float str = random(12, 180);` -> `float str = random(60, 180);` | large | much thicker, coarser diagonal black stripes; the black bands now dominate the canvas | variants/str_60_180/frame_00001.png |
| div_12 | `int div = int(random(2, 40*random(1)));` -> `int div = int(random(2, 12));` | moderate | coarser grid (~12 cells) with yellow-green lines and bigger node squares; the substitution consumes one fewer random, so downstream colours and elements also shifted | variants/div_12/frame_00001.png |
| ccDots_90 | `drawCircle(random(0.3, 0.6), int(random(4, random(10, 50))));` -> `... int(random(4, random(10, 90)));` | large | more small coloured intersection dots (visible clusters top-left and centre); the extra circles consume more randoms, so the coloured blocks and white arcs also differ from baseline | variants/ccDots_90/frame_00001.png |
| ccBlocks_0_15 | `int cc = int(random(0.05)*div*div);` -> `int cc = int(random(0.15)*div*div);` | moderate | more and larger coloured blocks (big magenta block mid-left, orange block top); stripes, grid and white arcs unchanged | variants/ccBlocks_0_15/frame_00001.png |
| ccArcs_40 | `drawCircle2(random(0.3, 0.8), int(random(20)));` -> `drawCircle2(random(0.3, 0.8), int(random(40)));` | subtle | dense web of thick white circles and thin intersection rings over the canvas; underlying stripes/grid unchanged, so only ~8% of pixels differ | variants/ccArcs_40/frame_00001.png |
   background. Because the lines extend well past the canvas, they appear as full-bleed
   diagonal stripes.
2. **Hidden circles → intersection dots** (l.42, `drawCircle` l.82-110): `cc` random circles
   are generated around the center (radius up to `width*maxDist`) but are never drawn
   (the `ellipse` is commented out, l.91). Each overlapping pair's intersection points
   (closed-form `pointsCircle`, l.162-199) gets two small filled dots in a random
   `rcol()` colour. These are the small colored dots clustered around the white arcs.
3. **Grid** (l.50-66): `div = int(random(2, 40*random(1)))` cells of size `ss = width/div`;
   vertical and horizontal lines in random `rcol()` (the orange lines) at weight 1.5, then
   small white rects (`ss*0.1`) at each intersection (l.62-66) — the white squares.
4. **Colored blocks** (l.68-77): `cc = int(random(0.05)*div*div)` random grid-aligned rects
   of 1-4 cells, filled with random `rcol()` — the magenta/orange/teal/yellow blocks.
5. **Big white circles** (l.79, `drawCircle2` l.112-144): `int(random(20))` circles around
   the center, drawn as white strokes with `noFill`, weight `s*0.02` (thick) plus a
   4-armed crosshair at each center; a second pass draws thin white circles at all
   pairwise intersection points (l.131-143).

Colour comes from `rcol()` (l.146-160): 50/50 picks between orange `#F05028` and magenta
`#F00AC8`, or yellow-green `#C8F00A` and teal `#0AF0C8`. All randomness is seeded
deterministically (seed 42) and the stream is consumed in fixed order, so layout, circle
positions and colours are fully reproducible.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `pointsCircle(c1, c2)` (l.162-199) is a clean, generic function: intersection points of
  two circles from (x, y, diameter) triples; returns null when non-intersecting or
  tangent. A strong library candidate:
  `circleIntersections(c1, c2) -> [p1, p2] | null`.
- The "invisible circles, mark their intersections" pattern (used by both `drawCircle`
  and `drawCircle2`) is generic: generate a set of circles around a center, then emit a
  primitive at every pairwise intersection. A clean parameter object would hold:
  center, maxDist, circle count, size range, and a callback for what to draw at each
  intersection (dot / ring / cross).
- The diagonal-stripe pass (`line(-90, i, i, -90)` loops, l.28-30/l.46-48) is a reusable
  `hatchStripe(spacing, weight, offset, color)` primitive.
- The grid + node rects (l.55-66) is a reusable `gridLines(div, color, nodeSize)`.
- One-off art decisions: the specific 4-colour `rcol()` list, the 0.1-size node rects,
  the 45-degree fixed angle, and the crosshair motif.
