---
sketch: 2017/Generativos/gricula
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1581
animated: false
techniques: [grid, distortion, symmetry]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#09080C", "#D1370C", "#094C22", "#C997A7"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: c1, default: "random(40, 800)", tried: [150], change: large, effect: "more rows: finer striping, a big rotated V-fold dominates the composition"}
  - {name: c2, default: "random(8, 100)", tried: [40], change: large, effect: "more segments per row: smaller blocks, busier checker, deeper pinched central corridor"}
  - {name: amp1, default: "random(1, 90)", tried: [1], change: large, effect: "no vertical warp: rows stay straight, centre collapses to a clean vertical slit, sharper fan"}
  - {name: colors, default: "#FFFFFF #09080C #D1370C #094C22 #C997A7", tried: ["#FFFFFF #09080C #2563EB #F59E0B #10B981"], change: large, effect: "same geometry, hues replaced (white/black/orange/green become white/black/blue/orange/green)"}
  - {name: rotation, default: "random(0, TWO_PI)", tried: [0], change: large, effect: "axis-aligned: horizon exactly mid-canvas, horizontal strips top / vertical strips bottom, notch opens downward from centre"}
reusable_candidates:
  - {name: warpRowGrid, signature: "warpRowGrid(rows, segsPerRow, amp, palette) -> void", note: "grid of filled quads whose y-positions are scaled per row by a random amplitude, mirrored left/right"}
  - {name: paletteIndexLerp, signature: "getColor(palette, v) -> color", note: "wrap a continuous value into the palette and lerp between adjacent entries"}
---

## What it draws
A full-bleed abstract composition with a horizon near the middle: the upper half is a
fan of horizontal stripes in white, pale pink, green, orange and black, the lower half
is vertical stripes in the same colours, and both converge into a deep V-shaped valley
at the centre. The stripes are broken into short rectangular blocks, so the surface
reads as a distorted, folded checkerboard of flat colour.

## How the code works
`setup()` calls `generate()` once (line 7); `draw()` is empty, so the image is static.
`generate()` clears to black (line 24), moves to the centre and applies one random
rotation (lines 29-30). It computes the canvas diagonal `diag` (line 32) and picks a random number of rows `c1` between 40 and 800 (line 34) plus a per-row vertical warp
amplitude `amp1` up to 90 (line 35). For each row, the row band spans `yy1..yy2`
(lines 39-40); with `c2` segments per row (8-100, line 42), two mirrored loops
(lines 53-67 and 68-82) draw one quad per segment: the four y-corners are
`map()`ped between `yy*amp` and `yy` (lines 54-57), which stretches the band
vertically by the row's amplitude, and the x-corners tile the row across
`-diag/2..+diag/2` (lines 58-59, mirrored at 73-74). Fill colour comes from
`getColor(ic+dc*j)` (line 60): a continuous index wrapped into the 5-colour
`colors[]` palette (line 87, from coolors.co) and lerped between adjacent entries
(lines 92-98), so colour advances smoothly along each row. Randomness enters via
the row/segment counts, amplitudes, the per-row colour offset `ic`/`dc` (lines
50-51) and the initial rotation. The mirror of the two segment loops plus the
symmetric y-warp produces the left-right symmetric fan; rows near y=0 with large
`amp` fold across the horizon and form the central V.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| c1_150 | `int c1 = int(random(40, random(40, 800)));` -> `int c1 = 150;` | large (0.31, 86%) | much finer rows; a broad rotated V-shaped fold of stripes dominates the centre-right, lower half becomes dense vertical checker | variants/c1_150/frame_00001.png |
| c2_40 | `int c2 = int(random(8, random(8, 100)));` -> `int c2 = 40;` | large (0.31, 86%) | blocks per strip smaller and busier; central valley deepens into a pinched vertical corridor of fine blocks | variants/c2_40/frame_00001.png |
| amp1_1 | `float amp1 = random(1, random(1, random(1, 90)));` -> `float amp1 = 1;` | large (0.31, 86%) | no per-row warp: strips stay straight and aligned, centre collapses to a sharp vertical slit, fan edges cleaner | variants/amp1_1/frame_00001.png |
| palette_alt | `int colors[] = {#ffffff, #09080c, #d1370c, #094c22, #c997a7};` -> `... {#ffffff, #09080c, #2563eb, #f59e0b, #10b981};` | large (0.19, 69%) | identical geometry; palette reads white, blue, orange, green, black instead of white, pink, orange, green, black | variants/palette_alt/frame_00001.png |
| rotate_0 | `rotate(random(TWO_PI));` -> `rotate(0);` | large (0.31, 85%) | no rotation: horizon sits exactly mid-canvas, horizontal strips top / vertical strips bottom, central notch opens downward as a symmetric X-fold | variants/rotate_0/frame_00001.png |

## Modularisation notes
Generic: the warp-row grid (row band + per-row amplitude + segment tiling + mirrored
half) is a self-contained generator parameterised by rows, segments, amplitude and
palette; `getColor`'s wrap-and-lerp palette indexing is a small reusable colour
utility. One-off art decisions: the specific 5-colour palette, the random ranges
(40-800 rows, 8-100 segments, amplitude up to 90), the single initial rotation, and
the black background. A clean parameter object: `{rows, segmentsPerRow,
amplitude, palette, colorStep, rotation, background}` with the generator as
`warpRowGrid(canvas, params)`.
