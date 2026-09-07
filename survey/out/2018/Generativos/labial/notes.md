---
sketch: 2018/Generativos/labial
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1496
animated: false
techniques: [subdivision]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#FF4B00", "#FFC500", "#00DEB5", "#3030D0", "#FF97D6", "#FFFFFF", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(30))", tried: [8, 25], change: large, effect: "fewer splits (8) = coarser, larger flat blocks; more splits (25) = finer, busier mosaic of many small cells"}
  - {name: decorationScale, default: 0.2, tried: [0.5], change: moderate, effect: "larger corner squares/triangles and centre marks; block layout unchanged"}
  - {name: cellSkipProb, default: 0.4, tried: [0.9], change: moderate, effect: "most cells skipped -> more black ground showing, sparser colored cells"}
  - {name: splitRatio, default: "random(0.4,0.6)", tried: ["random(0.85,0.95)"], change: large, effect: "very uneven splits -> thin slivers/bands plus a few large blocks"}
reusable_candidates:
  - {name: subdivideRect, signature: "subdivideRect(rect, iterations, splitMin, splitMax, rng) -> rect[]", note: "recursive binary space partition that tiles the canvas with axis-aligned leaf rects, no gaps"}
  - {name: decorateRect, signature: "decorateRect(rect, scale, palette, rng) -> void", note: "random corner squares + corner right-triangles + centre square + centre dot on one leaf cell"}
---

## What it draws
The canvas is tiled edge-to-edge by axis-aligned rectangles in a bright palette (pink, orange,
yellow, teal, blue, white) over a black ground, partitioned by a random recursive halving. Many
cells stay flat colour; others carry small decorative squares and right-triangles in their corners,
a small square in the centre, and a tiny dot. With seed 42 a large pink block fills the lower half
while a cluster of black, teal, orange and blue cells occupies the top third.

## How the code works
Single tab `labial.pde`. `setup()` (L3) opens a 960x960 P3D window, `smooth(8)`, `pixelDensity(2)`,
then calls `generate()`. `draw()` (L13) is empty, so the image is static.

`generate()` (L35): `background(0)` black (L36). Seeds a list with the full-canvas rect (L38-39).
`sub = int(random(30))` iterations (L41-57): each picks a random rect, splits it horizontally or
vertically at a random point between 0.4-0.6 (L46-54), removes the original and adds the two halves
(L48-53, L56). After `sub` splits the list holds the leaf rectangles that tile the canvas.

Draw loop (L59-99): `noStroke()`. Each leaf is skipped with 40% probability (L61). A drawn leaf is
filled with a random palette colour (`rcol()`, L107-111) as a full rect (L63-64). A small scale
`ss = min(r.w, r.h)*0.2` (L66); up to four corner squares (L69-80) and four corner right-triangles
(L83-94) are each drawn with 50% probability; a centred small square (L95-96) and a tiny centred
ellipse (L97-98) are always drawn, each in a fresh random colour.

Randomness enters through the `seed` field, the split count, split side/ratio, the per-cell 40% skip,
and the per-decoration 50% gates; colour is a uniform random pick from the 7-colour list (L107).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_25 | `int sub = int(random(30));` -> `int sub = 25;` | large (0.913 px) | much finer, busier mosaic of many small cells; lots of black gaps from skipped cells | variants/sub_25/frame_00001.png |
| sub_8 | `int sub = int(random(30));` -> `int sub = 8;` | large (0.657 px) | coarser: fewer, larger flat blocks; one big pink field dominates | variants/sub_8/frame_00001.png |
| ss_0.5 | `float ss = min(r.w, r.h)*0.2;` -> `... *0.5;` | moderate (0.332 px) | same block layout, but corner squares/triangles and centre marks are much bigger | variants/ss_0.5/frame_00001.png |
| skip_0.9 | `if (random(1) < 0.4) continue;` -> `< 0.9` | moderate (0.185 px) | most cells skipped: more black ground, sparser colored cells | variants/skip_0.9/frame_00001.png |
| ratio_0.85 | both split lines `random(0.4,0.6)` -> `random(0.85,0.95)` | large (0.673 px) | very uneven splits: thin horizontal/vertical bands and slivers plus a few large blocks | variants/ratio_0.85/frame_00001.png |

## Modularisation notes
Generic and reusable: the recursive rectangular subdivision (BSP) that tiles the canvas with no
gaps - `subdivideRect` above is a clean library primitive. The corner-decoration pass (squares and
right-triangles at the four corners plus a centre square and dot) is reusable as `decorateRect`.

One-off art decisions: the exact 7-colour palette (L107), the 0.4-0.6 split window (L47, L51), the
0.2 decoration scale (L66), the 40% cell-skip (L61) and 50% corner gates (L69-94), and the always-on
centre square/dot.

A clean parameter object for this sketch would contain: `{subdivisions, splitMin, splitMax,
decorationScale, cellSkipProb, cornerProb, palette}`.
