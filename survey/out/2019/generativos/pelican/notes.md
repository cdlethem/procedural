---
sketch: 2019/generativos/pelican
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3223
animated: false
techniques: [grid, voronoi-delaunay, noise-field]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#F76AE2", "#F4251A", "#EAEAEA", "#1BC6C1", "#1D38AF", "#FFCC00"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: eyes.count, default: 60, tried: [25], change: large, effect: "fewer eyes, more open background, larger/sparser mesh triangles"}
  - {name: eyes.baseSize, default: "width*random(0.08,0.1)*0.8", tried: ["width*random(0.15,0.2)*0.8"], change: large, effect: "much larger circles, denser overlap, mesh buried under discs"}
  - {name: eyes.sizeJitter, default: 10, tried: [3], change: large, effect: "more uniform eye sizes, no giant circles, calmer composition"}
  - {name: mesh.fillAlphaMax, default: 60, tried: [200], change: subtle, effect: "white Delaunay wash slightly more visible, composition nearly unchanged"}
  - {name: ribbons.count, default: 10, tried: [3], change: moderate, effect: "fewer, bolder ribbons; wisp layer thinned, eyes read more clearly"}
  - {name: ribbons.detail1, default: "random(0.001)*10", tried: ["random(0.004)*10"], change: moderate, effect: "finer noise field for one walker, tighter denser curls in wisp layer"}
reusable_candidates:
  - {name: arcRing, signature: "arcRing(x, y, r1, r2, col, alphaIn, alphaOut) -> void", note: "concentric ring built from quads with radial alpha gradient (radial fan texture)"}
  - {name: noiseRibbon, signature: "noiseRibbon(p1, p2, steps, detail, offset, speed, color, alpha) -> void", note: "two points walk a 2D simplex-noise angle field, drawing a fading line between them each step (wisp/feather)"}
  - {name: gridScatter, signature: "gridScatter(n, cell, radius, seed) -> PVector[]", note: "random points snapped to a pixel grid with radial (center-weighted) falloff"}
  - {name: delaunayOverlay, signature: "delaunayOverlay(points, fillAlpha) -> void", note: "white translucent Delaunay mesh with faint dark edges over a point set"}
---

## What it draws
Light off-white ground sprinkled with a sparse grid of tiny grey dots. Over it, dozens of large
overlapping "eye" circles in saturated pink, red, teal, blue, yellow and orange, each with a
radial fan texture, a smaller colored iris disc, a black pupil and a tiny white glint. A
translucent white triangular mesh with faint dark edges washes across the middle of the
canvas, and several wispy multicoloured ribbons of fading lines (blue, yellow, orange, white)
curl between the circles. Dominant colours: off-white, saturated red/pink, teal/blue/yellow.

## How the code works
- `settings()` (L14-19): 960×960, P2D, `smooth(8)`.
- `generate()` (L44): `background(240)` light grey (L49).
- **Dot grid** (L51-70): 400 iterations; position `random(-200, w+230)` snapped to a 30 px
  grid (`x -= x%30`, L58-59); draws a 5×5 rect grey 220 (L66-67) with a 1×1 lighter dot on top
  (L68-69); with probability 0.2 a 25×25 near-white rect (L61-64). Produces the sparse dot
  lattice in the background.
- **Eyes** (L72-123): 60 iterations. Position center-weighted: `random(-0.8,0.8)*random(1.4)*(w/2+30)+w/2`
  (L78-79), snapped to 30 px. Base diameter `width*random(0.08,0.1)*0.8` (L80) then multiplied by
  `1+int(random(0,10)*random(1)*random(0.7,1))` (L96) — a random integer 1..10, giving the wide
  size range (small dots up to ~700 px circles). Fill always from `colors2` (L98:
  `random(1) < 0.0` never picks `colors1`). With probability 0.6 (L100): filled ellipse alpha
  240 (L102) plus two `arc2` rings (L104-105) — thin inner ring and wide outer ring; `arc2`
  (L195-212) draws the ring as many quads with alpha ramping `alp1→alp2`, which creates the
  radial fan/spoke texture. Every eye also gets a small colored iris `s*0.4` + ring (L114-116),
  a black pupil `s*0.1` alpha 200 (L119-120) and a tiny white glint `s*0.02` (L121-122).
- **Delaunay mesh** (L125-138): `Triangulate.triangulate(points)` over the eye centers, drawn
  as one TRIANGLES shape with per-vertex `fill(255, random(60))` and `stroke(0,14)` — the
  translucent white wedge wash with faint dark edges.
- **Noise ribbons** (L142-185): per-ribbon noise detail `random(0.001)*10` and offsets
  `random(10000)` (L142-145). 10 ribbons (L147): two random eye points (L148-149),
  `cc = int(random(80,200)*random(0.5,1)*3)` steps (~120-600), speed `random(1,4)*random(0.5,1)`,
  alpha fixed 200 (L160). Each step: angle = `noise(x*det, y*det)*TAU` for each point (L164-165),
  draw a line p1→p2 with alpha `map(j,0,cc,200,0)` (L177-178), then advance both points along
  their noise angles (L180-183) — producing the curling, tapering wisps.
- Randomness enters only via `randomSeed(seed)`/`noiseSeed(seed)` (L46-47); `draw()` is empty,
  so the image is static (frames 10/60 identical).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| eyes_25 | `for (int i = 0; i < 60; i++) {` -> `for (int i = 0; i < 25; i++) {` | large | ~40% fewer eyes: canvas more open with large white areas, remaining eyes spread out, Delaunay triangles bigger and sparser | variants/eyes_25/frame_00001.png |
| eyesize_0.15 | `float s = width*random(0.08, 0.1)*0.8;` -> `float s = width*random(0.15, 0.2)*0.8;` | large | base circle diameter ~2x larger: discs cover most of the canvas, heavy overlap, saturated colour field, white mesh mostly buried | variants/eyesize_0.15/frame_00001.png |
| sizespread_3 | `s *= 1+int(random(0, 10)*random(1)*random(0.7, 1));` -> `s *= 1+int(random(0, 3)*random(1)*random(0.7, 1));` | large | size jitter capped at ~3x: no giant circles, uniform medium-sized eyes, calmer composition, background and mesh more visible | variants/sizespread_3/frame_00001.png |
| meshalpha_200 | `fill(255, random(60)*random(1));` (x3) -> `fill(255, random(200)*random(1));` | subtle | white Delaunay wash slightly more opaque/visible over the circles; composition otherwise nearly identical to baseline | variants/meshalpha_200/frame_00001.png |
| streaks_3 | `for (int i = 0; i < 10; i++) {` -> `for (int i = 0; i < 3; i++) {` | moderate | only 3 ribbons instead of 10: wisp layer thinned to a few bold white/yellow/pink bands, eyes read more clearly | variants/streaks_3/frame_00001.png |
| det1_0.004 | `float det1 = random(0.001)*10;` -> `float det1 = random(0.004)*10;` | moderate | finer noise field for one walker: ribbons curl tighter and denser across the middle, wisp layer busier than baseline | variants/det1_0.004/frame_00001.png |

## Modularisation notes
- **Generic (library candidates)**: `arcRing` (L195-212) is a self-contained radial-fan ring
  parameterised by radii/colours/alphas. The ribbon walk (L163-184) is a generic
  noise-field trail: two walkers + fading line, parameterised by detail, offset, speed, steps,
  alpha. The snapped center-weighted scatter (L78-83) and the translucent Delaunay overlay
  (L125-138) are both reusable as-is.
- **One-off art decisions**: the eye anatomy (iris/pupil/glint stack, L100-122), the specific
  30 px snap and the 200 background grey, the `random(1) < 0.0` dead branch (L98), the
  near-duplicate noise detail for the two walkers (L142-145), the commented-out palette blocks
  (L216-231).
- **Clean parameter object**: `{ dotGrid: {count, cell, size, bigChance}, eyes: {count,
  baseSize, sizeJitter, fanChance, palette}, mesh: {fillAlphaMax, edgeAlpha}, ribbons:
  {count, steps, speed, detail, offset, alpha, palette} }` — every visual layer is independent
  and would decompose into a layer renderer with these knobs.
