---
sketch: 2018/Generativos/kidmi
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1440
animated: false
techniques: [grid, lines-hatching]
primitives: [rect, ellipse, line]
palette:
  colors: ["#E6E7E9", "#F0CA4B", "#F07148", "#EECCCB", "#2474AF", "#107F40", "#231F20", "#010101"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(20,40)", tried: [6], change: large, effect: "fewer, much larger cells and bigger circles/hatch; also re-rolls the colour stream so the wash shifts salmon -> near-white"}
  - {name: dotSize, default: "ss*0.1", tried: ["ss*0.4"], change: subtle, effect: "centred cell dots 4x larger; barely visible at this scale"}
  - {name: circleSizeMax, default: "ss*random(1,5)", tried: ["ss*random(1,10)"], change: moderate, effect: "circles up to 10 cells; several large overlapping discs dominate"}
  - {name: overlayAlpha, default: 70, tried: [0], change: moderate, effect: "removes the salmon full-canvas wash; background reads pale gray, accents clearer"}
  - {name: hatchCount, default: 10, tried: [30], change: subtle, effect: "a few more cross-hatch patches but still sparse and faint; look nearly unchanged"}
  - {name: hatchLines, default: "random(3,28)", tried: ["random(3,90)"], change: none, effect: "no visible change to hatch density"}
reusable_candidates:
  - {name: coloredCellGrid, signature: "coloredCellGrid(n, baseColor, accentColorFn, dotSize) -> void", note: "tile canvas into n x n cells, mostly base colour with random accent cells and a centred sub-dot"}
  - {name: hatchRect, signature: "hatchRect(x, y, w, h, step, color) -> void", note: "fill a rect with a grid of vertical + horizontal lines (cross-hatch)"}
---

## What it draws
A flat, full-bleed mosaic: the whole 960x960 canvas is tiled into a regular square
grid of cells, most of them a pale warm cream with occasional accent squares in
yellow, orange, green, blue and dark brown, each cell carrying a tiny centred
square. Scattered over this are large soft circles in the same accent palette, and
several patches of fine cross-hatching (dense orange-red line grids) that look like
transparent overlays. Everything sits under a translucent tint that gives the whole
image a salmon/pink wash.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static
(frames 10/60 are byte-identical to frame 1). `seed` is a random int each run but
the harness pins it to 42.

1. `background(#010101)` (line 41) — near-black base, immediately covered.
2. `cc = int(random(20,40))` (line 48), `ss = width/cc` (49): a `cc x cc` tiling.
   The double loop (50-59) fills every cell either `#E6E7E9` (80%) or a random
   accent `rcol()` (20%), then draws a small centred square of `ss*0.1` in a random
   accent colour (56-57). This is the tiled grid + the tiny centred dots.
3. `points` loop (63-72): `cc` random circles, each `s = ss*int(random(1,5))` (66),
   snapped to a `ss*0.5` half-cell grid (67-68), drawn with `ellipse` in `rcol()`.
   These are the big scattered circles.
4. `rects` loop (74-96): starts with one full-canvas `Rect`. The intended
   subdivision loop (76-88) has a broken guard (`r.x+r.w < p.x` is unreachable with
   the other conditions) so it never splits; only the single full-canvas rect
   survives. It is drawn at `fill(col, 70)` (94) — a random accent colour at alpha
   70 over the whole canvas, which is the salmon/pink wash and the tint on the
   hatched lines (stroke is left as this `col`).
5. Hatch loop (100-117): 10 random cross-hatch patches. Each is snapped to the cell
   grid, size `1..8` cells (105-106), with `ccc = int(random(3,28))` (107) lines;
   vertical lines (109-111) and horizontal lines (114-116) are drawn in the
   leftover stroke colour (the wash colour). These are the orange-red grid patches.

Colour is chosen by `rcol()` (126-128): a uniform random pick from the 7-colour
`colors[]` array (125). `getColor`/`lerpColor` (129-139) exists but is unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_6 | `int cc = int(random(20, 40));` -> `int cc = 6;` | large | far coarser grid (~6 cells across instead of ~30): much bigger cells, circles and hatch patches; because the draw shares one random stream the change also re-rolls every colour pick, so the wash comes out near-white instead of salmon and accents read clearer | variants/cc_6/frame_00001.png |
| dot_0.4 | `rect(x+ss*0.45, y+ss*0.45, ss*0.1, ss*0.1);` -> `...ss*0.4...` | subtle | centred cell dots grow from 10% to 40% of the cell; the dots are a touch heavier but the overall mosaic is essentially the same | variants/dot_0.4/frame_00001.png |
| circle_10 | `float s = ss*int(random(1, 5));` -> `float s = ss*int(random(1, 10));` | moderate | circles can reach 10 cells (was 5): several large dark/green/yellow discs overlap and cover much more of the grid | variants/circle_10/frame_00001.png |
| overlayAlpha_0 | `fill(col, 70);` -> `fill(col, 0);` | moderate | the salmon/pink full-canvas wash is gone; the base reads as pale gray and the accent squares/circles look clearer and more saturated | variants/overlayAlpha_0/frame_00001.png |
| hatch_30 | `for (int k = 0; k < 10; k++) {` -> `for (int k = 0; k < 30; k++) {` | subtle | 30 patches instead of 10: a few more faint orange cross-hatch grids appear, but they stay sparse and low-contrast so the image looks nearly the same | variants/hatch_30/frame_00001.png |
| hatchLines_90 | `int ccc = int(random(3, 28));` -> `int ccc = int(random(3, 90));` | none | no visible change; the cross-hatch patches read at the same density as the baseline | variants/hatchLines_90/frame_00001.png |

## Modularisation notes
Two blocks are generic and worth extracting. (a) The cell tiling (50-59): a
`coloredCellGrid(n, baseColor, accentFn, dotSize)` that lays an `n x n` grid of
mostly-base cells with a random accent fraction and a centred sub-dot — the
accent probability (0.2), dot size (`ss*0.1`) and cell count `n` are the knobs.
(b) The hatch patch (100-117): a `hatchRect(x, y, w, h, step, color)` cross-hatch
filler; the line count `ccc` and patch count (10) are the knobs.

One-off / dead code: the `Rect` subdivision (74-96) never actually subdivides — its
guard is unreachable, so it degenerates to a single full-canvas translucent
overlay. That overlay is an art decision (the pink wash), not a real Voronoi/
subdivision; a clean parameter object would keep it as a single
`overlayColor + overlayAlpha` pair rather than pretending at rect splitting. The
`getColor`/`lerpColor` helpers are dead. A clean parameter object:
`{ n, accentProb, dotSize, circleCount, circleSizeMax, overlayColor, overlayAlpha,
hatchCount, hatchLines, palette }`.
