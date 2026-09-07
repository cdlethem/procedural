---
sketch: 2014/Generativos/degradefeo
year: 2014
renderer: JAVA2D
size: [600, 400]
libraries: []
deterministic: true
ms_first_frame: 137
animated: true
techniques: [particles]
primitives: [rect]
palette:
  colors: ["#B4DBA2", "#3C906E", "#DDE9B7", "#035048", "#46053F", "#A40E4B", "#FE3D4E", "#FCA49A"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: cosoCount, default: 5, tried: [15], change: none, effect: "no visible change in frame 1; extra columns all start at x=0 and overlap in the same narrow strip"}
  - {name: stepsPerFrame, default: 500, tried: [50], change: none, effect: "subtle: frame-1 band is only a ~50 px stub at the top-left instead of full height; rest of canvas identical"}
  - {name: rectSize, default: 4, tried: [8], change: none, effect: "subtle: left band made of chunkier 8 px blocks, slightly wider"}
  - {name: xShiftMax, default: 4, tried: [24], change: none, effect: "no visible change; frame 1 is pixel-identical (larger shift only applies from the second wrap, i.e. frame 2)"}
  - {name: valDivisor, default: 256, tried: [512], change: none, effect: "subtle: band biased toward the green ramp, more pale sage, less saturated red"}
reusable_candidates:
  - {name: fallingColumn, signature: "fallingColumn(w, h, stepsPerFrame, rectSize, xShiftRange) -> void", note: "one column of rects that falls, wraps at the bottom, and shifts x by a random step on wrap; draw N of them with offset phases for a growing mottled band"}
  - {name: twoAxisLerpRamp, signature: "twoAxisLerpRamp(x, y, rampA, rampB, mix) -> color", note: "lerp two 2D colour ramps (each ramp lerps horizontally and vertically between two anchors), then blend the ramps by a wandering value"}
---

## What it draws
Baseline frame 1 (seed 42): a flat mid-grey field with a narrow vertical strip of small
squares at the far left edge, the squares a mottle of pinkish red and pale sage green.
The sketch is accumulating: by frame 60 the strip has grown to roughly the left third of
the canvas and becomes a dense field of small pink/red squares with scattered pale-green
patches; the right side is still the grey background.

## How the code works
`setup()` (lines 3-12) creates `5` `Coso` objects and a grey background (`background(128)`).
Each `draw()` (line 15) runs an inner loop of `500` steps; every step calls `act()` on
every `Coso`:

- `y++` (line 40): the column falls 1 px per step, i.e. 500 px per frame.
- `val += inc; inc *= 1.08` (lines 41-42): a per-column colour value drifts upward with
  accelerating increment; when `val >= 256` it is re-randomised (lines 43-46). This makes
  each column's colour flicker as it falls.
- When `y > height` (line 47) the column wraps to the top and shifts right by a random
  `1..4` px (lines 48-50), so each column leaves a rightward-stepping staircase of
  vertical traces; the band of traces grows to the right over frames.
- `dibujar()` (lines 55-66) builds the colour from two 2-axis lerped ramps: a green ramp
  (`#B4DBA2/#3C906E` across x, `#DDE9B7/#035048` down y, lines 57-59) and a red/pink ramp
  (`#46053F/#A40E4B` across x, `#FE3D4E/#FCA49A` down y, lines 60-62), blended by
  `val/256` (line 64) — hence the green/red mottle. Drawn as a `noStroke` `4x4` rect
  (lines 63-65). No blend modes.

Randomness enters at `val = random(256)`, `inc = random(0.1, 0.2)` (lines 35-36) and
`t = int(random(1, 5))` (lines 37, 50). Renderer is JAVA2D, 600x400.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cosoCount_15 | `  for (int i = 0; i < 5; i++) {` -> `... i < 15 ...` | none (mean 0.001, 0.004 px) | no visible change: band at the left edge looks the same; the 15 columns all start at x=0 and overlap in the same ~8 px strip | variants/cosoCount_15/frame_00001.png |
| stepsPerFrame_50 | `  for (int j = 0; j < 500; j++) {` -> `... j < 50 ...` | none (mean 0.0009, 0.004 px) | subtle: in frame 1 only a short pink stub (~50 px tall) at the top-left is drawn; the full-height baseline band below it is absent, rest of canvas identical | variants/stepsPerFrame_50/frame_00001.png |
| rectSize_8 | `    rect(x, y, 4, 4);` -> `    rect(x, y, 8, 8);` | none (mean 0.0008, 0.003 px) | subtle: the left band is built from visibly larger 8 px blocks, a bit wider and blockier than the baseline's 4 px squares | variants/rectSize_8/frame_00001.png |
| xShiftMax_24 | `      t = int(random(1, 5));` -> `      t = int(random(1, 25));` (line 50 only) | none (mean 0.0, 0.0 px) | no visible change: frame 1 is pixel-identical to baseline; the re-rolled x-shift only kicks in at the second wrap (frame 2+), frame 1 uses the initial t from line 37 | variants/xShiftMax_24/frame_00001.png |
| valDivisor_512 | `    fill(lerpColor(col1, col2, val/256));` -> `... val/512 ...` | none (mean 0.0009, 0.004 px) | subtle: the left band is biased toward the green ramp — more pale sage green in the lower half, less saturated red than baseline | variants/valDivisor_512/frame_00001.png |

## Modularisation notes
The generic part is the "falling wrapping column" behaviour: a y-advance with a wrap
reset, a random x-jump on wrap, and a per-step colour value with re-randomisation — a
clean parameter object would be `{count, stepsPerFrame, rectSize, xShiftRange,
rampA, rampB, incRange}`. The 2x2 lerp colour ramp is also reusable as-is. Art-specific
decisions: the two exact green/red anchor palettes, the `inc *= 1.08` acceleration, the
fixed grey background, and the band-growing composition (all columns start at x=0, so
the work reads as a left-anchored growing field rather than a full-bleed pattern).
