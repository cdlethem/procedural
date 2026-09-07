---
sketch: 2017/Generativos/bahu
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 326
animated: false
techniques: [grid, agents, dots-stippling, typography]
primitives: [shape, line, ellipse, text]
palette:
  colors: ["#F4ED1D", "#D84B2F", "#377740", "#547CD8", "#ffffff", "#303030"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: sep, default: "random(8,24)", tried: [24], change: large, effect: "largest cell size: each walk step jumps a full cell, so the same walk count spans the whole canvas; bigger font/text; dense multi-colour mosaic, little dark ground"}
  - {name: polygon_count, default: "random(1,random(1,1000))", tried: [500], change: large, effect: "many large overlapping filled polygons dominate the field; dark ground mostly covered"}
  - {name: walk_count, default: "random(200)", tried: [400], change: moderate, effect: "more, denser dotted zigzag trails; polygons/text unchanged"}
  - {name: walk_len, default: "random(2,100)", tried: [150], change: large, effect: "longer trails that span the whole canvas; dark ground largely gone"}
  - {name: polygon_size, default: "sep*(1..7)*2", tried: ["*4"], change: moderate, effect: "polygons ~2x larger diameter; more overlap/coverage"}
reusable_candidates:
  - {name: poly, signature: "poly(x, y, d, seg, a)", note: "draws a closed regular polygon with seg sides, rotation a, centred on (x,y) with radius d/2"}
  - {name: hexCell, signature: "hexCell(ix, iy, sep) -> [xx, yy]", note: "offset hex-grid to pixel mapping used 3x: xx=(ix+(iy%2)*0.5)*sep, yy=iy*dh"}
  - {name: rcol, signature: "rcol(colors) -> int", note: "uniform random pick from a palette array"}
  - {name: hexWalk, signature: "hexWalk(x, y, steps, sep) -> nodes", note: "6-directional random walk on the hex grid, emitting a node per step"}
---

## What it draws
A dark charcoal (#303030) field overlaid with a faint, evenly-spaced stippled dot grid. Scattered across it are flat filled regular polygons (triangles, squares and hexagons) in yellow, red-orange, green, blue and white, of varying sizes. Winding over the whole canvas are many short random-walk trails: zigzag chains of small dots joined by thick short lines, in the same five colours. A handful of small floating decimal-number glyphs (e.g. "0.751", "0.951") are sprinkled around, mostly white or a palette colour.

## How the code works
`setup()` (line 4) sets a 960x960 window, `smooth(8)`, then calls `generate()` once; `draw()` is inert, so the piece is static. `generate()` (line 27):
- `background(#303030)` (line 30). Cell spacing `sep = random(8,24)` (line 32), cell height `dh = sep*sqrt(3)/2`, grid dims `cw`/`ch` (lines 33-35) define an offset hexagonal grid.
- Layer 1 (lines 40-52): place `cc` filled regular polygons via `poly()`. Each lands on a random hex cell (`xx=(ix+(iy%2)*0.5)*sep`), with diameter `sep*(1..7)*2`, side count from `{3,4,6}` (line 39), rotation in 60-degree steps (line 49), and `fill(rcol())` — a uniform random pick from the 5-colour `colors[]` palette (line 120).
- Layer 2 (lines 55-81): `cc` random walks. Each starts on a random cell and steps `rep = random(2,100)` times; every step moves one cell in one of six hex directions (line 69), drawing a thick `line` (strokeWeight 4) plus a small `ellipse` dot at the new node, all in one random palette colour — producing the dotted zigzag trails.
- Layer 3 (lines 85-94): `cc` text glyphs. Font is `Chivo-Light.otf` sized off `dh`; each draws the value of `random(1)` in a random palette colour and size, giving the floating numbers.
- Stipple grid (lines 97-106): a final double loop draws a 4px `ellipse` at every hex cell with low-alpha grey (stroke/fill alpha 180) — the background dot texture.
- `getColor()` (line 124, lerp between palette colours) is defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sep_24 | `float sep = random(8, 24);` -> `float sep = 24;` | large | dense busy mosaic: walks jump a full cell per step so the same count blankets the canvas, text glyphs larger, little dark ground | variants/sep_24/frame_00001.png |
| polys_500 | `int cc = int(random(1, random(1, 1000)));` -> `int cc = 500;` | large | many large overlapping filled polygons dominate; dark ground mostly covered | variants/polys_500/frame_00001.png |
| walks_400 | `cc = int(random(200));` -> `cc = 400;` | moderate | more, denser dotted zigzag trails; polygons/text unchanged | variants/walks_400/frame_00001.png |
| walklen_150 | `int rep = int(random(2, 100));` -> `int rep = 150;` | large | long snaking trails that span the whole canvas; dark ground largely gone | variants/walklen_150/frame_00001.png |
| polysize_x4 | `float ss = sep*(int(random(1, 8))*2);` -> `*4);` | moderate | polygons ~2x larger diameter; more overlap/coverage | variants/polysize_x4/frame_00001.png |

## Modularisation notes
Generic/reusable: `poly()` is a self-contained regular-polygon drawer; the hex-cell-to-pixel mapping (repeated identically in three layers) belongs in one `hexCell` helper; `rcol()` is a trivial random palette pick; the six-direction step loop is a reusable hex random-walk; the background dot pass is a reusable stipple-grid. One-off art decisions: the specific 5-colour palette, the four-layer stacking order (polygons, walks, text, grid), drawing literal `random(1)` text, and the per-layer count/size ranges. A clean parameter object would be `{seed, sep, polyCount, polySizeRange, sides, walkCount, walkLength, textCount, textSizeRange, gridAlpha, palette}`.
