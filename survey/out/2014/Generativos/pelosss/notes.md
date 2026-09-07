---
sketch: 2014/Generativos/pelosss
year: 2014
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 1118
animated: false
techniques: [spiral, dots-stippling, lines-hatching]
primitives: [line, ellipse]
palette:
  colors: ["#FF9900", "#424242", "#E9E9E9", "#BCBCBC", "#3299BB"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: strandCount, default: 5000, tried: [1250], change: large, effect: "fewer strands: sparse field of discrete curls, light grey background shows through"}
  - {name: startSize, default: 40, tried: [80], change: large, effect: "larger start diameter: bigger, bolder curls, fewer and more readable rings"}
  - {name: hatchSpacing, default: "random(2,5)", tried: ["random(8,12)"], change: none, effect: "no visible change; hatch is too faint and covered by the curls"}
  - {name: speed, default: "random(0.4,2)", tried: ["random(0.2,0.8)"], change: large, effect: "slower walkers: finer, tighter, more granular curls, more background between them"}
  - {name: angleJitter, default: 0.5, tried: [0.1], change: moderate, effect: "less jitter: looser, more open spirals, lighter texture"}
  - {name: hatchStrokeAlpha, default: 20, tried: [100], change: none, effect: "no visible change; stronger hatch still hidden under the curl field"}
reusable_candidates:
  - {name: hatchDiagonal, signature: "hatchDiagonal(spacing, strokeColor) -> void", note: "45-degree diagonal hatch across the whole canvas"}
  - {name: hairStrand, signature: "hairStrand(x, y, startSize, speed, angleJitter, palette) -> void", note: "random walk of shrinking filled ellipses with two shading arcs, forming a spiral curl"}
  - {name: paletteRandom, signature: "paletteRandom(colors[]) -> int", note: "uniform pick from a colour list"}
---

## What it draws
A dense full-bleed tangle of hundreds of small spiral "curls" (the sketch name means "hair"), each
curl a chain of overlapping circles shrinking from a few pixels to a large diameter, shaded with a
faint light arc on the upper-left and a faint dark arc on the lower-right so the curls read as
three-dimensional swirls. Dominant colours are orange, teal-blue, and white/light grey with dark
grey accents, lying over a barely visible diagonal hatch.

## How the code works
`setup()` (line 9-12) calls `generar()` once; `draw()` is empty, so the image is a one-shot static
composition (regenerated only on key press, line 17-20).

- Line 23: background is a random palette colour (`rcol()`, line 63-65, uniform pick from the 5
  colours in `paleta[]`, line 1-7).
- Lines 24-28: hatch layer. `stroke(250, 20)` is a near-invisible whitish line; a loop steps `i`
  by `des = random(2, 5)` (line 25) and draws `line(i, -2, -2, i)` (line 27) — parallel 45-degree
  diagonals with random 2-5 px spacing.
- Lines 29-55: 5000 hair strands. Each starts at a uniform random point with a 1.1x canvas margin
  (lines 30-31), with a random start angle `ang` (line 38), initial diameter `t = random(40)`
  (line 39) and speed `vel = random(0.4, 2)` (line 40). The while-loop (line 41-54) is a random
  walk: `ang += random(-0.5, 0.5)` (line 42) jitters the heading (this jitter is what makes the
  curl spiral), the point advances `vel` pixels per step (lines 43-44), and `t` shrinks each step
  (`t *= random(0.9, 1)`, `t -= random(0.1)`, lines 45-46). At every step it stamps a filled
  ellipse of diameter `t` in a random palette colour (lines 47-49), then a white quarter-arc
  `PI..PI*1.5` at alpha 20 (upper-left highlight, lines 50-51) and a black quarter-arc `0..PI*0.5`
  at alpha 20 (lower-right shadow, lines 52-53). The shrinking stamp size plus jittered heading
  produces the spiral-curl look; thousands of overlapping curls fill the whole canvas.
- No noise, no transforms, no blend modes; randomness is the only driver. Deterministic (seed
  reproduced).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_1250 | `for (int i = 0; i < 5000; i++) {` -> `... i < 1250 ...` | large (mean 0.1896, 75.1% px) | sparse field: curls become discrete, well-separated spirals; light grey background clearly visible between them | variants/count_1250/frame_00001.png |
| size_80 | `float t = random(40);` -> `float t = random(80);` | large (mean 0.2185, 83.5% px) | curls are noticeably bigger and bolder, rings more readable, fewer strands per area | variants/size_80/frame_00001.png |
| hatch_12 | `float des = random(2, 5);` -> `float des = random(8, 12);` | none (mean 0.0002) | no visible change; hatch too faint and fully covered by the curl field | variants/hatch_12/frame_00001.png |
| speed_0.8 | `float vel = random(0.4, 2);` -> `float vel = random(0.2, 0.8);` | large (mean 0.1662, 69.9% px) | slower walkers: finer, tighter, more granular curls; texture busier, more background shows between strands | variants/speed_0.8/frame_00001.png |
| jitter_0.1 | `ang += random(-0.5, 0.5);` -> `ang += random(-0.1, 0.1);` | moderate (mean 0.1468, 59.3% px) | looser, more open spirals; rings less tightly wound, overall lighter texture | variants/jitter_0.1/frame_00001.png |
| hatchAlpha_100 | `stroke(250, 20);` -> `stroke(250, 100);` | none (mean 0.0011) | no visible change; stronger hatch still hidden under the dense curl field | variants/hatchAlpha_100/frame_00001.png |

## Modularisation notes
Two independent, reusable layers:

1. **Diagonal hatch** (lines 24-28): `hatchDiagonal(spacing, strokeColor)` — generic, one loop.
2. **Hair strand / spiral curl** (lines 38-54): `hairStrand(x, y, startSize, speed, angleJitter,
   shrink, palette)` — the generic part is the shrinking-stamp random walk with two fixed
   quarter-arc shading stamps (highlight/shadow), which is a nice primitive for "furry" or "curly"
   texture. The number of strands and their start distribution are separate from the strand
   function.

One-off art decisions: the fixed 5-colour palette and `rcol()` selection, the 1.1x overflow margin
on start points, the 45-degree hatch direction, the specific arc quadrants (PI..1.5PI / 0..0.5PI)
and the low alphas (20) that keep the shading subtle.

A clean parameter object: `{ palette: [5 colors], background: "random" | color, hatch: {spacing:
[2,5], stroke: [250,20]}, strands: {count: 5000, startSize: 40, speed: [0.4,2], angleJitter:
0.5, shrink: [0.9,1.0, 0.1], startMargin: 1.1 } }`.
