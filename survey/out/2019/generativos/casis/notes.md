---
sketch: 2019/generativos/casis
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1538
animated: false
techniques: [subdivision, grid, dots-stippling]
primitives: [rect, shape]
palette:
  colors: ["#F7A625", "#D60606", "#E58BA8", "#1643A3"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(0.2,1)*2000*random(0.5,1)), range [200,2000]", tried: [300], change: large, effect: "forcing 300 splits makes the mosaic much finer: baseline tiles are further cut into many thin slivers (with seed 42 the baseline landed on a much coarser layout)"}
  - {name: colors, default: "[#F7A625,#D60606,#E58BA8,#1643A3]", tried: ["[#2F512C,#1643A3,#87426D,#FFFFFF]"], change: large, effect: "same layout, whole colour story swapped to green/blue/plum/white"}
  - {name: ch (dot rows), default: "random(5,20)", tried: ["random(20,40)"], change: none, effect: "no visible change: dot rows denser but dots too small to register"}
  - {name: dotScale (ww multiplier), default: 0.4, tried: [1.2], change: moderate, effect: "dots 3x wider: grid texture reads as thick dashes/bars instead of fine squares"}
  - {name: skipProb, default: 0.08, tried: [0.40], change: large, effect: "40% of tiles unpainted instead of 8%: much more black ground, sparser and more fragmented mosaic"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(ArrayList<Rect> rects, int iterations, float minFrac=0.2, float maxFrac=0.8) -> ArrayList<Rect>", note: "repeatedly split a random rect vertically/horizontally at a random fraction; yields an unbalanced Mondrian-like mosaic"}
  - {name: dotGrid, signature: "dotGrid(x, y, w, h, cols, rows, dotW, dotH, jitter) -> void", note: "small rect grid inside a tile with an alpha shadow copy offset by (dx,dy)"}
  - {name: skewBand, signature: "skewBand(x, y, w, h, hgt, skew) -> void", note: "thin parallelogram accent strip along a tile edge, random skew"}
---

## What it draws
Full-bleed mosaic of hundreds of flat rectangles of very unequal size on a black ground,
filled from a four-colour palette: amber/orange, red, dusty pink, and blue. Most tiles carry
a regular grid of small black squares (like a pixel texture or a window grid), and many tiles
have a thin skewed colour band along their top edge and a faint darker offset copy behind
them, giving a slightly glitchy, screen-print look.

## How the code works
- `setup()` -> `generate()` (casis.pde:21-29); `draw()` is empty, so the piece is static
  (confirmed: frames 1/10/60 identical).
- Subdivision (lines 64-86): starts with one rect covering the canvas; `sub` iterations
  (up to 2000) pick a random rect index, split it vertically or horizontally (50/50 chance)
  at a random 20-80% point, and remove the original. Randomness enters via the seed
  (lines 53-54, `randomSeed`/`noiseSeed`) and the split index/position draws.
- Per-tile rendering (lines 90-130), for ~92% of rects (8% skipped, line 93):
  1. `fill(0,40)` rect jittered by up to ±10 px -> the soft dark offset "shadow" copy.
  2. `fill(rcol())` rect, colour = random pick from `colors[]` (line 159).
  3. Dot grid (lines 101-119): `cw` in [2,5] columns, `ch` in [5,20] rows, dot size
     ~4-8% of tile width, each dot drawn twice (alpha-10 black copy offset by `dx,dy`
     in ±4, then solid black).
  4. Skew band (lines 121-129): 4-vertex `beginShape` parallelogram in a random palette
     colour, height ~0.5-1.5% of tile width, top edge skewed by random `s`.
- `rectMode(CENTER)` for all tile drawing; palette is a fixed 4-colour int array,
  selection is uniform random per rect. No shaders, no blend modes beyond NORMAL,
  no noise actually used (imports of triangulate/toxi are vestigial).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_300 | `int sub = int(random(0.2, 1)*2000*random(0.5, 1));` -> `int sub = 300;` | large (0.31, 0.76) | much finer mosaic: the coarse baseline tiles are cut further into hundreds of thin slivers; larger blocks remain but overall density is far higher | variants/sub_300/frame_00001.png |
| palette_cool | `int colors[] = {#F7A625, #D60606, #E58BA8, #1643A3};` -> `{#2F512C, #1643A3, #87426D, #FFFFFF};` | large (0.24, 0.57) | same layout, colours swapped to dark green, blue, plum and white | variants/palette_cool/frame_00001.png |
| dotrows_20_40 | `int ch = int(random(5, 20));` -> `int ch = int(random(20, 40));` | none (0.007, 0.019) | no visible change: dot rows are denser but the dots are too small to register | variants/dotrows_20_40/frame_00001.png |
| dotsize_1.2 | `float ww = r.w*random(0.1, 0.2)*0.4;` -> `... *1.2;` | moderate (0.069, 0.189) | dots 3x wider: the per-tile grid texture reads as thick dashes/bars instead of fine squares | variants/dotsize_1.2/frame_00001.png |
| skip_0.6 | `if(random(1) > 0.92 ) continue;` -> `if(random(1) > 0.6 ) continue;` | large (0.21, 0.55) | 40% of tiles unpainted instead of 8%: much more black ground shows through, sparser and more fragmented mosaic | variants/skip_0.6/frame_00001.png |

## Modularisation notes
- Generic: the subdivision loop (lines 64-86) is a clean parameterisable function
  (iteration count, split fraction range, split-axis probability); the dot grid
  (lines 101-119) and the skew band (lines 121-129) are small reusable stamp functions.
- One-off art decisions: the 8% tile-skip, the jittered shadow copy, the specific
  4-colour palette, the `0.4` multiplier on dot size, band height/skew ranges.
- Clean parameter object: `{sub, splitMin=0.2, splitMax=0.8, skipProb=0.08, shadowAlpha=40,
  jitter=10, dotCols=[2,5], dotRows=[5,20], dotScale=0.4, dotJitter=4, bandH=[0.05,0.15], bandScale=0.1, palette[]}`.
- `arc2()` (lines 139-156) and `getColor*` (lines 163-171) are dead code, unused in
  this sketch.
