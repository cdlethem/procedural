---
sketch: 2018/Generativos/golden
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2283
animated: false
techniques: [polar, symmetry, 3d-mesh]
primitives: [point, shape]
palette:
  colors: ["#141414", "#C6AD6C", "#db3b4b", "#edd23b", "#d4dbdd", "#2172ba"]
  selection: fixed
composition: radial
parameters: []
reusable_candidates:
  - {name: beadRing, signature: "beadRing(cx, cy, radius, beadCount, beadSize) -> void", note: "ring of 3D spheres on a circle"}
  - {name: crystal, signature: "crystal(w, h, depth) -> void", note: "four-triangle 3D diamond (two crossed kite faces meeting at an apex)"}
---

## What it draws
A centered golden mandala on a near-black background. Rings of bead-like spheres form
overlapping circular loops around a dense core; diamond-shaped crystals (flat 3D
trilaterals) are scattered on inner rings and fill the center as a layered rosette.
All geometry is one warm tan-gold colour with soft specular highlights; the whole
figure is radially symmetric.

## How the code works
`setup()` (golden.pde:3-9) calls `generate()` once; `draw()` (11-12) is empty, so the
sketch is static. `generate()` (22-89): dark grey background (20), `randomSeed(seed)`,
`lights()` + `specular(#C6AD6C)` + `fill(#C6AD6C)` + `noStroke()` (46-48) — one flat
gold material for everything. It draws 20 rings (55); per ring a base count `ccc`
(54), a per-ring count `cc = ccc*int(random(1,5))` (56), a ring radius `r` up to 0.4
of the width (57), and a bead-loop size `s2` (62). A coin flip `rnd` (64) picks the
ring style: 0 → for each of `cc` angles on the ring, `circles()` (67-73, 117-128)
places `c` spheres (8-219) on a small circle, producing the bead loops; 1 → for each
angle, translate+rotate to a ring point and draw `crystal()` (74-87, 91-115), a
four-triangle 3D diamond facing outward, producing the crystal ring and the central
rosette. Randomness enters via `randomSeed(seed)` (24): all `random()` calls follow
one fixed order. The `colors[]`/`rcol()`/`getColor()` helpers (135-147) are defined
but never called in this path.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `beadRing` (circles, 117-128): generic ring of N spheres of size S at (x,y); the
  sphere count `c` and radius `r` are the free knobs.
- `crystal` (91-115): generic 4-face 3D diamond parameterised by half-width,
  half-height and apex depth `d` (hard-coded 10).
- The ring loop (54-88) is the composition layer: count, radius, per-ring style
  coin-flip. A clean parameter object: `{rings, baseCount, countMult, maxRadius,
  beadCount, beadSize, crystalDepth, material}` with the style coin-flip made
  deterministic per ring (e.g. from an array) to remove the 50/50 mode draw.
