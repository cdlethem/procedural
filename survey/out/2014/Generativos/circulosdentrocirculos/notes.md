---
sketch: 2014/Generativos/circulosdentrocirculos
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 179
animated: false
techniques: [polar, symmetry, curves]
primitives: [ellipse, line, shape]
palette:
  colors: ["#000000", "#FFFFFF"]
  selection: fixed
composition: radial
parameters:
  - {name: step, default: "random(10)+1 times 10 (10-100 px)", tried: [20], change: large, effect: "larger shrink step = fewer, bolder rings with more black ground between them"}
  - {name: motifTypes, default: "random(5)+1 (types 1-5)", tried: ["random(2)+1 (types 1-2)"], change: large, effect: "restricting to types 1-2 removes wedges, polygons and dot rosettes, leaving only outline/tick rings and dotted rings"}
  - {name: maxDiameterScale, default: 1.0, tried: [0.55], change: large, effect: "smaller starting diameter = whole mandala shrinks to an inscribed circle with black corner margins"}
  - {name: c1TickCount, default: "random(3,72)", tried: ["random(3,20)"], change: none, effect: "no visible change (thin tick lines are nearly invisible at this scale)"}
  - {name: c4WedgeCount, default: "random(4,73)", tried: ["random(4,20)"], change: large, effect: "fewer wedges per ring = many more, smaller alternating black/white wedges; outer band becomes a high-contrast zigzag and the white areas grow dominant"}
reusable_candidates:
  - {name: ringMotif, signature: "ringMotif(cx, cy, diameter, weight, startAngle, count, motifId) -> void", note: "one decorated concentric ring: outline ellipse plus dots/ticks/polygons/wedges on its circumference"}
  - {name: concentricStack, signature: "concentricStack(cx, cy, maxDiameter, stepRange, motifPicker) -> void", note: "while loop drawing motif rings from maxDiameter down to 0 with random shrink steps"}
  - {name: regularPolygon, signature: "regularPolygon(cx, cy, radius, startAngle, sides) -> void", note: "figura(): closed polygon from polar vertices"}
---

## What it draws
A black-and-white radial mandala centered on a black background. Concentric rings
alternate between plain thin white circles, black circles broken into dotted rings of
small white dots, rings carrying small radial tick marks, and large angular
black/white wedge segments that reach the canvas corners. A dense cluster of small
white dots sits in the center.

## How the code works
- `setup()` (lines 1–12) draws a fixed stack of five motif rings, but `generar()`
  (line 11) immediately repaints with `background(0)` (line 26), so the final image
  comes entirely from `generar()`.
- `generar()` (lines 25–56): `tam` starts at the canvas diagonal
  (`dist(0,0,width,height)` ≈ 848 px, line 28). Each iteration picks a random shrink
  step `t` in 10–100 (line 32), a random ring type `r` in 1–5 (line 35), a random
  angle offset (line 34), then draws one motif ring of diameter `tam` at the center
  (lines 30–31) and subtracts `t` (line 53). Rings accumulate from outside in until
  `tam <= 0` (≈ 9–85 rings).
- Motif ring types, all pure black/white:
  - `circulo1` (58–77): thick white outline ellipse, `cant2` thin black inner circles,
    and `cant` thin black radial tick lines straddling the ring.
  - `circulo2` (78–92): thick black outline ellipse with `cant` small white filled
    dots on the circumference — dotted rings.
  - `circulo3` (94–109): white outline ellipse with `cant` small black polygons
    (`figura`, 167–175) spaced around it.
  - `circulo4` (111–145): paired black/white outline ellipses with alternating
    black and white quads between them — the large angular wedge segments.
  - `circulo5` (147–165): black outline ellipse with `cant` clusters of
    concentric black/white dots at equidistant points — the center dot rosettes.
- Randomness: only `random()` for step, type, angle, and counts; seeded, hence
  deterministic. `draw()` is empty; the image is static (keyPress regenerates,
  line 22, but that is not exercised by the renderer).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| step_20 | `float t = int(random(10)+1)*10;` -> `float t = int(random(10)+1)*20;` | large | fewer, bolder rings: a thick white wedge band cuts the corners, sparse dot rings, small thin center circle | variants/step_20/frame_00001.png |
| types_2 | `int r = int(random(5))+1;` -> `int r = int(random(2))+1;` | large | only dotted rings and dashed/ticked outline rings; no wedge bands, polygons, or center rosette; small plain white circle in center | variants/types_2/frame_00001.png |
| diamScale_0.55 | `float tam = dist(0, 0, width, height);` -> `float tam = dist(0, 0, width, height) * 0.55;` | large | same motif mix but the whole stack is an inscribed circle; flat black margins fill the canvas corners | variants/diamScale_0.55/frame_00001.png |
| c1ticks_20 | `circulo1(x, y, dim, ang, t, int(random(3, 72)), int(random(8)));` -> `... int(random(3, 20)) ...` | none | no visible change; looks identical to baseline (1-px black tick lines are too faint to read) | variants/c1ticks_20/frame_00001.png |
| c4wedges_20 | `circulo4(x, y, dim, ang, t, int(random(4,73)));` -> `circulo4(x, y, dim, ang, t, int(random(4,20)));` | large | wedge rings fragment into many small black/white triangles; outer band is a busy zigzag, large white field with thin black circles in the middle, small wedges reach the center | variants/c4wedges_20/frame_00001.png |

## Modularisation notes
- Generic: the five motif functions (`circulo1`–`circulo5`) plus `figura` are a
  library of "ring motifs" — each takes (center, diameter, weight, startAngle,
  count) and decorates one circle. `generar()` is a generic concentric-stack driver:
  iterate diameter downward with a step function and a motif picker.
- One-off art decisions: the specific set of five motifs, the strictly black/white
  palette, the random step range 10–100, and the uniform random motif choice.
- Clean parameter object: `{ center, maxDiameter, stepRange: [min, max],
  motifs: [{ id, weight, countRange, angleJitter }], palette: [black, white] }`.
