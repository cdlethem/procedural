---
sketch: 2019/generativos/neja
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1597
animated: false
techniques: [grid, noise-field, dots-stippling]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#FEFDFD", "#FFA6C5", "#FC818F", "#A8BAFC", "#6398FE", "#2656D8", "#021D86", "#1F1D3E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 600, tried: [1200], change: large, effect: "denser: more overlapping squares, wedges and corner dots across the canvas"}
  - {name: grid, default: 60, tried: [120], change: large, effect: "doubles snap cell (30->60px) and size ladder (60..960 -> 120..1920): fewer, much larger flat blocks, sparser small details"}
  - {name: sizeExpMax, default: 5, tried: [3], change: large, effect: "caps max square at 240px (int(random(5)) -> int(random(3))): no giant blocks, uniform small/medium scale, much more background showing"}
  - {name: shadowAlpha, default: 40, tried: [120], change: subtle, effect: "offset dark shadow a bit heavier on individual squares; overall composition reads the same"}
  - {name: solidProb, default: 0.4, tried: [0.8], change: large, effect: "most squares become single solid colours; two-tone triangle splits nearly disappear, flatter blockier look"}
  - {name: snapToGrid, signature: "snapToGrid(x, y, cell) -> float[]", note: "snap a point down to a half-cell grid step (x -= x % cell)"}
  - {name: noiseGatedSize, signature: "noiseGatedSize(base, field, gain) -> float", note: "shrink a base size by sampled 2-D simplex noise: s - 2*int(noi*gain)"}
  - {name: paletteLerp, signature: "getColor(v) -> color", note: "index a palette list with a float, lerp between adjacent entries (lines 175-181)"}
---

## What it draws
A flat, Mondrian-ish collage of large squares and rectangles in pink, sky blue, deep blue and dark navy,
scattered over a dark navy background and overlapping with partial transparency. Some squares are split
into two triangles of different palette colours, a few carry small solid dots at their corners, and thin
outlined squares with faint fills mark a few spots. Small solid squares and tiny dots are sprinkled
across the canvas. The overall look is crisp, geometric, high-contrast.

## How the code works
`generate()` (line 43) seeds RNG and noise, fills the background with a random palette colour
(`rcol()`, line 169 picks uniformly from the 8-colour list at line 168), then runs two scatter loops.

Main loop (lines 62-122, 600 iterations): each iteration picks a random point (lines 63-64), a base size
`s = grid * 2^int(random(5))` so sizes are 60/120/240/480/960 px (line 66), and snaps the point down to a
30 px half-grid (lines 68-69). Simplex noise (`toxi`, line 71) at a random offset/detail (lines 51-52)
shrinks the drawn size: `ss = s - 2*int(noi*10)` (line 72). Per square it then stacks up to 4 layers:
a soft dark overlay `fill(0,40)` slightly offset by `dx=dy=8` (lines 76-77), a 20%-chance four-vertex
quad that fades from a palette colour to transparent, forming an angular wedge (lines 79-100), a 40%-chance
solid `rcol()` square, else a quad split into two triangles each filled with its own random palette colour
and alpha 120-255 (lines 102-114), and a small solid dot of diameter `ss*0.1` at the corner (lines
118-119). Transparency is the main visual device: everything is layered with alpha so overlaps read as
new colours.

Detail loop (lines 124-158, 20 iterations): smaller squares snapped to their own size, a 4%-chance faint
fill, a small solid rect, and a 10%-chance outlined square (`ss*4`) with faint fill and a dot — these are
the thin-outlined boxes visible in the baseline.

`draw()` only regenerates every 360 frames; with the harness seed the sketch is static (frames 10/60
identical to frame 1).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_1200 | `for (int i = 0; i < 600; i++)` -> `i < 1200` | large (mean 0.2166, 0.784) | twice as many squares: denser pile of overlapping blocks, more wedges and corner dots, same style | variants/count_1200/frame_00001.png |
| grid_120 | `grid = 60;` -> `grid = 120;` | large (mean 0.1611, 0.433) | size ladder doubles to 120..1920 and snap cell to 60px: a few giant flat blocks (one sky-blue fills the right half), sparser small details | variants/grid_120/frame_00001.png |
| sizeexp_3 | `int(pow(2, int(random(5))))` -> `int(random(3))` | large (mean 0.2445, 0.692) | max square capped at 240px: no giant blocks, uniform small/medium squares, much more light background showing between them | variants/sizeexp_3/frame_00001.png |
| darkalpha_120 | `fill(0, 40);` -> `fill(0, 120);` | subtle (mean 0.0178, 0.051) | offset dark shadow slightly heavier where visible; overall composition essentially unchanged | variants/darkalpha_120/frame_00001.png |
| solidrect_0.8 | `if (random(1) < 0.4) {` -> `< 0.8` | large (mean 0.5129, 0.983) | almost every square is a single solid colour; two-tone triangle splits nearly gone, flatter and blockier | variants/solidrect_0.8/frame_00001.png |

## Modularisation notes
- Generic: the snap-to-grid step, the palette list + `rcol()`/`getColor` lerp, the "stack translucent
  layers per cell" pattern (dark offset shadow + solid/split fill + corner dot), and the noise-gated size
  attenuation. A library function `scatterSquares(count, gridSize, sizeExponents, palette, {shadow, wedge, split, dot} probs)`
  would cover the whole first loop.
- One-off art decisions: the fixed 8-colour pink/blue palette, `dx=dy=8` shadow offset, the exact size
  ladder 60..960, the wedge geometry (angle at 0.75/1.75 PI, 5x extension), and the second detail loop's
  outline-box motif.
- Clean parameter object: `{count, grid, sizeExpMax, noiseDetail, noiseGain, shadowAlpha, shadowOffset,
  wedgeProb, solidProb, dotScale, palette, bgFromPalette}` plus the detail loop's `{count, outlineProb,
  faintProb}`.
