---
sketch: 2020/generative/01_04/noiiiii
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate, peasy]
deterministic: true
ms_first_frame: 1573
animated: false
techniques: [noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#EA2E73", "#F7AA06", "#1577D8"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: form_cc, default: 20, tried: [40], change: moderate, effect: "denser, finer striations; central band splits into more thin lines; right edge gains more, smaller concentric rings"}
  - {name: back_cc_divisor, default: 10, tried: [5], change: large, effect: "back layer 24-36 strips instead of 12-18: the two lens shapes dissolve into a full-bleed dense vertical striation texture"}
  - {name: back_det, default: "random(0.004)", tried: ["random(0.02)"], change: moderate, effect: "coarser, grainier, more ragged texture; lenses break up; right edge opens into a large rainbow wavy band"}
  - {name: form_det, default: "random(0.001)", tried: ["random(0.005)"], change: subtle, effect: "subtle: texture slightly more mottled; ring columns on the right shift, otherwise same composition"}
  - {name: palette_order, default: "[#EA2E73, #F7AA06, #1577D8]", tried: ["[#EA2E73, #1577D8, #F7AA06]"], change: subtle, effect: "subtle: composition identical; strips that were orange now blue and vice versa, so yellow accents in the right rings/specks turn blue"}
reusable_candidates:
  - {name: noiseRibbonStrip, signature: "noiseRibbonStrip(count, noiseDetail, noiseAmp, osc1, osc2, falloffPower, falloffMode) -> void", note: "filled quad strips across the width, y from cos(i*osc1+j*osc2+noise) pulled toward canvas midline by a power falloff (edges or center)"}
  - {name: randomStripColor, signature: "randomStripColor(colors[]) -> int", note: "one palette color per strip via int(random(len))"}
---

## What it draws
A full-black 960x960 canvas covered in extremely fine vertical striations. Two large
lens/rounded-rectangle regions (one left, one right) are formed by the dense striated texture,
with a brighter vertical band down the middle. Along the right edge the striations loosen into
thin wavy lines and a vertical column of small colourful elliptical rings (pink, yellow,
blue, pale/white). Overall it reads as dark brown-ochre moire with bright pink/yellow/blue
accents concentrated on the right side.

## How the code works
`setup()` (line 24) calls `generate()` once; `draw()` (line 35) calls it every frame but with a
fixed seed the output is identical, so the sketch is static.

`generate()` (lines 48-58): `randomSeed(seed)`, `noiseSeed(seed)`, `background(0)`, then
`back()` and `form()`.

- `back()` (lines 61-91): `cc = int(random(120,180))` then `cc /= 10` -> 12-18 horizontal
  strips; `ss = width/cc`. Per strip: fill one of the 3 palette colours (`rcol()`, lines 137-139,
  `int(random(colors.length))`), then a `QUAD_STRIP` (noStroke) across every x pixel `j`:
  `y = (cos(i*osc1 + j*osc2 + n)*0.5+0.5)*height` where `n` is 2-D simplex noise
  (`SimplexNoise.noise(j*det, i*det)`, detail `det ~ random(0.004)`, scaled by `ss*ampNoi`).
  Finally `y = lerp(y, height*0.5, pow(v, pwr1))` with `v = abs(2*j/width - 1)` (line 84):
  the strip is pulled toward the vertical midline at the left/right edges, producing the rounded
  lens silhouettes.
- `form()` (lines 93-124): same construction, but `cc` is hard-set to 20 (line 95),
  `det ~ random(0.001)` (finer), and the lerp uses `pow(1-v, pwr1)` (line 117) so the strips
  are pulled toward the midline in the middle of the canvas and free at the edges. The 20
  strips overpaint the 12-18 back strips; the high-frequency cos+noise makes adjacent strip
  edges cross at many places, which is the fine vertical striation texture. Where neighbouring
  strip phases separate (right side) the gaps open up into the visible wavy lines and the
  stacked elliptical rings.

Randomness: all per-run parameters (`det`, `osc1`, `osc2`, `pwr1`, `ampNoi`, strip counts,
per-strip colour) are drawn once under `randomSeed(seed)`, so the image is fully determined by
the seed (baseline `deterministic: true`). No blend modes, opaque fills, later strips paint
over earlier ones.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| formCc_40 | `  cc = 20;` -> `  cc = 40;` | moderate | striations visibly finer/denser; central band breaks into more thin lines; right edge crowded with smaller pink/yellow/blue concentric rings; two lens shapes remain | variants/formCc_40/frame_00001.png |
| backDiv_5 | `  cc /= 10;` -> `  cc /= 5;` | large | the two big lens shapes disappear into a full-bleed dense vertical-striation texture; right side shows more pronounced wavy pale rings; central band still present | variants/backDiv_5/frame_00001.png |
| backDet_0.02 | `  float det = random(0.004);` -> `  float det = random(0.02);` | moderate | grainier, more ragged and broken-up texture; lenses less coherent; right edge opens into one large multi-coloured (blue/orange/pink) wavy band plus a small rainbow arc | variants/backDet_0.02/frame_00001.png |
| formDet_0.005 | `  float det = random(0.001);` -> `  float det = random(0.005);` | subtle | no visible change in composition; texture slightly more mottled; two ring columns on the right side, lens shapes as in baseline | variants/formDet_0.005/frame_00001.png |
| palette_swap | `int colors[] = {#EA2E73, #F7AA06, #1577D8};` -> `int colors[] = {#EA2E73, #1577D8, #F7AA06};` | subtle | same composition as baseline; orange-accented strips/rings on the right now render blue, so the right-edge rings read pink/blue instead of pink/yellow/blue | variants/palette_swap/frame_00001.png |

## Modularisation notes
The strip block (lines 71-90 in `back()`, 104-123 in `form()`) is duplicated almost verbatim;
the two layers differ only in three choices: strip count (random/10 vs fixed 20), noise detail
range (0.004 vs 0.001), and falloff mode (`pow(v, pwr)` = pull edges to midline vs
`pow(1-v, pwr)` = pull center to midline). A single library function
`noiseRibbonStrip(count, noiseDetail, noiseAmp, osc1, osc2, falloffPower, falloffMode)` would
cover both layers.

One-off art decisions: the two-layer composition (back lens shapes + form band), the specific
3-colour palette and per-strip random colour assignment, the cos-based y mapping, and the
fixed 960x960 size.

A clean parameter object: `{seed, width, height, background, layers: [{count, noiseDetail,
noiseAmp, osc1, osc2, falloffPower, falloffMode: "edges"|"center", palette: [..3..],
colorMode: "random-per-strip"}]}`.
