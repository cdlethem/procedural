---
sketch: 2019/generativos/buibui003
year: 2019
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1761
animated: false
techniques: [recursion, subdivision, grid, dots-stippling]
primitives: [rect]
palette:
  colors: ["#121B4B", "#028594", "#016C40", "#FBAF34", "#CF3B13", "#E55E7F", "#F0D5CA"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: subdiv4_count, default: 40000, tried: [12000], change: large, effect: "fewer four-way splits -> bigger blocky blocks, sparser fine field"}
  - {name: minSize, default: 4, tried: [16], change: large, effect: "coarser split floor -> uniform mid-scale cells, fine sliver field gone"}
  - {name: hsplits, default: 320, tried: [64], change: large, effect: "fewer horizontal splits -> tall vertical columns of cells"}
  - {name: vsplits, default: 16, tried: [48], change: large, effect: "more vertical splits -> flat horizontal bands and blocks"}
  - {name: areaK, default: 0.0082, tried: [0.05], change: large, effect: "stronger area->color coupling: big blocks dark navy/indigo, small cells stay bright"}
  - {name: dotCell, default: [8, 20], tried: [[24, 40]], change: subtle, effect: "coarser dot checker; dots on big blocks more widely spaced"}
reusable_candidates:
  - {name: rectSubdivision, signature: "rectSubdivision(rootRect, passes: [{count, splitAxis, minSize, selectionBias}]) -> Rect[]", note: "iterative random rect splitting with end-of-list selection bias (lines 74-105)"}
  - {name: dotGridTile, signature: "dotGridTile(x, y, w, h, cellSize, c1, c2)", note: "checkerboard of small center dots on stroked cells, the dricula() function (lines 239-254)"}
  - {name: areaColorOffset, signature: "fillByArea(rect, palette, drift, k, jitter)", note: "palette index = drift + log(1+area*k) + jitter, lerp between adjacent colors (lines 112-117, 327-333)"}
---

## What it draws

A full-bleed mosaic of flat rectangles on a near-black ground. A few large,
bold blocks (pink, orange, red, amber, dark green) fill the upper half, each
tiled with a fine checkerboard of tiny dots in two alternating tints; the
lower half and margins collapse into a dense field of thin slivers and small
cells in dark navy, teal and green, so the image reads as two scales: chunky
tiled blocks over a dark speckled mosaic.

## How the code works

`setup()` calls `generate()` once; `draw()` is empty, so the piece is static
(lines 19-30). The P3D renderer is used only for the flat 2D fill: a
perspective camera (`perspective(PI/2, ...)`, `translate(..., 200)`, lines
65-68) frames a root rect that is 2.8x the canvas (line 72), so the mosaic
overflows all edges.

Subdivision is a list of `Rect`s split in three passes (lines 74-105):
- 16 passes split a random rect in half vertically (lines 74-80);
- 320 passes split it horizontally at a random ratio `m1 = random(0.2, 0.8)`
  (lines 83-92);
- 40000 passes replace a rect with its four quadrants, skipping rects smaller
  than 4px on a side (lines 96-105).

Which rect is chosen is `int(random(size * random(0.6, 1)))` — biased toward
the end of the list, where the newest/smallest rects live (lines 75, 84, 97).
The earliest large rects are therefore spared, which is why a few big blocks
survive while the rest is shredded into the fine field.

Colour: each final rect is filled with
`getColor(dc + log(1 + r.w*r.h*0.0082) + random(1.4))` (lines 116-117).
`getColor(float)` lerps between two adjacent entries of the 7-colour palette
(line 316, 327-333), so colour position in the palette is set by a global
drift `dc` plus a term growing with the log of the area — large blocks and
tiny cells sit at different, locally coherent offsets; the `random(1.4)`
jitter keeps neighbours from matching. This is why the big blocks are the
bold pinks/oranges/reds while the fine field is mostly dark navy/teal/green.

Texture: every rect also gets `dricula(...)` (line 121, 239-254), which
overlays a grid of `int(random(8, 20))`-px cells, stroking each cell
(`noFill()`) and filling a 20%-size dot at its centre, alternating two random
palette colours on a checkerboard `(i+j)%2`. On large blocks this is the
visible dotted checker; on tiny cells the dots collapse into the speckled
dark field.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subdiv4_12000 | `for (int i = 0; i < 40000; i++) {` -> `for (int i = 0; i < 12000; i++) {` | large (0.181, 67.8% of pixels) | bigger, blockier mosaic: large pink/orange/red/cream blocks dominate, mid-size cells, fine dark field sparser and patchier | variants/subdiv4_12000/frame_00001.png |
| minSize_16 | `if (r.w < 4 || r.h < 4) continue;` -> `if (r.w < 16 || r.h < 16) continue;` | large (0.207, 75.2% of pixels) | fine sliver field gone; whole canvas a uniform texture of mid-size cells, warm pink/orange/red/cream blocks distributed evenly | variants/minSize_16/frame_00001.png |
| hsplits_64 | `for (int i = 0; i < 320; i++) {` -> `for (int i = 0; i < 64; i++) {` | large (0.245, 83.3% of pixels) | cells elongated into tall vertical columns; large orange/red block on the right built from vertical strips | variants/hsplits_64/frame_00001.png |
| vsplits_48 | `for (int i = 0; i < 16; i++) {` -> `for (int i = 0; i < 48; i++) {` | large (0.236, 81.4% of pixels) | cells flattened into horizontal bands; large flat pink/red/cream blocks across the top, big pink dotted block mid-right, horizontal striping throughout | variants/vsplits_48/frame_00001.png |
| areaK_0.05 | `float area = log(1+r.w*r.h*0.0082);` -> `float area = log(1+r.w*r.h*0.05);` | large (0.200, 75.7% of pixels) | size-to-color coupling much stronger: big blocks land on dark navy/indigo (large navy block top-right, purple dotted block mid-right), small cells stay teal/green/pink/orange | variants/areaK_0.05/frame_00001.png |
| dotCell_30 | `dricula(r.x, r.y, r.w-bb, r.h-bb, int(random(8, 20)), rcol(), rcol());` -> `dricula(r.x, r.y, r.w-bb, r.h-bb, int(random(24, 40)), rcol(), rcol());` | subtle (0.031, 9.9% of pixels) | subtle: same layout as baseline; dot checker coarser, dots on big blocks more widely spaced | variants/dotCell_30/frame_00001.png |

## Modularisation notes

- The three subdivision loops (lines 74-105) are the generic core: a
  `rectSubdivision` taking per-pass count, split mode (vertical / horizontal
  / four-way), min-size floor and selection bias. The end-of-list bias
  (`random(0.6, 1)` on line 97) is what creates the two-scale look — an art
  decision, keep it as a parameter.
- `dricula` (lines 239-254) is self-contained and reusable as a
  `dotGridTile` texture; `Rect` (lines 40-48) is trivial.
- `tentas()` (187-237), `grid()`, `piras()` and the two commented 3D-block
  sections (125-182) are dead code — call sites commented out; drop them.
- `getColor`/`rcol`/`colors[]` (316-333) are defined in this tab, so the
  palette is self-contained; a clean parameter object would be
  `{passes: [{count, mode, minSize, bias}], areaK: 0.0082, colorJitter: 1.4,
  dotCell: [8, 20], palette}`.
