---
sketch: 2017/Generativos/remove
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1545
animated: false
techniques: [subdivision, grid, lines-hatching]
primitives: [rect, shape]
palette:
  colors: ["#EBB858", "#EEA8C1", "#D0CBC3", "#87B6C4", "#EA4140", "#5A5787"]
  selection: lerp-between
composition: full-bleed
parameters:
reusable_candidates:
  - {name: subdivide, signature: "subdivide(RectList, iterations, splitStrategy)", note: "random recursive halving/quartering of a rectangle list"}
  - {name: nestedRects, signature: "nestedRects(cx, cy, w, h, count, exp, colorOffset, colorStep)", note: "concentric shrinking rects with power-law falloff and cycling palette"}
  - {name: cornerShade, signature: "cornerShade(x, y, w, h, alphas[4])", note: "four translucent black triangles from center to corner pairs, bevel/facet effect"}
  - {name: rectStrip, signature: "rectStrip(p1, p2, w1, h1, w2, h2, steps, colorOffset, colorStep)", note: "row of rects lerped along a line with lerped size"}
  - {name: cycleLerp, signature: "cycleLerp(int[] palette, float t) -> int", note: "cyclic lerp between adjacent palette entries"}
---

## What it draws
Full-bleed composition on a tan/gold field. The whole canvas is covered by concentric
nested rectangles cycling through a six-colour palette (gold, pink, warm grey, teal,
red, indigo), so the outer frame is a thick gold band stepping inward through the
other colours. Over this, diagonal stair-stepped bands of thin rectangles march
corner to corner in red/pink and grey/teal/gold, and translucent black triangular
wedges from each block's centre to its corners give a faceted, bevelled 3D look.
Dominant colours: tan/gold, red, indigo/blue-grey, with pink and teal accents.

## How the code works
`setup()` (L1-6): 960x960 P2D, `smooth(8)`, `pixelDensity(2)` (unavailable on the
headless display, harmless warning), then `generate()`. `draw()` is empty (L9-11),
so the piece is static; `keyPressed()` regenerates on any non-'s' key (L13-16).

`generate()`:
- Background (L35-36): a random palette colour is drawn, then immediately
  overwritten with black — dead code, the black is never visible.
- Subdivision (L40-62): starts with one full-canvas `Rect`. `div` iterations
  (hardcoded `0`) would pick a random rect, split it in half vertically or
  horizontally, or quarter it, and remove the original. With `div = 0` there is
  always exactly one full-canvas rect.
- Nested rectangles (L64-80): for each rect, `sub = int(random(1, 80))`
  concentric rects are drawn centred on the rect, shrinking by
  `sca = 1 - pow(j/sub, exp)` with `exp = random(0.5, 1)`, each filled by
  `getColor(dc*j + ic)` — a cyclic lerp through the 6-colour palette (L195-200)
  — with a faint `stroke(0, 4)`. This produces the nested-ring look.
- Corner wedges (L82-109): four `beginShape()` triangles from the rect centre to
  two adjacent corners, black with different alphas (90/50/60/30), giving the
  faceted bevel shading.
- Diagonal strips (L112-145): per rect, `cc = int(random(10, 30))` strips; each
  strip draws `sub = int(random(20, random(20, 220)))` rects interpolated along a
  line between two random points (L130-133, biased toward the right half via
  `random(0.5, 1)`), with width and height lerped between random start/end values
  scaled by `ms = random(0.05, 0.5)` times the rect size (L117). Fill cycles the
  palette per step. This makes the stair-stepped diagonal bands.
- Two large commented-out blocks (L147-188) contain earlier experiments.

All randomness is plain `random()`; with `--seed 42` the output is deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic, library-worthy blocks:
- the recursive rectangle subdivision loop (L40-62) is a clean
  `subdivide(list, iterations, strategy)` with strategy = halve-or-quarter;
- the concentric shrinking-rects loop (L76-80) is a parameterised
  `nestedRects` (count, power falloff, colour offset/step);
- the four-triangle centre-to-corner shading (L82-109) is a reusable
  `cornerShade` bevel with a 4-alpha parameter;
- the lerped rect strip (L136-143) is a reusable `rectStrip`;
- `getColor` (L195-200) is a cyclic palette lerp, a standard palette helper.

One-off art decisions: the specific wedge alphas (90/50/60/30), the ranges for
`ms`, `cc`, `sub`, the right-half bias in the strip endpoints
(`random(0.5, 1)`), the exact six-colour palette, and the dead double-background
at L35-36. A clean parameter object: `{seed, div, nestCount, nestExp,
wedgeAlphas[4], stripCount, stripSteps, stripScale, palette[]}`.
