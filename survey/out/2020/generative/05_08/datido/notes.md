---
sketch: 2020/generative/05_08/datido
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1623
animated: false
techniques: [polar, noise-field, lines-hatching]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#FFB0D0", "#F7DE20", "#245C0E", "#EB6117", "#F72C11", "#C6356B", "#953DC4", "#003399", "#02060D"]
  selection: random-from-list
composition: radial
parameters:
  - {name: res, default: 56, tried: [14], change: large, effect: "fewer, sparser ribbons; wider white gaps between them"}
  - {name: det, default: "random(0.0008)", tried: [0.0002], change: large, effect: "lower detail = long, smooth sweeping curves instead of fine churning"}
  - {name: aa, default: "random(380)", tried: [100], change: large, effect: "smaller displacement = smoother, wider bands; some ribbons read as solid fans near center"}
  - {name: amp, default: 0.8, tried: [0.25], change: large, effect: "thinner ribbons with more white gap between adjacent ones"}
  - {name: pwr, default: "int(random(1,10)), inverted 50%", tried: [2], change: moderate, effect: "uniform taper; all ribbons the same smooth thin-to-broad wedge, less variety"}
  - {name: "inner steps (800)", default: 800, tried: [200], change: large, effect: "coarser, chunkier hatched quads; note v1 still scales by j/800 so ribbons end shorter"}
reusable_candidates:
  - {name: noiseWarp, signature: "noiseWarp(x, y, z, det, amp, seed) -> PVector", note: "3 simplex-noise channels (x, y, z) offset by seed, mapped to spherical displacement; def() at line 107"}
  - {name: radialRibbon, signature: "radialRibbon(cx, cy, angle, width, length, taperPow, steps, warp)", note: "QUAD_STRIP of warped vertices from center at angle, radial width s*pow(t, pwr), one fill per quad"}
  - {name: randomPalette, signature: "randomPalette(colors[]) -> int", note: "rcol(): uniform random index into a fixed color list"}
---

## What it draws
A starburst of ~56 wavy ribbons radiating from the exact center to the corners of a white canvas.
Each ribbon tapers from thin at the center to a broad, irregular band at the edge, and its outline
is churned into a streaky, hatched texture made of thousands of tiny colored quads. The dominant
colors are the vivid palette — red-orange, yellow, pink, purple, blue, dark green — read together
as iridescent rainbow streaks; white shows through between the ribbons, which wobble and braid
where the noise displacement pushes them.

## How the code works
`settings()` makes a 960x960 P3D window (lines 13-18); `setup()` calls `generate()` once (line 22)
and `draw()` is empty, so the piece is static. `generate()` (line 54):

- `hint(DISABLE_DEPTH_TEST)` (line 56), `randomSeed/noiseSeed(seed)` (lines 58-59), white `background(250)` (line 61).
- Global knobs: `res = 56` ribbons (line 67), `s = width*0.7` max ribbon length (line 69), `amp = 0.8` angular half-width of each ribbon (line 70), `det = random(0.0008)` noise detail (line 76), `aa = random(380)` noise displacement amplitude (line 77).
- Outer loop `i < res` (line 79): ribbon `i` spans angles `a1 = da*i` to `a2 = da*(i+amp)` with `da = TAU/res` (lines 81-83), so ribbons overlap by 80% of a slot. Per-ribbon `pwr = int(random(1,10))`, inverted to `1/pwr` with probability 0.5 (lines 85-86): this picks the taper curve, so some ribbons swell out fast and others stay thin.
- Inner loop `j < 800` (line 89): `v1 = j/800` runs 0..1 along the ribbon; radius `s1 = s*pow(v1, pwr)` (line 91) — the taper. A color `col = rcol()` is picked per quad (line 93, `int(random(colors.length))` into the 10-color list at line 127). Two vertices `p1, p2` are computed on the two ribbon edges (lines 94-95) and each is displaced twice through `def()` (lines 96-97). `fill(col, 0)` + `fill(col)` per vertex pair (lines 98-100) makes the quad between p1 and p2 one flat color, producing the hatched streaks.
- `def()` (line 107) is the distortion: three `SimplexNoise.noise` calls with coordinates shuffled and offset by `seed*0.02` give angles `a1, a2` (x 0..2*TAU) and radius `a` (x 0..`aa`); it returns spherical displacement `(cos(a1)cos(a2)*a, sin(a1)cos(a2)*amp, sin(a2)*a)` (line 111). This warps every vertex, turning straight spokes into wavy braids.

Randomness enters at: seed (line 4), per-ribbon `pwr` (lines 85-86), per-quad color (line 93), and the global `det`/`aa` draws (lines 76-77). No blend modes; the P3D renderer is used only so `hint`/QUAD_STRIP draw fast.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| res_14 | `int res = 56;` -> `int res = 14;` | large | only 14 ribbons: sparse thin colored streaks radiating from center, much more white showing between them | variants/res_14/frame_00001.png |
| det_0.0002 | `float det = random(0.0008);` -> `float det = 0.0002;` | large | fine churn replaced by huge smooth sweeping curves; ribbons fold into broad, gentle waves | variants/det_0.0002/frame_00001.png |
| aa_100 | `float aa = random(380);` -> `float aa = 100;` | large | displacement reduced: smoother wide bands with big white gaps; several ribbons near center read as solid purple/green fans | variants/aa_100/frame_00001.png |
| amp_0.25 | `float amp = 0.8;` -> `float amp = 0.25;` | large | ribbons much narrower (less angular overlap), wavy edges, more white between them | variants/amp_0.25/frame_00001.png |
| pwr_2 | `float pwr = int(random(1, 10));` -> `float pwr = 2;` | moderate | uniform taper on every ribbon: all are smooth thin-center-to-broad-edge wedges; the per-ribbon variety is gone but overall layout stays similar | variants/pwr_2/frame_00001.png |
| steps_200 | `for (int j = 0; j < 800; j++) {` -> `for (int j = 0; j < 200; j++) {` | large | coarser hatching: fewer, chunkier colored quads; `v1 = j/800` unchanged so ribbons stop at ~1/4 of their length and solid fan areas appear near center | variants/steps_200/frame_00001.png |

## Modularisation notes
- `def()` is a generic 3-channel spherical noise warp: a clean library function `noiseWarp(x, y, z, detail, amplitude, seedOffset) -> PVector`.
- The ribbon builder (outer `res` loop + inner `800`-step QUAD_STRIP with `s*pow(v1, pwr)` taper and per-quad fill) is a reusable `radialRibbon(...)`; its art decisions are `amp` (overlap), the random `pwr` taper, and per-quad random color.
- A parameter object would be: `{res, amp, s, det, aa, steps, taper: {min, max, invertProb}, palette, seed}`. The commented-out palette lines (120-126) show the author iterates color sets, so `palette` should be first-class.
- One-offs: `hint(DISABLE_DEPTH_TEST)` and the P3D renderer choice (no depth is drawn), the double call to `def()` per vertex, and the `fill(col, 0)`/`fill(col)` per-vertex trick that colors each quad individually.
