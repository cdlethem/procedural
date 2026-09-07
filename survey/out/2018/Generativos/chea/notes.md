---
sketch: 2018/Generativos/chea
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1512
animated: false
techniques: [spiral, curves]
primitives: [rect, line]
palette:
  colors: ["#FACD00", "#FB4F00", "#F277C5", "#7D57C6", "#00B187", "#3DC1CD"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: sweptSquareRibbon, signature: "sweptSquareRibbon(x1, y1, x2, y2, nSteps, ang1, ang2, amp1, amp2, alp1, alp2, col) -> void", note: "parametric sweep of a stroked square (size/rotation/alpha lerped) along a segment; envelope of the sweep reads as a spiral ribbon"}
  - {name: polarArcBand, signature: "polarArcBand(x, y, r1, r2, a1, a2, col, alphaIn, alphaOut) -> void", note: "tessellated arc band between two radii; present in code but never called"}
---

## What it draws
On a flat teal-green background, 10 faint ribbon-like figures made of overlapping
translucent square outlines. Each ribbon follows a straight but invisible path from
corner to corner: the squares grow/shrink and twist as they travel, so their outer
edges trace smooth spiral and caustic-like envelopes. One large yellow-green ribbon
dominates the lower half, a pink/violet one sits upper-right with a tight coiled
end, and a few paler teal ones fade into the background. Where strokes overlap,
colours accumulate into brighter bands.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static
(chea.pde:3-12). `generate()` (chea.pde:22-57):

- reseeds `randomSeed`/`noiseSeed` with `seed` (1, 24-25) and fills the background
  with one random palette colour via `rcol()` (26, 86-88).
- Outer loop runs 10 times (30): each iteration picks a random segment
  `(x1,y1)-(x2,y2)` (31-34) and one random stroke colour (35).
- The segment itself is drawn once as a nearly invisible line, alpha 10 (36-37).
- Inner loop (46-55): `cc = int(dist*2)` steps (41); at each step `v = j/cc` it
  translates to `lerp` position on the segment (50), rotates by
  `lerp(ang1, ang2, v)` with random start/end angles in `[0, TAU*10)` (38-39, 51),
  and strokes a centred square of side `lerp(amp1, amp2, v)` where both amplitudes
  are `random(200)` (42-43, 52-53). Stroke alpha lerps between two
  `random(40)` values (44-45, 48). `noFill()` (29) means only the square outlines
  are drawn; with P3D + `smooth(8)` the many translucent edges overlap and
  accumulate, which is what produces the bright spiral envelopes in the image.
- Randomness enters through: background colour, segment endpoints, segment colour,
  start/end angles, both square amplitudes, both alphas (all `random()`); `noise()`
  is seeded but never used.
- `arc2()` (59-77) builds a filled polar arc band from quads but is never called;
  `getColor` (89-97) is also unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The whole visual is one reusable primitive: the swept-square ribbon (generate,
lines 30-56). A clean `sweptSquareRibbon` function would take the segment
endpoints, step count, angle/size/alpha start-end values and colour, and draw the
lerped chain of stroked squares; the art decision is the randomisation of those
parameters per segment and the choice of 10 segments over a solid random
background. `polarArcBand` (arc2) is a ready-made generic helper (tessellated
annular sector) that could be lifted straight into a library despite being unused.
A parameter object would be: `{segments, stepsPerUnit, ampRange, angRange,
alphaRange, lineAlpha, palette, bgFromPalette}`.
