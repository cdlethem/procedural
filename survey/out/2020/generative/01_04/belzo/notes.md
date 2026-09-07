---
sketch: 2020/generative/01_04/belzo
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3124
animated: false
techniques: [grid, distortion, noise-field]
primitives: [shape]
palette:
  colors: ["#8A8DE2", "#F9C827", "#F2DEE4", "#0A1835"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: flowerCount, default: 40, tried: [10], change: moderate, effect: "fewer, sparser grids with larger black gaps"}
  - {name: repellerCount, default: 20, tried: [6], change: large, effect: "much weaker distortion; grids stay flat and straight"}
  - {name: repellerRadius, default: "random(60, 380)", tried: ["random(60, 140)"], change: moderate, effect: "smaller influence zones; straighter grid, local dents"}
  - {name: strr, default: "random(0.6, 0.8)", tried: ["random(2.0, 2.8)"], change: large, effect: "strips ~3-4x thicker; bold ribbons instead of hairlines"}
  - {name: ampD, default: 0.1, tried: [0.6], change: subtle, effect: "no visible change"}
  - {name: palette, default: "[#8A8DE2, #F9C827, #F2DEE4, #0A1835]", tried: [["#8A8DE2", "#04EDC2", "#F2DEE4", "#0A1835"]], change: subtle, effect: "teal strips replace yellow; geometry identical"}
reusable_candidates:
  - {name: repulsionDisplace, signature: "repulsionDisplace(x, y, strength, points: (x, y, radius)[]) -> (x, y)", note: "push a point away from every repeller whose radius covers it, with pow(1 - dis/r, 1.3) falloff scaled by strength"}
  - {name: paletteLerp, signature: "paletteLerp(palette: int[], v: float) -> int", note: "walk a palette by a float index, lerping between adjacent entries with a pow-eased fraction"}
  - {name: warpGrid, signature: "warpGrid(x, y, size, cell, width, displace, zWave, fillFn) -> void", note: "draw a square grid of thin filled strips (vertical + horizontal QUAD_STRIPs), per-strip displaced and z-warped"}
---

## What it draws
On a pure black background, 40 overlapping square wireframe-like grids ("flowers") of varying
sizes are scattered across the canvas. Each grid is made of thin (~1–2 px) filled strips,
coloured periwinkle blue, yellow, pale pink and cream, and the lines are strongly warped and
curved — they bend, bulge and avoid roughly a dozen soft circular "holes", so the whole
composition reads as crumpled mesh cloth with puffy 3D relief.

## How the code works
- `setup()` -> `generate()` (belzo.pde:21-22); `draw()` is empty, so the image is static
  (regeneration only via key press, :36-42).
- `generate()` (:46-75) seeds RNG/noise with `seed`, paints `background(0)`, then creates 20
  random repeller points `points` with random positions and radii 60–380 (:65-70), and calls
  `flower()` 40 times at random positions with size up to `width*0.4` (:72-74).
- `flower(x, y, s)` (:77-139): divides the square into `cc = s/10` strips. For each of the `cc`
  columns it draws a vertical `QUAD_STRIP` (:99-119) and for each row a horizontal one
  (:121-137). Each strip is a chain of quads only ~`2*(0.6+0.4*noise)*strr` px wide (strr ~
  0.6–0.8, :87, :109), so the filled strips read as thin lines.
- Every vertex is passed through `def(x, y, v)` (:141-154): for each repeller within its radius
  the point is pushed radially outward by `dis * pow(1 - dis/r, 1.3) * v * 1.4`. The strength
  factor `v` is `1 - min(|i/cc*2-1|, |j/div*2-1|)` (:107, :125): zero at the grid border, 1 at
  its centre — so grid interiors deform most while edges stay anchored. This is what carves the
  curved "holes".
- A tiny sinusoidal z-offset `z = sin(...)*ampD` (ampD = 0.1, :88-89, :112, :130) adds slight
  3D relief under the default P3D perspective.
- Colour: `getColor(ic + j*dc + (i/2)%2)` (:114, :132) walks the 4-colour palette
  (:164) with a per-flower random start `ic` and random drift `dc = random(0.003)` (:97-98),
  lerping between adjacent palette entries (:174-180); alpha 250.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| flowers_10 | `for (int i = 0; i < 40; i++) {` -> `for (int i = 0; i < 10; i++) {` | moderate | only ~5 large grids; canvas mostly black, per-grid bulges stand out | variants/flowers_10/frame_00001.png |
| repellers_6 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 6; i++) {` | large | distortion greatly weakened: grids stay flat and straight, only a few round bulges | variants/repellers_6/frame_00001.png |
| repelRadius_140 | `float ss = random(60, 380);` -> `float ss = random(60, 140);` | moderate | influence zones smaller: long straight grid stretches with small local dents instead of sweeping curves | variants/repelRadius_140/frame_00001.png |
| strr_2.4 | `float strr = random(0.6, 0.8);` -> `float strr = random(2.0, 2.8);` | large | same warping, strips ~3-4x thicker: bold woven ribbons instead of hairlines | variants/strr_2.4/frame_00001.png |
| ampD_0.6 | `float ampD = 0.1;` -> `float ampD = 0.6;` | subtle | no visible change (z-offset is far smaller than the 2-D displacement) | variants/ampD_0.6/frame_00001.png |
| palette_teal | `int colors[] = {#8A8DE2, #F9C827, #F2DEE4, #0A1835};` -> `{#8A8DE2, #04EDC2, #F2DEE4, #0A1835};` | subtle | teal strips replace the yellow ones; geometry and density identical | variants/palette_teal/frame_00001.png |

## Modularisation notes
- Generic, library-ready: `def()`/repulsion displacement (a pure point-warper over a list of
  `(x, y, radius)` sources with a falloff curve) and `paletteLerp` (palette walk). The
  grid-of-thin-strips drawing loop is also reusable if parameterised (cell count, strip width,
  displace function, z-wave function, fill function).
- Art-specific decisions: the number of repellers (20) and their radii (60–380), the "inside-
  ness" strength mask `v`, the 0.1 z-amplitude, the 4-colour palette and per-flower colour
  drift `dc`, and the choice to fake lines with ~1.5 px filled quads (needed because the
  strips are `QUAD_STRIP`s with no meaningful stroke).
- A clean parameter object: `{count, maxFlowerSize, repellers: (x, y, r)[] or (count, rMin, rMax),
  cellSize, stripWidth, noiseDetail, zAmp, palette, colorDrift, falloffPow}`.
