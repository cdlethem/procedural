---
sketch: 2018/Generativos/huevo
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1681
animated: false
techniques: [subdivision, grid, curves, blend-modes, dots-stippling]
primitives: [rect, ellipse, arc, shape]
palette:
  colors: ["#2E0551", "#FF00C7", "#01AFC2", "#FDBE03", "#F4F9FD"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: subdivideQuad, signature: "subdivideQuad(rect, iterations) -> Rect[]", note: "repeatedly split a random leaf quad into 4 sub-quads"}
  - {name: splitCircles, signature: "splitCircles(cx, cy, r, splits) -> PVector[]", note: "binary-split one circle into two smaller ones at opposite random angles"}
  - {name: ringShade, signature: "ringShade(x, y, s1, s2, col, a1, a2)", note: "arc2(): tapered semi-transparent ring drawn as fan of quads"}
---

## What it draws
A 2x2 mosaic of four flat, poster-like "eggs": each quadrant is a large softly shaded
circle (teal, orange-brown, pink, pale blue) sitting on a dark or bright ground, with a
small cluster of 3–7 overlapping circles inside it — some with crescent shading, some with
colored ring highlights. Thick colored grid lines (white, dark purple, teal, yellow) cross
each quadrant, and tiny colored arc specks are scattered sparsely over the whole image.
The look is flat vector / risograph-ish, dominated by deep purple, magenta, teal and
orange-yellow.

## How the code works
`setup()` (huevo.pde:3) sets 960x960 P2D and calls `generate()` once; `draw()` is empty
so the piece is static. `generate()`:
- `background(250)`; the whole canvas is put into a `Rect` list and recursively
  subdivided: `sub = int(random(50)*random(1))` iterations (line 40; with seed 42 the
  value is 1, giving the 4 visible quadrants). Each iteration picks a random leaf and
  replaces it with its 4 half-size children (lines 41–52) — classic quad-tree splitting.
- For each leaf cell (lines 56–115):
  1. fill the cell with `rcol()` (random palette color, line 59) and a near-invisible
     black stroke.
  2. circle cluster: one seed circle of radius `0.9*min(r.w,r.h)` at the cell center
     (line 62) is split `div = int(random(20))` times (line 67); each split replaces a
     circle by two children of radii `c.z*random(0.2,0.8)` and the remainder, placed at
     opposite random angles (lines 75–80). Each final circle gets three layers
     (lines 84–91): `arc2()` draws a tapered semi-transparent black ring (alpha 30 and
     10) just outside the ellipse — the crescent shading; a solid `ellipse` in
     `rcol()`; and a small `arc2()` ring in `rcol()` at alpha 80 (the bright ring
     highlights).
  3. a two-tone overlay: a 4-vertex `beginShape` quad with two different
     `rcol()` fills at alpha `random(120)` (lines 93–100) — a diagonal semi-transparent
     tint that mutes half the cell.
  4. the grid: `cw,ch = int(random(2,10))` (lines 102–103) vertical and horizontal bars
     of thickness `bb = floor(min(r.w/cw, r.h/ch)*random(0.02,0.06))`, drawn as opaque
     `rect`s in `rcol()` on top of everything (lines 106–114). This produces the thick
     colored grid lines.
- Final pass (lines 117–129): 1000 random arcs of size `width*random(0.012)`, each drawn
  twice — a black offset copy at alpha `random(20)` (shadow) and a `rcol()` copy at
  alpha `random(240)` — the scattered specks.
`rcol()` (line 159) picks uniformly from the 5-color palette at line 158
(`#2E0551 #FF00C7 #01AFC2 #FDBE03 #F4F9FD`); `getColor()` (lerp variant) is defined but
unused. All randomness comes from Processing's seeded `random`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, reusable: the quad-tree subdivision (line 41–52) is a clean
  `subdivideQuad(rect, iterations)`; the circle binary-splitting (lines 63–82) is a
  self-contained `splitCircles` that only needs a seed circle and a split count; `arc2`
  (lines 132–150) is a ready-made tapered-ring primitive.
- Art-specific: the 3-layer circle rendering (black crescent + solid + colored ring),
  the two-tone quad overlay, the in-cell grid bars, and the 1000-arc speckle pass are
  all one-off decisions.
- A clean parameter object: `{subdivisions, circleSplits, circleScale (0.9),
  gridCols/Rows (2–10), gridWeight (0.02–0.06), speckCount, palette}`.
