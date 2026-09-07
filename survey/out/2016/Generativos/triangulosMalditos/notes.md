---
sketch: 2016/Generativos/triangulosMalditos
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 704
animated: false
techniques: [grid, lines-hatching]
primitives: [rect, shape]
palette:
  colors: ["#000000", "#1E1E1E", "#E1E1E1", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 8000, tried: [30000], change: large, effect: "more shapes -> denser, heavier woven field with big black diagonal masses"}
  - {name: baseSize, default: 50, tried: [100], change: large, effect: "2x base size -> coarser pattern of larger shards, less fine detail"}
  - {name: maxExponent, default: 10, tried: [4], change: large, effect: "caps max shape size -> giant shapes vanish, lighter more uniform field"}
  - {name: gridSnap, default: 50, tried: [150], change: large, effect: "coarser 150px lattice -> bigger stepped diagonal bands, more regular tiling"}
  - {name: triAlpha, default: 2, tried: [60], change: subtle, effect: "no visible change; outlines already near-invisible at alpha 2"}
reusable_candidates:
  - {name: snapToGrid, signature: "snapToGrid(float v, float cell) -> float", note: "v - v%cell; aligns scattered points to a lattice"}
  - {name: randomShape, signature: "randomShape(cx, cy, ss, kind) -> void", note: "draws an outlined+filled rect / half-diamond / thin bar at a grid-snapped cell"}
---

## What it draws
A dense, full-bleed field of diagonal black and white shapes on a pale grey ground, read as
45-degree stripes and shards. Squares, half-diamonds, and thin bars overlap and interlock into
a busy, almost woven pattern. A handful of faint grey ghost shapes and short thin diagonal lines
scatter through the darker masses.

## How the code works
`setup()` (L1-5) sizes 960x960, sets `rectMode(CENTER)`, and calls `generate()` once; `draw()`
is empty so the image is static (L7-8).

`generate()` (L15-71) translates to the centre and rotates the whole context by `PI/4`
(L16-17) — this is why every axis-aligned square/triangle renders as a 45-degree diagonal.
It then loops `cc = 8000` times (L19):
- Each iteration picks a random `xx`,`yy` in `±width*1.5` / `±height*1.5` (L21-22), i.e. a
  scatter well beyond the canvas so edges are full-bleed.
- Size `ss = 50*pow(2, int(random(1, map(i,0,cc,10,2)))*random(0,1)) + 1` (L23): the `int`
  exponent is drawn from 1..(10 down to 2) and then scaled by `random(0,1)`, so most shapes are
  small with a power-law tail toward large ones; `*50+1` is the size scale.
- `xx -= xx%50; yy -= yy%50` (L24-25) snap positions onto a 50-px lattice, which is what creates
  the aligned, tiling diagonal structure instead of pure noise.
- Colour `c = rcol()` (L26, defined L74-77): 40% chance of a dark value (0..30) else a light
  value (225..255) — a two-cluster greyscale, giving the black-and-white look with soft grey
  intermediates.
- Three branches, each gated on `random(1)<0.5` (L27, L39) / else (L59):
  1. **Rect** (L27-38): for the first half of the loop, 50% of the way; draws a 5-stroke outline
     (weights 5..1, alpha 3) then a filled centred rect.
  2. **Half-diamond** (L39-58): a triangle `beginShape` with vertices at left, bottom, right;
     same 5-stroke outline (alpha 2) then fill. Rotated 45 degrees these read as the diagonal
     shards.
  3. **Thin bar** (L59-69): a rect of height `ss*random(0,0.1)` — a short sliver; 3-stroke
     outline (alpha 3) then fill. These are the thin diagonal hairlines.

Randomness enters only through `random()` (positions, size exponent, branch choice, colour,
bar height); there is no noise field. No blend modes; shapes are simply overpainted in loop
order, so earlier (smaller-index) shapes sit beneath later ones.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_30000 | `int cc = 8000;` -> `int cc = 30000;` | large (mean 0.4634, 0.577 of pixels) | much denser, heavier weave; overlapping shapes merge into large black diagonal masses and white shards | variants/cc_30000/frame_00001.png |
| base_100 | `50*pow(2, int(random` -> `100*pow(2, int(random` | large (mean 0.3276, 0.406 of pixels) | coarser pattern: noticeably larger white and black triangles/squares, fine detail reduced | variants/base_100/frame_00001.png |
| exponent_4 | `map(i, 0, cc, 10, 2)` -> `map(i, 0, cc, 4, 2)` | large (mean 0.2687, 0.351 of pixels) | giant shapes gone; lighter, more uniform field of medium-sized shapes, fewer big black masses | variants/exponent_4/frame_00001.png |
| grid_150 | `xx -= xx%50;` + `yy -= yy%50;` -> `%150` (both) | large (mean 0.3828, 0.472 of pixels) | coarser lattice: diagonal structure becomes bigger stepped bands, more regular tiling with more white gaps between bands | variants/grid_150/frame_00001.png |
| alpha_60 | `stroke(0, 2);` -> `stroke(0, 60);` | subtle (mean 0.0275, 0.073 of pixels) | no visible change; triangle outlines were already near-invisible at alpha 2 | variants/alpha_60/frame_00001.png |

## Modularisation notes
- **Generic / reusable**: the 50-px position snap (L24-25) is a clean `snapToGrid(v, cell)`
  utility. The power-law size draw (L23) is a reusable `sizeFromExponent(base, maxExp, i, total)`.
  The three shape drawers (rect / half-diamond / thin bar, each outlined-then-filled at a
  snapped cell) could collapse into one `drawSnappedShape(cx, cy, ss, kind)`.
- **One-off art decisions**: the fixed 45-degree global rotation (L17); the two-cluster
  greyscale `rcol()` (L74-77); the exact 5/3-stroke outline weights and near-zero alphas (3, 2);
  the 40% dark / 60% light colour split; the bar-height factor `random(0,0.1)`.
- **Clean parameter object**: `{count, baseSize, maxExponent, gridCell, darkProb, outlineAlpha,
  barHeightFactor}` — everything currently hard-coded that visibly drives the look.
