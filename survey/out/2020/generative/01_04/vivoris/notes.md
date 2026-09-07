---
sketch: 2020/generative/01_04/vivoris
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2178
animated: false
techniques: [noise-field, grid, lines-hatching, dots-stippling, distortion]
primitives: [line, ellipse]
palette:
  colors: ["#D9BCBC", "#CAB4B0", "#3E87B2", "#1E4F42", "#F37C0A", "#FFFFFF", "#000000"]
  selection: random-from-list
composition: grid
parameters: []
reusable_candidates:
  - {name: noiseLine, signature: "noiseLine(x1, y1, x2, y2, detail) -> warped curve", note: "1-D simplex-noise walk between two endpoints, rotated/scaled to fit; the core wavy-line primitive"}
  - {name: gridWarpedBlobs, signature: "gridWarpedBlobs(div, strokeDetail, fillAlpha, lineCount) -> void", note: "grid of noise-warped closed strokes with dots at nodes"}
---

## What it draws

On a black background, a grid of small wavy "petal" or "leaf" shapes — each a
bundle of thin, overlapping, noise-warped closed curves radiating around a
grid node, with a tiny white dot at its centre. Some shapes have a translucent
fill (dusty rose, teal, slate blue, orange), most are just thin strokes. The
shapes vary a lot in orientation and width; a few cells are empty, so the
layout is irregular, roughly 3 columns by 4 rows of clusters.

## How the code works

- `setup()` -> `generate()` once; `draw()` is empty, so the image is static
  (frames 10/60 identical, dropped by harness).
- `generate()` (vivoris.pde:42): seeds `randomSeed`/`noiseSeed` from `seed`,
  `background(0)`, `hint(DISABLE_DEPTH_TEST)`.
- Grid: `div = int(random(4,9))` (line 59) sets both column and row division;
  `ww = width/div`, `hh = height/div`. Loops over columns `i = 1..div-1`
  (line 65); per column, `sub = int(random(height*0.5)*random(1))` (line 71)
  picks a random row count 0..~480 — so columns have very different numbers
  of nodes, and `j = 1..sub-1` walks rows.
- Per node: a noise-driven angle `ang = noise(xx*det, yy*det)*TAU*2 + k*rot`
  (line 82, `det = random(0.08)` line 63) gives each of 12 repeated lines
  (line 75) a direction; endpoints at `± ww*0.4` / `± hh*0.4` around the node
  (lines 83-86) — this is the "petal" axis.
- `noiseLine()` (line 101): walks a 1-D simplex-noise path from one endpoint
  (length `dist*1.8` steps, step 1.2, detail `det2 = random(0.0006)` per line,
  line 76), then rotates and rescales all points to fit the original
  endpoint-to-endpoint distance (lines 119-129). That produces the wavy,
  bundle-of-strands look. 12 overlapping calls per node make the dense
  fan/petal.
- Colour: `rcol()` picks randomly from 5 colours
  `{#D9BCBC, #CAB4B0, #3E87B2, #1E4F42, #F37C0A}` (line 170); stroke per line
  (line 88), `strokeWeight random(0.4,1.2)` (line 89); ~50% of nodes also get
  a translucent fill `alpha = random(255*random(1))` (lines 90, 68).
- White dot `ellipse(xx, yy, 5, 5)` at every node (lines 94-95).
- Randomness enters via `seed` (harness sets it), the per-column `sub`, the
  per-line `det2`, `ang` from 2-D noise, and per-stroke colours/weights.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes

- `noiseLine(x1,y1,x2,y2,detail)` is the reusable primitive: a deterministic,
  seed-driven wavy line between two points (walk with 1-D simplex noise, then
  fit to the chord). Generic, no art-specific constants beyond step size (1.2)
  and length multiplier (1.8) — parameterise those.
- The grid layer (`div`, per-column random row count `sub`, petal angle from
  2-D noise, 12 repeated strokes) is a generic "scattered warped-petal grid";
  the art decisions are the 12-fold repetition, the `0.4` radius, the
  translucent fill probability (0.5) and the 5-colour palette.
- A clean parameter object: `{div, strokeRepeats, petalRadius, strokeDetail,
  noiseScale, strokeWidth, fillAlpha, palette, seed}`.
