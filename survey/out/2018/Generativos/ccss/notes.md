---
sketch: 2018/Generativos/ccss
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1695
animated: false
techniques: [grid, dots-stippling]
primitives: [rect, shape]
palette:
  colors: ["#B14027", "#476086", "#659173", "#9293A2", "#262A2C", "#D38644"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 2000, tried: [5000], change: large, effect: "busier, denser mosaic with more overlapping blocks"}
  - {name: sizeExpMax, default: 9, tried: [6], change: moderate, effect: "no sub-30px blocks; larger, more legible blocks and subdivided regions"}
  - {name: subWMax, default: 20, tried: [6], change: large, effect: "chunkier cells, coarser patchwork instead of fine grain"}
  - {name: stripeAlpha, default: "random(200)*random(1)", tried: ["random(200)"], change: large, effect: "darker, more prominent black stripes across blocks"}
  - {name: lightAlpha, default: 6, tried: [100], change: none, effect: "no visible change"}
reusable_candidates:
  - {name: blockMosaic, signature: "blockMosaic(count, sizePow, subW, subH) -> void", note: "grid of random-pow2 blocks each subdivided into a colour grid + faint stripes"}
---

## What it draws
A full-bleed, high-density mosaic of small rectangles with no focal point. The dominant colours are warm orange/ochre, slate blue, muted green, and near-black, with a grey as a cooler accent. Each rectangular block is itself subdivided into a small grid of tiny cells, and many cells carry faint vertical or horizontal stripes, giving a busy, pixelated, abstract texture.

## How the code works
`setup()` (ccss.pde:3) sets a 960×960 P2D canvas and calls `generate()` once; `draw()` is empty so the piece is static. `generate()` (ccss.pde:21) fills the background with a random palette colour (`rcol()`, :133), then loops 2000 times (:25). Each iteration picks a block size as `width / 2^random(2,9)` — powers of two from 240px down to ~3.7px — and snaps the position to that grid so blocks tile cleanly (:26-31). It draws a "shadow" trapezoid pair in translucent black (`fill(0,50)`, :35-51) to offset each block, then the filled rectangle in a random palette colour (:53-59). Two more translucent black/white overlays add a faint top-left highlight and bottom-right shade (:61-79). The block is then subdivided into `cw × ch` cells (each `random(1,20)`, :81-91), every cell filled with a fresh random palette colour. Finally, per-column and per-row stripe bands alternate a translucent black (`shw = random(200)*random(1)`, :93) on even/odd bands, producing the thin striped look. Randomness enters entirely through `random()` for size, position, and every cell colour. No noise, no blend modes, no shaders.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_5000 | `for (int c = 0; c < 2000; c++) {` -> `... c < 5000 ...` | large | visibly denser: more overlapping blocks, finer overall texture | variants/count_5000/frame_00001.png |
| blocksize_2-6 | `float ww = width/pow(2, int(random(2, 9)));` -> `... random(2, 6) ...` | moderate | larger minimum block size (>=30px); bigger, more legible blocks and subdivisions | variants/blocksize_2-6/frame_00001.png |
| subdivide_1-6 | `int cw = int(random(1, 20));` -> `... random(1, 6) ...` | large | fewer columns per block: chunkier cells, coarser patchwork look | variants/subdivide_1-6/frame_00001.png |
| shw_full | `float shw = random(200)*random(1);` -> `float shw = random(200);` | large | stripes consistently stronger: darker, more prominent banding | variants/shw_full/frame_00001.png |
| light_100 | `fill(255, 6);` -> `fill(255, 100);` | none | no visible change | variants/light_100/frame_00001.png |
