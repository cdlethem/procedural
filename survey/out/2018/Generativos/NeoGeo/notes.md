---
sketch: 2018/Generativos/NeoGeo
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2423
animated: false
techniques: [subdivision, grid, curves, typography]
primitives: [rect, shape]
palette:
  colors: ["#E70012", "#D3A100", "#017160", "#00A0E9", "#072B45"]
  selection: fixed
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(canvasRect, iterations) -> Rect[]", note: "iteratively pick a random rect, split into 4 with random 0.4-0.6 ratios, replace it"}
  - {name: waveBand, signature: "waveBand(rect, freq, horizontal) -> vertices", note: "1px-stepped cosine band (cos(freq*j)) closed into a filled shape, dense stripe texture"}
  - {name: logoStamp, signature: "logoStamp(shape, rect, amp) -> placed PShape", note: "center a PShape at random 0.7-0.9 scale with random grayscale fill"}
---

## What it draws
A full-bleed black-and-white mosaic on a light background. The canvas is chopped into
irregular rectangles of wildly different sizes: a few huge tiles (top-left and right half
show the "NEO GEO" wordmark at poster scale) and one heavily subdivided region (bottom-left)
of dozens of tiny tiles, each carrying a miniature wordmark. Inside most tiles a white or
black wavy band with a dense comb-like stripe texture runs horizontally or vertically, and
the bold rounded NEO GEO wordmark is stamped at each tile's centre in black (occasionally
white). The look is a brutalist, Mondrian-meets-halftone typographic poster.

## How the code works
Single tab, P2D, 3250x3250, all work in `setup()` -> `generate()`; `draw()` is empty so the
piece is static (frames 10/60 identical in baseline).

1. `generate()` (NeoGeo.pde:40) paints `background(250)` and seeds a list with one rect
   covering the whole canvas (line 46).
2. Subdivision loop (lines 48-64): `sub = int(random(400)*random(1))` iterations. Each pass
   picks a random existing rect, splits it into four with random ratios
   (`nw = r.w*random(0.4, 0.6)`, `nh = r.h*random(0.4, 0.6)`, lines 57-58), appends the four
   children and removes the parent. It's an iterative quadtree: some regions are split many
   times (the tiny-tile mosaic) while others are never picked (the giant tiles). The
   commented-out `sep` guard (line 52) once prevented sub-128px tiles; it's off, so tiles can
   become arbitrarily small.
3. Rendering pass (lines 66-93): for every final rect it draws a black `rect` with a barely
   visible stroke (`stroke(0, 10)`, alpha 10). Over that it fills a white shape built by
   stepping `j` in 1px increments along the width (horizontal mode, 50/50 with vertical) and
   plotting `yy = (cos(freq*j)*0.5+0.5)*r.h` (lines 77-81); `freq = random(random(5), 20)`
   (line 73) sets the oscillation rate, and the 1px sampling makes the dense comb/stripe
   texture seen in the image. `endShape(CLOSE)` closes the band to a filled region.
4. Logo stamp (lines 90-92): the `NEOGEO.svg` PShape (loaded line 10) is filled with
   `color(int(random(1.1))*255)` — effectively always black, rarely white — and placed at the
   tile centre at `amp = random(0.7, 0.9)` of the tile size, so the wordmark scales with each
   tile.
5. Randomness enters only through the `random()` calls (harness pins the seed). The 5-colour
   array (lines 101-114: #E70012, #D3A100, #017160, #00A0E9, #072B45) and its
   `rcol()`/`getColor()` helpers are dead code — never called from `generate()`; the image is
   monochrome despite the palette existing in the file.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **quadtreeSplit** (lines 45-64) is fully generic: canvas rect + iteration count -> final
  rects. Parameters worth exposing: iteration count, ratio range (0.4, 0.6), and the
  (currently commented) minimum-tile-size guard.
- **waveBand** (lines 73-88) is generic: rect + frequency + orientation -> filled 1px-sampled
  cosine band. `freq` controls stripe density; orientation is a coin flip.
- **logoStamp** (lines 90-92) is the one-off art decision: a specific brand PShape at
  0.7-0.9 scale with grayscale fill. As a library function it becomes "stamp a PShape
  centred in a rect at random scale with a random fill".
- A clean parameter object: `{size, iterations, splitRange, minTile, freqRange, logoScale,
  logoFill, background, strokeAlpha}`. The dead 5-colour palette is an obvious unused
  extension point — swapping the grayscale logo fill for `getColor()` would recolour the piece
  without touching geometry.
