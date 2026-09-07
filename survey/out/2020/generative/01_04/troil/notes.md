---
sketch: 2020/generative/01_04/troil
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1490
animated: false
techniques: [grid, subdivision]
primitives: [rect]
palette:
  colors: ["#02AAE0", "#F47EF3", "#0ABB8B", "#F6DE21", "#F63528", "#000000", "#ffffff"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(4,9)", tried: [4, 8], change: large, effect: "fewer cells = larger, sparser blocky rects; more cells = finer, denser grid"}
  - {name: div, default: 10, tried: [20], change: large, effect: "more nested sub-rects per cell = busier, more overlapping outlines"}
  - {name: strokeWeight, default: 2, tried: [6], change: subtle, effect: "thicker black outlines only; layout and colours unchanged"}
  - {name: rnd, default: 1, tried: [0], change: moderate, effect: "0 = quarter-arc corners instead of rects; rounded petal/leaf shapes"}
reusable_candidates:
  - {name: nestedCell, signature: "nestedCell(x, y, w, h, layers, skipProb) -> void", note: "stack of shrinking corner-anchored rects per grid cell, each a random palette color"}
---

## What it draws
A full-bleed mosaic on a black ground. The canvas is split into a coarse square grid of cells; inside
each cell sits a stack of nested, corner-anchored rectangles in flat, high-saturation colours
(dominantly cyan-blue, magenta, yellow and green, with red/white/black accents). Every shape carries a
thin black outline, so the whole field reads as a blocky, Mondrian-like patchwork of coloured squares
and L/T shapes of varying size.

## How the code works
- `settings()` (L16-21): fixed 960×960, `P3D`, `smooth(8)`.
- `generate()` (L46-110): re-seeds `randomSeed/noiseSeed(seed)` (L48-49), paints the background a random
  palette colour (L51), then picks `cc = int(random(4, 9))` (L53) — a 4-8 cell grid — and computes the
  cell step `sw`/`sh` (L54-55).
- Double loop `j`×`i` (L58-59) walks the grid; each cell centre is `(i+0.5)*sw, (j+0.5)*sh` (L60-61).
- Per cell, `rnd` is fixed to `1` (L68) so the `rnd == 0` arc branch (L74-88) is dead code; the `rnd == 1`
  branch (L89-106) always runs.
- Inner loop `k < div` with `div = 10` (L69): each iteration is skipped with probability 0.5 (L71),
  then `v = 1 - k/div` (L72) shrinks the rect from full-cell size toward zero. `fill(rcol())` (L73)
  picks a fresh random palette colour; one of four corner-anchored `rect()` calls (L92/95/100/103) draws
  a rectangle of size `sw*v × sh*v` flush to a random corner. `stroke(0)` weight `2` (L66-67) outlines
  every rect.
- `rcol()` (L124-126) returns `colors[int(random(colors.length))]` — uniform random from the 7-colour
  list (L122). `getColor*` (L128-138, lerp-based) is defined but never called.
- Randomness enters only via `random()` after the seed; there is no noise field and no animation —
  `draw()` (L34-36) never calls `generate()` again, so the image is static.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_4 | `int cc = int(random(4, 9*random(1)));` -> `int cc = 4;` | large | coarser 4×4 grid; individual cells and rects are much bigger, sparser field | variants/cc_4/frame_00001.png |
| cc_8 | `int cc = int(random(4, 9*random(1)));` -> `int cc = 8;` | large | finer 8×8 grid; more, smaller cells; denser, busier mosaic | variants/cc_8/frame_00001.png |
| div_20 | `int div = 10;//...` -> `int div = 20;` | large | same cell size but twice the nested sub-rects per cell; much busier, more overlapping black outlines | variants/div_20/frame_00001.png |
| strokeWeight_6 | `strokeWeight(2);` -> `strokeWeight(6);` | subtle | only the black outlines thicken; layout, colours and rect sizes unchanged | variants/strokeWeight_6/frame_00001.png |
| rnd_0 | `int rnd = 1;//...` -> `int rnd = 0;` | moderate | rects replaced by quarter-circle arcs; rounded petal/leaf shapes instead of blocky squares | variants/rnd_0/frame_00001.png |

## Modularisation notes
- Generic: the `nestedCell` idea (a grid cell filled with N shrinking corner-anchored rects, each a
  random palette colour, with a per-rect skip probability) is a self-contained library function taking
  `(x, y, w, h, layers, skipProb, palette, strokeW, strokeColor)`.
- One-off art decisions: the specific 7-colour palette, the fixed `rnd = 1` (rects only, arcs disabled),
  the `0.5` skip probability, and the coarse 4-8 grid size.
- Clean parameter object: `{gridN (4-8), layers (div, 10), skipProb (0.5), palette[], strokeW (2),
  strokeColor (0), shape: "rect"|"arc"}`. The `rnd` variable already parameterises shape
  (`0` = quarter-arc corners, `1` = rects) and is a natural exposed knob.
