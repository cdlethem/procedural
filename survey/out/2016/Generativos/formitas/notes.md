---
sketch: 2016/Generativos/formitas
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 384
animated: false
techniques: [lines-hatching]
primitives: [ellipse, shape, rect]
palette:
  colors: ["#FF5F00", "#A020F0", "#33B5FF", "#88E530", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: "random(20,120)", tried: [40], change: moderate, effect: "fixed at 40: sparser, more open layout; background dominates, fewer glyphs"}
  - {name: sizeMax, default: "random(20,400)*random(1)*random(1)", tried: ["random(20,800)*random(1)*random(1)"], change: moderate, effect: "larger glyphs: big circles/polygons/bar rows, heavy overlap, denser feel"}
  - {name: barCount, default: "random(3,30)", tried: [6], change: moderate, effect: "bar clusters capped at 6 bars: shorter, chunkier rows; other glyphs unchanged"}
  - {name: saturation, default: "random(180,240)", tried: ["random(80,120)"], change: large, effect: "whole image pastel: peach background, soft purple/blue/mint shapes (background is drawn from the same palette)"}
  - {name: barAmp, default: "random(0.1,0.95)", tried: [0.3], change: moderate, effect: "uniform bar widths within each cluster (no thin-fat jitter); overall look close to baseline"}
reusable_candidates:
  - {name: scatterGlyphs, signature: "scatterGlyphs(count, sizeRange) -> void", note: "scatter random flat geometric glyphs (poly, bars, cross, ellipse) over a background"}
  - {name: barCluster, signature: "barCluster(x, y, bars, width, height, amp) -> void", note: "row of thin rects with per-cluster width jitter"}
---

## What it draws
Full-bleed flat composition on a bright orange field, seed 42: a dense random scatter of
solid geometric forms — large filled circles (violet, blue, white), 3–8-sided polygons
(triangles, hexagons, heptagons), X/cross glyphs, rows of thin vertical bars, small solid
dots and a few thin outline circles. Dominant colours: orange background, violet,
light blue, lime green, white. No outlines on most shapes; flat, no shading.

## How the code works
- `generate()` (L21-66): `createPallete()` builds the palette, `background(rcol())` picks
  a random palette colour for the background (orange this seed). Then `c = random(20,120)`
  glyphs are scattered at `random(width) × random(height)` (L26-29) with per-glyph size
  `r = random(20,400)·random(1)·random(1)` — the two extra uniform factors bias r small
  (L30). Each glyph gets a random colour `rcol()` (L32) and one of four types by
  `rnd = int(random(4))` (L31):
  - `rnd==0`: `poly()` (L85-94) — regular closed polygon with `random(3,9)` sides at
    angle 0.
  - `rnd==1`: bar cluster — `cc = random(3,30)` rects (L39-45), total span
    `random(40, 20+cc*20)`, each rect width `w*amp` with `amp = random(0.1,0.95)`,
    height up to 5× width; produces the thin vertical-bar rows.
  - `rnd==2`: `croos()` (L96-112) — 8-vertex star/cross polygon at PI/4 rotation with
    arm width `amp = random(0.2,0.5)`.
  - `rnd==3`: circle — 70% solid ellipse of diameter r (L54), else a small filled
    dot plus a thin stroked ring of diameter r (L56-62).
- `createPallete()` (L68-78): `c = random(2,6)` hues evenly spaced (`dc = 256/c`)
  starting at random hue `dd` (L73), HSB with saturation `random(180,240)`, value 255,
  plus a white entry `color(256)` (L74). `rcol()` picks any entry uniformly (L80-82),
  so white shapes and the background are both drawn from the same list.
- Randomness enters only via `random()` in `generate()`/`createPallete()`; no noise, no
  transforms beyond per-vertex trig in `poly`/`croos`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| c_40 | `int c = int (random (20, 120));` -> `int c = 40;` | moderate | sparse: ~40 glyphs, lots of plain orange showing; same glyph types, smaller overall coverage | variants/c_40/frame_00001.png |
| r_800 | `float r = random(20, 400)*random(1)*random(1);` -> `random(20, 800)*random(1)*random(1);` | moderate | much larger glyphs: big circles, 7-sided polygons, long bar rows filling and overlapping | variants/r_800/frame_00001.png |
| cc_6 | `int cc = int(random(3, 30));` -> `int cc = 6;` | moderate | bar clusters all exactly 6 bars: shorter, chunkier rows; circles/polygons/crosses unaffected | variants/cc_6/frame_00001.png |
| sat_100 | `random(180, 240)` in palette line -> `random(80, 120)` | large | everything pastel: background turns light peach, shapes become soft purple, sky blue, mint green | variants/sat_100/frame_00001.png |
| amp_0.3 | `float amp = random(0.1, 0.95);` -> `float amp = 0.3;` | moderate | bar widths uniform within each cluster (no thin/rich variation); overall composition nearly the same as baseline | variants/amp_0.3/frame_00001.png |


## Modularisation notes
- Generic: the glyph scatter loop (position + size + type dispatch + palette fill) is a
  clean `scatterGlyphs(count, sizeRange, glyphTypes)` function; `barCluster`, `croos`,
  and regular `poly` are each standalone drawable primitives worth extracting.
- One-off art decisions: the 70/30 solid-vs-ring split, the `random(1)*random(1)` size
  bias, HSB palette construction with evenly spaced hues and random saturation.
- Clean parameter object: `{count, sizeMin, sizeMax, paletteHueCount, hueStart,
  saturationRange, barCountRange, barAmpRange, crossAmpRange}`.
