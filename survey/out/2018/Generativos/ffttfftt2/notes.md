---
sketch: 2018/Generativos/ffttfftt2
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1758
animated: false
techniques: [subdivision, grid, noise-field, dots-stippling]
primitives: [rect, pixels, ellipse, shape]
palette:
  colors: ["#DEEDFE", "#E0D6CC", "#F0B0BA", "#E46B74", "#B00018", "#3E97E8", "#50B1FB", "#90D0C2", "#E2D874", "#DEC93E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 24, tried: [12], change: large, effect: "cell = width/cc; smaller cc halves every grid-based layer (finer mosaic blocks, finer dot grids); also changes random() call count so the downstream stream re-seeds and the whole layout changes"}
  - {name: div1, default: 180, tried: [60], change: large, effect: "first quadtree iterations; fewer -> fewer, much larger base blocks; downstream stream re-seeds (all later layers differ)"}
  - {name: div2, default: 200, tried: [80], change: large, effect: "second quadtree iterations; fewer -> fewer, larger decorated cells and fewer heat-map patches; stream re-seeds"}
  - {name: veilAlphaScale, default: 50, tried: [100], change: none, effect: "white noise-veil alpha scale; doubling to 100/255 stays below perceptual threshold; no random() consumed, so clean measurement"}
  - {name: dotScale, default: 0.2, tried: [0.5], change: none, effect: "noise dot-grid rect scale; 2.5x larger dots are still sub-cell and lost against the wash; no visible change"}
  - {name: arcCount, default: 40, tried: [12], change: none, effect: "translucent arc count; arcs are near-transparent (alpha 30/0) so only the small center dots show, and 12 vs 40 is not visible"}
reusable_candidates:
  - {name: quadtreeRects, signature: "quadtreeRects(seed, cellSize, subdivisions) -> Rect[]", note: "split canvas into random rectangular quadtrees on a fixed grid, returning the final cells"}
  - {name: noiseDotGrid, signature: "noiseDotGrid(cellSize, detail, offset, scale) -> void", note: "draw noise-sized rects centered on each grid cell, sized pow(noise(...)) * cell * scale"}
  - {name: noisePixelRect, signature: "noisePixelRect(x1,y1,x2,y2, detail, offset) -> void", note: "paint per-pixel lerp-color noise fill inside a rectangle via set()"}
  - {name: gridRect, signature: "gridRect(x,y,w,h, step, dotSize, col) -> void", note: "stippled dot grid with occasional accent-color dots"}
---

## What it draws
A full-bleed mosaic of axis-aligned rectangles in a pastel palette: pale pink dominates the
center, with blocks of yellow, blue, and deep red scattered around. Over it: pixelated
noise "heat-map" patches (red/yellow/blue contours) in the corners and right side, a soft
translucent white veil that mottles the middle, faint dot grids inside some rectangles,
translucent white circles overlapping the composition, and small solid color dots
scattered as accents. Static, flat, print-like.

## How the code works
`setup()` (line 3) sizes 960×960 P2D and calls `generate()`; `draw()` is empty (line 16),
so the piece is a single static frame. Randomness: `randomSeed(seed)` at line 39; all
structure derives from that one seed.

1. **First mosaic** (lines 42–68): canvas split on a grid of `cc = width/40` cells
   (line 42). Starting from the full canvas rect, `div = random(180)` iterations
   (line 46) pick a random cell and split it into 4 sub-rects at random grid-aligned
   cuts (lines 53–60), if it is at least 2×2 cells. Resulting cells are painted
   (lines 64–68) with `lerpColor(rcol(), white, random(1))` — random palette colour
   washed toward white, producing the pastel blocks.
2. **White noise veil** (lines 70–84): over the same grid, each cell is painted
   `fill(240, noise(...)*50)` — a mottled off-white wash (alpha ≤ 50), then a 1px
   center point; this is the soft translucent texture in the middle.
3. **Noise dot grid** (lines 108–118): second pass over the grid; each cell gets a
   rect of size `pow(noise(...),2)*ss*0.2` in a random palette colour (line 114–116) —
   the scattered small squares.
4. **Second mosaic** (lines 86–105, drawn in lines 120–156): another quadtree
   subdivision (`div = random(200)`). For each cell, with probability 0.6 (line 122):
   `rectRound()` fills it with a two-tone random-colour quad (lines 206–217), then
   `gridRect()` (lines 171–179) draws a stippled dot grid (step 20, dots `random(2,12)`,
   1% accent-colour dots), four 2px corner squares, and a per-pixel noise fill via
   `set()` (lines 149–154) over a random sub-rectangle — this is what produces the
   pixelated heat-map patches.
5. **Arcs** (lines 158–168): 40 random large translucent shapes via `arc2()`
   (lines 186–204), which tessellates the full annulus 0..TAU into thin quads with
   near-zero alpha (30/0) — barely visible large circular overlays — plus a small
   solid `rcol()` dot at each center (line 167, size `s*0.04`), the accent dots.

`rcol()` (line 221) picks a random entry from the 10-colour `colors[]` array
(line 219); `getColor(float)` (line 227) lerps adjacent palette entries for the
per-pixel noise. No blend modes; layering + alpha only.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_80 | `int cc = int(width/40);` -> `int cc = int(width/80);` | large (mean 0.187, 0.735 px) | clearly finer grid: mosaic blocks ~half size, dot grids and noise patches finer; layout also re-seeded, so block arrangement differs wholesale | variants/cc_80/frame_00001.png |
| div1_60 | `int div = int(random(180));` -> `int div = int(random(60));` | large (mean 0.1803, 0.738 px) | first mosaic much coarser: few wide bands (big blue, pink, yellow) instead of many blocks; downstream re-seed changes all later layers | variants/div1_60/frame_00001.png |
| div2_80 | `div = int(random(200));` -> `div = int(random(80));` | large (mean 0.1727, 0.65 px) | second mosaic coarser: a few big decorated cells (large blue dot-grid block, big yellow block) and fewer, larger heat-map patches | variants/div2_80/frame_00001.png |
| veil_100 | `fill(240, noise(des+x*det, des+y*det)*50);` -> `... *100);` | none (mean 0.0052, 0.0 px) | no visible change: veil at alpha <=100/255 stays below perceptual threshold | variants/veil_100/frame_00001.png |
| dot_0.5 | `... *ss*0.2;` -> `... *ss*0.5;` | none (mean 0.0018, 0.006 px) | no visible change: noise dot grid 2.5x larger is still too small to register | variants/dot_0.5/frame_00001.png |
| arcs_12 | `for (int i = 0; i < 40; i++)` -> `... i < 12 ...` | none (mean 0.0096, 0.001 px) | no visible change: arcs are nearly transparent; only the small center dots show, and 12 vs 40 is indistinguishable | variants/arcs_12/frame_00001.png |

Note: the three "large" scores conflate the local effect with downstream re-seeding —
`cc`, `div1`, `div2` change how many `random()` calls are consumed, so everything after
the changed line (colours, noise offsets, the second mosaic, the arcs) gets a different
draw from the stream. The three "none" scores (veil, dot, arcs) consume no `random()`
calls and are clean measurements: those parameters do not matter visually at the tried
deltas.

## Modularisation notes
The quadtree-split loop (lines 44–63, duplicated at 87–105) is fully generic: given a
seed, cell size, and iteration count it returns a rectangular partition — a strong
library candidate (`quadtreeRects`). `noiseDotGrid` (108–118), `noisePixelRect`
(149–154), `gridRect` (171–179), and `arc2` (186–204) are all parameterised by
position/size/detail/colour and could be library functions as listed in
`reusable_candidates`. One-off art decisions: the specific 10-colour pastel palette,
the `lerpColor(rcol(), white, random(1))` wash, the 0.6 decoration probability, the
two different noise passes (alpha veil vs dot sizes), and the fixed 40-arc count. A
clean parameter object would carry: `seed`, `cellSize` (40), `subdiv1` (180),
`subdiv2` (200), `veilAlphaScale` (50), `dotScale` (0.2), `decorationP` (0.6),
`arcCount` (40), and the palette. To make the layout stable under parameter changes
(the re-seeding problem observed above), the library version should seed each layer
independently (e.g. `seed + layerId`) instead of drawing from one shared stream.
