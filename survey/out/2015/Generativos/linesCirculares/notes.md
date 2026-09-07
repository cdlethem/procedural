---
sketch: 2015/Generativos/linesCirculares
year: 2015
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 349
animated: false
techniques: [curves, polar]
primitives: [shape]
palette:
  colors: ["#FFE223", "#E9D459", "#70A112", "#385F1B", "#F8CB3D"]
  selection: random-from-list
composition: radial
parameters:
  - {name: count, default: 1000, tried: [300], change: subtle, effect: "fewer petals; slightly thinner, less saturated core, a few fewer long edge petals"}
  - {name: r2Sigma, default: 30, tried: [80], change: moderate, effect: "larger cluster; core spread over a bigger area, more green, petals reach further out"}
  - {name: widthFactor, default: 4/3, tried: [8/3], change: moderate, effect: "wide soft petals; core becomes a big fuzzy yellow-green mass, fine outline threads disappear"}
  - {name: strokeAlpha, default: 20, tried: [60], change: subtle, effect: "petal outlines slightly more visible; overall look essentially unchanged"}
  - {name: fillAlpha, default: 6, tried: [20], change: moderate, effect: "much brighter and more solid; a large luminous disc with long rays reaching the canvas edges"}
reusable_candidates:
  - {name: radialPetals, signature: "radialPetals(count, lengthSigma, widthSigma, strokeAlpha, fillAlpha, palette, cx, cy)", note: "1000 closed 2-bezier leaf shapes centred symmetrically about a point, radiating at random angles with Gaussian length/width"}
---

## What it draws
A near-black square with a dense, roughly circular cluster of translucent petal/leaf
shapes centred on the canvas. The core is a bright, almost solid yellow-green mass built
from thousands of overlapping low-alpha fills; thinner outlined petals in yellow and green
radiate outwards and fade to the dark background, with a few long sparse petals reaching
most of the way to the edges.

## How the code works
`setup()` calls `generar()` once; `draw()` is empty, so the piece is static (lines 9-12,
14-16). `generar()` (lines 18-61):

- `background(2)` paints the near-black field (line 19).
- Colour: each petal picks one of the 5 yellow/green palette colours via `rcol()`
  (lines 73-75) with stroke alpha 20 (line 21) and fill alpha 6 (line 24); the
  commented-out line 21 shows an earlier idea of lerping towards black. `strokeWeight`
  is `random(0,2)` (line 22). The bright centre is pure accumulation of these low-alpha
  overlaps; there are no blend modes.
- Geometry: a random angle `ang` (line 29) and two Gaussian radii, `r1 =
  randomGaussian()*100` (length, line 27) and `r2 = randomGaussian()*30` (half-length
  offset, line 28). The two anchor points `topCenter`/`bottomCenter` (lines 37-45) sit
  symmetrically about the canvas centre at distance |r2| along `ang`; two side points
  (lines 39-49) are offset perpendicular to `ang` by `width_two_thirds = r1*4/3`
  (line 31). `beginShape()` + two `bezierVertex()` segments + `endShape()` (lines
  53-59) close the leaf: the bezier control points are the side points themselves, so
  each half is a smooth bulge from one anchor to the other.
- Because both radii are Gaussian, most petals are small (producing the dense bright
  core) while occasional large ones stretch toward the edges.

Randomness enters at `rcol()`, `random(2)` stroke weight, the two `randomGaussian()`
calls and `random(TWO_PI)`, all seeded by the harness.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for(int i = 0; i < 1000; i++){` -> `... i < 300 ...` | subtle | no visible change: cluster marginally thinner, core a touch less dense | variants/count_300/frame_00001.png |
| r2_80 | `float r2 = randomGaussian()*30;` -> `*80;` | moderate | larger cluster, core spread wider, more green, petals extend further out | variants/r2_80/frame_00001.png |
| width_8x3 | `float width_two_thirds = r1 * 4. / 3;` -> `r1 * 8. / 3;` | moderate | wide soft petals; core becomes a big fuzzy yellow-green mass, fine outline threads gone | variants/width_8x3/frame_00001.png |
| strokealpha_60 | `stroke(rcol(), 20);` -> `stroke(rcol(), 60);` | subtle | no visible change: outlines marginally crisper, same overall look | variants/strokealpha_60/frame_00001.png |
| fillalpha_20 | `fill(rcol(), 6);` -> `fill(rcol(), 20);` | moderate | much brighter, nearly solid: large luminous disc with long bright rays to the edges | variants/fillalpha_20/frame_00001.png |

## Modularisation notes
The generic, reusable block is the whole petal loop: a count, two Gaussian scales
(length/width sigma), a centre point, a palette, and two alphas — a clean
`radialPetals(count, lengthSigma, widthSigma, strokeAlpha, fillAlpha, palette)` function
would cover this sketch and its variants. The specific art decisions are the palette
itself, the 1000-iteration count, the 30 vs 100*4/3 ratio between the two sigmas, and
the 20/6 stroke/fill alpha pair that creates the accumulation glow. The
`keyPressed`/`saveImage` block (lines 63-71) is one-off save plumbing, not part of the
generative core.
