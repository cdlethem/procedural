---
sketch: 2019/generativos/ciserp
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 3437
animated: false
techniques: [noise-field, flow-field, particles, lines-hatching, dots-stippling]
primitives: [line, ellipse]
palette:
  colors: ["#EFACDB", "#F2B346", "#C90606", "#184CB2"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: pointCount, default: 220, tried: [60], change: large, effect: "fewer seed points: sparse, clearly separated tufts on white ground"}
  - {name: maxAlp, default: "random(160,240)", tried: ["random(60,120)"], change: subtle, effect: "subtle: strokes slightly fainter/airier, composition otherwise unchanged"}
  - {name: maxDisFactor, default: 0.4, tried: [1.2], change: large, effect: "3x longer strokes: huge radial fans that cover almost the whole canvas, background mostly hidden"}
  - {name: det, default: "random(0.01, 0.05)", tried: ["random(0.002, 0.01)"], change: large, effect: "lower noise scale: bigger, more uniform circular bursts, straighter parallel spokes, less wandering"}
  - {name: amp, default: "random(250,320)", tried: ["random(40,80)"], change: moderate, effect: "smaller angular swing: straighter paths, smaller tighter tufts, less spread"}
  - {name: black, default: "random(0.6,0.9)", tried: ["random(0.0,0.2)"], change: moderate, effect: "less lerp toward black: brighter, more saturated palette, gold/ochre dominates"}
reusable_candidates:
  - {name: flowFieldStrokes, signature: "flowFieldStrokes(seedCount, noiseScale, angleAmp, vel, steps, strokeLen) -> void", note: "particles advected through toxi simplex-noise angle field, drawing perpendicular strokes + end dots"}
---

## What it draws
A dense full-bleed field of radial "anemone" tufts on an off-white ground. Each tuft is a burst of
hundreds of thin semi-transparent spokes fanning out from a center, with tiny dots scattered at the
spoke tips and faint pale trails linking them. Dominant colours are deep red/crimson, blue, and
gold/ochre, with pink-purple where the semi-transparent strokes overlap. The tufts overlap heavily
and a few small solid dots (red, blue, gold) sit on the background between them.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (ciserp.pde:21-32).

- `generate()` (52-154) reseeds from `seed`, fills `background(240)` (off-white), and picks 220
  random points snapped to an 80 px grid (`dd = 80`, lines 60-71). For 50% of them it paints a
  small solid ellipse (size 20 or 10 px) in a random palette colour (73-78) — the isolated dots.
- For each grid point (81-153) a particle walks a noise-driven path: heading
  `a = ang + SimplexNoise.noise(des + x*det, des + y*det) * amp` (118), advanced by a small
  velocity `vel` (104) for `movs` = 2000-16000 steps (99). `det` (91) is the noise scale and `amp`
  (95) the angular swing; curling of the noise field is what makes the spokes fan out radially.
- Every step draws a stroke perpendicular to the heading: two endpoints at `a±HALF_PI` offset by
  `dis` from the current position (138-143). `dis = maxDis * sin-envelope * jitter` (134-135)
  swells in the middle of each walk, so each tuft is a lens/fan of strokes. Stroke colour is a
  random palette colour lerped toward a second palette colour and toward black (136), alpha 80-240
  (97) — the overlap builds the purple/maroon tones.
- A faint white line `stroke(255, 20)` traces the path between steps (144-145), giving the pale
  thread-like trails, and 50/50 small dots (1.4-2 px) are dropped at the two stroke ends (147-151) —
  the stippled specks.
- Palette is the 4-colour fixed array (185) sampled uniformly at random (`rcol()`, 187-189).
  Renderer P2D with `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| points_60 | `  for (int i = 0; i < 220; i++) {` -> `  for (int i = 0; i < 60; i++) {` | large | sparse field: ~10-20 separate anemone tufts with white gaps between them; same colours and structure, just fewer of them | variants/points_60/frame_00001.png |
| maxAlp_60_120 | `    float maxAlp = random(160, 240);` -> `    float maxAlp = random(60, 120);` | subtle | subtle: strokes a bit fainter and the ground shows through more, layout unchanged | variants/maxAlp_60_120/frame_00001.png |
| maxDis_1.2 | `...520)*random(0.2, 1)*0.4*random(1);` -> `...520)*random(0.2, 1)*1.2*random(1);` | large | spokes ~3x longer: a few giant radial fans span half the canvas and overlap into dense maroon masses, little white left | variants/maxDis_1.2/frame_00001.png |
| det_0.002 | `    float det = random(0.01, random(0.02, 0.05));` -> `    float det = random(0.002, random(0.004, 0.01));` | large | bigger, rounder, more regular bursts with straight parallel spokes; paths wander less so tufts look more like clean fan geometry | variants/det_0.002/frame_00001.png |
| amp_40_80 | `    float amp = random(250, 320)*...` -> `    float amp = random(40, 80)*...` | moderate | straighter particle paths: smaller, tighter, more separated tufts; same dense coverage but less organic curl | variants/amp_40_80/frame_00001.png |
| black_0.0_0.2 | `    float black = random(0.6, 0.9);` -> `    float black = random(0.0, 0.2);` | moderate | much brighter and more saturated: vivid gold/ochre and red-orange replace the muted maroon/brown overlaps; composition otherwise the same | variants/black_0.0_0.2/frame_00001.png |

## Modularisation notes
- Generic: the "particle walks simplex-noise angle field, draws perpendicular stroke + end dot +
  faint path trail" loop (112-152) is a reusable flow-field stroke field function; parameter object
  would be `{seedCount, gridSnap, noiseScale(det), angleAmp(amp), velocity(vel), steps(movs),
  strokeLen(maxDis), alpha(maxAlp), blackMix(black), palette, dotProb}`.
- Generic: `rcol()` uniform palette sampling (187-189); `getColor(v)` gradient palette (190-199)
  is unused dead code.
- One-off art decisions: the 4-colour palette itself; the grid-snap + 50% isolated seed dots
  (73-78); the sine amplitude envelope on stroke length (134-135); the `0.4` multiplier and
  `random(0.2, 1)` jitter baked into `maxDis` (101); the `arc2()` fan-drawing helper (156-173) is
  defined but never called — dead code.
