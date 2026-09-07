---
sketch: 2020/generative/01_04/colcha
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1519
animated: false
techniques: [grid, noise-field, polar, curves]
primitives: [ellipse]
palette:
  colors: ["#02AAE0", "#F47EF3", "#0ABB8B", "#F6DE21", "#F63528", "#000000", "#FFFFFF"]
  selection: noise-driven
composition: tiled
parameters: []
reusable_candidates:
  - {name: getColor, signature: "getColor(noiseValue: float) -> color", note: "maps a noise value to the palette via index + lerp between neighbours (pow 0.6 curve); generic noise-driven palette sampler"}
  - {name: fanPatch, signature: "fanPatch(cx, cy, size, div, amp, des, tilt, c1, c2, dir) -> void", note: "draws a radiating fan of alternating-colour semicircle arcs (P3D Y-tilted); the core 'quilt patch' motif"}
---

## What it draws
A full-bleed tiled grid of square "quilt patch" cells on a black background. Each cell holds a
radiating fan of many thin semicircular arcs sweeping around the cell centre, producing
pinwheel / spiral / rosette motifs. The arcs alternate between two colours per cell, giving a
fine striped, moiré-like texture. Dominant hues are cyan, blue, pink/magenta, green and yellow,
with occasional dark or near-white cells. Some cells' fans look dense and tight (small offset),
others loose with a clear dark hole in the middle.

## How the code works
- `generate()` (colcha.pde:46) runs once in `setup()` (line 24); `draw()` (line 34) is empty, so
  the piece is static. `randomSeed`/`noiseSeed` are set from `seed` (lines 48-49).
- Grid: `cc = int(random(6, 15))` (line 53) sets the cell count; `ss = width/(cc+1)` (line 54)
  is the cell size. Two nested loops (lines 63-64) run `i, j` from -1 to cc so cells bleed off
  every edge. Cell centres are jittered by `random(-0.08, 0.08)*random(0.5,1)*ss` (lines 66-67).
- Per-cell motif: `div` (line 74) is the number of arc segments (24-238 even); `amp` (line 75)
  scales arc radius; `des` (line 92) offsets the arc centre from the cell centre (controls the
  middle hole); `ax` (line 91) is a P3D `rotateY` tilt (lines 99-100) that foreshortens the arcs
  into ellipse-like fans; `dir` (line 89) flips rotation direction (mirror vs pinwheel).
- The inner loop (lines 93-103) draws `div` arcs: each is `rotate(a*dir)` around the cell centre,
  `arc(ss*des, 0, ss*0.5*amp, ss*0.5*amp, PI*dir, PI+PI*dir)` (line 101) — a semicircle whose
  flat side faces the centre, so the stacked rotated copies form the fan.
- Colour: `c1`/`c2` (lines 83-84) come from `getColor(noise(...))` — 2-D simplex noise (toxi
  `SimplexNoise` imported, but Processing's own `noise()` is used) sampled at per-cell coords
  with small detail (`detCol1/2`, lines 59,61), so neighbouring cells get similar hues. Each is
  nudged toward black (`c1`, line 86) or white (`c2`, line 87) by up to 10%. Arcs alternate
  `c1`/`c2` by even/odd `k` (line 96). `getColor(float v)` (lines 130-135) lerps between
  adjacent palette entries with a `pow(v%1, 0.6)` ease.
- `rcol()` (lines 122-124) picks a random palette colour but is only used in commented-out
  fill calls; the active fills are the noise-driven `c1`/`c2`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic / library-ready:** `getColor(noiseValue)` — a noise-driven palette sampler (index +
  neighbour lerp with an exponent ease). Reusable for any palette + noise field.
- **Generic with a parameter object:** the `fanPatch` motif — a radiating fan of alternating
  semicircle arcs, parameterised by (centre, size, segment count, arc radius scale, centre
  offset, Y-tilt, two colours, direction). This is the signature "quilt patch" primitive.
- **One-off art decisions:** the specific 7-colour palette (line 120), the random `cc` grid
  range (6-14), the jitter magnitude (0.08), the per-cell noise detail for colour, and the
  black/white nudges (lines 86-87).
- **Clean parameter object** would contain: `gridCount`, `cellJitter`, `arcSegments (div)`,
  `arcRadius (amp)`, `arcOffset (des)`, `tilt (ax)`, `palette`, `colorNoiseDetail`, `colorNudge`.
