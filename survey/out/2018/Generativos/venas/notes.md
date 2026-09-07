---
sketch: 2018/Generativos/venas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2364
animated: false
techniques: [noise-field, lines-hatching]
primitives: [line]
palette:
  colors: ["#141414", "#7FD1E2", "#4D2F53", "#E22570", "#30C09D", "#EAB300"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: det, default: "random(0.001)", tried: ["random(0.004)"], change: large, effect: "finer, denser contour bands; same band structure at smaller scale"}
  - {name: tolerance, default: 0.002, tried: [0.008], change: large, effect: "walkers wander inside wider noise bands: bands become thick, fuzzy, scribbled"}
  - {name: walkers, default: 1000, tried: [250], change: large, effect: "much sparser: fewer, thinner bands with large empty gaps"}
  - {name: alpha, default: 90, tried: [200], change: moderate, effect: "same band structure, lines more opaque; bands read as solid saturated stripes"}
  - {name: steps, default: 10000, tried: [2500], change: large, effect: "short strokes only: long continuous contours lost, texture becomes broken speckled scribble"}
reusable_candidates:
  - {name: traceNoiseContours, signature: "traceNoiseContours(scale, offset, tolerance, walkers, maxSteps, palette) -> void", note: "random-walk iso-contour tracing: each walker stays where |noise(p)-start| < tolerance, drawing 1px segments"}
---

## What it draws
Dense field of thin 1px lines on a near-black background forming swirling,
contour-like bands that wrap around one another in closed loops and nested
rings. The lines cluster into thick organic stripes (like topographic or
veined marble) in cyan/teal, magenta/pink, purple, and yellow, with dark
gaps where no walker lingered. The whole canvas is covered at high density;
some regions (e.g. a yellow patch in the lower-middle) are much denser than
others.

## How the code works
`setup()` (venas.pde:3-8) sizes the canvas 960x960 P2D and calls
`generate()` once; `draw()` is empty, so the piece is static (frames 1/10/60
are identical).

`generate()` (venas.pde:21-47):
- Background is dark grey `background(20)` (~#141414).
- `det = random(0.001)` (line 24) is the noise scale and `des = random(1000)`
  (line 25) a random noise offset; with the harness seed both are fixed.
- Outer loop (line 27): 1000 walkers, each starting at a random point
  `xx,yy` (lines 28-29). The starting noise value `val = noise(...)` (line 30)
  is the iso-level for that walker; initial heading `dir` is random (line 31).
- Inner loop (line 33): up to 10000 steps of 1px each. The walker proposes a
  step in a perturbed direction `ndir = dir + random(random(-HALF_PI),
  random(HALF_PI))` (line 34), computes the noise value `nv` at the proposed
  point (line 37), and only moves (`line()` at 40, position update 42-43) when
  `abs(nv-val) < 0.002` (line 39) — i.e. it traces the contour of its starting
  noise value, which produces the concentric band structure. Heading gets a
  small random walk `dir += random(-0.1, 0.1)` (line 38) whether or not it
  moves, so stuck walkers eventually turn and keep drawing.
- Colour: each walker's stroke is set once per walker as `stroke(rcol(), 90)`
  (line 32) — a random colour from the 5-colour array (line 56) at alpha 90.
  The commented-out array (line 55) shows an earlier 6-colour palette.
  `getColor()`/`getColor(float)` (lines 60-68) lerp between palette entries but
  are never called; `rcol()` (57-59) is what is used.
- Randomness enters via the start points, the noise offset/scale, per-walker
  colour, and the step jitter; all seeded by `seed` (line 1).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.004 | `float det = random(0.001);` -> `float det = random(0.004);` | large | finer, denser contour bands; same swirling band structure at a smaller scale, more rings visible | variants/det_0.004/frame_00001.png |
| tolerance_0.008 | `if (abs(nv-val) < 0.002) {` -> `if (abs(nv-val) < 0.008) {` | large | bands become much thicker and fuzzy: walkers roam inside wide noise bands, filling them with dense scribble | variants/tolerance_0.008/frame_00001.png |
| walkers_250 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 250; i++) {` | large | much sparser: fewer, thinner bands, large dark gaps between them | variants/walkers_250/frame_00001.png |
| alpha_200 | `stroke(rcol(), 90);` -> `stroke(rcol(), 200);` | moderate | same band structure; lines more opaque so bands read as solid, highly saturated stripes | variants/alpha_200/frame_00001.png |
| steps_2500 | `for (int j = 0; j < 10000; j++) {` -> `for (int j = 0; j < 2500; j++) {` | large | long continuous contours lost: canvas becomes short broken strokes and speckled scribble filling the bands | variants/steps_2500/frame_00001.png |

## Modularisation notes
- Generic core: the walker loop (lines 27-46) is a self-contained "noise
  iso-contour tracer" — parameterise scale, noise offset, tolerance, walker
  count, max steps, step jitter, and colour/alpha policy and it is reusable.
- One-off art decisions: the 5-colour palette, alpha 90, dark background, and
  the "propose in a randomly rotated direction" steering (vs a gradient-based
  contour follower). The unused `getColor` lerp helpers are dead code.
- Clean parameter object: `{noiseScale, noiseOffset, tolerance, walkers,
  maxSteps, stepJitter, colors[], alpha, background}`.
