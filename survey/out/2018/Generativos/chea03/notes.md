---
sketch: 2018/Generativos/chea03
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1608
animated: false
techniques: [curves, dots-stippling, lines-hatching]
primitives: [line, rect, ellipse]
palette:
  colors: ["#FACD00", "#FB4F00", "#F277C5", "#7D57C6", "#00B187", "#3DC1CD"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: line_count, default: 60, tried: [120], change: moderate, effect: "denser, busier overprint; background less visible, more prominent orange/pink ribbons"}
  - {name: amp, default: 400, tried: [200], change: moderate, effect: "all shapes and beads about half size; finer, lighter, more mesh-like texture"}
  - {name: alpha, default: 80, tried: [200], change: moderate, effect: "ribbons more opaque and saturated; overprint denser (only ~10% of pixels changed)"}
  - {name: osc, default: 2, tried: [0.3], change: none, effect: "no visible change; bead size pulse is too small to see at this scale"}
  - {name: line_alpha, default: 10, tried: [80], change: none, effect: "no visible change; connector lines stay invisible, erased by the dense overprint of later shape outlines"}
reusable_candidates:
  - {name: chainShapes, signature: "chainShapes(p1, p2, colorPair, ampRange, alphaRange, osc, n) -> void", note: "interpolate a rotating, rescaling noFill shape (plus a beaded dot at a corner) along a segment"}
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "uniform random palette pick"}
---

## What it draws
A full-bleed abstract web of hundreds of thin, semi-transparent rotated-rectangle outlines that
taper and rotate along long straight segments, layered over a flat random-color background.
The aligned rectangle chains produce faint straight envelope edges crossing the canvas (the code's
own connector lines are invisible, see experiments); each chain is accompanied by a row of
small beads (dots) whose size pulses along it, like beaded
threads. Dominant colours are green and teal, with orange, purple and yellow accents; the whole
image reads as a soft, overprinted glassy texture with no clear focal point.

## How the code works
Single tab, `generate()` called once from `setup()` (chea03.pde:8); `draw()` is empty so the
sketch is static. Flow:
- `background(rcol())` (line 26) fills the canvas with one random palette colour; the palette is
  the 6-colour list at line 89, picked uniformly by `rcol()` (lines 90-92).
- Outer loop, 60 iterations (line 30): two random endpoints in a 200 px margin beyond the canvas
  (lines 31-34), two random palette colours (lines 35-36), and a nearly invisible connector
  `line()` with stroke alpha 10 (lines 37-38).
- Inner loop runs `cc = int(dist)` times (lines 41-48): `v = j/cc` maps the segment 0→1. Each
  step pushes a matrix, translates to the lerped point, rotates by a lerped angle
  (`ang1`→`ang2`, each `random(TAU*random(1,3))`, lines 39-40), and strokes a noFill centred
  square of side `amp = lerp(amp1, amp2, v)` where `amp1/amp2 = random(400)` (lines 43-44, 54-55).
  Stroke colour lerps between `col1` and `col2` and alpha lerps between `alp1/alp2 = random(80)`
  (lines 45-50, 50). This is what makes the long tapering, twisting rectangle ribbons.
- A small `ellipse` at the square's corner `(amp*0.25, amp*0.25)` with radius
  `amp*0.1*(cos(j*osc1)*0.5+0.5)` (line 56-57) follows the rotating frame, producing the beaded
  dot-chains; the `cos` term makes bead size pulse along each chain (`osc1 = random(2)`).
- Everything is drawn with the default blend mode at low alpha, so 60 × (up to ~1300) strokes
  accumulate into the overprinted wash. P3D is used only for `smooth(8)`; no 3D geometry or
  shaders are involved. `arc2()` (lines 63-81) is dead code, never called.
- Randomness enters via `randomSeed(seed)` at line 24; with a fixed seed the output is
  deterministic (confirmed by `result.json`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| line_count_120 | `for (int i = 0; i < 60; i++)` -> `i < 120` | moderate (mean 0.0964, 40.3% px) | twice as many ribbon chains; the canvas is noticeably denser and busier, background less visible, orange and pink ribbons stand out more | variants/line_count_120/frame_00001.png |
| amp_200 | `float amp1 = random(400);` and `amp2` -> `random(200)` | moderate (mean 0.089, 36.1% px) | all rectangle outlines and beads shrink to about half size; texture becomes finer and lighter, more of the green background shows through | variants/amp_200/frame_00001.png |
| alpha_200 | `float alp1/alp2 = random(80)` -> `random(200)` | moderate (mean 0.0524, 9.6% px) | shapes are more opaque; the overlapping teal/green ribbons read as denser and more saturated, slightly stronger overprint | variants/alpha_200/frame_00001.png |
| osc_0.3 | `float osc1 = random(2);` -> `random(0.3);` | none (mean 0.004, 0.1% px) | no visible change; the bead size pulse frequency is not perceptible at this scale | variants/osc_0.3/frame_00001.png |
| line_alpha_80 | `stroke(col1, 10);` -> `stroke(col1, 80);` | none (mean 0.001, 0.0% px) | no visible change; the connector lines remain invisible because later iterations' hundreds of shape outlines overprint them completely | variants/line_alpha_80/frame_00001.png |

## Modularisation notes
The core generic block is the inner "chain" loop (lines 48-59): given a segment, a colour pair,
size/alpha ranges, angle range and bead frequency, it interpolates a rotating, rescaling noFill
shape (any primitive could stand in for `rect`) plus a beaded satellite along it. That is a
clean `chainShapes(...)` library primitive with the segment endpoints, shape type and all ranges
as parameters. One-off art decisions: the specific 6-colour palette, the 60-segment count, the
`random(400)` size range, the near-invisible alpha-10 connector lines, and the corner-placed
bead at `amp*0.25`. `rcol()` (uniform palette pick) is trivially reusable. `arc2()` is unused
dead code and should not be ported. A parameter object for this sketch: `{count, margin,
ampRange, alphaRange, angleRange, osc, beadScale, palette, bg}`.
