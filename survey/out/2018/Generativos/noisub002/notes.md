---
sketch: 2018/Generativos/noisub002
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1506
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#DAAC80", "#FCC9D2", "#FC2E1D", "#235F3F", "#02272D"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 5, tried: [3, 8], change: large, effect: "fewer start cells = fewer, larger flat blocks; more = denser, finer tiling"}
  - {name: sub, default: 1000, tried: [300, 3000], change: large, effect: "fewer subdivisions = coarser larger squares; more = finer, busier dust"}
  - {name: gap, default: 1, tried: [0], change: subtle, effect: "removing 1px inset removes white grid lines; blocks touch edge-to-edge"}
reusable_candidates:
  - {name: quadtreeFill, signature: "quadtreeFill(gridN, subdivisions, gap, colorFn) -> void", note: "recursively quarter-subdivide a grid and fill leaves with a random color"}
---

## What it draws
A full-bleed Mondrian-style tiling. The 960×960 canvas is divided into a 5×5 grid, and each cell is recursively quarter-subdivided many times, producing a dense patchwork of squares of wildly different sizes. Every square is filled with one of five flat colors (tan, pink, red, forest green, dark teal), separated by thin white gaps where the off-white background shows through. The overall effect is a busy, high-contrast abstract composition with a few large color blocks interspersed with fine clusters of tiny squares.

## How the code works
- `setup()` (line 3–9): sets a 960×960 P2D canvas, `smooth(8)`, then calls `generate()` once. `draw()` is empty (line 11–12), so the sketch is static.
- `generate()` (line 37–74):
  - Seeds both `random` and `noise` with the same seed (lines 39–40).
  - Paints the background near-white (`background(252)`, line 42).
  - Sets `noiseDetail(2, 0.45)` and computes `detSize` / `desSize` (lines 43–45), but **no noise call is ever made** — these values are unused.
  - Builds a 5×5 grid of `Rect` cells (`cc = 5`, `ss = width/cc`, lines 49–55).
  - Runs `sub = 1000` iterations (lines 57–67): each picks a **random** existing rect and splits it into four equal quarters, adding all four to the list. This is the recursive-subdivision step; randomness enters here via the random rect index.
  - Draws every rect (lines 69–73): fills with `rcol()` (a uniformly random palette entry, lines 97–99) and draws `rect(r.x+1, r.y+1, r.w-2, r.h-2)` — the 1px inset on each side creates the thin white gaps.
- Palette: five hard-coded hex colors (line 96), selected by uniform `random` in `rcol()`.
- The `arc2`, `getColor` helpers (lines 76–108) are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_3 | `int cc = 5;` -> `int cc = 3;` | large | coarser 3x3 start grid: much larger flat color blocks, fewer and more isolated clusters of tiny squares | variants/cc_3/frame_00001.png |
| cc_8 | `int cc = 5;` -> `int cc = 8;` | large | denser 8x8 start grid: finer, more even mix of medium and small blocks, busier overall | variants/cc_8/frame_00001.png |
| sub_300 | `int sub = 1000;` -> `int sub = 300;` | large | fewer subdivisions: coarser, larger squares dominate, far less fine "dust" | variants/sub_300/frame_00001.png |
| sub_3000 | `int sub = 1000;` -> `int sub = 3000;` | large | more subdivisions: finer, denser tiny squares, busier detail | variants/sub_3000/frame_00001.png |
| gap_0 | `rect(r.x+1, r.y+1, r.w-2, r.h-2);` -> `rect(r.x, r.y, r.w, r.h);` | subtle | removes the 1px inset: white grid lines vanish, blocks touch edge-to-edge | variants/gap_0/frame_00001.png |

## Modularisation notes
- **Generic / library candidate:** the quadtree subdivision loop (lines 57–67) plus the inset-rect draw (lines 69–73) is a self-contained "recursively quarter a grid and fill leaves" routine. A clean parameter object would be `{ gridN, subdivisions, inset, colorFn }`.
- **One-off art decisions:** the specific 5-color palette, the 1px inset, the 5×5 starting grid.
- **Dead code:** `noiseDetail`, `detSize`, `desSize`, `arc2`, `getColor` — none affect the output.
