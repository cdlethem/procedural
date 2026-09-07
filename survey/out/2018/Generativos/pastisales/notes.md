---
sketch: 2018/Generativos/pastisales
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1700
animated: false
techniques: [noise-field, dots-stippling]
primitives: [ellipse, rect, triangle, quad]
palette:
  colors: ["#121435", "#FAF9F0", "#EDEBCA", "#FF5722", "#FFF1F6", "#FAF9F4", "#F7F2EC", "#DDDCDA", "#272741"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: 200000, tried: [50000], change: moderate, effect: "fewer iterations -> sparser bands, more empty gaps between clusters"}
  - {name: a, default: 0.5, tried: [0.3, 0.7], change: moderate, effect: "noise gate threshold; lower = fewer dots/bars (sparse skyline), higher = denser fuller bands"}
  - {name: det, default: "random(0.0012,0.004)", tried: [0.004], change: moderate, effect: "finer noise frequency -> busier, more fragmented clusters with more vertical bars"}
  - {name: dot_size_mult, default: 30, tried: [60], change: moderate, effect: "larger dots -> more solid, filled-in bands"}
  - {name: bar_chance, default: 0.03, tried: [0.1], change: moderate, effect: "more vertical bars -> stronger skyline effect"}
reusable_candidates:
  - {name: noiseBands, signature: "noiseBands(count, detail, threshold, yStagger) -> points", note: "scattered dots gated by a 1-D noise field sampled on a y-mapped row, producing horizontal clusters"}
---

## What it draws
A cream/off-white field covered in a scatter of small dots and thin vertical bars that
coalesce into loose horizontal bands at a handful of y-levels. The bands are made of
navy, cream, pale-yellow and orange dots and tall thin rectangles (like a skyline or
fields of pasta). Sprinkled in are a few small triangles, diamonds and quads, mostly
dark navy or orange, sitting on or just above the bands. Overall it reads as a sparse,
horizon-streaked stipple — most of the canvas is empty background with the interest
concentrated in a few rows.

## How the code works
One-shot: `setup()` -> `generate()`, empty `draw()`. (pastisales.pde:3-22)

- Background: `background(rcol(colors))` picks a random colour from `colors[]`
  (`#121435, #FAF9F0, #EDEBCA, #FF5722`) (line 23). Seed 42 lands on the pale cream
  background.
- Main loop: 200000 iterations (`cc`, line 32). `x = random(width)`, but
  `y = map(i, 0, cc, 0, height)` (line 35) — y is deterministic and sweeps top-to-bottom,
  so each successive point sits a little lower; this is what creates the horizontal
  banding, because the noise gate below accepts/rejects in y-aligned runs.
- Gate: `n = noise(des + x*det, des + y*det*6)` (line 38). The y frequency is 6x the x
  frequency (`det*6`), so the noise varies fast vertically and slowly horizontally —
  the source of the horizontal streaks.
- Main dots (lines 40-45): when `n < a` (a = 0.5, line 37) draw an ellipse of size
  `s = 30*sa*random(0.5,2)*amp` where `sa = pow(map(n,0,a,1,0),4)` (line 41) makes size
  fall off steeply as n approaches the threshold, and `amp = map(y,0,h,0.6,1.4)`
  (line 36) makes lower dots bigger. Fill from `getColor(colors, random())` — a
  lerp between two random palette colours (lines 92-97).
- Bars (lines 46-55): with 3% probability (and `s>2`) a thin vertical bar is drawn: a
  dark-navy (`fill(0,30)`) shadow ellipse plus a `rect` of height `h = 80*n2` and width
  `h*random(0.02,0.2)` in a palette colour. These are the "skyline" verticals.
- Small shapes (lines 57-70): with 0.0008 probability, a tiny triangle or quad (with a
  shadow ellipse) in a palette colour — the scattered diamonds/triangles.
- `det = random(0.0012,0.004)` and `det2 = random(0.005,0.002)` are fixed per run (seeded).
- Renderer P2D, `smooth(8)`, `pixelDensity(2)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_50000 | `int cc = 200000;` -> `int cc = 50000;` | moderate (mean 0.0553, 0.162) | sparser: same horizontal bands but fewer dots, more empty gaps between clusters, overall lighter | variants/cc_50000/frame_00001.png |
| a_0.3 | `float a = 0.5;...` -> `float a = 0.3;...` | moderate (mean 0.0554, 0.156) | fewer dots pass the gate: bands thin out, the tall thin vertical bars stand out more, reads as a sparser skyline with fewer round dots | variants/a_0.3/frame_00001.png |
| a_0.7 | `float a = 0.5;...` -> `float a = 0.7;...` | moderate (mean 0.1422, 0.419) | more dots pass the gate: bands denser and more continuous, more orange/navy, more vertical bars, fuller coverage | variants/a_0.7/frame_00001.png |
| det_0.004 | `float det = random(0.0012,0.004);...` -> `float det = 0.004;` | moderate (mean 0.1004, 0.285) | finer noise: clusters busier and more fragmented, more vertical bars, patchier | variants/det_0.004/frame_00001.png |
| s_60 | `float s = 30*sa*random(0.5,2)*amp;` -> `float s = 60*...` | moderate (mean 0.0585, 0.187) | bigger dots: bands more solid and filled-in, larger blobs, more continuous texture | variants/s_60/frame_00001.png |
| bar_0.1 | `...random(1) < 0.03 && s > 2` -> `...random(1) < 0.1 && s > 2` | moderate (mean 0.0563, 0.167) | more vertical bars: skyline effect stronger, more thin rectangles sticking up from the bands | variants/bar_0.1/frame_00001.png |

## Modularisation notes
- **Generic / reusable:** the core loop is a "noise-gated scatter on a mapped axis" —
  points distributed with one coordinate random and one mapped from the index, gated by
  a 1-D noise field (x freq << y freq), sized by a power curve on the noise value, and
  coloured from a lerped palette. This is a reusable `noiseBands`-style primitive:
  parameters = count, noise detail (x and y), threshold, size multiplier, y-stagger
  (random vs mapped), palette.
- **One-off art decisions:** the specific 4-colour palette, the 3% bar overlay and
  0.0008 micro-shape overlay (skyline/triangle motifs), the navy `fill(0,30)` shadows,
  the `amp` y-size ramp, the `*6` vertical frequency exaggeration.
- **Clean parameter object:** `{ count, noiseDetailX, noiseDetailY, threshold,
  sizeMult, yMode("random"|"mapped"), barChance, barMaxH, microChance, palette,
  background }`. The bar and micro-shape overlays are optional "decoration" layers that
  could be toggled/parameterised separately from the base stipple.
