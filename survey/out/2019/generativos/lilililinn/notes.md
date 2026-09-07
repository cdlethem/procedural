---
sketch: 2019/generativos/lilililinn
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1557
animated: false
techniques: [grid, noise-field, lines-hatching, dots-stippling]
primitives: [rect, ellipse]
palette:
  colors: ["#4703BC", "#CC8BE0", "#EA1E3D", "#F9CD07", "#E5E5E5"]
  selection: noise-driven
composition: scattered
parameters:
  - {name: count, default: 100, tried: [250], change: large, effect: "denser field; bars overlap into a woven mosaic with fewer dark gaps"}
  - {name: barLength, default: 200, tried: [450], change: large, effect: "longer bars; longer continuous striped runs and more crossing/overlap"}
  - {name: subdivisions, default: "20*(1..4) i.e. 40-80", tried: ["4*(1..4) i.e. 4-16"], change: moderate, effect: "thicker strips; bars read as chunky banded blocks instead of fine hatching"}
  - {name: gridSize, default: 40, tried: [100], change: moderate, effect: "coarser 100px snap; bars align to fewer, more regular columns"}
  - {name: glowAlpha, default: 12, tried: [60], change: moderate, effect: "stronger halo; large soft circular glows now clearly visible around each dot"}
reusable_candidates:
  - {name: gridSnappedField, signature: "gridSnappedField(n, gridSize, place) -> void", note: "place n random positions snapped to a pixel grid"}
  - {name: stripedBar, signature: "stripedBar(w, h, sub, c1, c2, alpha) -> void", note: "stack of thin overlapping quads making a hatched bar with two-tone fill"}
  - {name: noiseColor, signature: "noiseColor(v, colors) -> color", note: "lerpColor between adjacent palette entries indexed by a value (L124-129)"}
---

## What it draws
A dark (near-black) canvas tiled with short striped bars that snap to a coarse grid and point either horizontally or vertically. Each bar is built from many thin, closely-stacked strips in two colours from a purple / light-purple / red / yellow / grey palette, so the bars read as ladder-like hatched segments. On top of many bars sit small centre dots (solid white, and a darker tinted dot) plus a faint circular white glow, and the overall field looks like a mosaic of coloured grid cells punctuated by dots.

## How the code works
Single tab, everything runs once in `setup()` -> `generate()`; `draw()` is empty and the image is static (frames 10/60 dropped as identical to frame 1).
- `settings()` (L15-20): 960x960 P2D, `smooth(8)`, `pixelDensity(2)`.
- `generate()` (L43): `randomSeed`/`noiseSeed` from `seed` (L45-46), `background(10)` dark (L48). Two independent 2-D simplex-noise setups: `det1/des1` and `det2/des2` (random detail < 0.005, random large offset) used to pick colours (L50-53).
- The main loop places 100 bars (L55-103):
  - random `x,y` in `[-80, width+80]` (L56-57), then snapped to a 40 px grid with `x -= x%40; y -= y%40;` (L59-62) — this is what aligns the bars into rows/columns.
  - `rotate(HALF_PI*int(random(8)))` (L70) restricts orientation to 90° multiples (4-fold symmetry, so bars are only horizontal or vertical).
  - `w = 4*2^k` (k in 0..3 -> width 4/8/16/32, L71) and fixed `h = 200` (L72).
  - `c1`/`c2` = two noise-driven colours via `getColor(noise(...)*colors.length*2)` (L74-75); `getColor(float)` (L124-129) `lerpColor`s between adjacent palette entries, so strip colours are noise-driven blends of the palette.
  - `sub = 20*(1..4)` (L77) subdivisions; the inner loop (L80-92) draws `sub` thin overlapping quads spanning `-h..h`, each top half `fill(c1)` and bottom half `fill(c2, 80)` (alpha 80). The 0.8/1.0 overlap (L82) leaves small dark gaps between strips, producing the hatched/ladder texture.
  - After the bar: faint white glow `fill(255,12)` ellipse 120 (L96-97), solid white dot 20 (L99-100), and a dark random-tint dot 16 via `lerpColor(rcol(), color(0), ...)` (L101-102).
- `rcol()` (L118) picks a random palette colour; the palette is at L117. The `triangulate` import (L1) is unused; `toxi SimplexNoise` is imported (L2) but the code actually uses Processing's built-in `noise()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_250 | `  for (int i = 0; i < 100; i++) {` -> `... i < 250 ...` | large | far denser: bars overlap into a woven full-bleed mosaic, almost no dark gaps, dots everywhere | variants/count_250/frame_00001.png |
| h_450 | `    float h = 200;` -> `    float h = 450;` | large | bars visibly longer: longer striped runs and more crossing/overlap of segments | variants/h_450/frame_00001.png |
| sub_4 | `    int sub = 20*int(random(1, 5));` -> `    int sub = 4*int(random(1, 5));` | moderate | thicker strips: fine comb/hatch gone, bars now chunky banded blocks | variants/sub_4/frame_00001.png |
| grid_100 | `      x -= x%40;` -> `      x -= x%100;` | moderate | coarser snap: bars align to a sparser, more regular column/row grid | variants/grid_100/frame_00001.png |
| glow_60 | `    fill(255, 12);` -> `    fill(255, 60);` | moderate | stronger halo: large soft circular glows now clearly visible, especially in the dark gaps | variants/glow_60/frame_00001.png |

## Modularisation notes
- Generic / library-ready: `gridSnappedField` (L55-62 pattern: n random positions snapped to a grid), `stripedBar` (the L80-92 sub-loop is a self-contained hatched-bar drawer parameterised by width, length, subdivision count and two colours + alpha), and `noiseColor` (L124-129, the palette-lerp colour sampler). These three are reusable as-is.
- One-off art decisions: the specific 5-colour palette (L117), the 40 px grid size, the 90°-only rotation, the triple-dot motif (glow + white dot + dark dot at L96-102), and the dark background(10).
- A clean parameter object would be: `{ count, gridSize, barWidth, barLength, subdivisions, stripAlpha, palette[], glowAlpha, dotSize, rotationStep }`.
