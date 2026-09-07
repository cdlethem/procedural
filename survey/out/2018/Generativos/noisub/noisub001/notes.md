---
sketch: 2018/Generativos/noisub/noisub001
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1555
animated: false
techniques: [subdivision, grid, packing]
primitives: [rect]
palette:
  colors: ["#DAAC80", "#FCC9D2", "#FC2E1D", "#235F3F", "#02272D"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(Rect[] initial, int iterations) -> Rect[]", note: "start from a coarse grid, repeatedly pick a random rect and split into 4 equal quads, append children"}
  - {name: fillRects, signature: "fillRects(Rect[] rects, ColorPicker, float inset) -> void", note: "draw each rect with a per-cell color and a 1px inset gap"}
---

## What it draws
A full-bleed 960×960 square divided into a 5×5 grid that has been recursively quartered many times, so cells range from large monochrome squares down to very fine clusters of tiny squares. Each cell is filled with one flat colour from a 5-colour palette (tan, dark green, bright red, pale pink, very dark teal) and a light grey (252) background shows through the 1-pixel gaps, giving a thin grid of lines between cells. Some cells stay large and solid (e.g. the big green square top-left, the large tan and pink squares), while others are broken up into dense, busy patches of small squares. The overall impression is a mottled Mondrian-like grid with patches of fine texture.

## How the code works
`setup()` (noisub001.pde:3-9) sizes the canvas to 960×960 in P2D, then calls `generate()` once; `draw()` (line 11-12) is empty so the sketch is static. Randomness is seeded from `seed` (line 1, set by the harness to 42) via `randomSeed`/`noiseSeed` (lines 39-40). `noiseDetail(2, 0.45)` (line 43) and `detSize`/`desSize` (lines 44-45) are set but the noise field is never actually sampled, so they have no visual effect.

The grid: `cc = 5` (line 49) and `ss = width/cc` (line 50); the double loop (lines 51-55) creates the initial 5×5 = 25 rects each `ss`×`ss`. Subdivision: `sub = 1000` (line 57); the loop (lines 58-67) picks a random rect index, splits that rect into 4 equal quadrant rects (`mw = r.w*0.5`, lines 61-62), and appends the 4 children to the same list, so the list grows and smaller rects become more likely to be picked again (richer detail accumulates).

Drawing: the final loop (lines 69-73) fills each rect with `rcol()` and draws `rect(r.x+1, r.y+1, r.w-2, r.h-2)` — the +1/-2 inset creates the 1px gap through which the 252-grey background shows. Colour is chosen by `rcol()` (lines 97-99): a uniform random pick from the fixed 5-colour array (line 96). `getColor`/`lerpColor` (lines 100-108) and `arc2` (lines 76-94) are defined but never called. No blend modes or transforms are used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The generic, reusable blocks are the quadtree subdivision (pick a random rect, split into 4, repeat N times) and the flat-colour fill with a 1px inset gap — both are art-agnostic and parameterizable. The one-off art decisions are the 5-colour palette, the 5×5 initial grid, and the fixed `sub = 1000` iteration count. The unused noise field, `arc2`, and `getColor`/lerp helpers are dead code that should be dropped. A clean parameter object would hold: initial grid count `cc`, subdivision iterations `sub`, inset `gap`, the colour list, and the seed.
