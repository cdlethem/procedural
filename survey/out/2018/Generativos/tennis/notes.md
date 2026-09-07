---
sketch: 2018/Generativos/tennis
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1605
animated: false
techniques: [noise-field, grid, dots-stippling]
primitives: [rect]
palette:
  colors: ["#FFFFFF", "#000000", "#C8FA4C"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: noiseDashGrid, signature: "noiseDashGrid(cellCount, dashAspect, angleScale, sizeScale, jitter) -> void", note: "jittered grid of noise-sized, noise-rotated elongated dashes drawn twice (shadow pass + stroke/fill pass)"}
---

## What it draws
A regular grid of short, elongated dash marks (like scattered strokes or tennis-ball seams) on a
flat chartreuse (yellow-green) background. Dashes vary in length and thickness following a smooth
noise field, are rotated at varying angles, and sit on slightly jittered grid positions, so the
whole field looks organic rather than mechanical. Each dash is black with a white core and a faint
dark shadow, giving a subtle embossed look.

## How the code works
`setup()` (tennis.pde:3-11) sizes the P2D window and calls `generate()`; `draw()` is empty, so the
piece is static (confirmed: baseline frames 10/60 identical to frame 1).

`generate()` (25-80):
- Picks three distinct colors `c1, c2, c3` from the 3-color list `{#ffffff, #000000, #C8FA4C}`
  (88-91); in this render the background is chartreuse `#C8FA4C`, strokes are black, fills white.
- Builds a jittered grid: `cc = int(random(5,20))` cells (33), cell size `des = width/cc` (34),
  per-cell position offset by `random(-md, md)` with `md = random(0.3)` (40) and a global offset
  `id = random(des)` (39).
- Per cell, two noise fields: a size field `noise(is+xx*ds, is+yy*ds)*des` (52) and an angle field
  `noise(ia+xx*da, ia+yy*da)*TWO_PI*2` (53), with different offsets/scales so size and rotation
  vary independently across the canvas.
- Pass 1 (43-61): `fill(0, 20)` — a very low-alpha black rect at the same position, acting as a
  soft shadow (the dash is `dis x dis*0.14`, rectMode CENTER, rotated by the angle field).
- Pass 2 (63-79): re-seeds with `randomSeed(seed)` so the same jitter/noise values are
  reproduced, then draws each dash with `strokeWeight(dis*0.03)` in `c2` (black) and `fill(c3)`
  (white) — a thin black outline around a white elongated rectangle.

Randomness enters via `rcol()` (unseeded, run-dependent — but the harness seeds it), the unseeded
`random()` calls at 33-40 for field parameters, and the seeded `random(-md, md)` jitter per cell.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The two-pass grid (shadow pass + outline pass) with per-cell size/angle noise is a clean, reusable
pattern: parameter object would contain cell count `cc`, dash aspect (`dis*0.14`), shadow alpha
(`20`), jitter `md`, size/angle noise scales `ds`/`da`, noise offsets `is`/`ia`, and the 3-color
selection. One-off art decisions: the 3-color chartreuse/black/white palette, the
`dis*0.03` stroke weight, and the `translate(-5,-5)` nudge (46).
