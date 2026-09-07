---
sketch: 2014/Generativos/minimalCirculines
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 229
animated: false
techniques: [curves, polar, pixel-ops]
primitives: [ellipse, pixels]
palette:
  colors: ["#FFFFFF", "#FAFAFA", "#000000"]
  selection: fixed
composition: scattered
parameters:
  - {name: circleCount, default: 3, tried: [8], change: subtle, effect: "adds 5 more circles of the same random style; original three unchanged, new ones thin so little extra ink"}
  - {name: ddMin, default: 20, tried: [200], change: moderate, effect: "all circles larger (diameter >= 200); the small circle becomes a large dashed ring"}
  - {name: cantMax, default: 20, tried: [40], change: subtle, effect: "more segments = finer dashes; bottom ring nearly continuous, small circle unchanged"}
  - {name: sepMax, default: 0.6, tried: [0.9], change: subtle, effect: "arcs fill more of their slot; gaps shrink, rings look near-closed"}
  - {name: weightFactor, default: 0.2, tried: [0.5], change: large, effect: "strokes 2.5x thicker; big rings become heavy near-solid bands, small circle stays thin"}
  - {name: grain, default: 5, tried: [20], change: none, effect: "no visible change per score; background grain slightly coarser but below the per-pixel change threshold"}
reusable_candidates:
  - {name: dottedCircle, signature: "dottedCircle(x, y, diameter, segments, fillRatio, startAngle) -> void", note: "circle drawn as `segments` arc spans of TWO_PI/cant * fillRatio, rotated by startAngle; with strokeWeight it reads as a dashed ring"}
  - {name: pixelGrain, signature: "pixelGrain(amount) -> void", note: "per-pixel random brightness offset in [-amount, +amount] via get/set; note: local `noise()` shadows Processing's noise()"}
---

## What it draws
A near-white light-grey background with fine grain, carrying three black "dotted circles": rings built
from short arc segments separated by gaps. One large thick ring sits centre-bottom, a large thick
broken ring arcs across the top-right corner, and a small thin dashed ring sits at the bottom edge.
Circle sizes, dash density and stroke weights vary between the three rings.

## How the code works
- `setup()` (line 5) calls `generar()` once; `draw()` (line 10) is empty, so the piece is static
  (frames 10/60 identical to frame 1).
- `generar()` (line 14): `background(250)` sets the light grey; `noise(5)` (line 16) is a local
  function (line 32) that walks every pixel and adds a random brightness offset in [-5, +5] —
  this is the visible background grain, not Perlin noise; `filter(BLUR, 1)` (line 17) softens the
  grain slightly.
- Main loop (lines 20-29): 3 iterations; each draws one dotted circle with a random centre
  `random(width)/random(height)` (lines 21-22), random diameter `random(20, 400)` (line 23),
  random segment count `int(random(3, 20))` (line 24), random fill ratio `random(0.6)` (line 25,
  arc covers that fraction of its slot), random start angle (line 26), and random stroke weight
  `max(dd*random(0.2), 2)` (line 27).
- `circuloPunteado` (line 44): draws `cant` arcs, each spanning `TWO_PI/cant * sep` of the circle
  at `da*i + ang`; with `noFill()` and `strokeCap(PROJECT)` (lines 18-19) the result is a ring of
  black dashes. Colour is the default black stroke; the `paleta` array (line 1, single white
  entry) and `rcol()` (line 62) are defined but never used.
- `keyPressed` (line 52): any key re-generates; 's' saves a frame.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_8 | `for(int i = 0; i < 3; i++){` -> `for(int i = 0; i < 8; i++){` | subtle | five more dashed circles appear (thin ring top-left, thin ring mid-left, ring bottom-centre, etc.) on top of the original three, which are unchanged; the new circles at seed 42 are thin, so total added ink is small | variants/count_8/frame_00001.png |
| dd_min_200 | `float dd = random(20, 400);` -> `float dd = random(200, 400);` | moderate | all three circles get bigger (diameter >= 200): the bottom ring grows and shifts right, the top arc becomes a wider sweep, and the former small circle becomes a large dashed ring | variants/dd_min_200/frame_00001.png |
| cant_max_40 | `int cant = int(random(3, 20));` -> `int cant = int(random(3, 40));` | subtle | finer dashes: the bottom ring becomes nearly continuous with small notches and the top arc breaks into more, shorter chunks; the small bottom circle is unchanged (its count was under 20) | variants/cant_max_40/frame_00001.png |
| sep_0.9 | `float sep = random(0.6);` -> `float sep = random(0.9);` | subtle | each arc fills most of its slot: the bottom ring and the small circle look nearly closed, and the top arcs become long sweeps with only short gaps | variants/sep_0.9/frame_00001.png |
| weight_0.5 | `strokeWeight(max(dd*random(0.2),2));` -> `strokeWeight(max(dd*random(0.5),2));` | large | strokes 2.5x thicker: the big rings become heavy, near-solid bands with tiny gaps; the small bottom circle stays thin because its weight is capped by its small diameter | variants/weight_0.5/frame_00001.png |
| grain_20 | `noise(5);` -> `noise(20);` | none | no visible change per score (mean 0.0095, 0.0% of pixels); background grain looks slightly coarser in the image but the per-pixel difference stays below the change threshold | variants/grain_20/frame_00001.png |

## Modularisation notes
- Generic: `dottedCircle(x, y, diameter, segments, fillRatio, startAngle)` is a clean library
  primitive (dashed ring via arc spans); `pixelGrain(amount)` is a generic texture op but should
  be renamed (it shadows `noise`).
- One-off art decisions: the 3-circle loop, the `random(20,400)`/`random(3,20)`/`random(0.6)`
  ranges, weight proportional to diameter (`dd*random(0.2)`), background 250, blur 1.
- A clean parameter object: `{ count, diameterRange: [20,400], segmentRange: [3,20], maxFill: 0.6,
  weightFactor: 0.2, grain: 5, blur: 1, background: 250 }`.
