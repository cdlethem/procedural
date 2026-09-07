---
sketch: 2018/Generativos/chea04
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1550
animated: false
techniques: [particles, distortion, blend-modes]
primitives: [rect, line]
palette:
  colors: ["#1A1312", "#3C333B", "#A84257", "#D81D37", "#D81D6E"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: lineSquares, signature: "lineSquares(x1, y1, x2, y2, density, amp, alpha1, alpha2, osc) -> void", note: "squares distributed along a random line with lerped size/rotation/alpha"}
---

## What it draws
A full-bleed, soft, layered composition in reds: a dark maroon/crimson background covered by
hundreds of large translucent square outlines in deep red, crimson and magenta, overlapping so
densely that they read as smoky petal-like washes. Faint thin straight lines cross the field
underneath, and a few near-black square outlines stand out where alpha overlaps. The overall
effect is an abstract, organic, almost botanical red mist with no hard focal point.

## How the code works
Single-shot generation in `setup()` -> `generate()` (chea04.pde L22-60); `draw()` is empty, so
the image is static. The seed is set once (L1, reseeded from key presses L14-20; the harness
pins it via the `seed` field).

- L26: background is a random palette colour (dark maroon `#1A1312` here).
- L28-29: `rectMode(CENTER)`, `noFill()` — all squares are stroke-only, so overlaps accumulate
  via additive alpha rather than opaque fills.
- L30-37: 60 iterations; each draws a random chord (endpoints in a box extended 200 px beyond
  the canvas, L31-34) with a low-alpha stroke (alpha 10, L36) in a random palette colour
  (`rcol()`, L89-91). These are the faint straight lines.
- L38-46: per-line parameters: start/end rotation angles `ang1/ang2` (0..3*TAU), amplitude
  `amp1/amp2` = `random(400)` (square size, up to 400 px), alpha `alp1/alp2 = random(40)*random(1)`
  (so effectively ~0-16), and an oscillation factor `osc1`.
- L47-58: inner loop walks `cc = int(dist*2)` squares along the chord; at each step it
  translates to the lerp position, rotates by the lerp angle, and strokes a centred square of
  side `amp = lerp(amp1, amp2, v)` with alpha `lerp(alp1, alp2, v)`. Because size, angle and
  alpha are all lerped along the line, each chord becomes a tapered, rotating band of squares;
  the 60 bands crossing the canvas produce the smoky, petal-like overlap field.
- The `cir` ellipse (L55-56) is commented out; `arc2()` (L62-80) and `getColor()` (L92-100)
  are dead code in this sketch.
- Renderer P3D (L4) with `smooth(8)`; the anti-aliasing plus low-alpha strokes gives the soft,
  hazy edges.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the "squares along a line" builder (L38-58) is a reusable primitive — a set of
  stroke-only rects distributed along a segment with lerped position/rotation/size/alpha.
  Parameter object: `{x1, y1, x2, y2, density, amp, alpha1, alpha2, osc}`.
- Generic: the random-chord generator (L31-34) with an overscan margin is a small helper
  (`randomChord(margin) -> (x1, y1, x2, y2)`).
- One-off art decisions: the 5-colour red palette, the 60-chord count, alpha scale
  (`random(40)*random(1)`), the `dist*2` density, and the square-only primitive (vs. the
  commented-out ellipse).
- The dead `arc2()` (segmented ring between two radii) is itself a candidate library function
  but is not exercised by this sketch.
