---
sketch: 2018/Generativos/dada
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1512
animated: false
techniques: [grid, polar, curves]
primitives: [rect, shape]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: gradientAnnulus, signature: "gradientAnnulus(x, y, innerD, outerD, a1, a2, col, alphaIn, alphaOut) -> void", note: "fill an annulus from many thin quads, alpha fading inner->outer; the ring primitive here"}
  - {name: snapToGrid, signature: "snapToGrid(v, cell) -> float", note: "v - v%cell, used to snap random points onto the cell grid"}
---

## What it draws
On a solid black canvas, a handful of small solid squares (orange and red) sit at scattered
positions. Around each square is a large, thin ring (annulus) several cells in radius, rendered
with a radial fade: near-transparent on its inner edge and more saturated on its outer edge.
Rings are blue or amber, and where they overlap the translucent fills layer into a soft,
glowing, stacked look. Only a few cells are occupied, so the composition reads as a sparse
scattering of squares-and-halos on black.

## How the code works
`settings()` (dada.pde:9-13) sets 960x960 P2D, smooth(8), pixelDensity(2). `setup()` (15-23)
calls `generate()` once; `draw()` (25-26) is empty, so the piece is a one-shot static image
(frames 1/10/60 identical). `keyPressed` re-rolls the seed and regenerates.

`generate()` (46-65) is the whole piece:
- `randomSeed(seed)` (48) makes it deterministic per seed; `background(0)` (49) paints black.
- `sub = int(random(6,15))` (51) picks the grid division; `ss = width/sub` (52) is the cell size.
- `cc = int(sub*sub*random(0.4))` (53) is the count of occupied cells (~40% of all cells).
- Loop 54-64: each iteration draws a random point (55-56) snapped to the grid (`x -= x%ss`,
  57-58). It fills a solid square `rect(x,y,ss,ss)` (59-60) in `rcol()`, then sets an (unused)
  `stroke(255,20)` (62) and draws the halo via `arc2` (63) centred on the cell centre, inner
  diameter `sss*0.8`, outer diameter `sss`, colour `rcol()`, alpha 0 (inner) -> 200 (outer).
- `sss = ss*int(random(1,8))` (61) is the ring's outer diameter, 1-8x the cell, so rings span
  many cells.

`arc2()` (72-90) is the ring primitive: it splits the annulus into `cc = int(r2*PI*ma)` thin
quads (77), each with two inner vertices at radius r1 filled at `alp1` and two outer vertices
at radius r2 filled at `alp2`, closed (81-88). The ~hundreds of slices give the fine texture,
and the inner-alpha-0 / outer-alpha-200 fill produces the transparent-inner, opaque-outer
radial fade. No transforms (no translate/rotate/scale) and no explicit blend mode; the layered
look comes from default alpha compositing of overlapping translucent rings.

Colour: squares are a solid random pick from `colors[]` via `rcol()` (125-127); rings use the
same random colour with the 0->200 alpha gradient. `colors[]` (123) is
{#FF3D20, #FC9D43, #3998C2, #3E56A8, #090D0E}. Note: `PShader post` (3) is declared but never
created or used, so despite `uses_shader:true` in result.json no shader is actually applied.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
`arc2`/`arc3` (72-108) are generic "filled annulus from N slices with an inner->outer alpha
gradient" primitives — a clean `gradientAnnulus(x, y, innerD, outerD, a1, a2, col, aIn, aOut)`
library function. The `x -= x%ss` snap (57-58) is a reusable `snapToGrid`. The rest — the
specific 5-colour palette, the 0->200 alpha pair, the `sss = ss*int(random(1,8))` size law, and
the ~40% occupancy factor — are one-off art decisions. A clean parameter object would hold:
`{sub, occupancy, ringSizeRange, squareFrac, innerAlpha, outerAlpha, colors}`.
