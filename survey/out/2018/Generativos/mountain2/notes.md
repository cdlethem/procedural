---
sketch: 2018/Generativos/mountain2
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1687
animated: false
techniques: [noise-field]
primitives: [shape, line]
palette:
  colors: ["#061431", "#2E52DF", "#F78DF1", "#FEFEFE", "#EC3063"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 80, tried: [200], change: large, effect: "many more, much thinner bands; large empty white area opens at the top right"}
  - {name: velScale, default: "random(3, 5)", tried: ["random(8, 12)"], change: moderate, effect: "fewer, wider, flatter bands; one large flat pink area dominates the lower half"}
  - {name: angRange, default: "PI*1.5..PI*2.5", tried: ["PI*1.0..PI*2.0"], change: large, effect: "headings biased left/up, so bands arc strongly downward across the full width"}
  - {name: strokeWeight, default: "random(0.5, 2)", tried: ["random(2, 6)"], change: moderate, effect: "same fan, but bands look chunky with thick visible outlines"}
  - {name: det, default: "random(0.01)", tried: ["random(0.002)"], change: large, effect: "lower noise scale: smoother, more parallel bands with a broad downward bow"}
  - {name: closedProbability, default: 0.9, tried: [0.3], change: large, effect: "mostly open LINES polylines: thin dashed bands, few large flat filled areas"}
reusable_candidates:
  - {name: noiseWalk, signature: "noiseWalk(x0, y0, detail, angleMin, angleMax, stepScale, steps) -> PVector[]", note: "1-D walk advancing along a row, heading mapped from 2-D noise"}
---

## What it draws
Full-bleed stack of wavy horizontal ribbons in navy, royal blue, orchid pink, crimson red and white. The bands are dense and fine in the upper left, growing into broad flat-topped layers toward the bottom, and everything converges in a fan at the bottom-right corner, where the shapes meet at the corner.

## How the code works
`setup()` (mountain2.pde:3-8) opens a 960x960 P2D window, calls `generate()` once; `draw()` is empty, so the piece is static. `generate()` (21-76) seeds `random`/`noise` from the harness seed and paints the background with a random palette colour (`rcol()`, 86-88, picks from the 5-colour list at line 85).

- Rows: `cc = 80` (line 27); row `i` starts at `(0, (i+0.5)*ss)` where `ss = height/80` (28, 39-40).
- Noise detail: `det = random(0.01)` per sketch (33), then drifts multiplicatively per row by `random(0.99, 1.01)` (41).
- Walk: for `j = 0..width*0.2` (44), heading `ang = map(noise(lx*det, ly*det), 0, 1, PI*1.5, PI*2.5)` (45) sweeps from up, through right, to down, so the polyline advances to the right while oscillating vertically; step `vel = (0.5 + noise)*0.8 * random(3,5)` (42-43). Points are stored in a `PVector` list (46-48).
- Draw: 90% of rows are closed polygons — `vertex(0, height)`, the walk points (y constrained to `0..width`, 59), `vertex(width, height)`, `endShape()` (54-62); the other 10% are `beginShape(LINES)` open polylines. Fill is an opaque random palette colour (53), stroke another random palette colour with weight `random(0.5, 2)` (51-52).
- Rows are painted top-to-bottom (i=0 first), so lower rows overpaint upper ones; since every closed shape spans from `(0,height)` to `(width,height)`, the stacked opaque shapes overlap and converge at the bottom-right corner, producing the fan.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `  int cc = 80;` -> `  int cc = 200;` | large | 200 very thin diagonal stripe-bands (barcode-like) fanning to the bottom-right corner; a big white empty wedge at the top right where the walks no longer reach | variants/cc_200/frame_00001.png |
| vel_8_12 | `    vel *= random(3, 5);` -> `    vel *= random(8, 12);` | moderate | walks take bigger steps, so only a handful of wide flat bands remain (pink, white, red, a tight cluster of blue/red lines top-left); one huge flat pink shape fills the lower half | variants/vel_8_12/frame_00001.png |
| ang_1_2 | `... PI*1.5, PI*2.5);` -> `... PI*1.0, PI*2.0);` | large | angle range shifted toward left/up: bands now bow strongly downward in a big smooth arc across the whole canvas, still converging at the bottom-right | variants/ang_1_2/frame_00001.png |
| weight_2_6 | `    strokeWeight(random(0.5, 2));` -> `    strokeWeight(random(2, 6));` | moderate | same fan structure and layout as baseline, but bands look noticeably chunkier with thick, clearly visible stroke outlines (dashed where strokes overlap) | variants/weight_2_6/frame_00001.png |
| det_0.002 | `  float det = random(0.01);` -> `  float det = random(0.002);` | large | lower noise scale: bands are smoother, thinner and more parallel, with a broad downward bow in the upper third; fan at the bottom-right preserved | variants/det_0.002/frame_00001.png |
| lines_0.3 | `    if(random(1) < 0.9) beginShape();` -> `    if(random(1) < 0.3) beginShape();` | large | most rows are now open LINES polylines: image becomes a dense mesh of thin dashed bands with few large flat filled areas; white wedge at top right, convergence at bottom-right kept | variants/lines_0.3/frame_00001.png |

## Modularisation notes
Generic, library-worthy: the row walk itself — `noiseWalk(x0, y0, detail, angleMin, angleMax, stepScale, steps)` returns a `PVector[]`; angle mapped from 2-D noise with a per-step scale is a reusable "noise-guided polyline" primitive. One-off art decisions: anchoring each shape to the two bottom corners (what creates the fan), the 90/10 closed-shape vs `LINES` lottery, per-row `det` drift, the specific 5-colour list, and the `y -> constrain(y, 0, width)` clamp. A clean parameter object: `{rows, noiseScale, noiseScaleDrift, angleMin, angleMax, stepScale, weightMin, weightMax, closedProbability, palette, backgroundFromPalette}`.
