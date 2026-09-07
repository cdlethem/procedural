---
sketch: 2017/Generativos/lineTextures2
year: 2017
renderer: JAVA2D
size: [1920, 1920]
libraries: []
deterministic: true
ms_first_frame: 582
animated: false
techniques: [lines-hatching, grid]
primitives: [line]
palette:
  colors: ["#000000", "#d9601a", "#5ae68b", "#770101"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: minLen, default: "random(5, 40)", tried: ["random(30, 120)"], change: large, effect: "longer dashes -> more continuous linear streaks, texture reads as scratchy hatching"}
  - {name: g, default: "random(0.2, 0.9)", tried: ["random(0.05, 0.2)"], change: large, effect: "stroke-weight scale (strokeWeight = sep*g); lower -> much thinner strokes, darker sparser texture"}
  - {name: strokeAlpha, default: "random(50, 200)", tried: ["random(50, 80)"], change: large, effect: "lower alpha -> overall darker, muddier image; dark red background dominates"}
  - {name: gap, default: "sep*random(0.8, 1)", tried: ["sep*random(0.2, 0.5)"], change: large, effect: "smaller gaps -> dashes merge into fat continuous chunks, dense grainy texture"}
  - {name: sep, default: "random(2, random(30))", tried: ["random(4, random(60))"], change: large, effect: "wider column spacing -> fewer, more separated columns, more dark red visible between rows"}
  - {name: palette, default: "[#d9601a, #5ae68b, #770101, #d9601a, #5ae68b]", tried: [["#4477ff", "#55aaff", "#223388", "#4477ff", "#55aaff"]], change: large, effect: "all blue tones; dash structure unchanged"}
reusable_candidates:
  - {name: dashHatch, signature: "dashHatch(angle, spacingDist, dashLenDist, gap, weightScale, alphaRange, palette) -> void", note: "parallel columns of short dash strokes at one angle, random spacing, ADD-blended on black"}
---

## What it draws
Full-bleed texture of short, fat, rounded dash strokes arranged in parallel columns along one fixed random angle (slightly tilted near-horizontal in the baseline). The dashes are orange, green and dark red on black, with irregular gaps between them; where overlaps occur the additive blending brightens the colours, giving a woven, hatched line texture with no focal point.

## How the code works
`setup()` (lines 1-6) sizes a 1920x1920 canvas, `smooth(8)`, sets `rectMode(CENTER)` (unused), then calls `generate()`; `draw()` is empty (line 9-11) so the image is static, and key press regenerates.

`generate()` (lines 23-60):
1. Black background (line 24) and `blendMode(ADD)` (line 25), so overlapping semi-transparent strokes accumulate brightness.
2. Translates to canvas centre (line 26) and draws in a rotated coordinate frame: a single random column angle `ang` (line 28) and the diagonal `diag` (line 27) set the extent.
3. Outer loop (line 38-59) walks `dx` along the angle direction from `-diag*0.5` to `+diag*0.5`, advancing by a random column spacing `sep = random(2, random(30))` each iteration (line 39, doubled via `dx += sep*0.5` on both sides, lines 41/58).
| minLen_30_120 | `float minLen = random(5, 40);` -> `float minLen = random(30, 120);` | large | much longer dashes: continuous streaky, scratchy lines instead of fat capsules; dark rows between columns more visible | variants/minLen_30_120/frame_00001.png |
| g_0.05_0.2 | `float g = random(0.2, 0.9);` -> `float g = random(0.05, 0.2);` | large | far thinner strokes: darker, sparser texture, lots of black showing between dashes | variants/g_0.05_0.2/frame_00001.png |
| alpha_50_80 | `stroke(rcol(), random(50, 200));` -> `stroke(rcol(), random(50, 80));` | large | overall darker and muddier: low-alpha strokes barely lift the surface, dark red background dominates, colours desaturated | variants/alpha_50_80/frame_00001.png |
| gap_0.2_0.5 | `b = sep*random(0.8, 1);` (inner loop) -> `b = sep*random(0.2, 0.5);` | large | gaps nearly vanish: dashes merge into fat continuous chunks/blobs, dense grainy texture, brightest of all variants | variants/gap_0.2_0.5/frame_00001.png |
| sep_4_60 | `sep = random(2, random(30));` (inner loop) -> `sep = random(4, random(60));` | large | wider column spacing: fewer, more separated columns, more dark red between rows, dashes read as thinner relative to the gaps | variants/sep_4_60/frame_00001.png |
| palette_blue | `int colors[] = {#d9601a, #5ae68b, #770101, #d9601a, #5ae68b};` -> `{#4477ff, #55aaff, #223388, #4477ff, #55aaff}` | large | identical dash structure in blue tones (light cyan-blue to dark navy) on black; confirms colour is independent of the hatch geometry | variants/palette_blue/frame_00001.png |
5. Stroke weight is `sep*g` (line 45) with `g = random(0.2, 0.9)` (line 35), so dash thickness tracks column spacing. Each dash is stroked in a random palette colour with alpha `random(50, 200)` (line 53) from `rcol()` (lines 63-64, 5-colour list `#d9601a, #5ae68b, #770101`, orange duplicated).
6. Every dash is drawn twice in a row (lines 54-55), doubling its effective alpha where the two calls overlap.

Randomness enters at: `ang`, column `sep`, `minLen`/`maxLen`, gap `b`, per-dash length, and per-dash colour+alpha. The double line call and ADD blend produce the brightened, slightly doubled look of the texture.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The core is a generic angled hatch field: one random angle, columns placed by a random spacing distribution, and within each column dashes of random length separated by random gaps. A library function `dashHatch(angle, spacingDist, dashLenDist, gap, weightScale, alphaRange, palette)` would cover this with the per-iteration randoms as parameters. One-off art decisions: the 5-entry orange/green/red palette (orange repeated to bias selection), the double `line()` call, the ADD blend on black, and the `strokeWeight = sep*g` coupling of thickness to spacing. A clean parameter object: `{angle, columnSpacing: [min, max], dashLength: [min, max], gap: [min, max], weightScale, alpha: [min, max], palette, blend}`.
