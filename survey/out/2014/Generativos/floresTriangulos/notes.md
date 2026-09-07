---
sketch: 2014/Generativos/floresTriangulos
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 214
animated: false
techniques: [grid, polar, symmetry, dots-stippling, lines-hatching]
primitives: [ellipse, line]
palette:
  colors: ["#D7D3CE", "#F2ECB1"]
  selection: fixed
composition: centered
  - {name: t, default: 20, tried: [40], change: none, effect: "no visible change — dot grid is low-alpha (fill 250,20); doubling the cell size barely moves pixels"}
  - {name: da, default: "TWO_PI/3", tried: ["TWO_PI/4"], change: subtle, effect: "central triangle rosette switches from 3-fold to 4-fold symmetry; only the faint inner outlines shift"}
  - {name: triangleCount, default: 200, tried: [400], change: subtle, effect: "more concentric triangle rings, rosette extends slightly further out; still faint"}
  - {name: dis, default: 200, tried: [350], change: moderate, effect: "white circle flower grows to span the full canvas; large rim circles reach the frame edges"}
  - {name: circleCount, default: 300, tried: [150], change: subtle, effect: "flower becomes sparser with more gaps between circles; overall ring shape unchanged"}
reusable_candidates:
  - {name: radialDotGrid, signature: "radialDotGrid(cx, cy, cell, alpha) -> void", note: "grid of filled circles whose radius grows with distance from a center"}
  - {name: concentricPolygons, signature: "concentricPolygons(cx, cy, n, sides, step) -> void", note: "nested regular polygons, radius and stroke weight growing per ring"}
  - {name: scatteredRing, signature: "scatteredRing(cx, cy, count, maxR) -> void", note: "random un-filled circles clustered in a disc/ring around a center"}
---

## What it draws
A portrait, warm-grey/taupe field (`#D7D3CE`) overlaid with a very faint radial dot
grid. A dense "flower" of overlapping white outlined circles sits at the center,
denser toward the rim and sparser in the middle, with faint concentric triangles
radiating out from the same center. A soft filled white disc with thin concentric
rings and three small cream/yellow dots sits top-left, and a dark vertical band of
thin lines runs down the right edge.

## How the code works
Single `generar()` pass in `setup()`; `draw()` is empty, so the sketch is static
(seed 42; `randomSeed(seed)` at line 13 makes it deterministic).

- **Lines 18-26 — radial dot grid.** Nested `i`/`j` loops over a cell of `t=20`.
  Each cell draws a `noStroke()` filled circle `fill(250,20)` whose diameter
  `tam = t*dis/height` scales with `dis = dist(center, cell)`. Near the center the
  dots are tiny; near the corners they grow, producing the faint stippled texture
  that reads as a radial vignette.
- **Lines 28-37 — concentric triangles.** `i` from 0..199. Each ring is a
  `triangle()` with three vertices at `ang`, `ang+da`, `ang+2*da` where
  `da = TWO_PI/3` (120°, i.e. an equilateral triangle) and radius `tt = i*10`.
  `strokeWeight` and black `stroke` alpha both map up with `i`. The 120° symmetry
  gives the 3-fold rosette of faint dark triangle outlines at the center.
- **Lines 39-43 — vertical dark band.** 80 `line()`s at `xx = width*0.66+i`
  spanning the full height, `stroke(5, map(i,0,80,30,0))`. The right-hand dark
  band with a faint diagonal sheen (the diagonal read comes from the dot grid
  showing through).
- **Lines 45-55 — the white flower.** 300 `noFill()` circles, each placed at a
  random angle and `dis = random(200)` from the center, radius `tam = dis/4`.
  Because radius grows with distance, large rings land near the rim and small ones
  near the middle — the overlapping white circle cluster. Stroke is near-white
  `random(248,252)` with `strokeWeight(tam/10)`.
- **Lines 57-65 — top-left disc + rings.** A filled `fill(250,60)` circle of
  radius `width*0.2` at `(0.25w,0.25h)`, then 10 `noFill()` concentric circles
  with `strokeWeight(1.5 - i/10)` growing outward — the soft halo.
- **Lines 68-73 — cream dots.** Three `fill(#F2ECB1)` circles shrinking along a
  short horizontal run from the disc — the small yellow dots.

Colour is fixed per block (no random palette): taupe background, near-white
strokes/fills, black/near-black lines, cream `#F2ECB1` accents.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| t_40 | `int t = 20;` -> `int t = 40;` | none | no visible change — the faint dot grid is barely affected by a larger cell (low alpha) | variants/t_40/frame_00001.png |
| da_4 | `float da = TWO_PI/3;` -> `float da = TWO_PI/4;` | subtle | central triangle rosette becomes 4-fold (square) instead of 3-fold; only faint inner outlines differ | variants/da_4/frame_00001.png |
| tri_400 | `for(int i = 0; i < 200; i++){` -> `for(int i = 0; i < 400; i++){` | subtle | faint concentric triangle outlines extend a little further from center, denser; overall still subtle | variants/tri_400/frame_00001.png |
| dis_350 | `float dis = random(200);` -> `float dis = random(350);` | moderate | white circle flower grows to fill the whole canvas; large rim circles reach the edges | variants/dis_350/frame_00001.png |
| ring_150 | `for(int i = 0; i < 300; i++){` -> `for(int i = 0; i < 150; i++){` | subtle | flower is sparser — more empty space between circles, mid-cluster thinner — but ring shape unchanged | variants/ring_150/frame_00001.png |

## Modularisation notes
The dot grid (radialDotGrid), the nested-polygon rosette (concentricPolygons), and
the random-circle ring (scatteredRing) are all generic and reusable — each is a
self-contained loop driven only by a center, a count, and a radius rule. The
vertical band, the top-left disc/halo, and the three cream dots are one-off art
placements. A clean parameter object would carry: center (x,y), cell size `t`,
dot alpha, triangle {count, sides, step, weightRange, alphaRange}, band
{x0, count, alphaRange}, ring {count, maxRadius}, and the accent {x,y, radius,
color}.
