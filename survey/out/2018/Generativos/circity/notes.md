---
sketch: 2018/Generativos/circity
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1575
animated: false
techniques: [grid]
primitives: [rect, ellipse, shape, line]
palette:
  colors: ["#BA2F1A", "#EEA313", "#0C7E42", "#00134D", "#222126", "#E5E5E5", "#1E1E1E", "#F0F0F0"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: sub, default: "int(random(3, random(5, 40)))", tried: [8], change: large, effect: "8x8 grid instead of 4x4; smaller tiles, thinner streets, denser layout"}
  - {name: ver, default: "random(0.8, 0.9)", tried: [0.6], change: large, effect: "smaller light border rect; dark background shows in wider gaps between tiles, intersection motifs loom larger over them"}
  - {name: man, default: "ver-random(0.05, 0.1)", tried: [0.45], change: large, effect: "much smaller dark interior and motif scale; tiles read as white with small centred content, corner diamonds dominate"}
  - {name: "glow alpha (random(10))", default: "random(10)", tried: [120], change: moderate, effect: "strong translucent colour halos wash over the whole canvas, dulling and mixing the palette"}
  - {name: "street gap amp (linee)", default: 0.4, tried: [0.1], change: none, effect: "no visible change; dash length of the 1px street lines is below pixel resolution at this size"}
  - {name: cc, default: "int(random(2, 10))", tried: [20], change: moderate, effect: "checkerboard motif cells up to 20x20; affected tiles show fine dense checker texture instead of coarse squares"}
reusable_candidates:
  - {name: tiledMotifGrid, signature: "tiledMotifGrid(n, cellDraw) -> void", note: "n x n grid; each cell draws one randomly chosen motif from a list of drawing closures"}
  - {name: dashedLine, signature: "dashedLine(x1, y1, x2, y2, segments, gapFrac) -> void", note: "linee(): draws a line as segments with fractional gaps, used for the street grid"}
---

## What it draws
A dark charcoal canvas covered by a 4x4 grid of square "city block" tiles separated by
gapped (dashed) light-grey streets. Every tile has an off-white border and a dark inner
rectangle, on top of which sits one randomly chosen geometric motif: a large rotated
square (diamond), a circle, a right triangle, a small diamond-on-diamond, or a fine
checkerboard. A faint warm glow sits under each motif and small dots mark the street
intersections. Colours are brick red, orange, green, navy, near-black and off-white.

## How the code works
`generate()` (circity.pde:21) fills the background dark grey (`background(30)`, line 22),
then computes a random subdivision count `sub = int(random(3, random(5, 40)))` (line 26);
with seed 42 it comes out 4, giving the 4x4 layout. Two size ratios are drawn randomly:
`ver` in [0.8, 0.9] (line 29) sizes the light border rectangle, `man` slightly smaller
(line 30) sizes the dark interior and the motif scale.

First pass (lines 32-77): over the grid *corners* a single random shape type `rnd`
(0=diamond, 1=disc, 2=diamond+inner square, 3=disc+disc) is chosen once and drawn at
every grid intersection with a fresh `rcol()` fill per shape (line 39, etc.), so these
motifs appear at the street crossings.

Then `stroke(160)` (line 79) and `linee()` (lines 80-87, helper at 173-184) draw the
dashed streets: each grid line is split into `sub*10` segments with a fractional gap of
0.4, producing the broken-line look.

Second pass (lines 89-163): over each tile *centre* a white-ish border rect
`rect(xx, yy, ss*ver, ss*ver, 2)` (line 101, `fill(240)`), an off-white corner-notch
quad (lines 102-108), the dark interior rect `ss*man` with a random palette colour
(line 110), a very faint glow ellipse `ss*2` at alpha ~`random(10)` (line 113), and up
to 4 more randomly chosen small motifs (lines 116-161: disc, diamond, small diamond,
triangle, or a `cc x cc` checkerboard of rects with `cc = int(random(2, 10))`,
line 151). Colour always comes from `rcol()` (line 192), a uniform pick from the 6-colour
array (line 191). Finally a sparse 2px dot grid at half-cell spacing in 20% white
(lines 165-170).

Randomness enters via `sub`, `ver`/`man`, the per-tile motif picks, all `rcol()` calls,
and the glow alpha. No noise, no transforms beyond implicit centring (rectMode CENTER,
line 25). `draw()` is empty, so the sketch is static.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_8 | `int sub = int(random(3, random(5, 40)));` -> `int sub = 8;` | large (0.3542, 0.831) | 8x8 grid of the same tile language: smaller tiles, thinner dashed streets, more motifs per canvas | variants/sub_8/frame_00001.png |
| ver_0.6 | `float ver = random(0.8, 0.9);` -> `float ver = 0.6;` | large (0.3186, 0.727) | border rects shrink; dark ground shows in wider gaps and the corner intersection motifs overlap the tiles | variants/ver_0.6/frame_00001.png |
| man_0.45 | `float man = ver-random(0.05, 0.1);` -> `float man = ver - 0.4;` | large (0.318, 0.698) | dark interiors and motifs shrink to ~half; tiles look white with a small centred square of content, corner diamonds unchanged and dominant | variants/man_0.45/frame_00001.png |
| glow_120 | `fill(rcol(), random(10));` -> `fill(rcol(), random(120));` | moderate (0.0814, 0.352) | large translucent colour halos (2-cell radius) wash over everything, dulling and blending the palette | variants/glow_120/frame_00001.png |
| streets_0.1 | `linee(..., sub*10, 0.4);` (both calls) -> `..., 0.1);` | none (0.002, 0.008) | no visible change; street lines are 1px so the dash-length change is below resolution | variants/streets_0.1/frame_00001.png |
| cc_20 | `int cc = int(random(2, 10));` -> `int cc = int(random(8, 20));` | moderate (0.0515, 0.146) | tiles using the checkerboard motif show fine dense grids (up to 20x20) instead of coarse 2-10 squares; other tiles unaffected | variants/cc_20/frame_00001.png |

## Modularisation notes
The tile loop (lines 89-163) is the generic core: a grid where each cell composites a
fixed frame (border + interior) plus a random choice from a small library of motif
drawing functions. That maps cleanly to a `tiledMotifGrid(n, frame, motifList)` function
with the motif list as data. `linee()` is already a reusable dashed-line primitive.
One-off art decisions: the specific 6-colour palette, the corner motif pass at grid
intersections, the corner-notch quad, the glow alpha, and the dot overlay. A clean
parameter object would hold: `n` (subdivision), `borderFrac` (ver), `innerFrac` (man),
`palette`, `motifWeights`, `streetGap` (linee amp), `glowAlpha`, `bg`, `streetColor`.
