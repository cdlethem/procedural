---
sketch: 2014/Generativos/edificios
year: 2014
renderer: JAVA2D
size: [800, 600]
libraries: []
deterministic: true
ms_first_frame: 348
animated: false
techniques: [packing]
primitives: [rect]
palette:
  colors: ["#4E4D4A", "#353432", "#94BA65", "#2790B0", "#2B4E72"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: w (building width range), default: "random(100, 300)", tried: ["random(400, 500)"], change: subtle, effect: "larger building, wider footprint in top-right corner"}
  - {name: density (area/cant divisor), default: 10, tried: [5], change: none, effect: "no visible change; mosaic already saturated"}
  - {name: fill alpha, default: 80, tried: [200], change: none, effect: "no visible change; heavy overlap already makes centre near-opaque"}
  - {name: stroke alpha, default: 120, tried: [255], change: none, effect: "no visible change"}
  - {name: block width range, default: "random(10, 40)", tried: ["random(30, 80)"], change: none, effect: "no visible change at this scale"}
reusable_candidates:
  - {name: packedBlock, signature: "packedBlock(x, y, w, h, density, blockW, blockH, palette, alpha) -> void", note: "fills a rotated rect region with random overlapping translucent sub-rects"}
---

## What it draws
A light gray canvas with a single tilted rectangular "building" sitting in the
upper-right corner. The building is a dense mosaic of overlapping translucent
rectangles in dark gray, green, blue, and deep blue-gray, outlined by a faint
gray stroke. The rest of the canvas is empty.

## How the code works
- `setup()` (lines 3-22): 800x600, `smooth(8)`. Builds a 5-colour palette; the
  first assignment (lines 7-11, beige/orange/black) is immediately overwritten
  (lines 12-16) with the effective dark/green/blue palette. `angulos[0..2]` are
  random angles, with `angulos[0] = angulos[1] + PI/2` (line 21).
- `draw()` (lines 23-26) calls `generar()` exactly once, at `frameCount == 10`;
  the sketch is otherwise static (frame 60 identical to frame 1 in baseline).
  `keyPressed` regenerates on any key, saves on 's'.
- `generar()` (lines 35-44): picks a random size `w,h in [100,300]` and random
  position `(x,y)` over the whole canvas, `translate`s there, rotates by one of
  the three angles, then calls `rectangulo(-w/2, -h/2, w, h)` and `resetMatrix()`.
- `rectangulo()` (lines 46-58): draws `cant = int(w*h)/10` sub-rectangles; each
  has random size `ww,hh in [10,40]`, random position inside the region, a
  stroke of `stroke(0,120)` and a fill of a random palette colour at alpha 80,
  so the blocks blend into the mosaic. With seed 42 the building lands in the
  top-right corner.
- Randomness enters via `random()` for angles, position, size, and every block;
  seed 42 makes the layout deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| size_400 | `  float w = random(100, 300);` -> `  float w = random(400, 500);` | subtle (0.081 px) | building noticeably wider, extends further off the top-right corner | variants/size_400/frame_00001.png |
| density_5 | `  int cant = int(w*h)/10;` -> `  int cant = int(w*h)/5;` | none (0.015 px) | no visible change | variants/density_5/frame_00001.png |
| alpha_200 | `    fill(paleta[int(random(5))],80);` -> `    fill(paleta[int(random(5))],200);` | none (0.007 px) | no visible change | variants/alpha_200/frame_00001.png |
| stroke_255 | `  stroke(0,120);` -> `  stroke(0,255);` | none (0.007 px) | no visible change | variants/stroke_255/frame_00001.png |
| block_80 | `    float ww = random(10, 40);` -> `    float ww = random(30, 80);` | none (0.008 px) | no visible change | variants/block_80/frame_00001.png |

## Modularisation notes
- Generic: `rectangulo()` is a reusable "packed block" — fill a rectangle with
  `area/density` random translucent sub-rects from a palette. `generar()` is a
  reusable "place one transformed cluster" step (random position + size + angle).
- One-off art decisions: the double palette assignment (dead beige palette),
  the `angulos[0] = angulos[1] + PI/2` constraint, generating only at
  `frameCount == 10`, the specific 5-colour green/blue set.
- Clean parameter object: `{buildings: 1, wRange: [100,300], position: random-canvas,
  angles: n-random + 90-degree-constraint, density: 10 (area/cant), blockSize: [10,40],
  fillAlpha: 80, strokeAlpha: 120, palette: [5 colours]}`.
