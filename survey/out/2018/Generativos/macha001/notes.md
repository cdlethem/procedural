---
sketch: 2018/Generativos/macha001
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1478
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#34302E", "#72574C", "#9A4F7D", "#488753", "#D9BE3A", "#D9CF7C", "#E2DFDA", "#CF4F5C", "#368886"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(8000))", tried: [2000, 15000], change: large, effect: "fewer iterations = coarser mosaic with fewer fine clusters; more iterations = near-pixel speckle with few mid-size islands"}
  - {name: cc, default: "int(random(2, 5))", tried: [4], change: large, effect: "always-4x4 splits make squares smaller and more uniform in scale across the canvas"}
  - {name: pickBias, default: "quads.size()*random(0.1)", tried: ["quads.size() (uniform)"], change: large, effect: "uniform pick over all cells leaves many large flat blocks and only a few fine clusters, instead of dense fine clusters next to large blocks"}
  - {name: colors, default: "9-color list", tried: ["2-color black/white", "5-color blue ramp"], change: large, effect: "geometry identical; only the flat fill colors change"}
reusable_candidates:
  - {name: randomSquareSubdivision, signature: "randomSquareSubdivision(seed, iterations) -> PVector[] (x,y,size)", note: "iterative random subdivision of the canvas into a square partition; picks biased toward oldest/largest cells"}
  - {name: randomPaletteColor, signature: "rcol(colors) -> int", note: "uniform random pick from a fixed color array"}
---

## What it draws
A full-bleed 960×960 mosaic of axis-aligned squares of wildly varying sizes, from near-pixel specks
up to ~100 px blocks, tiling the whole canvas with no gaps or overlaps. Every square is flat-filled
with one of nine saturated colors (cream, yellow, green, red/pink, purple, teal, brown), giving a
dense, busy confetti-like texture with scattered clusters of extremely fine subdivision.

## How the code works
- A quad list starts with one entry covering the whole canvas: `PVector(0, 0, width)` (line 29).
- `sub = int(random(8000))` iterations (line 30). Each picks `ind = int(random(quads.size()*random(0.1)))`
  (line 32) — a random index only within the **first 10% of the list**. Since new children are appended
  at the end (line 38) and the head of the list holds the oldest, largest cells, early (large) cells are
  re-picked far more often: that bias is what creates the dense clusters of tiny squares next to
  regions of larger blocks.
- The picked quad is split into a `cc × cc` grid with `cc = int(random(2, 5))` (line 34), i.e. 2×2 to 4×4
  child squares of size `q.z/cc` (lines 36-40), and the parent is removed (line 41).
- After the loop, only surviving (leaf) quads are drawn: `noFill(); stroke(255); noStroke();` (lines 44-46)
  leave strokes off; each quad gets `fill(rcol())` (line 51, which overwrites the black/white fill on
  line 50) — a uniform random color from the 9-entry `colors[]` array (line 82) — and is drawn with
  `rect(q.x, q.y, q.z, q.z)` (line 52). Because the partition is a true subdivision, rects never overlap.
- `keyPressed` regenerates with a new seed; `saveImage()` saves a timestamped frame (lines 14-20, 56-59).
  `arc2`/`getColor` are dead code, not called from `generate()` (lines 61-79, 87-96).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_2000 | `int sub = int(random(8000));` -> `int sub = 2000;` | large | coarser mosaic: squares visibly larger throughout, fine clusters smaller and sparser, same 9-color palette | variants/sub_2000/frame_00001.png |
| sub_15000 | `int sub = int(random(8000));` -> `int sub = 15000;` | large | much finer: most of the canvas is near-pixel speckle, only a few mid-size islands survive | variants/sub_15000/frame_00001.png |
| cc_4 | `int cc = int(random(2, 5));` -> `int cc = 4;` | large | squares smaller and more uniform in scale across the whole canvas; fine clusters still present but the 2x2 splits that made the baseline's larger blocks are gone | variants/cc_4/frame_00001.png |
| pick_uniform | `int ind = int(random(quads.size()*random(0.1)));` -> `int ind = int(random(quads.size()));` | large | structure changes dramatically: many large flat blocks (some 200-300 px) survive because small cells dominate the pick pool, with only a few dense fine clusters; baseline's fine-clusters-everywhere look is gone | variants/pick_uniform/frame_00001.png |
| palette_bw | `int colors[] = {#34302E, ... 9 colors ...};` -> `int colors[] = {#FFFFFF, #000000};` | large | identical geometry and size distribution; fills are black and white only, reading as high-contrast static noise | variants/palette_bw/frame_00001.png |
| palette_blue | `int colors[] = {#34302E, ... 9 colors ...};` -> `int colors[] = {#0A1F44, #1F4E8C, #4A90D9, #A8D0F0, #E8F4FD};` | large | identical geometry; fills are a blue ramp from dark navy to near-white, same cluster structure as baseline | variants/palette_blue/frame_00001.png |

## Modularisation notes
- **Generic / reusable:** the subdivision loop (lines 28-42) is a clean parameterised algorithm:
  start cell, iteration count, child-grid range (min/max cc), and a cell-selection policy
  (uniform vs. front-biased). Exposed as `randomSquareSubdivision(iterations, ccMin, ccMax, pickBias)`
  returning the leaf cells. The color array + `rcol()` (lines 82-86) is a trivial
  `randomPaletteColor(palette)` helper.
- **One-off art decisions:** the specific 9-color palette; the 0.1 front-bias in the cell pick
  (defines the "clumpy" aesthetic); 960×960 P2D canvas; black background (invisible since the
  partition covers everything).
- **Parameter object:** `{ seed, iterations, ccMin, ccMax, pickBias, palette, canvas }`.
- The black/white fill line (50) is dead (overwritten line 51) — a bug or leftover; a clean port
  would delete it. `arc2` and `getColor` are unused dead code.
