---
sketch: 2017/Generativos/gusanitos
year: 2017
renderer: P3D
size: [720, 720]
libraries: []
deterministic: true
ms_first_frame: 1582
animated: false
techniques: [grid, distortion, lines-hatching]
primitives: [shape]
palette:
  colors: ["#EBB858", "#EEA8C1", "#D0CBC3", "#87B6C4", "#EA4140", "#5A5787"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: createSine, signature: "createSine(freq, phase, amount) -> float[]", note: "integer-frequency sine samples, combined additively/multiplicatively"}
  - {name: ribbonRows, signature: "ribbonRows(divs, sub, amp, palette, rotated) -> void", note: "grid of rows, each row a z-undulating ribbon strip in P3D"}
---

## What it draws
Baseline (seed 42) shows the 720x720 canvas in three vertical zones: the left ~40% is a dense
tangle of short, multi-coloured (red, pink, yellow, teal, grey-purple) wavy 3D ribbon strips with
dark near-black background showing through the gaps; the middle zone is broad flat horizontal
pink/rose stripes; the right zone is broader horizontal slate-blue and mauve stripes, with small
multi-coloured zigzag fragments scattered in the gaps between the flat stripes.

## How the code works
`setup()` calls `generate()` once (L3-9, 29); `draw()` is empty, so the image is static.
`generate()` fills `background(20)` (L30) then runs a 2-pass loop `k = 0..1` (L32): pass 1 draws
directly, pass 2 is the same thing rotated 90° about the canvas centre (L33-35), drawn on top.
Each pass builds a grid of `divs` rows x `sub` columns (L36-38, 47). For each row, three sine
waveforms `freq1..3` (L42-44, `createSine` L77-85 with random integer frequencies) are combined
twice with a random binary op `operation()` (L45-46, L87-101: average, difference or product) to
make one `values[]` height profile. Every column `i` of the row is drawn as a quad (L52-61) whose
z-coordinates are `values[i]*amp` / `values[i+1]*amp` (L53-54, L57-60) — so each row is a ribbon
undulating out of the screen; with the P3D perspective camera the z-wobble (amp up to 300, L39)
displaces and distorts the strips and opens dark gaps between crossing ribbons. A second quad over
the same cell (L62-70) paints a black overlay with vertex alpha 0/0/80/30 (L63, 66, 68) — a
per-quad shade that gives the ribbons their 3D lit look. Colour: `getColor` (L119-124)
interpolates through the 6-colour palette (L115); per row a random offset `ic` (L50) and a small
per-column step `dc` (L49) with a checkerboard jump `(i%2)*inter` (L48, 55) choose the position in
the palette, so each row is a horizontal run of slowly shifting colours with alternating jumps.
Randomness enters only through the per-pass `divs`, `sub`, `amp`, `dc`, `ic` and the sine
frequencies/ops, all seeded by the harness `seed` field (L1).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `createSine(freq, phase, amount)` + `operation(v1, v2, op)` form a small random-waveform
  library (integer-frequency sine mixers). The row-ribbon drawing (quad grid with per-column z from
  a shared 1-D profile, plus the alpha-shade overlay quad) is a reusable "ribbon strip" primitive,
  parameterised by (rows, cols, amp, profile).
- One-off art decisions: the 2-pass 90°-rotated overlay, the specific 6-colour palette and the
  per-row colour-walk formula `i*dc + (i%2)*inter + ic`, the background(20) dark gap colour.
- Clean parameter object: {divs, sub, amp, palette, colorStep (dc), colorJump (inter), colorOffset
  (ic), passes: 2, rotateStep: 90°, background, shadeAlphas: [0,0,80,30]}.
