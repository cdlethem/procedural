---
sketch: 2018/Generativos/dacu
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1611
animated: false
techniques: [grid, lines-hatching, distortion]
primitives: [rect, ellipse, shape, line]
palette:
  colors: ["#E70012", "#D3A100", "#017160", "#00A0E9", "#072B45"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cw, default: "random(4, 24)", tried: [8], change: large, effect: "8 narrow columns x 24-40 rows; small busy cells, many lines"}
  - {name: ch, default: "cw*random(3, 5)", tried: [8], change: moderate, effect: "4x8 grid of large squarish cells; very soft, few visible lines"}
  - {name: cc, default: "random(20)", tried: [4], change: moderate, effect: "sparser: only a few thin strokes per cell, cleaner mosaic"}
  - {name: rectAlpha, default: 40, tried: [200], change: large, effect: "cells read as solid saturated colour blocks, gaps stand out"}
  - {name: arcAlp1, default: 150, tried: [255], change: moderate, effect: "stronger centre-fade wash; glowy disc more visible in each cell"}
  - {name: amp, default: "hh*random(0.5)", tried: ["hh*2.0"], change: moderate, effect: "vertical strokes wobble into large S-curves and loops"}
reusable_candidates:
  - {name: arcWash, signature: "arcWash(x, y, rIn, rOut, a1, a2, col, alp1, alp2)", note: "360-degree radial alpha-fade wash built from thin quad segments (lines 66-84)"}
  - {name: wobbleLine, signature: "wobbleLine(x1, y1, x2, y2, amp, col, alpha)", note: "line plus bezier overlay with random control amplitude (lines 44-60)"}
  - {name: randomPalette, signature: "rcol(colors[]) -> int", note: "uniform random pick from a fixed palette (lines 91-94)"}
---

## What it draws
Baseline (seed 42) is a full-bleed grid of 4 columns and ~17 rows of soft, pastel rectangular cells. Each cell is washed in a single translucent colour (dominantly teal, blue and green, with warm red/orange/yellow cells), has a soft blurred disc in its centre, and is crossed by a few thin, gently wobbly coloured curves and straight lines. Edges between cells show as thin light gaps; overall the image reads as a calm, watercolor-tiled mosaic.
## How the code works
`setup()` (lines 3-8) sets 960x960 P2D, `smooth(8)`, then calls `generate()` once; `draw()` (10-12) is empty so the piece is static; `keyPressed` (14-20) regenerates on any non-`s` key. `generate()` (22-64): `background(250)` (23); grid of `cw` columns = `int(random(4, random(4, 25)))` (25) and `ch` rows = `cw*random(3,5)` (26), so cells are taller than wide. Per cell (30-63): rounded rect inset by 1px, random palette colour at alpha 40 (35-36); centre ellipse sized `hh*0.6` (37); then `arc2(...)` (38) draws a full 360-degree wash: `arc2` (66-84) splits the ring into `cc` quads from radius 0 to `ww/2`, each filled with the cell's random colour fading from alpha 150 (centre) to 0 (edge), which produces the soft radial gradient visible in every cell. Finally 0-19 strokes per cell (`cc = int(random(20))`, 42), each horizontal (straight `line` + `bezier` overlay, 52-60) or vertical (top-to-bottom `bezier` with random end-x and amplitude, 45-51), stroked in a random palette colour at alpha 50 (49, 57). Colour always comes from the 5-colour palette `{#E70012, #D3A100, #017160, #00A0E9, #072B45}` via `rcol()` (91-94); `getColor` (95-104) exists but is unused. `smooth(8)` + P2D does most of the softness; low alphas stack into pastels. Randomness enters via the seed (line 1, harness-rewritten) and every `random()` call; deterministic per seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cw_8 | `int cw = int(random(4, random(4, 25)));` -> `int cw = 8;` | large | 8 narrow columns, ~24 rows: small cells, dense thin lines, busy texture | variants/cw_8/frame_00001.png |
| ch_8 | `int ch = int(cw*random(3, 5));` -> `int ch = 8;` | moderate | 4x8 grid of large squarish cells; washes very soft, lines sparse and faint | variants/ch_8/frame_00001.png |
| cc_4 | `int cc = int(random(20));` -> `int cc = 4;` | moderate | same 4x17 grid, colour layout identical; each cell has at most 4 thin strokes, clearly cleaner | variants/cc_4/frame_00001.png |
| rectAlpha_200 | `fill(rcol(), 40);` -> `fill(rcol(), 200);` | large | same grid and colours but cells look like solid saturated blocks (red/blue/yellow/teal), 1px gaps stand out | variants/rectAlpha_200/frame_00001.png |
| arcAlp1_255 | `rcol(), 150, 0)` -> `rcol(), 255, 0)` | moderate | per-cell radial wash stronger: bright centre fading to pale edges, glowy centre discs more visible | variants/arcAlp1_255/frame_00001.png |
| amp_2 | `float amp = hh*random(0.5);` -> `float amp = hh*2.0;` | moderate | vertical strokes now swing up to twice the cell height: pronounced S-curves and loops crossing cells | variants/amp_2/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `arc2` as a radial alpha-fade wash (pure geometry, palette-agnostic); the wobble-line generator (line + bezier overlay with random amplitude) as a `wobbleLine` primitive; `rcol`/`getColor` as a palette sampler.
- Caveat: changing `cw`/`ch` shifts the `random()` stream, so those two variants also re-roll the per-cell colour layout; `cc_4`, `rectAlpha_200`, `arcAlp1_255` keep the baseline grid and colours, so their scores isolate the parameter. `amp_2` removes one `random()` call per vertical stroke, so its layout is also slightly re-rolled.
- One-off art decisions: the 5-colour palette, the fixed stack of rect+ellipse+arc wash per cell, the 1px gap, the specific alpha ladder (40/50/150→0), the tall-cell aspect (`cw*random(3,5)`).
- A clean parameter object: `{columns, rows, rectAlpha, ellipseScale, washRadius, washAlpha, strokesPerCell (min,max), strokeAlpha, lineAmplitude, gap, palette[]}`.
