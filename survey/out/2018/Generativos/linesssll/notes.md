---
sketch: 2018/Generativos/linesssll
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 4858
animated: false
techniques: [flow-field, noise-field, curves]
primitives: [line]
palette:
  colors: ["#434E20", "#E8AF36", "#F56546", "#446E9A", "#F6EDDD", "#DF2601", "#7A04C4", "#1DCCBB", "#F4F4F4", "#FFD71D", "#EFEFEF", "#0258F1"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: layers, default: 3, tried: [8], change: large, effect: "same 3 baseline layers kept (same seed) plus 5 more; denser, more cross-cutting strokes"}
  - {name: startsPerLayer, default: 30, tried: [80], change: large, effect: "much denser fan of strands sweeping diagonally; canvas almost fully covered"}
  - {name: steps, default: 200, tried: [600], change: subtle, effect: "first 200 steps identical under same seed; longer tails only slightly increase density"}
  - {name: strokeWeight, default: "random(2,14)", tried: ["random(0.5,3)"], change: moderate, effect: "all thin hairline-ish strokes; thick bands gone, image looks sparser"}
  - {name: det, default: 0.002, tried: [0.012], change: large, effect: "finer noise field; strokes curl and wobble in short tangles instead of long smooth arcs"}
  - {name: angleGain, default: 2, tried: [6], change: large, effect: "heading wraps 6 turns; serpentine S-curves and tight undulations instead of broad arcs"}
reusable_candidates:
  - {name: flowFieldStrokes, signature: "flowFieldStrokes(startCount, strokesPerStart, steps, stepSize, fieldScale, angleGain, weightRange, layers, washAlpha)", note: "polylines that follow a 2-D noise flow field; per-layer noise offset so each layer carves a different field region"}
---

## What it draws
A full-bleed field of flowing colour ribbons sweeping diagonally across a pale warm grey/cream
background. Dozens of smooth arcs and near-straight strokes in bright red-orange, teal, blue,
yellow, cream, dark olive, purple and black cross the canvas, mixed with a few thin hairline
curves; line weights vary from thick bands to 1-px lines, and the strokes bend along a common
invisible flow so the whole image reads as one directional current.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (static output). `generate()` (lines 22-53):
- Background: one random palette colour via `rcol()` (line 23).
- `noiseDetail(1)` (line 25) — low-frequency, single-octave Perlin noise.
- 3 layers (`l = 0..2`, line 26). Each layer first paints a near-invisible wash of a random
  palette colour at alpha 10 (lines 27-29), then picks its own noise offset `des = random(10000)`
  and field scale `det = random(0.002)` (lines 30-31), so every layer samples a different region
  of the noise field.
- 30 start points per layer, seeded just outside the canvas (`random(-100, width+100)`, lines 35-37).
- For each start point, 20 independent polylines (`k = 0..19`, line 40); each polyline walks 200
  steps of 1 px (lines 43-48): heading `ang = noise(des + x*det, des + y*det) * TWO_PI*2`, then
  `x += cos(ang)`, `y += sin(ang)`. The `*TWO_PI*2` gain wraps the noise value through two full
  turns, so directions rotate rapidly and the strokes become flowing arcs rather than gentle curves.
- `strokeWeight(random(2, 14))` is re-rolled per polyline (line 41) — that is why one start point
  fans out into a bundle of differently-weighted strands.
- Colour: `stroke(getColor(random(colors.length)))` (line 38) is immediately overwritten by
  `stroke(rcol())` (line 39), so the `getColor` lerp (lines 69-74) is dead code and every stroke is
  a pure random palette colour from the 15-entry `colors[]` (line 62).
- Total: 3 * 30 * 20 = 1800 polylines of 200 unit steps, all square-capped.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| layers_8 | `for (int l = 0; l < 3; l++) {` -> `... l < 8 ...` | large | denser image: baseline strokes plus 5 additional layers of arcs in new field regions; overall diagonal flow unchanged | variants/layers_8/frame_00001.png |
| starts_80 | `for (int i = 0; i < 30; i++) {` -> `... i < 80 ...` | large | much denser fan of strands, near-full canvas coverage, strong diagonal sweep from top-left to bottom-right | variants/starts_80/frame_00001.png |
| steps_600 | `for (int j = 0; j < 200; j++) {` -> `... j < 600 ...` | subtle | no visible change to the original strokes (first 200 steps identical, same seed); longer tails only add a little density | variants/steps_600/frame_00001.png |
| weight_3 | `strokeWeight(random(2, 14));` -> `strokeWeight(random(0.5, 3));` | moderate | same flow structure but all strokes thin; thick bands gone, background shows through much more | variants/weight_3/frame_00001.png |
| det_0.012 | `float det = random(0.002);` -> `... random(0.012);` | large | finer field: strokes curl into short tangles and wiggles; long smooth arcs mostly lost | variants/det_0.012/frame_00001.png |
| anggain_6 | `noise(...)*TWO_PI*2;` -> `noise(...)*TWO_PI*6;` | large | heading wraps 6 turns: serpentine S-curves and tight undulations instead of broad arcs | variants/anggain_6/frame_00001.png |

## Modularisation notes
Generic, library-worthy: the flow-field walker — a function that takes start points, steps, step
size, a 2-D noise field (scale + offset), an angle gain, and a weight range, and emits polylines
following the field; the per-layer random offset `des` is a useful trick for carving independent
regions out of one continuous noise field. One-off art decisions: the specific 15-colour palette,
the 1-px step size, the `*TWO_PI*2` angle gain, the alpha-10 background wash per layer, and the
overwritten `getColor` lerp (dead code — drop it). A clean parameter object: `{seed, layers,
startsPerLayer, strokesPerStart, steps, stepSize, fieldScale, angleGain, weightMin, weightMax,
washAlpha, palette}`.
