---
sketch: 2018/Generativos/guasanos
year: 2018
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: false
ms_first_frame: 253
animated: true
techniques: [noise-field, grid, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: fixed
composition: margins
parameters:
  - {name: cw, default: 40, tried: [20], change: moderate, effect: "fewer, wider ellipses per row; corner tangle thinner; cleaner sparser band"}
  - {name: ch, default: 60, tried: [50], change: moderate, effect: "50 chains vs 60: denser overlapping rings in lower half; ch=20 crashed (totalH indexed by column loop, line 36)"}
  - {name: det, default: 0.02, tried: [0.05], change: moderate, effect: "finer size variation; fan fills in, bottom-right much denser, less smooth band"}
  - {name: noiseFloorW, default: 0.2, tried: [0.02], change: moderate, effect: "extreme width contrast: very wide ellipses next to near-zero slivers; jagged stepped march"}
  - {name: noiseFloorH, default: 0.2, tried: [0.02], change: moderate, effect: "extreme height contrast: flat ellipse rows and big vertical drops; banded, compressed lower region"}
  - {name: timeSpeed, default: 0.0001, tried: [0.001], change: moderate, effect: "no structural change - same tangle-and-fan structure, just a different noise slice (non-deterministic)"}
reusable_candidates:
  - {name: noiseWormGrid, signature: "noiseWormGrid(cols, rows, detail, floor, time, width, height, border) -> void", note: "per-cell noise values normalized per row drive ellipse w/h of a running (x,y) corner-to-corner march"}
---

## What it draws
White background. A dense dark tangle of small black-outlined circles in the top-left
corner, from which ~60 diagonal chains of stroked ellipses (no fill) run toward the
bottom-right, like a bundle of worms ("guasanos"). Near the top-left the chains overlap
into a near-solid black mass of tiny rings; toward the bottom-right they fan out into
individual, larger, mostly white ellipses with black outlines. Frame 60 is the same
structure, slightly reshuffled: the tangle has loosened and the bottom-right fan is a
little denser and shifted.

## How the code works
`setup()` (lines 1-4): 800x800 window, `pixelDensity(2)` (unavailable on the headless
display, harmless warning). `draw()` runs every frame with no `stop()`; line 9
`background(255)` wipes the canvas, so there is no accumulation — the image is fully
regenerated each frame and the only animation is `time = millis()*0.0001` (line 11), a
slowly advancing z-coordinate fed into Perlin noise.

Grid: `cw=40` columns, `ch=60` rows (lines 13-14). Lines 29-38 fill two noise grids with
`det=0.02` (line 27): `valuesW[i][j] = 0.2+noise(i*det, j*det, time)*0.8` (line 33) and
`valuesH[i][j] = 0.2+noise(j*det, i*det, time)*0.8` (line 35) — the indices are swapped,
so the two grids are different noise fields. Line 34 sums `valuesW` per row into
`totalW[j]`. Line 36 accumulates `totalH[i]` with the *column* index, so in the draw loop
`totalH[j]` is not the exact sum of the numerators in row j; the heights therefore only
approximately tile the full height (rows end up slightly ragged). The same line also means
`totalH` (length `ch`) is indexed by the column loop variable `i`, which only works while
`ch >= cw` (see the `ch_20` crash below).

Drawing (lines 45-56): `ellipseMode(CORNERS)`; for each row j the pen starts at
`(border, border)` = (20,20). Each ellipse spans `(x,y)` to `(x+ww, y+hh)` where
`ww = w*valuesW[i][j]/totalW[j]` (normalized to tile the full width across the row) and
`hh = h*valuesH[i][j]/totalH[j]` (approximately tiles the full height). After each
ellipse the pen moves `x += ww; y += hh`, so within a row the ellipses march right and
down and the row ends near the bottom-right corner. Every new row restarts at the
top-left, so all 60 chains share the corner: that is the dark tangle, and each chain's
noise values decide its own sizes and path, giving 60 slightly different diagonal worms
fanning out. Colour is the default black stroke with no fill on white — the only "palette"
is `background(255)` (line 9). Randomness enters only through Perlin noise (no
`random()`); because the noise z-coordinate is `millis()`-based, `deterministic: false`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cw_20 | `int cw = 40;` -> `int cw = 20;` | moderate (mean 0.0767, 0.157 of pixels) | each row has 20 wider ellipses instead of 40; top-left tangle is thinner (first ellipse is bigger); the whole band is sparser and reads as a cleaner diagonal of individual rings | variants/cw_20/frame_00001.png |
| ch_50 | `int ch = 60;` -> `int ch = 50;` | moderate (mean 0.0939, 0.222 of pixels) | same structure; 50 chains instead of 60 - slightly denser overlapping rings in the lower half, corner tangle intact | variants/ch_50/frame_00001.png |
| det_0.05 | `float det = 0.02;` -> `float det = 0.05;` | moderate (mean 0.0859, 0.207 of pixels) | size variation is finer and choppier; the fan fills in - bottom-right is packed with many small-to-medium circles, band no longer a smooth spread | variants/det_0.05/frame_00001.png |
| noiseFloorW_0.02 | `valuesW[i][j] = 0.2+noise(...)` -> `0.02+noise(...)` | moderate (mean 0.0657, 0.169 of pixels) | extreme width contrast: occasional very wide ellipses next to near-zero-width slivers; the per-row march looks jagged and stepped instead of a smooth staircase | variants/noiseFloorW_0.02/frame_00001.png |
| noiseFloorH_0.02 | `valuesH[i][j] = 0.2+noise(...)` -> `0.02+noise(...)` | moderate (mean 0.0642, 0.147 of pixels) | extreme height contrast: rows of nearly flat ellipses with occasional big vertical drops; lower region looks banded and vertically compressed | variants/noiseFloorH_0.02/frame_00001.png |
| timeSpeed_0.001 | `float time = millis()*0.0001;` -> `millis()*0.001;` | moderate (mean 0.0689, 0.174 of pixels) | no structural change - same corner tangle and diagonal fan, just a different noise realization (sketch is non-deterministic, millis-driven) | variants/timeSpeed_0.001/frame_00001.png |

Note: a `ch_20` attempt crashed with `ArrayIndexOutOfBoundsException` at line 36:
`totalH` is allocated with length `ch` but indexed by the column loop variable `i`,
so `ch` must be at least `cw`. The `ch_50` variant is the successful `ch` experiment.

## Modularisation notes
The generic block is lines 29-56: build a normalized per-row noise weight matrix, then
march a pen corner-to-corner drawing ellipses sized by the weights. A library function
`noiseWormGrid(cols, rows, detail, floor, time, w, h, border)` would cover it; the
swapped-index second grid (line 35) is a deliberate asymmetry worth a `swap: bool`
parameter, and the `totalH` index quirk (line 36) is an artifact, not a feature — a clean
version should sum `totalH[j]` per row and allocate it with length `cw`. One-off art
decisions: the fixed 20px border, the 0.2 noise floor (guarantees no zero-size ellipses),
the 0.0001 time speed, and the black-on-white stroke-only style. A parameter object:
`{cols, rows, detail, floor, timeSpeed, border, strokeWeight, fill}`.
