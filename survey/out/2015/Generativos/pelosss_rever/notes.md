---
sketch: 2015/Generativos/pelosss_rever
year: 2015
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: false
ms_first_frame: 20794
animated: false
techniques: [particles, dots-stippling, curves]
primitives: [ellipse]
palette:
  colors: ["#FF9900", "#424242", "#E9E9E9", "#BCBCBC", "#3299BB"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: randomWalkStrand, signature: "randomWalkStrand(x, y, startSize, shrink, jitter, steps) -> void", note: "random-walk trail of shrinking filled ellipses with random per-step colour"}
  - {name: palettePick, signature: "palettePick(colors) -> int", note: "uniform random pick from a colour list (rcol)"}
---

## What it draws
A full-bleed 800×800 field of hundreds of overlapping "fur" strands: each strand is a
meandering trail of filled dots that start large and shrink to a point, curling into
loose spirals. The dots are picked at random from a 5-colour palette (dominant:
orange, teal-blue, light gray, with dark gray accents), so the tangle reads as a
dense multicoloured rosette pattern over a light-gray background.

## How the code works
`setup()` (line 14) calls `generar()`; `draw()` is empty, so the sketch is static
(rendered once, ~21 s for 2000 strands). `generar()` (lines 34-80):
- `randomSeed(seed)` (line 43) makes the field reproducible per seed; the baseline
  `result.json` still flags `deterministic: false`, so small render-to-render
  differences may be noise — compare large changes only.
- `background(paleta[3])` (line 45) = light gray `#BCBCBC`.
- 2000 strands (`cantidad`, line 46). Each starts at a uniform random point in a
  slightly oversized box, `random(-1.1, 1.1)` (lines 48-49), so strands begin
  partly off-canvas and the field is full-bleed with no margins.
- Inner `while (t > 0.1)` loop (line 59): heading `ang` random-walks with
  `ang += random(-0.1, 0.1)` (line 60); step length `vel = t*0.025` (line 61)
  scales with dot size, so the trail slows down as it shrinks; `t` decays
  multiplicatively by `random(0.98, 0.99)` (line 65), which is why each strand
  is a long curl of hundreds of dots rather than a short dash.
- Every step draws a filled `ellipse(x, y, t, t)` (line 69) with
  `fill(rcol())` — uniform random pick from the 5-colour palette (lines 87-89).
  The shrinking, random-walk, per-dot recolouring is what creates the layered
  spiral "hair" look; later dots of a strand overpaint earlier ones.
- The `ligths` block (lines 70-76) is dead code (`ligths = false`), so no arcs.
- PDF recording (`beginRecord`) is a side effect only; the PNG frame is the source.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the shrinking random-walk strand (lines 56-77) is a self-contained
  primitive — `randomWalkStrand(x, y, startSize, shrink, jitter, steps)` with a
  pluggable per-dot colour function; the palette pick (lines 87-89) is a one-line
  helper. Both are library candidates.
- One-off art decisions: the 2000-strand count, the oversized start box
  (`-1.1..1.1`), the specific 5-colour palette and gray background, the
  `vel = t*0.025` coupling of step length to dot size, and the `0.98-0.99`
  decay range (these jointly tune the "hair" character).
- Clean parameter object: `{count, canvasOversize, startSizeMin, startSizeMax,
  angleJitter, decayMin, decayMax, stepScale, palette, background}`.
