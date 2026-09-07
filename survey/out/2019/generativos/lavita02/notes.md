---
sketch: 2019/generativos/lavita02
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 4251
animated: false
techniques: [noise-field, flow-field, grid, distortion, lines-hatching]
primitives: [line]
palette:
  colors: ["#F23602", "#300F96", "#C9FFF6", "#F72C81", "#09EFA6", "#fac62a"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
parameters:
  - {name: lar, default: "*26 (0-26 steps)", tried: ["*8 (0-8 steps)"], change: large, effect: "same layout/border; much darker and less saturated (shorter strands accumulate less under ADD); only the top-left orange streak stays bright"}
  - {name: "stroke alpha", default: 38, tried: [120], change: large, effect: "much brighter: large areas blow out to white/cyan/magenta/yellow, pastel washed-out silk, weave still visible"}
  - {name: amp, default: 20, tried: [60], change: large, effect: "much stronger displacement: huge white glowing ribbons/loops, big black notches at top, exaggerated lobes, stretched interior"}
  - {name: bb, default: 50, tried: [200], change: large, effect: "cloth shrinks to ~560 px centred in a large black margin; colours, brightness and texture unchanged"}
  - {name: detAng, default: "random(0.001)", tried: ["random(0.003)"], change: none, effect: "no visible change - frame identical to baseline"}
---

## What it draws
A full-bleed woven cloth of thousands of fine, short line strands over a black
background, reading like glowing silk fabric. The cloth fills the canvas as a
rough square with a wavy, lobed border — big rounded bulges near the corners and
a scalloped top edge — with black showing through the gaps. Colours form large
smooth regions: orange/red (top-left and right), green/teal (centre), purple
(bottom-centre) and yellow (bottom-right), all highly saturated; where strands
overlap most they bloom into bright near-white streaks (a hot yellow-white band
on the left edge, white glints along the border lobes). The strand texture is
extremely fine and dense, with a faint vertical weave to it.

Note: baseline `frame_00010.png`/`frame_00060.png` are blank black even though
the code is fully static — `draw()` is empty (line 31-32) and `generate()` runs
once in `setup()`. This is a headless P3D capture artifact on this display
(`pixelDensity(2) is not available for this display` on stderr), not temporal
behaviour. Frame 1 is the real artwork.

## How the code works
`settings()` (14-19) opens a 960×960 P3D canvas (scale = nwidth/swidth = 1),
`smooth(8)`, `pixelDensity(2)` (unavailable on the headless display — warning
only). `setup()` calls `generate()` once (21-29); `draw()` is empty (31-32);
any key regenerates with a new seed (34-40).

`generate()` (42-105):

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| lar_8 | `float lar = noise(desLar+x*detLar, desLar+y+detLar)*26;` -> `...*8;` | large (mean 0.2507, 81.2% px) | same layout and wavy border, but the cloth is much darker and desaturated (deep green, maroon, dark purple, olive); only the top-left orange diagonal streak stays bright — shorter strands accumulate less under ADD, so the glow is lost | variants/lar_8/frame_00001.png |
| alpha_120 | `stroke(col, 38);` -> `stroke(col, 120);` | large (mean 0.3227, 82.1% px) | same layout and border; much brighter — large areas blow out to near-white, with cyan, magenta and yellow pastel regions; the weave is still visible but washed out | variants/alpha_120/frame_00001.png |
| amp_60 | `float amp = 20;` -> `float amp = 60;` | large (mean 0.16, 58.6% px) | displacement 3x stronger: huge white glowing ribbons and loops (a big "m" of white bands across the top), large black notches cut into the top and right edges, very exaggerated lobes; the interior is rippled and stretched between the white bands | variants/amp_60/frame_00001.png |
| bb_200 | `float bb = 50;` -> `float bb = 200;` | large (mean 0.209, 49.0% px) | the cloth shrinks to a ~560 px square centred in a large black margin; colours, brightness and texture are the same as baseline, same wavy lobed border | variants/bb_200/frame_00001.png |
| detAng_0.003 | `float detAng = random(0.001);` -> `float detAng = random(0.003);` | none (mean 0.0, 0.0% px) | no visible change — frame_00001 is identical to the baseline. [INFERENCE] `detAng` enters only as an additive offset on noise inputs dominated by `x*desAng`/`y*desAng` with `desAng = random(10000)` (line 56), so a ~1e-3 offset is far below float32 precision after the `(float)` cast on line 86; the parameter is effectively dead | variants/detAng_0.003/frame_00001.png |
  picks 3-5 colours at random from the fixed 6-colour list
  `#F23602 #300F96 #C9FFF6 #F72C81 #09EFA6 #fac62a` (line 121/140) into `colors`.
- `background(0)` black ground (53), `blendMode(ADD)` (68), `noFill()` (69) —
  everything is additive, so low-alpha strokes accumulate and saturate to
  white where they overlap.
- A set of random noise-detail/offset pairs are drawn (55-63): `detAng`/`desAng`
  (strand-direction field), `detAng2`/`desAng2` (direction jitter), `detCol`/
  `desCol` (colour field), `detLar`/`desLar` (strand-length field), `radNoise`,
  `detPwrCol` (colour-blend exponent field); `detDef = random(0.0008, 0.001)*0.8`
  (line 49) sets the displacement-field detail.
- Outer loop (74-75): unit grid from `bb = 50` (line 73) to `width/height - bb`.
  Each point starts at `x = i, y = j + cos(x*0.2)` (76-77) — a gentle vertical
  wave across the grid.
- Per point: `lar = noise(desLar + x*detLar, desLar + y + detLar) * 26` (84)
  gives a strand length of 0-26 steps; `nc = noise(...) * colors.length` (82)
  seeds the colour walk.
- Inner loop (85-101): at each step a direction `ang = SimplexNoise.noise(
  detAng + x*desAng, detAng + y*desAng)` (86) plus a near-white-noise jitter
  `noise(desAng2 + x + ..., desAng2 + y + ...)` (87, unit-per-pixel detail), so
  `ang` wanders in roughly [-2, 2]. Colour: `n2 = SimplexNoise.noise(nc*0.2,
  k*0.001)` (88) drifts along the strand; `pwrCol = noise(x*detPwrCol,
  y*detPwrCol) * 2` (89) is the lerp exponent; `getColor(vc + grid*0, pwrCol)`
  (91-93) lerps between two neighbouring palette entries at position `v` (147-
  153) — the `grid` term is computed but multiplied by 0 (dead). Stroke is
  `col` at alpha 38 (94).
- The first vertex is `def(x, y)` (96, 109-113): a 3-D simplex angle
  (`seed` as the z slice) times TAU*2.2, displacement amplitude `amp = 20` —
  every strand start is shoved up to 20 px along a smooth noise direction. This
  displacement field is what produces the wavy, lobed border (edge strands
  pushed in/out of the black margin) and the cloth-like distortion. Subsequent
  vertices follow the walk (`x += cos(ang); y += sin(ang)`, 99-100) through the
  same `def()` displacement.
- `beginShape(LINES)`/`endShape()` (83/102) connect the displaced points into a
  short polyline per grid point.

Randomness: the seed controls `randPallets()`, all noise offsets, and the
displacement z-slice; the sketch is fully deterministic under a fixed seed
(baseline `deterministic: true`). The triangulate import (line 1) is unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic / library candidate: `generate()` is a parameterisable "displaced
  flow-hatch" primitive: unit grid over a bounding box, short noise-walked
  polylines per point (max steps `26`, length from a noise field), a global
  3-D-simplex displacement (amplitude `amp = 20`, detail `detDef`), direction
  from a 2-D simplex field plus unit-scale jitter, colour by lerping adjacent
  palette entries at a noise-driven position with a noise-driven exponent,
  additive blend, fixed alpha (38).
- One-off art decisions: the specific 6-colour palette and its random 3-5
  subset, the `y + cos(x*0.2)` row wave, `bb = 50` margin, the dead `grid*0`
  term, alpha 38.
- A clean parameter object: `{bbox, step, maxSteps, lengthDetail,
  displaceAmp, displaceDetail, angDetail, angJitter, colorDetail, pwrDetail,
  palette, alpha, blend: "ADD"}`.
