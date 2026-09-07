---
sketch: 2017/Generativos/tevebe
year: 2017
renderer: P3D
size: [960, 720]
libraries: []
deterministic: true
ms_first_frame: 1507
animated: true
techniques: [grid, pixel-ops]
primitives: [rect]
palette:
  colors: ["#F05638", "#F5C748", "#3FD189", "#FFB9DB", "#AF8AB4", "#6FC4EA", "#FFFFFF", "#412A50"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ch, default: "random(1,18)", tried: [4], change: large, effect: "4 tall bands; row colours re-drawn (fewer draws shift the stream)"}
  - {name: cw, default: "random(1,80)", tried: [20], change: large, effect: "uniform 20-cell column width in every row; row colours re-drawn (draw shift)"}
  - {name: pwr, default: "random(0.5,2)", tried: [0.5], change: large, effect: "same rows; stripes go high-contrast, cells pushed to near-black/near-white"}
  - {name: dd, default: "random(50)/w", tried: [10/w], change: large, effect: "same rows; pattern coarsens into wide blocks instead of fine stripes"}
  - {name: colors, default: "8-colour list", tried: ["4 warm colours"], change: large, effect: "all rows restricted to maroon/pink/salmon/cream"}
reusable_candidates:
  - {name: stripedRow, signature: "stripedRow(y, h, cells, color, phase, pwr) -> void", note: "one row of vertical cells whose colour is a shaped sawtooth lerped black->color->white"}
  - {name: shapedSawtooth, signature: "shapedSawtooth(x, pwr) -> float in [0,1]", note: "pow(abs(fract(x)), pwr) folded with abs(2v-1): a V-shaped distribution whose sharpness is pwr"}
  - {name: twoStageLerpColor, signature: "twoStageLerpColor(v, midColor) -> color", note: "v<0.5 lerp(black,mid), else lerp(mid,white) — pushes cells through a mid colour"}
---

## What it draws
Full-bleed mosaic of horizontal bands: about 17 rows of different heights (1 to ~18 rows across 720 px), each
row filled with vertical stripes of varying widths (1 to 80 cells). Each row has one palette colour, and the
stripes oscillate between near-black, that colour, and near-white in a smooth wave, so rows read as shimmering
bars. Baseline rows (top to bottom): light blue, pink, yellow, white/grey, purple, pink, red-orange, grey,
blue, purple, pink, green, white, purple, blue. Frame 60 has the same rows but the stripe phases have drifted,
so the pattern has shifted horizontally.

## How the code works
`setup()` calls `generate()` once (tevebe.pde:7); `draw()` calls `render()` every frame (line 13). `render()`
(31-58) reseeds noise and random with the same seed each frame, then builds the picture row by row:
- `ch = int(random(1, 18))` (37) fixes the number of rows for the whole piece; row height `h = height/ch` (38).
- Per row (39-42): `cw = int(random(1, 80))` sets the column count (cell width `w = width/cw`); `col = rcol()`
  picks one colour from the 8-colour list (60-63); `dd = random(50)/w` is the phase step per cell;
  `dt = random(1) + frameCount*random(-0.1, 0.1)` is the row phase plus a slow per-frame drift — this is what
  makes the sketch animate (the regeneration line in `draw()` is commented out, line 11).
- Per cell (46-55): `val = abs((dt+dd*i) % 1)` is a sawtooth along the row; `pow(val, pwr)` (45, `pwr` random
  0.5-2) reshapes it; `abs(val*2-1)` folds it into a 0-1-0 triangle; then the cell fill is a two-stage lerp:
  black->row colour for val<0.5, row colour->white above (51-52), drawn as a `rect` (55).
- All randomness enters through the per-frame `randomSeed(seed)` sequence, so with a fixed seed the piece is
  deterministic; the only time-varying term is `frameCount*random(-0.1,0.1)` in `dt`, which shifts each row's
  stripe phase at a different rate. P3D is used but nothing 3-D is drawn (only rects). `getColor()` (66-76)
  and the second palette (64) are dead code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ch_4 | `int ch = int(random(1, 18));` -> `int ch = 4;` | large | 4 tall bands (light blue, lilac, light blue, dark purple); fewer rows also shifts the random stream, so row colours differ from baseline | variants/ch_4/frame_00001.png |
| cw_20 | `int cw = int(random(1, 80));` -> `int cw = 20;` | large | every row has the same 20-cell column width; rows keep distinct colours but the stream shift re-drew them (pinks, maroon, cream, salmon, tan) | variants/cw_20/frame_00001.png |
| pwr_0.5b | `float pwr = random(0.5, 2);` -> `float pwr = random(0.5, 2)*0 + 0.5;` | large | same 17 rows and row colours, but the sqrt power pushes values to the extremes: many rows read as bold near-black/near-white stripes, higher contrast than baseline | variants/pwr_0.5b/frame_00001.png |
| dd_10b | `float dd = random(50)/w;` -> `float dd = random(50)*0 + 10/w;` | large | same rows, but the fixed 10/w phase step makes the sawtooth wrap more slowly: colour blocks are wider/chunkier, less fine striping | variants/dd_10b/frame_00001.png |
| palette_warm | `int colors[] = {#F05638, ... 8 colours}` -> `int colors[] = {#45171D, #F03861, #FF847C, #FECEA8};` | large | identical structure, but every row is drawn only from the 4 warm colours (dark maroon, crimson pink, salmon, cream); no blues/greens/purples remain | variants/palette_warm/frame_00001.png |

First pwr/dd attempts (`pwr_0.5`, `dd_10`) dropped the `random()` call, which shifted the whole random stream
and conflated the parameter with a re-draw; the `*b` variants keep the draw and are the ones reported above.

## Modularisation notes
Generic, reusable blocks:
- `shapedSawtooth(x, pwr)`: `abs(2*pow(abs(fract(x)), pwr) - 1)` — a 1-D shaped oscillation in [0,1]; the
  `pwr` parameter is the main look knob (low = high-contrast, high = smoother mid-tones).
- `twoStageLerpColor(v, mid)`: black->mid->white colour ramp; the `mid` colour is the only per-row state.
- `stripedRow(y, h, cells, color, phase, step, pwr)`: composes the two above into one row of rects — this is
  the natural library function; the sketch is just N calls with different row parameters.
One-off art decisions: the per-row random draws (row count, cell count, colour, phase, step, power) and the
8-colour palette; the `frameCount*random(-0.1,0.1)` drift is the animation style (slow per-row phase wander).
Clean parameter object: `{rows: int, perRow: [{cells, color, phase, step, power}], palette: color[],
driftRate: float, seed: int}`. Note for the library: because every row consumes a fixed number of random
draws, any change to the draw order (e.g. fewer rows) re-draws all later rows — a `seeded stream per row`
(or per-feature) would make rows independent, which the sketch's own structure (fixed `seed`, reseeded in
`render()`) already makes possible.
