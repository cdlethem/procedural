---
sketch: 2018/Generativos/poop
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2109
animated: false
techniques: [subdivision, grid]
primitives: [rect]
palette:
  colors: ["#AECDEC", "#D098F9", "#3A3569", "#FFC300", "#FD3537"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: randomRectSubdivision, signature: "randomRectSubdivision(seed, x, y, w, h, iterations) -> Rect[]", note: "randomly split rectangles until leaf set forms a Mondrian-like tiling"}
  - {name: concentricInsets, signature: "concentricInsets(x, y, w, h, step, colorA, colorB) -> void", note: "paint a rect with nested alternating insets"}
---

## What it draws
A full-bleed Mondrian-style tiling on a black background: the canvas is split into
many axis-aligned rectangles of very different sizes, and each rectangle is filled
with tight concentric nested rectangles (insets) that alternate black with one flat
color. The overall impression is a grid of glowing wireframe panels in pale blue,
orchid purple, dark indigo, yellow, and red, with small sliver rectangles between
the big panels.

## How the code works
`setup()` (poop.pde:3) creates a 3250x3250 P2D window and calls `generate()` once;
the sketch is static (draw() is empty).

`generate()` (poop.pde:34):
1. Seeding: a fresh integer seed is drawn and `randomSeed(seed)` is called (line 35-36).
2. Background black (line 37). A faint grid of 2x2 dots every `sep = 20` px is drawn
   at `fill(220, 40)` (lines 39-48) — barely visible against black.
3. Subdivision: start with one cell covering the canvas in *cell units*
   (`cw = width/sep`, `ch = height/sep`, line 40-41, 51). Then `sub = int(random(400))`
   times (line 52): pick a random rect, choose horizontal or vertical split with 50/50
   (`random(1) < 0.5`, line 56), split at a random interior position, and replace it by
   the two halves (lines 60-71). The commented-out block (57-59) would have forced
   splits along the long side.
4. Painting (lines 74-87): for every leaf rect, one random palette color `col` is
   chosen via `rcol()` (line 97-99, picks from `colors[]`, line 95). Then `ss = 3`
   nested insets: for `j = 0..min(r.w,r.h)*sep*0.5/ss`, fill black on even j, `col` on
   odd j, and draw `rect(r.x*sep + ss*j, r.y*sep + ss*j, r.w*sep - ss*2*j,
   r.h*sep - ss*2*j)` (line 85). This is what produces the concentric rings; the
   minimum ring spacing is 3 px, so tall thin rects become dense black-and-color
   hatching.

Randomness enters at the split count, the split orientation, the split position, and
the per-rect color. No noise, no transform, no blend modes; plain P2D rect fills.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, library-ready: the recursive random rect subdivision (Mondrian tiling) is a
  clean function of (seed, cell, iteration count, orientation bias) and is the core
  reusable algorithm. The concentric-inset painter (step size + two colors) is a second
  generic primitive, independent of the tiling.
- One-off art decisions: the 20 px cell / 3 px inset step (they fix the "wireframe"
  density), the 5-color palette, the black alternate color, and the faint background
  dot grid (barely visible; decorative).
- Clean parameter object: `{seed, cell, subdivisions, orientationBias, insetStep,
  palette, alternateColor, background}`.
