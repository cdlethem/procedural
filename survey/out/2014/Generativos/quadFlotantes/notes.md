---
sketch: 2014/Generativos/quadFlotantes
year: 2014
renderer: JAVA2D
size: [768, 768]
libraries: []
deterministic: true
ms_first_frame: 338
animated: false
techniques: [grid, dots-stippling]
primitives: [rect]
palette:
  colors: ["#512B52", "#635274", "#7BB0A8", "#A7DBAB", "#E4F5B1"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: maxx, default: 8, tried: [6], change: subtle, effect: "coarser minimum cell (4px vs 1px); grain looks blockier, same overall density"}
  - {name: quadCount, default: 40000, tried: [10000], change: large, effect: "4x fewer squares per pass; much of the dark background shows through, sparse glitter look"}
  - {name: outlineAlpha, default: 8, tried: [60], change: large, effect: "near-invisible outlines become strong; image much darker with a visible dark grid mesh"}
  - {name: paletteColor, default: "#7BB0A8", tried: ["#B07B7B"], change: subtle, effect: "teal swapped for dusty rose; warmer muted cast, structure unchanged"}
  - {name: maxOutlineWeight, default: 3, tried: [6], change: large, effect: "thicker outlines; darker, more connected mesh of outlined squares"}
reusable_candidates:
  - {name: quadScales, signature: "quadScales(count, maxLevel, palette, outlineAlpha) -> void", note: "scatter grid-aligned quads in halving size passes, each outlined in faint black and filled from a palette"}
---

## What it draws
A full-bleed 768x768 static image that reads as dense static/grain: thousands of tiny
squares in a five-colour palette (dark aubergine, muted purple-grey, teal, soft green,
pale yellow-green) over a dark purple background. Faint blocky structure of larger
squares shows through at places, but the fine 1-8 px squares dominate, giving a noisy,
salt-and-pepper, almost textile look.

## How the code works
- `setup()` calls `generar()` once; `draw()` is empty, so the image is static
  (frames 10/60 dropped as identical).
- `generar()` (lines 22-42) fills the background with a random palette colour
  (`rcol()`, line 23), then runs 9 passes. `tt` starts at `pow(2, 8) = 256` (line 26)
  and is halved at the end of each pass (line 40), so pass cell sizes are
  256, 128, 64, 32, 16, 8, 4, 2, 1 px.
- Each pass scatters `40000/tt` squares (line 28), snapped to the grid of that size:
  `x = int(random(width/tt))*tt` (line 29), same for `y`. Later, finer passes are
  drawn on top, so large squares are mostly overpainted.
- Every square first gets three nested near-transparent black outlines
  `stroke(0, 8)` at weights 3, 2, 1 (lines 31-35), then an opaque fill from the
  random palette `fill(rcol())` (lines 37-38).
- Randomness enters via `random()` for position and for every colour pick
  (`rcol()`, lines 44-46); there is no noise field, transform, or blend mode.
- The palette (lines 1-7) is a muted purple/teal/green family; `rcol()` picks
  uniformly at random, for both background and every square.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| maxx_6 | `  int maxx = 8;` -> `  int maxx = 6;` | subtle | coarser grain: smallest cells are 4px blocks instead of 1px dots, giving a chunkier, blockier static; same palette and density | variants/maxx_6/frame_00001.png |
| count_10000 | `    for (int i = 0; i < 40000/tt; i++) {` -> `... 10000/tt ...` | large | much sparser: only ~25% of squares, so the dark purple background dominates with sparse glittering specks | variants/count_10000/frame_00001.png |
| outline_alpha_60 | `      stroke(0, 8);` -> `      stroke(0, 60);` | large | outlines now clearly visible: the image is much darker overall, a dark grid/mesh of square edges laid over a lighter field | variants/outline_alpha_60/frame_00001.png |
| palette_teal_rose | `#7BB0A8` -> `#B07B7B` | subtle | teal squares replaced by dusty rose/brown; noticeably warmer, muddier cast; same grain structure | variants/palette_teal_rose/frame_00001.png |
| outline_weight_6 | `      for(int s = 3; s >= 1; s--){` -> `      for(int s = 6; s >= 1; s--){` | large | thicker outlines (up to 6px): darker, more connected mesh; squares read as outlined tiles rather than filled dots | variants/outline_weight_6/frame_00001.png |

## Modularisation notes
- `generar()` is a self-contained "multi-scale grid scatter": a generic
  `quadScales(count, maxLevel, palette, outlineAlpha)` could implement the loop
  (halving cell size, grid-snapped random placement, faint nested outline, random
  palette fill). The halving schedule and the `40000/tt` count-per-pass rule are the
  two structural knobs.
- One-off art decisions: the specific five-colour palette, the `stroke(0, 8)`
  near-invisible outline (three weights 3/2/1), and the `40000/tt` density constant.
- A clean parameter object: `{count, maxLevel, palette[], outlineAlpha, outlineWeights[]}`.
- The `keyPressed`/`saveImage` boilerplate is sketch-specific and not reusable.
