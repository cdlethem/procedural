---
sketch: 2014/Generativos/enfermita
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 594
animated: false
techniques: [polar, dots-stippling, curves]
primitives: [ellipse]
palette:
  colors: ["#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: concentricRings, signature: "concentricRings(x, y, dim, count, weightFactor) -> void", note: "count concentric no-fill ellipses at (x,y), total span dim/2, stroke weight = (dim/2/count)/weightFactor"}
  - {name: dotRing, signature: "dotRing(x, y, radius, count, dotSize) -> void", note: "count filled dots evenly spaced on a circle of given radius (polar placement)"}
  - {name: scatterGroups, signature: "scatterGroups(n, xRange, yRange, sizeRange, countRange) -> void", note: "loop drawing one ring+dotRing group per iteration at random centers/sizes"}
---

## What it draws
A full-bleed, densely packed mosaic of overlapping circle groups on a white ground. Each
group is a set of soft concentric rings in pastel random colours (dominantly pale green,
lavender, pink and cream in the seed-42 render) with a ring of small bright white dots
clustered around the group's outer edge. The heavy overlap and low stroke alpha make the
colours blend into a uniform speckled texture with no focal point.

## How the code works
- `setup()` (lines 1-4): `size(600, 800)` then `generar()` once. `draw()` (lines 6-7) is
  empty, so the piece is static; `keyPressed()` (lines 8-10) regenerates.
- `generar()` (lines 12-28): loop of 1000 iterations. Each picks a random RGB stroke with
  alpha 50 (line 14), a random center (lines 15-16), a diameter `dim = random(20, 400)`
  (line 17) and a count `cant = int(random(5, 20))`.
- `circulo()` (lines 30-37): step `tam = dim/2/cant`, `strokeWeight(tam/4)`, `noFill()`;
  draws `cant` concentric outline ellipses with diameters `tam*i` (i = 0..cant-1), so the
  rings fill from the center out to about `dim/2`. These produce the soft pastel rings.
- `fill(255, 190)` (line 19) then `circulo2()` (lines 39-44): `r = dim/2`, angular step
  `TWO_PI/cant`; draws `cant` small filled white ellipses of diameter `r/cant` on a circle
  of radius `r` around the center — the bright white dot clusters at each group's rim.
- Randomness enters only via `random()` (centers, colours, sizes, counts); with a fixed
  seed the result is deterministic. There are no transforms or blend modes — the look
  comes purely from dense overlap of alpha-50 strokes and alpha-190 white fills.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `circulo()` and `circulo2()` are clean, self-contained drawing primitives (concentric
  rings at a point; dots evenly placed on a circle) and would work as library functions as
  in `reusable_candidates`.
- The `generar()` loop is the generic scatter driver: n groups at random centers/sizes
  feeding the two primitives. A clean parameter object would be `{n, sizeMin, sizeMax,
  countMin, countMax, ringAlpha, ringWeightFactor, dotAlpha, dotSizeFactor}` — currently
  these are hardcoded at lines 13, 14, 17, 18-20, 19, 32, 43.
- One-off art decisions: the fixed low alpha 50 for rings vs alpha 190 for the white dots
  (the contrast that makes the dots pop), and the `strokeWeight = step/4` rule tying ring
  thickness to ring spacing.
