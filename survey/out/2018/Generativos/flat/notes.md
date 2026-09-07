---
sketch: 2018/Generativos/flat
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1603
animated: false
techniques: [grid, distortion, polar, noise-driven]
primitives: [shape]
palette:
  colors: ["#17E5DB", "#5442AE", "#A64AC9", "#FD6519", "#FDCF00", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: warpedGrid, signature: "warpedGrid(n, powX1, powX2, powY1, powY2) -> quad[][]", note: "square grid distorted by per-row/column power exponents; each quad returned as 4 corners"}
  - {name: rosette, signature: "rosette(cx, cy, rw, rh, layers, c1, c2, res) -> void", note: "concentric ring fan built from per-segment triangles, colour lerped by sin(angle)"}
  - {name: edgeShade, signature: "edgeShade(quad, alpha, spread) -> void", note: "thin translucent black slivers straddling a quad's edges for a paper-cut crease look"}
---

## What it draws
A full-bleed low-poly mosaic: a square grid warped into wedge-shaped cells
(compressed into thin slivers along the left/bottom, fanning out into large
triangles toward the right/top). Every cell is split into two triangles, each
painted a different random colour from a six-colour palette (teal, purple,
magenta, orange, yellow, white), with faint black shadow slivers along the
edges that read as folded paper. In the centre of each cell sits a small
radial rosette of concentric rings and fan segments, gradient-shaded between
two random palette colours; rosette sizes vary smoothly across the canvas.

## How the code works
- `setup()` (L3-8): 960x960 P2D, `smooth(8)`, then `generate()`. `draw()` is
  empty (L10-11) so the image is static; any key press re-seeds and
  regenerates (L13-19). `pixelDensity(2)` warns "not available" on the
  headless display.
- `generate()` starts with `randomSeed(seed)` (L23). L25-32 paint a full-canvas
  background quad split into two `rcol()` triangles (mostly hidden later).
- L33: `cc = int(random(4, random(40)))` — grid resolution, roughly 4..40
  cells per side.
- L35-43: four power exponents `px1/px2/py1/py2`, each `random(1,4)` or
  (50%) `random(0.25,1)`. L59-66 map each grid coordinate through
  `pow(v, exponent)` with the exponent itself interpolated across rows/columns,
  warping the square lattice into the wedge pattern (exponent > 1 compresses
  cells near 0, i.e. the left/bottom edge).
- L52-85: per cell, a quad is drawn as two triangles (L79-81 and L82-84),
  each `fill(rcol())` — a random pick from the 6-colour `colors[]`
  (L214-219). This two-tone split is the main faceted look.
- L88-125: four shadow slivers, one per cell edge: a quad from an edge's two
  corners to two points offset ±10px outward, `fill(0,30)` fading to
  `fill(0,0)`. L138-147 repaint the cell quad (again two-tone) on top, so only
  the half of each sliver spilling over the neighbouring cell survives — a soft
  crease line along every edge.
- L150-184: per-cell rosette. Two distinct random palette colours `c1`, `c2`
  (L150-152), midpoint colour `mc = lerpColor(c1,c2,0.5)` (L153); centre at the
  cell's diagonal midpoint (L154-155). For 4 concentric layers `l`
  (L157), radius scale `r = noise(des+cx*det, des+cy*det) * map(l,0,4,0.4,0)`
  (L158): 2D noise (detail `det = random(0.01)`, offset `des = random(1000)`)
  modulates the size, and the layer index shrinks rings from 40% to 10% of the
  cell diagonal. Each layer is tessellated into `res = max(4, max(rw,rh)*PI)`
  segments (L161): an outer ring quad shaded `fill(0,10)`-to-transparent
  (L167-174) plus a fan segment from centre filled
  `lerpColor(c1, c2, sin(ang)*0.5+0.5)` (L176-182) — the gradient rosette.
- Randomness enters only via `randomSeed(seed)` at the top of `generate()`:
  cell count, exponents, every cell colour, shadow-free, rosette colours and
  the noise offset.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `warpedGrid` (the `pow()`-distorted lattice, L54-75) is the most reusable
  block: a pure function of `(n, px1, px2, py1, py2, width, height)` returning
  per-cell quad corners; the power-exponent trick is the interesting part.
- `rosette` (L157-184) is self-contained given `(cx, cy, rw, rh, layers, c1,
  c2)`; the `sin(ang)` colour lerp and the `noise`-scaled radius are the
  tunable knobs.
- The two-tone triangle split + `edgeShade` slivers (L77-147) together form the
  "paper-cut" effect; generic enough to attach to any quad mesh.
- One-off art decisions: the 6-colour palette (L214) and the choice to
  regenerate on keypress. A clean parameter object:
  `{seed, cc, [px1, px2, py1, py2], palette, shadowAlpha (30), rosetteLayers (4), det, des, noiseScale (0.4)}`.
