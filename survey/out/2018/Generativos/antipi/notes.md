---
sketch: 2018/Generativos/antipi
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1683
animated: false
techniques: [subdivision, 3d-mesh, grid]
primitives: [rect, shape]
palette:
  colors: ["#D5E486", "#24C0F2", "#E3BBE4", "#06F8F7", "#1B1A36", "#E5244D", "#1412CE", "#FEBD9F", "#A861AD", "#969ECC", "#EB6156", "#E94A6A"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(start: PVector, iterations: int) -> PVector[]", note: "repeatedly pick a random quad and replace it with 4 half-size children (stochastic quadtree)"}
  - {name: pyramidFan, signature: "pyramidFan(x, y, size, height, div, palette) -> void", note: "draw a quad as a low pyramid: fan of gradient triangles from center apex over top, striped trapezoids on the 4 sides"}
  - {name: rcol, signature: "rcol(palette: int[]) -> int", note: "random color from a fixed list"}
---

## What it draws

A full-bleed mosaic of slightly tilted quads seen in perspective, each rendered as a shallow
pyramid: its top face is a pinwheel fan of thin triangles radiating from a central apex, and its
four side faces are banded stripes. Every triangle is a smooth gradient between random bright
colours (cyan, pink, red, blue, orange, yellow), punctuated by near-black navy triangles. A few
large, mostly-flat quads (solid or sparsely striped purple, mauve and grey) sit among the dense
small fans, giving a strong mix of coarse and fine scale.

## How the code works

- `setup()` (line 3) calls `generate()` once; `draw()` (line 10) is empty (regeneration commented
  out), so the image is static. `keyPressed` re-rolls the seed, but the harness only seeds it.
- `generate()`: black background (line 24), `randomSeed(seed)` (line 25) makes everything
  deterministic per seed. Perspective: `fov = PI/random(1.4, 4)` (line 27), world pushed to
  `z = -900` (line 31), then small random rotations up to `±0.3π` about X/Y/Z (lines 32-35) —
  this is the slight tilt of the plane.
- Subdivision (lines 37-50): one starting quad of `size*width` (size = 5, so 5× the canvas,
  lines 37-39). Then `sub = int(random(20, 1000))` times: pick a random quad from the list and
  replace it with its four half-size children (lines 41-50). Result: an irregular mosaic of quad
  sizes, ~`sub` quads total.
- Drawing (lines 53-160): for each quad, a base `rect` is drawn first (line 55, fill 100/stroke
  255, mostly covered). Then `div = int(random(2, 12))` (line 59) splits each of the 4 sides into
  `div` slices; each slice draws two triangles (lines 130-158): a top face from the center apex at
  `z = hh*0.5` (line 142) to two points on the side at `z = hh`, and a side face from `z = 0` to
  `z = hh`. `fill(rcol())` is set per vertex (lines 141-153), so every triangle interpolates
  between two random palette colours — that vertex-color gradient is the pinwheel look.
- Colour: `rcol()` (lines 169-171) picks uniformly from the 12-colour `colors[]` array
  (line 168); `getColor()` (lines 175-181, unused in the active path) would lerp between
  adjacent palette entries.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes

- The stochastic quadtree loop (lines 38-50) is fully generic: given a start quad and an
  iteration count, "replace a random quad with 4 children". Reusable as
  `quadSubdivide(start, iterations)`.
- The per-quad drawing (lines 53-160) is a "gradient pyramid fan": parameterisable by quad
  position/size, apex height scale, side-division count, and palette. The large commented-out
  block (lines 67-127) shows an earlier variant (flat per-face `rcol()` fills + white strokes);
  the active per-vertex fills are the art decision that gives the gradient fans.
- `rcol()` / `getColor()` (lines 169-181) are a small palette-sampler module: random-from-list
  and lerp-between selection modes.
- One-off art decisions: the 5×-canvas world size, the `2..12` division range, the `20..1000`
  subdivision range, the 12-colour palette, the ±0.3π rotation limit and z = -900 camera.
- A clean parameter object: `{seed, fov, cameraZ, rotationMax, worldSize, subdivisions,
  divMin, divMax, apexHeightScale, palette}`.
