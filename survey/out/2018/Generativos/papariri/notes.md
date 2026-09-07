---
sketch: 2018/Generativos/papariri
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1879
animated: false
techniques: [noise-field, flow-field, packing]
primitives: [line, ellipse, shape]
palette:
  colors: ["#000000", "#33346B", "#567BF6", "#B4CAFB", "#FFFFFF", "#FFB72A", "#FF4C3D"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: buildsCount, default: 1000, tried: [300], change: large, effect: "thinner background mosaic; thin dark bird-line web becomes dominant texture"}
  - {name: birdsCount, default: 100, tried: [300], change: moderate, effect: "denser web of thin dark line squiggles between circles, busier and slightly darker"}
  - {name: circleSizeRange, default: "width*random(0.1,0.4)*random(0.2,1)", tried: ["width*random(0.04,0.16)*random(0.2,1)"], change: moderate, effect: "circles about one third the size, finer, more of them, background mosaic more visible"}
  - {name: buildsStrokeAlpha, default: 20, tried: [90], change: subtle, effect: "no visible change in composition; background rects slightly more opaque"}
  - {name: packingFactor, default: 0.55, tried: [0.9], change: moderate, effect: "circles pushed apart, fewer kept, more background visible between them"}
reusable_candidates:
  - {name: arcRing, signature: "arcRing(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "filled annulus from segmented quads with per-vertex alpha"}
  - {name: packCircles, signature: "packCircles(n, minDistFactor, w, h) -> PVector[]", note: "rejection-sampling circle packing with per-circle radius"}
  - {name: noiseWalk, signature: "noiseWalk(x, y, detail, offset, step, n, seed) -> points", note: "line walk following a 2-D noise field"}
---

## What it draws
A full-bleed collage on a near-white ground: a background layer of many small,
translucent rotated rectangles in muted blues, oranges and reds, over which
hundreds of circles of very different sizes are scattered. Each circle is
drawn like a small instrument face: concentric filled arcs and ring segments,
a faint crosshair, small centre dots, and on some a dashed outline ring.
A few thin squiggly lines (the "birds" layer) thread between the circles.

## How the code works
`setup()` (lines 3-9) creates a 960x960 P2D window and calls `generate()` once;
`draw()` is empty, so the piece is static. `generate()` (22-31) sets the
random seed, fills the background with light grey (250), then layers three
passes:

1. `builds()` (57-85): 1000 iterations. Each picks a random position, a size
   scaled by a noise field `pow(noise(...), 1.1)` (68-69), and a rotation
   from another noise field (71). `boxShadow` (147-186) draws four trapezoid
   quads whose alpha fades from `rcol()` to 0, giving each rectangle a soft
   cast shadow; `plane` (188-200) then draws the rotated rectangle itself as
   two half-quad fills with different colours/alphas, plus a small 10%
   inset plane (81-82). This produces the blurred, layered mosaic of the
   background.
2. `birds()` (33-53): 100 walkers of 100 steps. Each step follows a noise
   field angle `noise(...)*TAU*5` (45); a line is drawn on every other step
   (48), so each bird is a short chain of disconnected segments - the thin
   squiggles between circles.
3. `circles()` (88-145): rejection-sampling packing - 10000 attempts, a
   candidate is kept only if it is at least `0.55*(sum of radii)` away from
   every kept circle (96-104), giving non-overlapping scattered circles.
   Each circle is then built from: two `arc2` annuli (207-225, filled segmented
   ring with per-vertex alpha), a faint filled ellipse, a dashed arc ring
   (126-128), crosshair lines (132-133), a no-fill outline ellipse (134), a
   white highlight arc (136), and two small centre dots (139-143).

Colour always comes from `rcol()` (230-232), a uniform random pick from the
7-colour `colors[]` list (228). Randomness enters through positions, sizes,
noise offsets and colour picks; with a fixed seed the output is identical
(deterministic: true). No blend modes; the layered translucent fills do the
mixing.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| builds_300 | `for (int i = 0; i < 1000; i++) {` -> `... i < 300 ...` | large | background mosaic much thinner; the thin dark line web (bird walks) becomes the dominant texture, circles sit on a mostly line-filled ground | variants/builds_300/frame_00001.png |
| birds_300 | `for (int j = 0; j < 100; j++) {` -> `... j < 300 ...` | moderate | ~3x more squiggly line walkers form a visible web of dark threads between the circles; busier, slightly darker | variants/birds_300/frame_00001.png |
| circleSize_small | `float s = width*random(0.1, 0.4)*random(0.2, 1);` -> `...random(0.04, 0.16)...` | moderate | circles roughly one third the size, finer and more numerous, background rect mosaic more visible | variants/circleSize_small/frame_00001.png |
| buildsAlpha_90 | `stroke(0, 20);` -> `stroke(0, 90);` | subtle | no visible change in composition; background rectangles marginally more opaque | variants/buildsAlpha_90/frame_00001.png |
| packing_0.9 | `(p.z+s)*0.55` -> `(p.z+s)*0.9` | moderate | circles pushed farther apart; fewer, more separated circles, more background mosaic showing between them | variants/packing_0.9/frame_00001.png |

## Modularisation notes
- `arc2` (207-225) is a generic "filled ring segment with per-vertex alpha"
  primitive - directly reusable for any circular instrument/gauge look.
- The packing loop in `circles()` (89-105) is a standalone
  rejection-sampling circle packer parameterised by attempt count and the
  `0.55` overlap factor; the per-circle decoration (108-144) is the one-off
  art decision and should be a separate "style" function.
- `plane`/`boxShadow` (147-200) form a generic "rotated soft-shadow quad"
  pair; the noise-driven size/angle fields in `builds()` (58-71) are a
  reusable "mosaic from noise-scaled rotated quads" block.
- The `noiseWalk` line chain in `birds()` is a minimal flow-field tracer.
- A clean parameter object: {buildsCount, buildsDetail, buildsAlpha,
  birdsCount, birdStepLen, circlesAttempts, circleSizeRange,
  packingFactor, palette}.
