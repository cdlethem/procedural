---
sketch: 2017/Generativos/lineTextures
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 207
animated: false
techniques: [lines-hatching, grid]
primitives: [line]
palette:
  colors: ["#FFFFFF", "#000000", "#fe435b", "#19b596", "#9061bf", "#e0dc3f"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: sep, default: "random(3, 30)", tried: [15.0], change: large, effect: "coarser, sparser hatch; rows separated by clear black bands (angle also shifted via PRNG)"}
  - {name: minLen, default: "random(5, 20)", tried: [30.0], change: large, effect: "longer segments; rows read as near-continuous oblique lines"}
  - {name: b, default: "sep*random(0.8, 1)", tried: [0.0], change: large, effect: "gaps removed; segments merge into continuous parallel lines with grainy joints"}
  - {name: strokeWeight, default: "sep*random(0.2, 0.9)", tried: [3.0], change: large, effect: "thick pill-shaped dashes; bolder, chunkier texture"}
  - {name: ang, default: "random(TWO_PI)", tried: [0.0], change: large, effect: "axis-aligned (vertical) rows; dense zigzag weave, overall lighter gray"}
  - {name: maxLen, default: "minLen*random(1, 8)", tried: ["minLen*2.0"], change: large, effect: "uniform dash lengths; more regular, less organic texture"}
reusable_candidates:
  - {name: hatchField, signature: "hatchField(angle, spacing, minLen, maxLen, gap, weight) -> void", note: "rotated field of short line segments, brick-offset per row; spacing/lengths/gaps all parameterised"}
---

## What it draws
A full-bleed black field covered in a dense, regular hatching of very short white line
segments. The segments are grouped into parallel rows that run at a single fixed oblique
angle (seed 42 gives roughly 20 degrees off horizontal); within each row the segments are
separated by small gaps, and successive rows are offset like running brickwork, so the
whole canvas reads as a woven, fabric-like texture. Line thickness is thin relative to
the spacing, so most of the image is black with a fine white grain.

## How the code works
`setup()` calls `generate()` once (line 5); `draw()` is empty so the piece is static
(until the commented-out regenerate is enabled, line 10). `generate()` (lines 23-53):

- Clears to black, translates to the centre (lines 24-25), and computes `diag` as the
  corner-to-corner distance (line 26) so the hatch always overflows every edge.
- `ang = random(TWO_PI)` (line 27) picks the single global hatch direction.
- Outer loop (lines 37-52) walks rows from `dx = -diag/2` to `diag/2` in steps of
  `sep = random(3, 30)` (line 30); the row centre sits at `(cos(ang)*dx, sin(ang)*dx)`.
- Inner loop (lines 41-49) walks along each row in the perpendicular direction
  (`ang + HALF_PI`), drawing one segment per iteration: length
  `random(minLen, maxLen)` with `minLen = random(5, 20)` (line 31) and
  `maxLen = minLen*random(1, 8)` (line 32), then advancing a gap
  `b = sep*random(0.8, 1)` (line 33) before the next segment. The random length plus the
  roughly-constant gap is what produces the staggered brick offset between rows.
- Colour is a fixed `stroke(255)` on `fill(0)`/black background (lines 34-35);
  `strokeWeight(sep*random(0.2, 0.9))` (line 36) scales thickness with spacing. The
  `colors[]` array and `rcol()` (lines 55-58) are never called from `generate()`, so the
  four accent colours in the code do not appear in the render.
- All randomness is the seeded PRNG: with `--seed 42` the render is fully deterministic
  (confirmed `deterministic: true` in the baseline result.json).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sep_15 | `  float sep = random(3, 30);` -> `  float sep = 15.0;` | large (mean 0.5758, 0.881) | coarser, sparser hatch: rows of short dashes with wide black bands between them; row tilt also differs from baseline (PRNG shift) | variants/sep_15/frame_00001.png |
| minLen_30 | `  float minLen = random(5, 20);` -> `  float minLen = 30.0;` | large (mean 0.4057, 0.96) | segments much longer; rows read as nearly continuous oblique lines with occasional short breaks instead of a dashed grain | variants/minLen_30/frame_00001.png |
| b_0 | `  float b = sep*random(0.8, 1);` -> `  float b = 0.0;` | large (mean 0.3914, 0.959) | gaps gone: segments connect into continuous parallel lines edge to edge, with a fine grainy tick at each joint | variants/b_0/frame_00001.png |
| strokeWeight_3 | `  strokeWeight(sep*random(0.2, 0.9));` -> `  strokeWeight(3.0);` | large (mean 0.2187, 0.66) | thick rounded pill-shaped dashes (here near-vertical rows due to PRNG shift); bold, chunky texture, much more white cover | variants/strokeWeight_3/frame_00001.png |
| ang_0 | `  float ang = random(TWO_PI);` -> `  float ang = 0.0;` | large (mean 0.6029, 0.888) | axis-aligned vertical rows of short segments; staggered joints make a dense zigzag weave, overall a lighter gray than the baseline | variants/ang_0/frame_00001.png |
| maxLen_2 | `  float maxLen = minLen*random(1, 8);` -> `  float maxLen = minLen*2.0;` | large (mean 0.4324, 0.964) | dash lengths now uniform (max = 2x min); texture noticeably more regular and ordered, less organic variation than baseline | variants/maxLen_2/frame_00001.png |

Caveat: each substitution removed one `random()` call, which shifts the downstream PRNG
draws, so the angle/spacing/lengths in a variant also differ from the baseline on top of
the intended parameter change. All six variants score `large`, so the observations above
hold regardless; the within-parameter trends (sep up = sparser, gap 0 = continuous,
weight up = bolder) are consistent with what is visible.

## Modularisation notes
- The core is a single generic routine: a rotated, full-bleed field of short parallel
  segments whose row spacing, segment length range, gap and stroke weight are all
  parameters. A library version would be `hatchField(angle, spacing, minLen, maxLen, gap,
  weight)` drawing in the current stroke colour, so it composes with any palette.
- One-off art decisions: the black-and-white fixed stroke, the `b = sep * (0.8..1)`
  coupling of gap to spacing, and the `strokeWeight`-scales-with-`sep` coupling. Both
  couplings deserve to be independent parameters rather than derived values.
- The unused `colors[]`/`rcol()` suggests a later intended variant where each segment
  (or each row) samples the accent palette; that would be a one-line hook
  (`stroke = rcol()`) in `hatchField`'s caller.
