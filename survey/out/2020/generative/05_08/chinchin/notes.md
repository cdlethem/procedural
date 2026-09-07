---
sketch: 2020/generative/05_08/chinchin
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]   # imported (SimplexNoise, triangulate.*) but never used in code
deterministic: true
ms_first_frame: 1626
animated: false
techniques: [grid, packing]
primitives: [rect, shape]
palette:
  colors: ["#F9F7F7", "#F94D32", "#500C02", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 768, tried: [256, 2304], change: large, effect: "fewer = coarser, chunkier mosaic; 3x more = denser busier overlaps"}
  - {name: cellDivisions, default: 32, tried: [16], change: large, effect: "ss = width/N; lower N = coarser grid, visibly larger tiles"}
  - {name: gradientAlphaMax, default: 140, tried: [255], change: subtle, effect: "alp = random(20, random(40, X)); no visible change at a glance"}
  - {name: sizeMax, default: 10, tried: [14], change: large, effect: "s = int(random(1, random(5, X))); larger squares dominate, coarser texture"}
  - {name: outlineProb, default: 0.125, tried: [0.5], change: large, effect: "thin outlined squares become a dense web over the mosaic"}
reusable_candidates:
  - {name: gradientSquare, signature: "gradientSquare(x, y, size, cornerColor, alpha) -> void", note: "axis-aligned square whose two opposite corners fade from colour to transparent via a 4-vertex fill-gradient quad (the 'soft corner' look)"}
  - {name: snapToGrid, signature: "snap(v, cell) -> float", note: "v - v % cell; aligns random positions to a uniform grid so squares tile without gaps/overlaps at cell boundaries"}
  - {name: edgeHalo, signature: "edgeHalo(x, y, size, alpha) -> void", note: "four trapezoid wings off a rect's edges fading from fill(0, alpha) to transparent; soft dark bleed between tiles"}
---

## What it draws
A full-bleed mosaic of flat, grid-aligned squares in off-white, bright red-orange, dark maroon and
black, densely packed over the whole 960×960 canvas. Many squares carry a soft diagonal fade: two
opposite corners are a translucent version of the square's colour while the other two are transparent,
so each reads as a lit corner or a folded card. Some squares contain a smaller centred square of a
different palette colour, and a few have a thin single-colour outline square (sometimes much larger
than the filled square, spilling into neighbours). The overall impression is a pixelated,
half-tone-like red-and-white poster made of slightly "beveled" tiles.

## How the code works
`setup()` calls `generate()` once; `draw()` is a no-op, so the piece is static (confirmed: frames 10
and 60 are identical to frame 1). `randomSeed(seed); noiseSeed(seed)` (lines 53–54) make it
deterministic for seed 42.

1. Cell size: `ss = width/32` (line 59) = 30 px; every square is snapped to this grid with
   `x -= x%ss; y -= y%ss` (lines 64–65), so all squares share edges.
2. Main loop (line 60) draws 768 squares (`128*6`). Each: random grid-aligned position; side length
   `s` cells with `s = int(random(1, random(5, 10)))` (line 63, i.e. 1–9 cells, biased small).
3. "Soft corner" gradient (lines 68–133): one `beginShape(QUAD)` per square with per-vertex
   `fill(col, alpha)` changes. One of two corner orientations is chosen (line 75, 50/50). Two
   opposite corners get `fill(col, 0)` (transparent) and the other two `fill(col, alp)` with
   `alp = random(20, random(40, 140))` (line 71). Processing interpolates the vertex colours across
   each triangle, giving the diagonal fade from the lit corner into transparency.
4. Dark edge shading (lines 106–132): the same quad continues with four trapezoid "wings" off each
   edge, filled `fill(0, 40)` fading to `fill(0, 0)` over 0.4–1.4× the square size — faint black
   gradients bleeding beyond each square's edges, adding soft dark halos between tiles.
5. Solid fill (line 137): `rect(x, y, ss*s, ss*s)` in `rcol()` — a random colour from the 4-colour
   list (line 166, `rcol()` at line 171). This sits on top of the gradient, so the gradient only
   shows around/under it as corner glow.
6. Inset square (lines 139–142): with 25% probability a centred half-size square in another random
   palette colour.
7. Outline square (lines 144–149): with 12.5% probability a stroked, unfilled square of side
   `ss*s*2.5` (larger than the filled one) and weight `ss*s*0.03` (line 147) — the thin frames
   crossing multiple tiles.

Background is also `rcol()` (line 56). No noise, no transforms, no blend modes; `smooth(8)`,
`DISABLE_DEPTH_TEST` (line 49). The `SimplexNoise` and `triangulate` imports are dead — the gradient
effect is pure per-vertex fill interpolation, not the triangulate library.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_256 | `for (int k = 0; k < 128*6; k++) {` -> `for (int k = 0; k < 128*2; k++) {` | large | coarser, chunkier mosaic: fewer, larger flat tiles; big black/white/maroon regions, fewer outlines | variants/count_256/frame_00001.png |
| count_2304 | `for (int k = 0; k < 128*6; k++) {` -> `for (int k = 0; k < 128*18; k++) {` | large | denser, busier: 3x more squares, more small fragments and overlapping layers | variants/count_2304/frame_00001.png |
| cell_16 | `float ss = width/32;` -> `float ss = width/16;` | large | coarser 60px grid: visibly larger tiles, chunkier blocks, same gradient look | variants/cell_16/frame_00001.png |
| alpha_255 | `float alp = random(20, random(40, 140));` -> `float alp = random(20, random(40, 255));` | subtle | no visible change; corner fades at most marginally stronger | variants/alpha_255/frame_00001.png |
| size_14 | `int s = int(random(1, random(5, 10)));` -> `int s = int(random(1, random(8, 14)));` | large | larger squares dominate; coarser texture, fewer small fragments | variants/size_14/frame_00001.png |
| outline_0.5 | `if (random(1) < 0.125) {` -> `if (random(1) < 0.5) {` | large | thin outlined squares form a dense web of frames across the whole canvas | variants/outline_0.5/frame_00001.png |

Note: every substitution shifts the downstream random stream, so the `large` scores are partly
resampling; the density/scale differences above still match the parameter that was changed.

## Modularisation notes
Generic, reusable: `snapToGrid`; `gradientSquare` (corner-fade tile); the dark edge-wing gradient
block (soft halo around a rect) is also reusable as `edgeHalo(x, y, size, alpha)`; `rcol()`
(random-from-list) is a trivial palette helper worth keeping as a shared utility.
One-off art decisions: the exact 768 count and 32-division cell, the double-`random` bias in `s`,
the 25%/12.5% decoration probabilities, the 2.5× oversize outline, and the fixed 4-colour
red/white/black palette. A clean parameter object would be: `{cellDivisions (32), count (768),
sizeRange ([1, 10]), gradientAlpha ([20, 140]), edgeHaloAlpha (40), insetProb (0.25),
insetScale (0.5), outlineProb (0.125), outlineScale (2.5), outlineWeight (0.03), palette []}`.
