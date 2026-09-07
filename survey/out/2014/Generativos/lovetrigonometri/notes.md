---
sketch: 2014/Generativos/lovetrigonometri
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 708
animated: false
techniques: [polar, particles, curves, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#7DA110", "#F61529", "#85725D", "#101B29", "#E2E5EE"]
  selection: random-from-list
composition: radial
parameters:
  - {name: cc, default: 1200, tried: [3000], change: moderate, effect: "more steps around the ring: dots sampled 2.5x denser, ribbons more solid, knot denser"}
  - {name: amplitud, default: "random(0.2, 0.4)", tried: ["random(0.4, 0.55)"], change: large, effect: "larger ring radius: loop spreads to fill the canvas, bead trails radiate farther"}
  - {name: cant, default: "random(3, 300)", tried: ["random(3, 40)"], change: moderate, effect: "particle count cap (seed 42: 87 -> 13): tangle much sparser, few thin ribbons"}
  - {name: strokeAlpha, default: 30, tried: [90], change: subtle, effect: "more opaque solid lines; same paths, less see-through overlap"}
  - {name: cv, default: "random(1, 10)", tried: ["random(6, 10)"], change: moderate, effect: "higher ring modulation frequency (3.6 -> 7.1): wavier lobed ring, similar density"}
reusable_candidates:
  - {name: modulatedRing, signature: "modulatedRing(cx, cy, amp, freq, phase, steps) -> point[]", note: "radius = width*(amp - cos(2pi*t*freq)/20) sampled over steps; the base ring every particle is steered toward"}
---

## What it draws
On a near-black background, dozens of translucent, ribbon-like wavy lines in red,
green, off-white, dark navy and beige tangle together into an irregular closed loop
around the centre, like a knotted ring of glowing rope. Around it, thin dotted
"bead-chain" trails in the same palette radiate outwards and some short straight
streaks escape the ring. Everything is soft and see-through, with heavy overlap in
the dense parts of the loop.

## How the code works
`setup()` (lines 11-18) creates 20 particles (unused; `draw()` is empty, line 20)
and calls `generar()`, which does all the drawing in one pass, so the sketch is static.

`generar()` (lines 36-58):
- `cant = int(random(3, 300))` particles are spawned (line 38), all at the same
  point (240, 240) (line 40).
- Random parameters per run: `cv = random(1,10)` (modulation frequency, line 43),
  `av = random(TWO_PI)` (phase, line 44), `amplitud = random(0.2, 0.4)` (base
  radius as fraction of width, line 45), `cc = 1200` steps (line 46).
- The double loop (47-57) walks angle `aa = TWO_PI*j/cc` around the circle. The
  target radius is `amp = width*(amplitud - cos(TWO_PI*j/cc*cv)/20)`: a circle
  whose radius is modulated by a cosine of frequency `cv`, so the target path is a
  wavy closed ring (line 51-53).
- For each step, every particle is steered toward the current point on that ring
  (`moved`, line 54) and `update()` (76-82) moves it part of the way there
  (`vel * dist * 0.4`) plus a tangential drift `cos/sin(da*frameRate) * av * (des+0.3)`
  (lines 79-80). Each particle therefore lags the ring and weaves around it:
  small `des` particles hug the ring as dense ribbons, large `des` particles spiral
  away into the bead-like dotted trails.
- `show()` (83-87) draws a small semi-transparent ellipse (`stroke(col,30)`,
  `fill(col,20)`, size `t = random(2,12)`) at every new position, so each trail is a
  chain of overlapping dots.
- Colour: each particle picks one of the 5 palette colours via `rcol()` (94-96);
  no blending modes, plain alpha over the dark `background(20)` (line 42).

Randomness: the seed fixes `cant`, `cv`, `av`, `amplitud` and every particle's
`col/da/vel/des/t` (lines 70-74).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_3000 | `int cc = 1200;` -> `int cc = 3000;` | moderate (mean 0.1339, 43.2% of pixels) | denser, more solid knot: 2.5x more steps sample each trail with closer dots, so the ribbons fill in and the tangle looks heavier than the baseline | variants/cc_3000/frame_00001.png |
| amplitud_0.4 | `float amplitud = random(0.2, 0.4);` -> `float amplitud = random(0.4, 0.55);` | large (mean 0.1933, 63.0% of pixels) | bigger ring: the loop spreads out to fill the canvas and the bead-chain trails radiate much farther from the ring | variants/amplitud_0.4/frame_00001.png |
| cant_40 | `int cant = int(random(3, 300));` -> `int cant = int(random(3, 40));` | moderate (mean 0.1264, 41.1% of pixels) | much sparser (same seed draws 87 particles baseline vs 13 here): only a few thin ribbons form a small ring, bead chains sparse | variants/cant_40/frame_00001.png |
| alpha_90 | `stroke(col, 30);` -> `stroke(col, 90);` | subtle (mean 0.0445, 17.4% of pixels) | same paths, but lines read as solid opaque ribbons instead of translucent overlap; composition unchanged | variants/alpha_90/frame_00001.png |
| cv_high | `float cv = random(1, 10);` -> `float cv = random(6, 10);` | moderate (mean 0.0977, 34.9% of pixels) | wavier, more-lobed ring (modulation frequency 3.6 -> 7.1 under seed 42); density about the same as baseline | variants/cv_high/frame_00001.png |

## Modularisation notes
- Generic: `modulatedRing` (the cosine-modulated radius target, lines 51-53) and the
  particle-steering kernel (move fraction `vel*dist*0.4` toward a moving target plus
  tangential drift, lines 76-81). Both are reusable as a "particles tracing a
  modulated polar curve" generator.
- One-off art decisions: the 5-colour palette with alpha 30/20, the fixed spawn point
  (240,240), the `/20` scaling inside the radius modulation, and the per-particle
  random `des` range that decides ribbon-vs-trail behaviour.
- Clean parameter object: `{canvas, particleCount, ringAmplitude (0.2-0.4),
  ringFrequency (1-10), ringPhase, steps, stepFrac (0.4*vel), driftPhase (da),
  driftAmp (des), dotSize (t), strokeAlpha, fillAlpha, palette}`.
