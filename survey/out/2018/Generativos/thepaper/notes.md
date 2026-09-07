---
sketch: 2018/Generativos/thepaper
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1685
animated: false
techniques: [grid, dots-stippling, symmetry, lines-hatching]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#EA554F", "#FAC745", "#2760AB", "#369952", "#1E2326", "#FFF7F3"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, shd1, shd2)", note: "full-ring annulus built from quad strips with two alpha fills — fakes a 3D-shaded circle"}
  - {name: stripedSquare, signature: "rr(size, stripeCount, amp)", note: "rotated square with vertical stripe hatching and a soft offset shadow layer"}
---

## What it draws
A dense, edge-to-edge collage of rotated black-and-white striped squares in
many angles and stripe widths, producing moiré-like interference where they
overlap, on a near-black background. Scattered flat circles in red, yellow,
green, blue, off-white and black sit on top; the larger ones read slightly
three-dimensional thanks to faint shaded rings. A faint dot grid and a few
thin horizontal black line clusters are just visible in the background.

## How the code works
`setup()` sizes 960x960 P2D and calls `generate()` once (draw() is empty, so
the piece is static; a keypress re-generates).
- L23: background is a random palette colour (`rcol()`, L122-124 picks from
  the 6-colour `colors[]` list at L121).
- L25-35: a 30 px grid of tiny `rect`s — 2x2 at alpha 40 and 20x20 at alpha
  10 — draws the faint stippled dot grid.
- L37-48: 200 random rotated squares via `rr()` (L77-93): an optional white
  base rect (80% chance), then `cc` vertical black stripes of width
  `dw*amp` over a 4% oversized copy, giving the striped-square look; the
  size is `random(80, random(100,220))*0.8`, stripe count 6-20, stripe
  amplitude 0.1-0.9, each square rotated randomly.
- L49-59: a handful (2-20) of thin horizontal black line clusters
  (`rect(x, y+4*j, s, 1.5)`), mostly hidden under the squares.
- L62-73: 50 circles, each with a soft dark shadow ellipse offset by up to
  10% of the size, a flat `rcol()`-coloured ellipse, and two `arc2()` rings
  (L95-113): an outer white ring with alpha fading from 255 to 0 (glossy
  top) and an inner dark ring, plus a dark outer ring (alpha 30) — these
  fake the sphere shading.
Randomness enters only through `random()` calls (seeded via the `seed`
field); colour is always random-from-list.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `arc2` is a clean, self-contained primitive: shaded annulus from quad
  strips with independent inner/outer alphas — reusable for any
  "sphere-ish" shading.
- `rr` (striped square) is a good candidate: size, stripe count, stripe
  ratio, and shadow offset are already parameterised.
- The grid stipple (two alpha layers over a spacing) and the "circle +
  shadow + two rings" compositing are both generic building blocks.
- One-off art decisions: the 6-colour palette, the 30 px grid spacing, the
  200-square / 50-circle counts, and the size ranges.
- A parameter object: `{gridSize, dotAlpha, squareCount, squareSizeRange,
  stripeCountRange, stripeAmpRange, lineClusterCount, circleCount,
  circleSizeMax, palette}`.
