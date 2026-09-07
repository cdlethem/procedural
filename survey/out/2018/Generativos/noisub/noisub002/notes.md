---
sketch: 2018/Generativos/noisub/noisub002
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1492
animated: false
techniques: [grid, subdivision]
primitives: [rect]
palette:
  colors: ["#DAAC80", "#FCC9D2", "#FC2E1D", "#235F3F", "#02272D"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: 5, tried: [3], change: large, effect: "coarser base tiling: 3x3 base cells, larger flat monochrome blocks"}
  - {name: sub, default: 1000, tried: [200, 3000], change: large, effect: "lower = big monochrome cells persist, shallower clusters; higher = finer, busier clusters"}
  - {name: palette[2], default: "#FC2E1D", tried: ["#1D4ED8"], change: subtle, effect: "red-orange fills become royal blue, geometry unchanged"}
  - {name: rectInset, default: 1, tried: [0], change: subtle, effect: "off-white seams become thin dark hairlines; sub-2px rects become visible"}
  - {name: noiseDetail, default: "2, 0.45", tried: ["8, 0.9"], change: none, effect: "no effect: noise() is never sampled; 'noisub' is a misnomer"}
reusable_candidates:
  - {name: randomQuadSubdivision, signature: "randomQuadSubdivision(baseRects, iterations) -> Rect[]", note: "repeatedly pick a random rect, append its 4 quadrants (originals kept, so hierarchy accumulates)"}
  - {name: insetRectGrid, signature: "insetRectGrid(rects, inset, palette) -> void", note: "draw each rect inset by 1px so the background shows as seams; fill = random palette pick"}
---

## What it draws
A full-bleed 5×5 grid of squares, many of which are recursively split into quadrant
squares of progressively smaller sizes. Every square is filled with a flat colour from a
five-colour palette (dark green, tan, pink, red-orange, very dark teal) and the squares
are separated by thin off-white seams. Some cells stay as one large colour block while
neighbours subdivide into dense clusters of tiny squares, giving an uneven mix of blocky
and busy regions.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (noisub002.pde:3-12).
- Seeding: `randomSeed(seed); noiseSeed(seed)` (lines 39-40); background is off-white `252` (line 42).
- Base grid: `cc = 5` (line 49) builds a 5×5 list of `Rect`s of size `width/5` (lines 50-55).
- Subdivision: `sub = 1000` iterations (line 57): each picks a random rect from the growing list,
  splits it into 4 equal quadrants and appends them (lines 58-67). The original is *kept* in the
  list, so large cells are drawn first and their children overdraw them — that is what creates the
  nested scale hierarchy.
- Drawing: each rect is drawn inset by 1px, `rect(r.x+1, r.y+1, r.w-2, r.h-2)` (line 72), which lets
  the off-white background show as seams between squares; rects with `w-2 <= 0` vanish.
- Colour: `rcol()` (lines 96-99) picks a random entry from the 5-colour array; independent of
  position or size. Note the colour stream depends on `sub` (RNG state at draw time), so changing
  `sub` re-rolls all colours, not just the geometry.
- Decoys: `noiseDetail(2, 0.45)` (line 43) is set but `noise()` is never sampled; `detSize`/`desSize`
  (lines 44-45) are computed and never used — despite the "noisub" name, subdivision is purely
  random, not noise-driven. `arc2()` (lines 76-94) is dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_3 | `int cc = 5;` -> `int cc = 3;` | large | 3×3 base tiling: noticeably larger flat blocks (up to ~320px) replace the 192px ones; busy clusters persist | variants/cc_3/frame_00001.png |
| sub_200 | `int sub = 1000;` -> `int sub = 200;` | large | far fewer subdivisions: big monochrome cells persist, clusters are shallow with visible mid-size squares where baseline had fine fragmentation | variants/sub_200/frame_00001.png |
| sub_3000 | `int sub = 1000;` -> `int sub = 3000;` | large | denser, finer clusters of tiny squares; a few large monochrome cells still remain; busier overall than baseline | variants/sub_3000/frame_00001.png |
| palette_blue | `#FC2E1D` -> `#1D4ED8` in `colors[]` | subtle | geometry identical; the red-orange squares are now royal blue (11.3% of pixels differ) | variants/palette_blue/frame_00001.png |
| gap_0 | `rect(r.x+1, r.y+1, r.w-2, r.h-2);` -> `rect(r.x, r.y, r.w, r.h);` | subtle | off-white seams gone; thin dark hairlines appear between adjacent fills (P2D antialiasing), and sub-2px rects that were invisible now show | variants/gap_0/frame_00001.png |
| noiseDetail_8_0.9 | `noiseDetail(2, 0.45);` -> `noiseDetail(8, 0.9);` | none | no visible change; frame is pixel-identical to baseline (same md5) — confirms noise is never used | variants/noiseDetail_8_0.9/frame_00001.png |

## Modularisation notes
- Generic: the random quad-subdivision loop (lines 57-67) is a self-contained, parameterised
  operation on a rect list — good candidate for a library function `randomQuadSubdivision(rects, n)`
  (keep-originals vs replace-original is a natural option flag).
- Generic: inset rect drawing with random palette fill (lines 69-73 + `rcol`) is a trivial
  renderer that any tiling/subdivision sketch can share.
- One-off art decisions: the 5-colour palette, `cc = 5` base grid, 1px inset, off-white background.
- The `noiseDetail`/`detSize` lines are vestigial (this is a sibling of a noise-driven variant);
  a clean parameter object would be `{gridN, iterations, palette, inset, keepParents}` and nothing
  noise-related.
