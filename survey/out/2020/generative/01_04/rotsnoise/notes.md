---
sketch: 2020/generative/01_04/rotsnoise
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1676
animated: false
techniques: [noise-field, grid]
primitives: [shape]
palette:
  colors: ["#F0F0F0", "#F7C900", "#005AA6", "#E73C2B"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: sca, default: 4, tried: [8], change: moderate, effect: "coarser mosaic: tiles 2x larger (edge 2*sca*exp), grid step 12->24px; same palette and large colour regions"}
  - {name: det, default: "random(0.005) per run", tried: [0.01], change: large, effect: "higher density-noise frequency: mottled tile counts break into fine speckled clumps with many empty gaps showing the background"}
  - {name: detCol1, default: "random(0.02) per run", tried: [0.08], change: large, effect: "finer colour field: individual tiles vary more (red/blue/yellow/white intermix) while the big soft regions remain visible"}
  - {name: exp, default: "int(random(6)) per run", tried: [1], change: moderate, effect: "tile edge 2*sca*exp fixed at 8px: much smaller confetti, sparser coverage, background shows through"}
  - {name: colors, default: "F0F0F0 F7C900 005AA6 E73C2B", tried: ["00E5FF FF4081 76FF03 FFEA00"], change: large, effect: "same structure recoloured: green/yellow field with pink and cyan patches; palette is a pure style knob"}
  - {name: "cc multiplier (noise*30-8)", default: "30", tried: [60], change: moderate, effect: "twice the sub-tiles per cell: denser hatched texture, fewer gaps; region layout unchanged"}
reusable_candidates:
  - {name: noiseRotatedTiles, signature: "noiseRotatedTiles(cell, subCount, tileExp, detail, colorDetail) -> void", note: "noise-gated grid of rotated quads, colour from low-frequency noise-lerped palette"}
---

## What it draws
A full-bleed 960x960 field densely packed with small rotated squares, like a
mosaic of confetti. The overall image reads as large soft colour regions —
blue and red dominant, with patches of yellow and near-white — while at the
micro level it is a grainy scatter of 45-degree-stepped quads of mixed blue,
red, yellow and white. Coverage is uneven: some areas (e.g. the top-right
yellow patch, the left white patch) are thickly packed, others are sparser,
giving a mottled, cellular density pattern.

## How the code works
`settings()` sizes a 960x960 P3D window (lines 14-19); `generate()` (44-90)
draws once and is not re-called from `draw()`, so the piece is static.

1. Background: a single black-filled quad covering the canvas, whose two
   triangles are re-filled with random palette colours `rcol()` (48-56),
   giving a faint two-tone backdrop (nearly invisible under the tiles).
2. Density field: `det = random(0.005)` (58) is a per-run noise frequency;
   a double loop steps the canvas in `3*sca` = 12 px cells (67-68), and each
   cell draws `cc = int(noise(det*i, det*j)*30-8)` sub-tiles (69) — the
   simplex-like noise makes local tile counts vary smoothly across the
   canvas (mottled density).
3. Each sub-tile: position jittered by 0-2 cells (72-73), rotated to a
   multiple of 45 degrees (`int(random(8))*HALF_PI*0.5`, 76), drawn as a
   quad of half-size `sca*exp` (79-83) where `exp = int(random(6))` (66) is
   a per-run size multiplier (0-5).
4. Colour: `getColor(noise(xx*detCol1, yy*detCol1)*colors.length)` (78)
   samples a second, even lower-frequency noise field (detail < 0.02),
   wraps it modulo 4, and `lerpColor`s between adjacent palette entries with
   `pow(v%1, 0.1)` (107-112) — the heavy pow bias snaps the lerp mostly to
   the endpoint colour, which is why regions read as flat palette colours
   with soft seams. The four-colour palette is white, yellow, blue, red
   (98); a commented-out alt palette (97) uses rust/grey/indigo/dark-green.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sca_8 | `  int sca = 4;` -> `  int sca = 8;` | moderate | coarser mosaic: ~2x larger rotated quads on a sparser grid; same blue/red/yellow/white regions and mottled density | variants/sca_8/frame_00001.png |
| det_0.01 | `  float det = random(0.005);` -> `  float det = 0.01;` | large | density mottling becomes fine-scale: small dense clumps of red/yellow tiles scattered over blue with many empty background gaps; big colour regions persist | variants/det_0.01/frame_00001.png |
| detCol1_0.08 | `  float detCol1 = random(0.02);` -> `  float detCol1 = 0.08;` | large | colour field 4x finer: tiles within each region mix red/blue/yellow/white instead of settling on one colour; large red (top-left) and blue regions still readable | variants/detCol1_0.08/frame_00001.png |
| exp_1 | `  float exp = int(random(6));` -> `  float exp = 1;` | moderate | tiles shrink to ~8px edges: sparse fine confetti over a pale background, much of the canvas empty | variants/exp_1/frame_00001.png |
| palette_pastel | `int colors[] = {#F0F0F0, #F7C900, #005AA6, #E73C2B};` -> `int colors[] = {#00E5FF, #FF4081, #76FF03, #FFEA00};` | large | identical structure recoloured: green/yellow dominant with pink and cyan patches | variants/palette_pastel/frame_00001.png |
| cc_60 | `int cc = int(noise(det*i, det*j)*30-8);` -> `*60-8` | moderate | twice the sub-tiles per cell: denser hatched texture, fewer background gaps; same region layout as baseline | variants/cc_60/frame_00001.png |

## Modularisation notes
The generic core is a "noise-gated tile grid": a grid step, a per-cell count
from 2-D noise, per-tile random rotation snapped to a step, and a colour
chosen by noise-sampling a palette with lerp. Reusable as
`noiseRotatedTiles(cell, subCount, tileExp, detail, colorDetail)` taking a
palette and optional rotation snap. One-off art decisions: the specific
palette and the `pow(v, 0.1)` lerp bias (a style knob worth keeping as a
`snap` parameter), the per-run random `det`/`exp` instead of explicit
parameters, and the random two-tone background quad. A clean parameter object
would be `{cell, subCount, tileExp, densityDetail, colorDetail, rotSnap,
palette, lerpBias}`.
