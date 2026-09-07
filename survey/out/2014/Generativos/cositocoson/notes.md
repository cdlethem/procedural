---
sketch: 2014/Generativos/cositocoson
year: 2014
renderer: JAVA2D
size: [800, 600]
libraries: []
deterministic: true
ms_first_frame: 171
animated: false
techniques: [recursion, lines-hatching]
primitives: [ellipse, line]
palette:
  colors: ["#FFFFFF", "#000000", "#1F982C"]
  selection: fixed
composition: scattered
parameters: []
reusable_candidates:
  - {name: randomWeb, signature: "randomWeb(origin, depth, maxBranch) -> void", note: "recursive branching line-web; each edge length 8-16 at random angle, double-stroked white(-1,-1)/black for pseudo-relief"}
  - {name: ringStamp, signature: "ringStamp(x, y, diameter, alpha) -> void", note: "thick noFill ellipse (weight = d/3), white copy offset (-1,-1) under black copy at (x,y), both at low alpha"}
  - {name: crossStamp, signature: "crossStamp(x, y, halfLen, angle, weight) -> void", note: "two perpendicular lines through a point at angle and angle+PI/2"}
---

## What it draws
On a white ground, large translucent gray rings (donuts) of varied size overlap in loose clusters, especially across the center. Interspersed are dense tangles of very thin dark lines (small branching webs, like scribbled nests) and dozens of small thin plus/cross marks scattered over the whole canvas. Overlaps of the gray rings darken where they intersect.

## How the code works
`setup()` (line 1-5) sizes 800x600, paints white, calls `generar()` once; `draw()` is empty so the piece is static. All randomness comes from the seeded `random()`.

`generar()` (lines 26-57) has three layers:
1. **Line webs** (lines 27-30): 20 calls to `recursion()` from random points with depth `int(random(6, 12))`. `recursion()` (lines 59-74) draws one edge of length `random(8, 16)` at a random angle `random(TWO_PI)`, double-stroked as white alpha 80 at offset (-1,-1) and black alpha 80 at (x,y), then recurses into `int(random(n*0.2, n*0.8))` children after decrementing `n` by `int(random(1, 3))`. This exponential-then-collapsing branching produces the dark tangled webs.
2. **Rings** (lines 31-42): `int(random(20))` rings, diameter `random(20, 200)`, `noFill()`, `strokeWeight(tam/3)` (thick relative to size). Each ring is drawn twice: white alpha 60 at (x-1, y-1), then black alpha 60 at (x, y). Black-over-white at 60/255 alpha gives the flat gray donuts; the 1px white under-copy creates the slightly broken/offset rim.
3. **Crosses** (lines 43-53): `int(random(20, 100))` marks, half-length `random(2, 60)/2`, `strokeWeight(2)`: a line through the point at `random(PI)` and a second at `angle + PI/2`, i.e. a random-orientation plus sign.

Line 55-56: a `fill(#1F982C, 20)` rect is commented out, so the green is unused. No blend modes, no shaders.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Three independent stamp layers over a white ground, each a clean candidate function:
- `randomWeb` (the `recursion` function) is fully generic: origin, depth, edge-length range, and branch-count range as parameters; the white/black double stroke is a stylistic option flag.
- `ringStamp` is generic: position, diameter, alpha, offset; the `weight = diameter/3` ratio is an art decision to expose as a parameter.
- `crossStamp` is generic: position, half-length, base angle, weight.
A clean parameter object: `{webCount, webDepth, ringCount, ringDiameterRange, crossCount, crossLengthRange, lineAlpha, ringAlpha}`. The three layers are independent and could be reordered or dropped without affecting each other.
