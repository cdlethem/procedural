---
sketch: 2019/generativos/aquaman
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1793
animated: false
techniques: [flow-field, noise-field, particles, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#F23602", "#300F96", "#C9FFF6", "#F72C81", "#09EFA6", "#fac62a"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: 1000, tried: [300], change: large, effect: "shorter, fatter, smoother ribbon bodies; fewer beaded tail trails; a few soft orbs remain"}
  - {name: maxSize, default: "random(50)*random(8) (max 400)", tried: ["random(50)*random(2) (max 100)"], change: large, effect: "thin worm-like ribbons, no big orbs, much more white background shows through"}
  - {name: alpha, default: 250, tried: [80], change: subtle, effect: "composition unchanged; overlaps slightly softer/washed, the dense mass stays near-opaque (only 8.8% of pixels differ)"}
  - {name: detAng, default: "random(0.01)", tried: ["random(0.03)"], change: large, effect: "tighter curls: paths collapse into discrete round orbs/discs with a few thin squiggly worms between them"}
  - {name: count, default: 200, tried: [600], change: large, effect: "much denser mass, almost no background visible, heavier overlap of ribbons and orbs"}
reusable_candidates:
  - {name: flowFieldRibbons, signature: "flowFieldRibbons(count, steps, maxSize, maxVel, angDetail, colorDrift, palette, alpha) -> void", note: "2-D simplex-noise flow field; N random walkers draw ellipses whose size follows a sin^4 envelope and whose colour drifts along the path"}
---

## What it draws
A dense full-bleed tangle of semi-transparent ribbons and squiggly worm-like
trails in saturated orange, purple, teal-green, yellow and pink, over a near-white
background. Interspersed are rows of small bead-like dots (the thin ends of the
ribbons) and several large soft radial "orbs" — bright centres fading to a halo —
that look like glowing spheres. Everything overlaps at ~98% opacity so the
composition reads as a busy, layered, confetti-like mass.

## How the code works
`setup()` loads an unused GLSL shader (`post.glsl`; the `filter(post)` call is
commented out, so no post-processing is actually applied) and calls `generate()`
(aquaman.pde:23-33).

`generate()` (46-95):
- Seeds RNG and noise from `seed`, then `randPallets()` (102-111) rebuilds the
  palette: 3-5 random colours drawn from the fixed 6-colour list
  `#F23602 #300F96 #C9FFF6 #F72C81 #09EFA6 #fac62a` (line 122).
- `background(250)` gives the near-white ground.
- Outer loop (56-91): 200 random start points, snapped to a 10 px grid
  (`x -= x%10`). Each point gets a random palette index `ic`, a small colour
  drift `dc = random(0.01)`, a random flow-field offset pair
  (`desAng/detAng`, `detAng = random(0.01)`) and a velocity pair
  (`desVel/detVel = random(0.0001)`).
- Inner loop (78-90): 1000 steps. At each step the walker queries
  `SimplexNoise.noise(desAng + x*detAng, desAng + y*detAng) * TAU` for a heading
  and a second noise for speed `vel ∈ [0, maxVel]` (`maxVel = random(10,20)`),
  then moves `cos/sin(ang)*vel`. The ellipse size is
  `pow(sin(tt*PI), 4) * maxSize` with `maxSize = random(50)*random(8)` (≤ 400):
  near-zero at both ends of the path (producing the dotted-bead trails) and
  maximal in the middle (producing the fat ribbon bodies; when `maxSize` is
  large the overlapping semi-transparent ellipses read as soft radial orbs).
- Fill is `getColor(ic + dc*k)` with alpha 250: `getColor(v)` (129-135)
  interpolates between two neighbouring palette entries at position `v`, so the
  colour drifts smoothly along each ribbon.
- Randomness enters via `random()` for every start point, field offset, size and
  speed; the field itself is `toxi SimplexNoise`. The sketch is fully
  deterministic under a fixed seed (baseline `deterministic: true`).

`draw()` is empty; regeneration is only via `keyPressed()` (38-44).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_300 | `int cc = 1000;` -> `int cc = 300;` | large (mean 0.2665, 82.3% px) | shorter, fatter, smoother ribbon bodies; far fewer beaded dot trails; a couple of soft orbs (green top-left) still present | variants/cc_300/frame_00001.png |
| maxSize_2 | `float maxSize = random(50)*random(8);` -> `*random(2);` | large (mean 0.3484, 82.2% px) | thin worm-like ribbons and beads only; the big radial orbs are gone and much more white background shows through | variants/maxSize_2/frame_00001.png |
| alpha_80 | `fill(getColor(ic+dc*k), 250);` -> `..., 80);` | subtle (mean 0.0283, 8.8% px) | composition and density unchanged; overlaps slightly softer/washed, the mass still reads near-opaque | variants/alpha_80/frame_00001.png |
| detAng_0.03 | `float detAng = random(0.01);` -> `random(0.03);` | large (mean 0.2867, 89.3% px) | tighter noise curls: long ribbons collapse into many discrete round orbs/discs with a few thin squiggly worms between them | variants/detAng_0.03/frame_00001.png |
| count_600 | `for (int i = 0; i < 200; i++)` -> `i < 600;` | large (mean 0.2695, 85.4% px) | much denser mass, almost no white background left; heavier overlap of ribbons and orbs, same colours | variants/count_600/frame_00001.png |

## Modularisation notes
- Generic / library candidate: the whole `generate()` body is a parameterisable
  "noise-flow-field ribbon" primitive — parameters: walker count (200), steps
  per walker (`cc` = 1000), size envelope (`pow(sin(tt*PI), 4) * maxSize`),
  max velocity (10-20), angular noise detail (`detAng`), velocity noise detail,
  colour drift per step (`dc`), palette, alpha (250). The sin^4 size envelope
  (fat middle, beaded ends) is the defining trick and is worth keeping as a
  named option.
- One-off art decisions: the specific 6-colour palette, the 10 px start-point
  grid snapping, `random(50)*random(8)` as a heavy-tailed size distribution,
  the near-opaque alpha 250.
- The loaded-but-unused `post.glsl` filter is dead weight; a clean parameter
  object would be `{count, steps, maxSize, maxVel, angDetail, velDetail,
  colorDrift, palette, alpha, sizeEnvelope: "sin4"}`.
