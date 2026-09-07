---
sketch: 2014/Generativos/pelotitas
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 329
animated: false
techniques: [grid]
primitives: [ellipse, shape]
palette:
  colors: ["#F20765", "#3F3E3C", "#C2C5BC", "#AADECB", "#F9F0D3"]
  selection: random-from-list
composition: centered
parameters: []
reusable_candidates:
  - {name: weightedPick, signature: "weightedPick(weights[], values[]) -> int", note: "rcol(): palette index from weighted random ranges (lines 110-126)"}
  - {name: randomGlyphInCircle, signature: "randomGlyphInCircle(x, y, d, vertexCount) -> void", note: "logo(): circle + polygon from 5 candidate points (4 corner quarter + center), points removed as chosen (lines 53-90)"}
  - {name: diagonalHatch, signature: "diagonalHatch(spacing, alpha, weight) -> void", note: "lineas(): parallel lines (-2,i)-(i,-2) at fixed spacing (lines 92-99)"}
  - {name: brightnessGrain, signature: "brightnessGrain(amount) -> void", note: "noisee(): adds random 0..amount brightness to every pixel via get/set (lines 101-109)"}
---

## What it draws
A 3x3 grid of large circles on a cream background. Each circle is filled with a palette colour
(dark charcoal, grey, or mint), has a thick dark outline, and contains a small flat polygon —
a line, triangle, quad or pentagon — in a contrasting palette colour, with rare magenta
accents (one magenta triangle in the top-middle circle). Faint diagonal hatching shows in the
top and bottom margins; the whole image has a slight brightness grain.

## How the code works
`setup()` calls `generar()` once (line 7); `draw()` is empty, so the sketch is static
(keyPress regenerates). Flow in `generar()` (line 17):
1. `background(paleta[4])` — cream `#F9F0D3` (line 18).
2. `lineas(random(4,18))` (line 19): parallel diagonal lines from `(-2, i)` to `(i, -2)` at
   spacing `tt`, stroke alpha 50, weight 1 (lines 92-99). Mostly covered later by the circles.
3. `noisee()` (line 101): per-pixel `get`/`set` adding `random(5)` brightness to each channel —
   the subtle grain (lines 101-109).
4. Grid: `tam = random(10, width-40)` is the circle diameter (line 40); `bb = tam*random(0.1,0.2)`
   is the gap (line 41); `cw`/`ch` count columns/rows (lines 42-43); a double loop
   (lines 44-50) calls `logo(x, y, tam)` on the centred grid.
`logo` (line 53) picks three distinct palette colours via `rcol()` (line 110) — weighted:
8% magenta, 32% charcoal, 35% grey, 25% mint — draws the circle (fill `ccuer`, stroke `ca`,
weight `tam/30`, lines 65-68), then builds a polygon from 5 candidate points (the 4 corners of
the inscribed quarter-square plus the centre, lines 76-81): it draws `cant = int(random(2,6))`
vertices, removing each picked point (lines 82-89), fill `ca`, stroke `cs`, square caps.
Randomness: global `random()` seed; `rcol()` thresholds; `cant`; which points are picked.
No blend modes; plain JAVA2D.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, library-worthy: `rcol()` weighted palette picker; `lineas()` diagonal hatch;
  `noisee()` pixel grain; the point-pick-and-remove polygon in `logo` (random convex-ish
  glyph from a small candidate set).
- One-off art decisions: the 5-colour palette and its 8/32/35/25 weights, the specific 5
  candidate points (quarter-square corners + centre), circle weight `tam/30`, the grid gap
  factor `0.1-0.2`.
- Clean parameter object: `{diameter, gapFactor, rows/cols (or derived), vertexCountRange,
  palette, weights, hatchSpacing, grainAmount, outlineWeightFactor}`.
