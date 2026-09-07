---
sketch: 2019/generativos/gradd
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 9695
animated: false
techniques: [noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#55D0FE", "#1B8CFF", "#FF6014", "#FF263D", "#F369F9"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 800, tried: [200], change: null, effect: ""}
  - {name: ccc, default: "int(random(1200,2000)*16)", tried: ["*4"], change: null, effect: ""}
  - {name: strokeAlpha, default: 10, tried: [50], change: null, effect: ""}
  - {name: ampX, default: "random(1,6)", tried: ["random(1,1.2)"], change: null, effect: ""}
  - {name: det, default: "random(0.001)*0.1", tried: ["random(0.004)*0.1"], change: null, effect: ""}
  - {name: colors, default: "blue/orange/magenta 5-color list", tried: ["pink/purple/yellow/green/cyan list"], change: null, effect: ""}
reusable_candidates:
  - {name: noiseWalkLine, signature: "noiseWalkLine(x0, y0, steps, stepSize, det, baseAngle, noiseOffset) -> PShape", note: "polyline that walks in the direction given by simplex noise minus a base angle"}
  - {name: noiseLerpPalette, signature: "noiseLerpPalette(float[] colors, float v) -> int", note: "color = lerp between palette neighbors indexed by a noise value (getColor, line 96)"}
---

## What it draws

A full-bleed white field densely woven with thousands of extremely thin, semi-transparent
wiggly strokes. The strokes run in roughly vertical ribbons that curve and fold across the
canvas, creating broad lens-shaped and fan-shaped overlaps. Dominant colors are cyan/blue,
red-orange, and pink/magenta; where many strokes pile up the overlaps build up into saturated
bands while the white background still shows through. The image reads as soft, feathery
hatching rather than discrete lines. Static: frames 1/10/60 are identical.

## How the code works

- `settings()` (line 15): 960x960 P3D, smooth(8), pixelDensity(2) (unavailable on the headless
  display, see stderr).
- `generate()` (line 37): white background, then 6 passes (`k`, line 53). Each pass picks one
  random base angle `ang = PI*random(-1,1)` (line 54) and draws `ccc = int(random(1200,2000)*16)`
  strokes (line 51, ~115k-190k total strokes).
- Each stroke: starting x is `width*(0.5 + cos(i/ccc*ampX*PI)*0.2)` (line 56) — strokes fan
  out in a cosine band; starting y maps i across -0.1..1.1 of the height (line 57), so strokes
  are laid top to bottom per pass.
- The stroke is a `beginShape`/`endShape` polyline of `cc = 800` unit steps (line 62): each step
  moves by `cos(a)`, `sin(a)` where `a = (SimplexNoise.noise(i*det, j*det) - ia)*2.1` (line 63) —
  a noise-walk whose heading is noise minus a per-stroke offset `ia`, giving thin meandering
  filaments.
- Color: per-stroke `getColor(SimplexNoise.noise(i*detCol, 0)*colors.length*40)` (line 58) with
  `detCol` ~1e-6 — noise-driven index into the 5-color palette, lerped between neighbors
  (`getColor(float)`, line 96). Stroke alpha is fixed at 10 (line 58), ~4% opacity, which is what
  makes the overlaps accumulate softly.
- Randomness enters through the seed (line 4, set by the harness) via `det`, `detCol`, `ampX`,
  `ccc` and the per-pass `ang`. `draw()` is empty; everything is drawn once in `setup()`.
- `gradient.png` is loaded (line 24) but never used in `generate()` (`getGradient` is unused).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes

- Generic: the noise-walk stroke (`generate` inner loop, lines 61-68) is a self-contained
  `noiseWalkLine(x0, y0, steps, stepSize, det, baseAngle, noiseOffset)` primitive; the
  cosine-fan placement (lines 56-57) is a generic emitter pattern; `getColor(float)` is a
  reusable noise-driven palette sampler.
- One-off art decisions: the fixed stroke alpha of 10, the 6-pass structure with a fresh
  random angle per pass, the exact palette, and the `*16` count multiplier that makes the
  piece computationally heavy (~150k polylines of 800 vertices).
- A clean parameter object: `{passes, strokesPerPass, stepsPerStroke, stepSize, noiseDetail,
  colorDetail, ampX, baseAngleRange, palette, strokeAlpha}`.
