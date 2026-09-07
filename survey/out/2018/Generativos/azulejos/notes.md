---
sketch: 2018/Generativos/azulejos
year: 2018
renderer: P2D
size: [6500, 6500]
libraries: []
deterministic: true
ms_first_frame: 4143
animated: false
techniques: [grid, subdivision, dots-stippling]
primitives: [rect]
palette:
  colors: ["#EE3425", "#000000", "#D3D3D3", "#FEFEFE"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: subw, default: "1-99", tried: ["1-4"], change: large, effect: "fewer horizontal splits -> blocks span nearly full width; image becomes horizontal bands of different grain"}
  - {name: subh, default: "1-49", tried: ["1-4"], change: large, effect: "fewer vertical splits -> blocks span nearly full height; image becomes vertical strips"}
  - {name: sca, default: "{1,2,4,8}", tried: ["{1,2}"], change: large, effect: "no fine blocks; every block filled at 1x/2x resolution, whole image coarser"}
  - {name: accentProb, default: 0.2, tried: [0.7], change: large, effect: "many more cells get the small offset accent square; busier, more 'ringed' texture"}
  - {name: stippleAlpha, default: 30, tried: [200], change: none, effect: "no visible change: stipple layer is drawn under the opaque mosaic and only a thin margin shows"}
reusable_candidates:
  - {name: gridSubdivide, signature: "gridSubdivide(w, h, cell, splitsV, splitsH) -> Rect[]", note: "recursively split random rects at grid-aligned offsets, min remainder one cell"}
  - {name: blockMosaic, signature: "blockMosaic(x, y, w, h, cell, scale, accentProb) -> void", note: "fill a rect with a sub-grid of random-palette squares at 1/scale resolution, plus small corner accents on some cells"}
  - {name: lerpPalette, signature: "lerpPalette(colors[], t) -> color", note: "continuous index lerped between adjacent palette entries (yields in-between tones)"}
---

## What it draws
A full-bleed pixel mosaic in reds, black, grays, pinks and off-white on a light-gray ground,
partitioned into rectangular blocks. The blocks differ in pixel density: some are made of
coarse ~216 px squares, others of very fine ~27 px squares, and a few in between; block edges
appear as thin 1 px lines. Underneath the mosaic is a faint layer of tiny dots and faint square
outlines spanning the whole canvas. Overall it reads as a tiled, low-fidelity "azulejo"
mosaic with several focal regions of different grain.

## How the code works
- `setup()` (L5-15): 6500x6500 P2D, calls `generate()` once, saves and exits; static output
  (only frame 1 exists).
- `generate()` L39: `background(rcol())` picks a random background from the 4-color palette
  `colors[]` (L159: red `#EE3425`, black, light gray `#D3D3D3`, white `#FEFEFE`); baseline
  background is light gray.
- Stipple layer (L42-60): 48x48 half-step grid (`ss = width/24`, `cc = 24`, loops to `cc*2`)
  of 3 px and 1 px dots at alpha 30, one random palette color — the faint dot texture visible
  at the margins.
- Tile-outline layer (L62-82): per cell of a 24x24 grid, two concentric noFill stroked squares
  (size `ss` and `ss*0.9`), alpha 30, in two random palette colors — faint square grid.
- Subdivision (L84-112): one rect covering the canvas inset by `ss/2`; `subh = int(random(1,50))`
  vertical splits then `subw = int(random(1,100))` horizontal splits. Each iteration picks a
  random rect and cuts it at a random grid-aligned multiple of `ss`, only if the remainder
  exceeds one cell. This produces the rectangular block partition.
- Block fill (L115-152): each final rect gets a 1 px border (four thin rects, alpha 180).
  `rnd` is hard-coded 0 (L129), so every block is filled: `sca = 2^int(random(0,4))` ∈ {1,2,4,8}
  (L132) sets the sub-resolution; pixels are `ss/sca * 0.8` squares (L139-141), each filled
  with `getColor()` — a continuous random index lerped between two adjacent palette entries
  (L163-172), which is where the pink/intermediate tones come from. With probability 0.2
  (L142) a cell additionally gets a smaller accent square of random size (L143-147).
- Randomness enters via: `rcol()` background/stipple picks, split counts and positions, per-block
  `sca`, per-pixel colors, accent squares. All seeded (harness sets `seed = 42`); deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subw_5 | `int subw = int(random(1, 100));` -> `int subw = int(random(1, 5));` | large (mean 0.2449, 0.669 of pixels) | canvas split into full-width horizontal bands of mixed grain (fine, mid, coarse); far fewer vertical edges than baseline | variants/subw_5/frame_00001.png |
| subh_5 | `int subh = int(random(1, 50));` -> `int subh = int(random(1, 5));` | large (mean 0.2415, 0.654 of pixels) | canvas split into full-height vertical strips of mixed grain; far fewer horizontal edges | variants/subh_5/frame_00001.png |
| sca_1 | `int sca = int(pow(2, int(random(0, 4))));` -> `int sca = int(pow(2, int(random(0, 2))));` | large (mean 0.2514, 0.649 of pixels) | no fine mosaic regions anywhere; all blocks made of coarse (~216 px) or medium (~108 px) squares | variants/sca_1/frame_00001.png |
| accent_0.7 | `if (random(1) < 0.2) {` -> `if (random(1) < 0.7) {` | large (mean 0.2407, 0.659 of pixels) | most cells show the small offset accent square (inner dot / ring); noticeably busier texture at same block layout | variants/accent_0.7/frame_00001.png |
| stipple_200 | `fill(rcol(), 30);` -> `fill(rcol(), 200);` | none (mean 0.0003, 0.0 of pixels) | no visible change: the dot layer sits under the opaque mosaic fills and is only exposed in the thin outer margin | variants/stipple_200/frame_00001.png |

## Modularisation notes
- Generic: the rect-subdivision loop (L84-112) is a clean library function
  (`gridSubdivide(w, h, cell, splitsV, splitsH) -> Rect[]`) — pure, seedable, no Processing
  draw calls. The block fill (L115-151) is `blockMosaic(...)` with `scale`, `cellRatio` (0.8)
  and `accentProb` as knobs. `lerpPalette(colors, t)` (L166-172) is a small reusable color
  helper.
- One-off art decisions: the faint stipple and tile-outline underlayers (L42-82) are decorative
  and tied to this piece; the 4-color palette; the 1 px border width and alpha 180; the
  `sca` powers-of-two range {1,2,4,8}; the 0.2 accent probability.
- Clean parameter object: `{ canvasSize, cellSize (width/24), palette, subhRange, subwRange,
  scales: [1,2,4,8], pixelRatio: 0.8, accentProb: 0.2, borderAlpha: 180, stippleAlpha: 30,
  seed }`.
