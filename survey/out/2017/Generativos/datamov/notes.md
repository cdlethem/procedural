---
sketch: 2017/Generativos/datamov
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 275
animated: false
techniques: [grid]
primitives: [rect]
palette:
  colors: ["#EAA104", "#F9BBD1", "#51D17C", "#47A1BC", "#EA2525"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: columnCount, default: 600, tried: [300], change: large, effect: "half the columns: sparser diagonal bands, wider background gaps between columns"}
  - {name: rotation, default: -PI*0.25, tried: [-PI*0.125], change: large, effect: "22.5 deg instead of 45: columns tilt much closer to vertical"}
  - {name: dd (gap ratio), default: random(0.2,0.95), tried: [random(0.95,1.0)], change: moderate, effect: "blocks nearly touch: thinner seams, denser solid mosaic"}
  - {name: dc (color drift per step), default: random(100), tried: [random(2)], change: moderate, effect: "slow color cycling: long single-color runs, large smooth diagonal color fields"}
  - {name: w range, default: diag*random(0.005,0.055), tried: [diag*random(0.01,0.11)], change: moderate, effect: "wider blocks (h unchanged): chunkier, more elongated bars"}
reusable_candidates:
  - {name: lerpPalette, signature: "lerpPalette(int[] colors, float v) -> color", note: "cyclic lerp between adjacent palette entries, v wraps"}
  - {name: colorColumn, signature: "colorColumn(x, w, h, hGap, startIdx, colorStep) -> void", note: "stack of rects cycling palette down the column"}
---

## What it draws
A full-bleed, diagonally tilted mosaic of small colored rectangles: hundreds of thin
columns run from the top-left to the bottom-right at 45 degrees, each column a stack of
tiny blocks with small gaps between them. The image reads as a dense, busy confetti of
green, orange, teal, pink, and red blocks, with thin dark seams where the translucent
black stroke and the background color show through the gaps.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int i = 0; i < 600; i++) {` -> `... i < 300 ...` | large (0.78) | half as many columns: diagonal bands visibly sparser, wider background-colored gaps between columns, texture looser | variants/count_300/frame_00001.png |
| rot_0.125 | `rotate(-PI*0.25);` -> `rotate(-PI*0.125);` | large (0.84) | columns now tilt at 22.5 deg, much closer to vertical; same mosaic but the diagonal direction clearly changed | variants/rot_0.125/frame_00001.png |
| gap_1.0 | `float dd = random(0.2, 0.95);` -> `random(0.95, 1.0)` | moderate (0.39) | blocks almost fill their slots: seams are thin, mosaic reads as a denser, more solid field with less background showing | variants/gap_1.0/frame_00001.png |
| cstep_2 | `float dc = random(100)*...` -> `random(2)*...` | moderate (0.56) | color drifts slowly along each column: long runs of one color, large smooth diagonal color fields (big red/green/teal regions) instead of per-block confetti | variants/cstep_2/frame_00001.png |
| size_2x | `float w = diag*random(0.005, 0.055)*...` -> `random(0.01, 0.11)*...` | moderate (0.44) | block width doubled (height unchanged): chunkier, more elongated bars; column structure still reads but with coarser grain | variants/size_2x/frame_00001.png |

## How the code works
`setup()` calls `generate()` once (datamov.pde:7); `draw()` is inert. In `generate()`
(:29-54): background is one random palette color (:30); the canvas is translated to
center and rotated -45 deg (:33-34), which makes the vertical columns appear diagonal.
A loop of 600 iterations (:39) places one "column": x is uniform across the diagonal
(:40), y starts at the rotated top edge (:41). Each column gets a random width w and
block height h, both `diag*random(0.005, 0.055)` further scaled by `random(0.5, 1)`
(:42-43), so blocks range from hairline-thin to ~5% of the diagonal; h has a floor of
3 px (:44). The inner loop (:49-52) stacks rects from the top down to the bottom edge
(step = h), each rect drawn at height `h*dd` where `dd = random(0.2, 0.95)` (:45) —
the random gap factor is what leaves the seams. Color: a random start index `ic`
(:46) plus a random drift `dc` (:47, 30% of the time replaced by a small int for slow
cycling, :48); each block's fill is `getColor(ic + dc*j)` which lerps between adjacent
palette entries and wraps (:62-68), so colors drift smoothly along each column.
`stroke(0, 70)` (:38) gives the thin dark outlines. Randomness enters via `random()`
with a harness seed; nothing is noise-based.

## Modularisation notes
Two blocks are generic: the cyclic palette lerp (`getColor`, :62-68) is a ready-made
`lerpPalette(colors, v)` helper, and the column builder (:39-53) is a
`colorColumn(x, w, blockH, gapRatio, startIdx, colorStep)` function. One-off art
decisions: the -45 deg rotation, the random-gap `dd` factor, the `max(h, 3)` floor,
and the 30% slow-cycling special case at :48. A clean parameter object:
`{columnCount, wRange, hRange, gapRange, colorStepRange, palette, rotation, strokeAlpha, backgroundColor}`.
