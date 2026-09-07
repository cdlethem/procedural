---
sketch: 2017/Generativos/dricula
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 263
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#EAA104", "#F9BBD1", "#47A1BC", "#EA2525"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: passes, default: 10, tried: [3], change: large, effect: "fewer overlay layers: large coarse blocks, a few big solid squares, sparser mosaic"}
  - {name: subdiv, default: "int(random(200)*random(1))", tried: ["int(random(20)*random(1))"], change: large, effect: "fewer splits per layer: most of the canvas stays flat grey, dense patchwork confined to one corner"}
  - {name: stripeProb, default: 0.8, tried: [1.0], change: large, effect: "every rect gets striped: full-bleed with no empty grey squares, denser and more uniform"}
  - {name: flipProb, default: "random(-0.1, 0.2)", tried: ["random(-0.1, 1.0)"], change: moderate, effect: "per-row direction flips become frequent: mottled mixed h/v micro-stripes, square layout unchanged"}
  - {name: quarter, default: 0.5, tried: [0.25], change: large, effect: "children at a quarter of the parent size: much finer texture in split clusters; unsplit regions become wide smooth gradient bands"}
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(x, y, size, splits) -> List<Rect>", note: "repeatedly replace a random rect by its 4 equal quarters"}
  - {name: stripeFill, signature: "stripeFill(x, y, size, palette, cycle, flipProb) -> void", note: "paint a square as 1px rows/columns cycling through a lerp palette, direction flips randomly per row"}
---

## What it draws
A full-bleed 960x960 mosaic of squares at many different sizes, nested like a quadtree.
Most squares are filled with fine 1px horizontal or vertical stripes; the stripe colour
cycles through a 4-colour palette (dominant: orange and red, with pink and teal-blue
strips), and the direction flips at random places so squares show checkerboard-like
patches of horizontal and vertical strips. Some squares are left empty, revealing the
dark grey background. The overall look is a dense, busy textile/printed-fabric grid.

## How the code works
`setup()` (dricula.pde:3-8) calls `generate()` once; `draw()` is empty (the regenerate
call is commented out, line 11), so the image is static.

`generate()` (lines 29-69):
1. Paints `background(90)` — a dark grey base (line 33).
2. Outer loop over `passes = 10` layers (line 34). Each layer starts from one rectangle
   covering the whole canvas (`PVector(0,0,width)`, line 36) and performs
   `sub = int(random(200)*random(1))` (0-199) subdivision steps: pick a random rect,
   remove it, and insert its 4 equal quarters (lines 38-47). This builds a random
   quadtree per layer; later layers overlay earlier ones.
3. For every final rect (lines 51-67): the first branch `random(1) < 0.0` is dead code
   (never true), so a solid `fill` is set but never drawn. With probability 0.8 the
   square is painted as stripes: for `k` in 0..size-1 a 1px-wide rect (line 62/63) is
   drawn with `getColor(ic + ddc*k)` (line 61), i.e. the colour walks along the
   palette with a random rate `ddc`. `getColor` (lines 77-83) lerps between adjacent
   palette colours, so stripes run through smooth colour bands. The orientation `hor`
   (line 58) flips per row with probability `pr` (line 59, ~0-0.2), creating the
   patchwork of horizontal/vertical regions.
4. The remaining ~20% of rects are not painted, so they show whatever was drawn
   underneath (grey background or an earlier layer).

Randomness enters via the unseeded `random()` in the quadtree picks, stripe rates,
palette offsets and orientation flips; the harness seeds the field `seed` (line 1),
but note `generate()` never calls `randomSeed(seed)` — determinism holds only because
the harness fixes the initial RNG state.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| passes_3 | `for (int j = 0; j < 10; j++) {` -> `for (int j = 0; j < 3; j++) {` | large | coarser and blockier: only ~3 quadtree layers, so big stripe bands and a few large solid orange/teal squares, less overlap between layers | variants/passes_3/frame_00001.png |
| subdiv_20 | `int sub = int(random(200)*random(1));` -> `int sub = int(random(20)*random(1));` | large | most of the canvas is flat dark grey; the dense stripe patchwork is confined to the top-left quarter, with a couple of solid blocks | variants/subdiv_20/frame_00001.png |
| stripeProb_1.0 | `else if (random(1) < 0.8) {` -> `else if (random(1) < 1.0) {` | large | full-bleed: no empty grey squares remain, every block is striped; denser, more uniform, with several large smooth gradient blocks | variants/stripeProb_1.0/frame_00001.png |
| flipProb_1.0 | `float pr = random(-0.1, 0.2);` -> `float pr = random(-0.1, 1.0);` | moderate | same square layout and sizes, but mottled: squares show fine mixed patches of horizontal/vertical micro-stripes instead of clean directional bands | variants/flipProb_1.0/frame_00001.png |
| quarter_0.25 | `float ss = r.z*0.5;` -> `float ss = r.z*0.25;` | large | much finer and denser: split regions become very fine grids, unsplit regions become wide smooth orange/teal/pink gradient bands; still full-bleed | variants/quarter_0.25/frame_00001.png |

## Modularisation notes
The generic, reusable blocks: (1) the random quadtree subdivision (lines 34-47) is a
standalone `quadtreeSplit(x, y, size, splits) -> List<Rect>`; (2) the 1px stripe fill
with palette cycling and random direction flips (lines 55-66) is a
`stripeFill(rect, palette, cycleRate, flipProb)` function; (3) `getColor`
(lerp-between-palette) is a small `paletteLerp(palette, t)` utility.

One-off art decisions: the 10 stacked full-canvas layers (each a fresh quadtree), the
specific 4-colour palette from coolors.co, the 0.8 stripe probability, and the dead
`< 0.0` branch.

A clean parameter object would contain: `passes`, `maxSplits` (per layer),
`stripeProbability`, `flipProb`, `quarterScale` (must stay 0.5 for the quadtree to
keep partitioning the parent square; at 0.25 the four children only cover the
top-left quarter of the parent, so coverage collapses), `palette`, `cycleRateRange`
(`ddc`), and `bgColor`.
