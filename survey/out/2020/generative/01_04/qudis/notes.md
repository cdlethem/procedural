---
sketch: 2020/generative/01_04/qudis
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate, peasy]
deterministic: true
ms_first_frame: 1524
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#EE371D", "#4F4EB7", "#1C1E4E", "#EC3789", "#E7CCB2"]
  selection: random-from-list
composition: margins
parameters:
  - {name: bb, default: 20, tried: [0], change: large, effect: "margin width; 0 = full bleed, grey border gone"}
  - {name: hSplits, default: "int(random(20))", tried: ["int(random(200))"], change: large, effect: "count of vertical bisections; more = dense thin vertical strips dominate"}
  - {name: vSplits, default: "int(random(60))", tried: ["int(random(6))"], change: large, effect: "count of horizontal bisections; fewer = big chunky bands, coarser blocks"}
  - {name: ghostAlpha, default: "random(255)", tried: [0], change: large, effect: "alpha of offset ghost layer; 0 = clean flat rects (also shifts downstream random sequence)"}
  - {name: lineProb, default: 0.1, tried: [1.0], change: large, effect: "per-rect chance of 1px left-edge line; 1.0 = line on every rect"}
  - {name: colors, default: "5-color (#EE371D,#4F4EB7,#1C1E4E,#EC3789,#E7CCB2)", tried: ["3 gray (#0F0F0F,#7C7C7C,#4C4C4C)"], change: large, effect: "grayscale palette; same composition, monochrome Bauhaus look, layout unchanged"}
reusable_candidates:
  - {name: randomBisectRects, signature: "randomBisectRects(rect, hSplits, vSplits) -> Rect[]", note: "randomly bisect a rect list, width then height, 40-60% split ratios"}
  - {name: nestedCellGrid, signature: "nestedCellGrid(x, y, w, h, cw, ch, cw2, ch2, colorFn, gapFrac=0.1) -> void", note: "two-level grid of inset rects inside a cell, gap as fraction of cell size"}
---

## What it draws
A Bauhaus/Mondrian-style flat composition that fills the canvas inside a thin light-grey
margin: a field of nested rectangles in five colours (vermilion red, violet-blue, dark navy,
magenta-pink, cream) over an off-white background. The canvas is broken into irregular
vertical strips and horizontal bands of very different widths; many cells are further
tessellated into small uniform grids of inset squares, and a few cells are plain slabs.
Some rectangles carry a slightly offset semi-transparent ghost copy, giving a soft
misregistration look, and a sparse set of 1px vertical accent lines.

## How the code works
`setup()` calls `generate()` once (line 26); `draw()` is a no-op, so the piece is static.
`generate()` (line 60):
- Seeded via `randomSeed(seed)`/`noiseSeed(seed)` (lines 68-69), `background(250)` (line 71).
- Starts from one rect inset by `bb = 20` from the canvas edges (lines 75-76).
- Horizontal pass: `int sub = int(random(20))` random bisections of the width of a
  randomly chosen rect into 40-60% parts (lines 78-85) -> irregular vertical strips.
- Vertical pass: `sub = int(random(60))` random bisections of the height (lines
  87-94) -> irregular horizontal bands.
- Draw loop (lines 97-109), `noStroke()`: for each rect it paints (a) an offset
  "ghost" copy filled with `rcol()` at random alpha `random(255)`, shifted by
  `int(random(-2,2))*des` where `des = random(min(r.w, r.h))` (lines 99-101) - the
  misregistration effect; (b) the solid rect in a random palette colour `rcol()`
  (lines 102-103); (c) `grid(...)` (line 104) with random 2x2 to 8x8 cells and a
  further random nested sub-grid (cw2 x ch2) - the small tessellated squares.
- `grid()` (lines 118-142) draws each cell as an inset rect (gap = 10% of cell size)
  in a random colour, then repeats the same at the finer level.
- With probability 0.1 a 1px-wide full-height line is added on the rect's left edge
  (lines 105-108).
- Colour: `rcol()` (line 159) picks uniformly at random from the 5-colour array
  (line 155); `getColor()`/lerp variants (lines 163-173) are defined but unused.
- Imports (triangulate, toxi SimplexNoise, PeasyCam) are unused in the code path;
  the P3D renderer is only needed because the sketch declares it.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| bb_0 | `float bb = 20;` -> `float bb = 0;` | large | no light-grey margin: composition runs edge to edge; structure otherwise same | variants/bb_0/frame_00001.png |
| subH_200 | `int sub = int(random(20));` -> `int sub = int(random(200));` | large | far more vertical bisections: dense thin vertical strips dominate, wide blocks mostly gone | variants/subH_200/frame_00001.png |
| subV_6 | `sub = int(random(60));` -> `sub = int(random(6));` | large | few horizontal bisections: large chunky bands and coarser blocks, less banding | variants/subV_6/frame_00001.png |
| ghost_alpha_0 | `fill(rcol(), random(255));` -> `fill(rcol(), 0);` | large | ghost layer gone: clean flat rects, no offset misregistration; layout also differs (dropping the random() call shifts the downstream sequence) | variants/ghost_alpha_0/frame_00001.png |
| lineProb_1.0 | `if (random(1) < 0.1) {` -> `if (random(1) < 1.0) {` | large | 1px left-edge line on every rect: dense vertical accents throughout; layout also differs (extra rcol() calls shift the sequence) | variants/lineProb_1.0/frame_00001.png |
| palette_gray | `int colors[] = {#EE371D, #4F4EB7, #1C1E4E, #EC3789, #E7CCB2};` -> `int colors[] = {#0F0F0F, #7C7C7C, #4C4C4C};` | large | same composition in 3-color grayscale (near-black/mid/light grey); layout identical to baseline since the random-call count is unchanged | variants/palette_gray/frame_00001.png |

Note: first attempt at subV_6 failed with `bad_sub` (OLD quoted as `int sub = int(random(60));`, but line 87 is `sub = int(random(60));` with no `int`); retried once with the correct text.

## Modularisation notes
- `randomBisectRects` (lines 74-94): fully generic - a rect list, two pass counts, a
  split-ratio range. Reusable as a layout primitive for any grid/panel composition.
- `nestedCellGrid` (lines 118-142): generic two-level inset grid; the gap fraction
  (0.1) and the per-cell colour function are its only knobs.
- Art-specific decisions to keep in a parameter object: the 5-colour palette +
  uniform random selection, the ghost-offset layer (des magnitude, alpha range),
  the 20px margin, the 0.1 thin-line probability, and the split-count ranges
  (20 / 60) that set strip density. A clean parameter object would be
  {palette, margin, hSplits, vSplits, splitRange:[0.4,0.6], ghost:{on, alpha, jitter},
  gridDensities:[cw,ch,cw2,ch2], lineProb, background}.
