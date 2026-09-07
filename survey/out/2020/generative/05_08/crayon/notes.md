---
sketch: 2020/generative/05_08/crayon
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1592
animated: false
techniques: [noise-field, particles]
primitives: [point]
palette:
  colors: ["#FFFFFF", "#FFB0D0", "#F7DE20", "#245C0E", "#EB6117", "#F72C11", "#C6356B", "#953DC4", "#003399", "#02060D"]
  selection: random-from-list
composition: scattered
parameters:
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, z, det, amp) -> PVector", note: "simplex-noise displacement of a point along a pseudo-spherical offset"}
  - {name: crayonStroke, signature: "crayonStroke(pointsPerStroke, detailRange, ampRange, alphaRange, palette) -> void", note: "one noisy hand-drawn-looking stroke: sample t in [0,1] along a random segment, displace, draw semi-transparent point"}
---

## What it draws
Thin, semi-transparent scribble strokes in a dozen-ish bright colours (dominantly reds/oranges, yellow, pinks, blues, with occasional purple/green/near-black) scattered across a light-grey field. Each stroke looks like a hand-drawn crayon line: some are dense tight tangles or loops, others are loose wavy squiggles or short dashes. Strokes cluster in a few patches with large empty gaps between them; no fill shapes, no background pattern.

## How the code works
`setup()` calls `generate()` once (crayon.pde:22); `draw()` is empty so the image is static. `generate()` (54-99) sets a P3D perspective camera, translates to centre and scales 1.2x (68-69), then loops 30 times (76): each iteration picks a random horizontal segment — `x1 = width*random(-0.5,0.5)`, `x2 = x1+random(200)`, `y` random, `z=0` (77-82) — a noise detail `det = random(0.001)*20*random(1)` (84, so 0..0.02), an amplitude `amp = random(200)` (85), and one random palette colour (86, `rcol()` at 152-154 picks from the 10-colour array at 151). It then draws 5000 points (88-98): each point takes `v = random(1)` (90, not sequential — this is what makes it a scattered stroke, not a continuous line), lerps along the segment (91-93), displaces with `def()` (94) and strokes it with the stroke colour at `random(190)` alpha (95). `def()` (131-136) samples toxi `SimplexNoise` three times at `(x,y,z)*det` to get angles a1, a2 and radius a, and offsets the point by `(cos a1 cos a2 a, sin a1 cos a2 amp, sin a2 a)` — a noise-driven spherical-ish wobble that turns the straight segment into an organic squiggle. The P3D renderer with perspective adds slight depth variation; depth test is disabled (56). Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` (58-59), so the whole image is deterministic per seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Two reusable pieces: `def()` is a generic noise-displacement field (input point, detail, amplitude; output displaced point) and could ship as `noiseDisplace(x, y, z, det, amp)`; the per-stroke generator (random segment + N random-t samples + displace + translucent point) is a self-contained `crayonStroke(pointsPerStroke, detailRange, ampRange, alphaRange, palette)`. One-off art decisions: the specific 10-colour palette, 30 strokes, 5000 points per stroke, `scale(1.2)`, and the light-grey background. A clean parameter object would contain `{strokeCount, pointsPerStroke, detailRange, ampRange, alphaMax, palette, canvasScale}`.
