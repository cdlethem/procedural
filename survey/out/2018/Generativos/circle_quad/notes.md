---
sketch: 2018/Generativos/circle_quad
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1716
animated: false
techniques: [grid, polar, curves]
primitives: [shape]
palette:
  colors: ["#FF18C0", "#FF4556", "#FF6726", "#EFA11C", "#B5B346", "#DA6548", "#3A9FAB"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: annulusSector, signature: "annulusSector(x, y, r1, r2, a1, a2, col, shd1, shd2[, shd3])", note: "polar ring sector of thin quads, alpha ramped across the ring (arc1/arc2)"}
  - {name: centerFan, signature: "centerFan(x, y, w, h, c1, c2, alp1, alp2)", note: "square split into 4 edge-to-center triangles with per-side fills (pyram)"}
---

## What it draws
A full-bleed 960x960 image of soft, overlapping translucent circles on a coarse grid.
With seed 42 the grid is 2x2 (cells ~480 px): four quadrants of faintly different
opaque tints (orange top-left, pink/red top-right, green/teal bottom-right, orange
bottom-left), a bright pink near-opaque disc in the centre, and large lens/petal
shapes where the big translucent circles overlap. Warm pink/orange dominates, with
olive and teal accents bottom-right; everything reads as soft radial gradients.

## How the code works
`setup()` (L3-8) sizes 960x960 P2D, `smooth(8)`, then `generate()` once; `draw()`
is empty (static, L10-12). `generate()` (L22-97) fills black, then:

1. **Grid of quads** (L25-47): `cc = int(random(2, random(10,24)))` is the grid count
   (seed 42 lands on cc=2, cells `ss = width/cc` ~ 480 px). For each cell two
   opaque `beginShape` squares are drawn with per-vertex fills: first square takes
   two `getColor()` palette colours (L31-47), second the same two plus a
   green/teal `color(random(100), random(180))` pair (L49-60); a coin flip `hor`
   (L37) swaps which corners get which colour, so each cell is a two-tone quad.
2. **Quarter-circle shading** (L62-76): four `arc1()` calls place a quarter annulus
   (radius 0 -> ss/2) at each cell corner, i.e. one full gradient disc per grid
   point. `arc1` (L140-158) builds the ring from thin polar quads whose alpha ramps
   from `shd1` (80-140) at the inner edge through `shd2` (80-100) to `shd3` (0-50)
   at the outer edge, giving the soft radial glow.
3. **Overlay circles and fans** (L81-96): over a (cc+2)^2 grid of lattice points,
   `arc2()` (L161-179, same ring-of-quads construction, flat alpha per ring)
   stacks: a near-opaque disc of radius ss/2 (alpha 250), a tiny ring, two large
   low-alpha discs of radius ss centred on cell centres (alpha 0-40 and 0-120) —
   their overlaps are the big lens/petal shapes — and two small discs of radius
   0.205*ss (alpha 50 / 0-100). Then `pyram()` (L99-133) fans four edge-to-centre
   triangles across each cell, alpha up to 120, adding faint square-edge tints.
4. **Colour**: palette of 7 warm hues (L181); `rcol()` picks uniformly
   (L182-184), `getColor()` lerps between adjacent palette entries (L188-194).
   No blend modes; the whole soft look is pure alpha accumulation on P2D.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `arc1`/`arc2` are the same algorithm (polar annulus sector built from thin quads,
  alpha ramped or flat across the ring) with one extra shading stop — a single
  `annulusSector(x, y, r1, r2, a1, a2, col, alphaStops[])` would cover both.
- `pyram` is a generic 4-triangle centre fan; useful as a cell-shading primitive.
- The quad pass (two per-cell two-tone squares with the `hor` coin flip) is a
  one-off art decision but trivially parameterisable.
- A clean parameter object: `{cc, cellColors: [c1, c2], quadHorizon: bool,
  arcAlphas: [a1, a2, a3], discAlpha, bigCircleAlphas: [a1, a2], smallCircleAlphas:
  [a1, a2], fanAlphas: [a1, a2], palette}`.
