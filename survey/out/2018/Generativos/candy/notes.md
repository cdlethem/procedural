---
sketch: 2018/Generativos/candy
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2503
animated: false
techniques: [packing, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#434E20", "#E8AF36", "#F56546", "#446E9A", "#F6EDDD"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: packFactor, default: 0.48, tried: [], change: none, effect: ""}
reusable_candidates:
  - {name: poissonPack, signature: "poissonPack(n, sizeRange, minDist) -> PVector[]", note: "rejection-sampled packing; keep point if dist to all existing > (existing.size+new.size)*factor"}
  - {name: speckleDisc, signature: "speckleDisc(x, y, r, c1, c2, count, speckleFrac) -> void", note: "draw shadowed disc then scatter two-tone tiny dots inside"}
---

## What it draws
A full-bleed field of scattered discs ("candies") on a solid steel-blue ground, in warm
olive-green, amber/gold, coral-red and cream. Discs come in many sizes from large (up to
~250 px) down to tiny; each disc is offset by a soft dark drop-shadow toward the lower-right.
Every disc is peppered with small two-colour speckle dots packed into its interior, so each
reads like a frosted or sprinkled candy. Large discs overlap smaller ones; the field is dense
in the middle and thinner at the edges.

## How the code works
`setup()` (candy.pde:3-9) sizes 960×960 P2D, smooths, then calls `generate()` once;
`draw()` (11-12) is empty, so the image is static. `keyPressed` (14-20) reseeds on any key.

`generate()` (22-76):
- Picks a random background colour `back` from the 5-colour `colors[]` list (line 23, 90-92),
  a shadow `shaw` = background darkened 5% (24), and a foreground `colo` != back (25-26).
- Packing loop (30-43): tries 200,000 random candidate points, each with a random radius
  `s = width*random(0.3)*random(1)` (line 33, 0 to ~288 px, skewed small). A candidate is kept
  only if its distance to every already-kept point exceeds `(other.r + s)*0.48` (line 37), so
  bigger discs push each other further apart — a rejection-sampled (Poisson-like) packing.
- Render loop (45-75): for each kept point, `pushMatrix()` -> translate to the point (offset
  up-left by `dd = s*0.1`, line 50-52), a random rotation (53), pick two distinct colours
  c1/c2 (55-57). Draws the shadow ellipse `fill(shaw,120)` at (0,0) (58-60), then the main
  disc `fill(c1)` shifted by `dd` (61-63). Then a speckle loop (65-73): 100 tiny dots, each at a
  random angle, size `ss = s*random(0.08,0.12)` (67), radius from centre
  `des = acos(random(PI))*(s-ss)*0.33` (68) — the `acos(random(PI))` biases dots toward the
  disc rim; a c1 dot is drawn slightly offset (70) and a c2 dot on top (72), giving the
  two-tone speckle. `popMatrix()` (74).

Randomness enters at: background/foreground colour pick, every candidate position+radius,
per-disc c1/c2, per-disc rotation, and every speckle angle/size/radius/colour. No noise, no
shader.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Two blocks are generic and reusable:
1. **Packing** (lines 30-43): a pure rejection sampler `poissonPack(n, sizeRange, minDist)`
   returning accepted points. The `(other.r + s)*factor` rule is the key parameter; the O(n·m)
   nearest check is the obvious optimisation target (a spatial grid / quadtree) for a library.
2. **Speckled disc** (lines 45-75): `speckleDisc(x, y, r, c1, c2, count, speckleFrac)` — the
   shadowed two-tone speckled disc. The `acos(random(PI))` rim-bias and the 0.08-0.12 speckle
   fraction are the tunable look.

One-off art decisions: the fixed 5-colour palette, the 0.48 packing factor, the 0.33 rim
distance, the shadow offset `dd = s*0.1` and alpha 120, and the c1 offset `-ss*0.03` that
gives each speckle a slight two-tone edge.

A clean parameter object would be: `{palette, candidates, sizeMax, packFactor,
shadowOffsetFrac, shadowAlpha, speckleCount, speckleSizeRange, speckleDistFactor,
speckleEdgeOffset}`.
