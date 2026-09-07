---
sketch: 2014/Generativos/cuadraditos
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 184
animated: false
techniques: [grid, dots-stippling, pixel-ops]
primitives: [rect, pixels]
palette:
  colors: ["#181818", "#C8C8C8"]
  selection: fixed
composition: tiled
parameters:
  - {name: skipP, default: 30, tried: [70], change: subtle, effect: "70% skip: noticeably sparser dots, thinner ragged blocks; grid structure preserved"}
  - {name: cw, default: 8, tried: [12], change: subtle, effect: "wider blocks (12 cells) fill the 80px pitch, gaps between blocks shrink slightly"}
  - {name: ch, default: 2, tried: [4], change: moderate, effect: "taller blocks (4 rows) merge into dense texture, canvas much more filled"}
  - {name: t, default: 5, tried: [9], change: large, effect: "9px squares: much chunkier, coarser dot clusters, clearly larger marks"}
  - {name: esp, default: 4, tried: [1], change: moderate, effect: "near-zero gap: dots run into solid bars, texture becomes dense and continuous"}
  - {name: alpha, default: 180, tried: [60], change: subtle, effect: "lower fill alpha: dots fade toward the dark background, lower contrast"}
reusable_candidates:
  - {name: dotBlock, signature: "dotBlock(x, y, cw, ch, tileSize, gap, skipP) -> void", note: "grid of tiny squares with per-cell random skip probability"}
  - {name: pixelGrain, signature: "pixelGrain(amount) -> void", note: "adds uniform random brightness to every pixel via get/set loop"}
---

## What it draws
A near-black (#181818) portrait canvas covered by a 24-row × 7-column grid of small dot-blocks. Each block is a dense 8-wide × 2-tall grid of tiny light-gray squares with gaps between them; roughly a third of the dots are randomly missing, so blocks look like stippled texture patches with ragged edges. The whole image has a fine per-pixel brightness grain.

## How the code works
`setup()` (cuadraditos.pde:3-6) sets a 600×800 window and calls `generar()` once; `draw()` is empty so the piece is static. `generar()` (12-21) seeds the RNG with the global `seed` (harness sets it to 42), fills the background `#181818`, then loops `j` 0..23 × `i` 0..6 placing a block via `logito(30+i*80, 40+j*30, 8, 2, 5, 4)` (line 17). `logito(x, y, cw, ch, t, esp)` (31-41) draws a `cw`×`ch` grid of `t`×`t` squares spaced by `t+esp`, skipping any cell where `random(100) < 30` (line 37, ~30% of cells dropped); fill is light gray `fill(200, 180)` (line 34). Finally `noisee()` (43-51) loops over every pixel and adds `random(10)` to each RGB channel (lines 46-48), producing the fine grain. Randomness enters only in the cell skips and the grain, both seeded, so the render is deterministic. Any key press reseeds and regenerates (23-29).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| skip_70 | `if(random(100) < 30) continue;` -> `if(random(100) < 70) continue;` | subtle | sparse dots: more missing cells, thinner ragged blocks; same grid structure | variants/skip_70/frame_00001.png |
| cw_12 | `logito(30+i*80, 40+j*30, 8, 2, 5, 4);` -> `... 12, 2, 5, 4);` | subtle | wider 12-cell blocks, inter-block gaps shrink slightly | variants/cw_12/frame_00001.png |
| ch_4 | `logito(30+i*80, 40+j*30, 8, 2, 5, 4);` -> `... 8, 4, 5, 4);` | moderate | taller 4-row blocks merge into dense texture; canvas much more filled | variants/ch_4/frame_00001.png |
| t_9 | `logito(30+i*80, 40+j*30, 8, 2, 5, 4);` -> `... 8, 2, 9, 4);` | large | 9px squares: chunkier coarser dot clusters, clearly larger marks | variants/t_9/frame_00001.png |
| esp_1 | `logito(30+i*80, 40+j*30, 8, 2, 5, 4);` -> `... 8, 2, 5, 1);` | moderate | dots run together into solid bars; dense continuous texture | variants/esp_1/frame_00001.png |
| alpha_60 | `fill(200, 180);` -> `fill(200, 60);` | subtle | dots fade toward the dark background; lower contrast | variants/alpha_60/frame_00001.png |
## Modularisation notes
- `dotBlock(x, y, cw, ch, tileSize, gap, skipP)` is the generic core: a small grid of squares with a per-cell random skip probability; `cw/ch/t/esp/skipP` are its natural parameters.
- `pixelGrain(amount)` (the `noisee()` get/set loop) is a generic post-effect but slow at 600×800; a library version would want a PGraphics or pixel-array API.
- One-off art decisions: the 24×7 block tiling with 80/30 px pitch, the dark background, the gray 180-alpha fill, and the 30% skip rate.
- Clean parameter object: `{blockCols: 7, blockRows: 24, cellW: 8, cellH: 2, tileSize: 5, gap: 4, skipP: 0.30, blockPitchX: 80, blockPitchY: 30, origin: [30, 40], fill: [200, 180], bg: #181818, grain: 10}`.
