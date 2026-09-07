---
sketch: 2014/Generativos/circulos
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 211
animated: false
techniques: [grid, dots-stippling, pixel-ops]
primitives: [ellipse, rect, pixels]
palette:
  colors: ["#F73F09", "#004D51", "#008280", "#00B9B5"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: circleCount, default: 8, tried: [3], change: moderate, effect: "fewer circles per tile: sparser rings, more white showing"}
  - {name: circleSize, default: "random(30,160)", tried: ["random(30,60)"], change: moderate, effect: "smaller circles: no edge-bleeding rings, lighter airier tiles"}
  - {name: circleStroke, default: "random(3,8)", tried: ["random(1,3)"], change: moderate, effect: "thinner rings: more delicate lines, same layout"}
  - {name: dotCount, default: 22, tried: [120], change: moderate, effect: "denser stipple speckle grain across tiles"}
  - {name: circleDist, default: "random(30,120)", tried: ["random(0,40)"], change: large, effect: "centres pulled to tile centre: rings cluster mid-tile, less edge clipping"}
reusable_candidates:
  - {name: noisyTexture, signature: "noisyTexture(w, h, baseColor, amount) -> PImage", note: "per-pixel lerpColor toward random, used for the background and tile base"}
  - {name: circleTile, signature: "circleTile(size, circleCount, dotCount, palette) -> PImage", note: "one tile: noisy base + stippled dots + scattered stroked circles clipped to the square"}
---

## What it draws
A 4-row by 3-column grid of 12 off-white square tiles on a teal field. Each tile is a
collage of thin stroked circles in four colours (orange-red, dark teal, mid teal, light
cyan) that overlap and bleed off the tile edges, plus a faint scatter of tiny dark dots.
The whole composition reads as a hand-stamped print: crisp rectangular cells, busy
overlapping ring patterns, on a flat teal ground.

## How the code works
`setup()` (circulos.pde:3) sets size(600,800) and builds a 4-colour palette
(`#F73F09`, `#004D51`, `#008280`, `#00B9B5`, lines 13-17), then calls `generar()`.
`draw()` (line 21) is empty, so the image is generated once and is static; `keyPressed`
re-runs on 'g'.

`generar()` (line 33):
- Builds the full-canvas background `fondo` from `crearTexturilla(width, height, paleta[2])`
  (line 34) and blits it (line 35). That is the flat teal field.
- Loops `j` over 4 rows and `i` over 3 columns (lines 36-44), drawing a 12-cell grid.
  For each cell it makes a 160x160 `PImage` via `crearCuadrito(160,160)` (line 38), draws a
  thin `stroke(0,12)` rectangle border at `40.5 + i*180, 40.5 + j*180` (line 41), and blits
  the tile at `40 + i*180, 40 + j*180` (line 42). The 40px left margin and 20px gaps give
  the printed-frame look.

`crearCuadrito(w, h)` (line 59) is the core tile generator, drawn into a PGraphics:
- Base: `crearTexturilla(w, h, #F2F2EB)` (line 60) — an off-white per-pixel noisy fill.
- Stipple dots: 22 iterations (line 67); each `aux.fill(paleta[rand])` with
  `tam = random(0.5,2)` and `aux.ellipse(random(w), random(h), tam, tam)` (lines 68-70) —
  the tiny dark specks.
- Circles: 8 iterations (line 73); centre is `80 + cos(ang)*dist, 80 + sin(ang)*dist` where
  `ang = random(TWO_PI)`, `dist = random(30,120)` (lines 74-75), so centres scatter within
  ~120px of the tile centre. Diameter `tam = random(30,160)` (line 76) means large circles
  exceed the 160px tile and are clipped by the PGraphics bounds. `strokeWeight = random(3,8)`
  (line 77), `stroke = random palette colour` (line 78), `noFill` (line 72), so only rings.

Randomness enters only here (seed 42). Colour is always `random-from-list` over the 4-colour
palette. No blend modes; circles just overpaint in draw order.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| circleCount_3 | `for (int i = 0; i < 8; i++) {` -> `... i < 3 ...` | moderate | only 3 rings per tile: sparser, more white showing between them | variants/circleCount_3/frame_00001.png |
| circleSize_60 | `tam = random(30, 160);` -> `tam = random(30, 60);` | moderate | circles all small: no big edge-bleeding rings, lighter airier tiles | variants/circleSize_60/frame_00001.png |
| circleStroke_3 | `aux.strokeWeight(random(3, 8));` -> `random(1, 3)` | moderate | rings noticeably thinner and more delicate; same layout, finer lines | variants/circleStroke_3/frame_00001.png |
| dotCount_120 | `for (int i = 0; i < 22; i++) {` -> `... i < 120 ...` | moderate | ~5x more stipple dots: denser speckle grain across every tile | variants/dotCount_120/frame_00001.png |
| circleDist_40 | `dist = random(30, 120);` -> `dist = random(0, 40);` | large | circle centres pulled to tile centre: rings cluster in the middle, less edge clipping, biggest shift | variants/circleDist_40/frame_00001.png |

## Modularisation notes
- `crearTexturilla` is fully generic: a parameterised noisy-fill texture
  (size, base colour, lerp amount). Good library candidate `noisyTexture`.
- `crearCuadrito` is the reusable unit: a "tile" of stippled dots + scattered stroked
  circles on a noisy base. Expose the knobs: tile size, circleCount, circleSize range,
  circleStroke range, circleDist range, dotCount, dotSize range, palette, base colour.
- The grid loop in `generar` (cell size, gaps, margin, row/col counts) is a separate
  composition parameter — orthogonal to the tile generator.
- One-off art decisions: the specific 4-colour palette, the off-white `#F2F2EB` base, the
  teal ground derived from `paleta[2]`, the 40px margin / 20px gap spacing.
