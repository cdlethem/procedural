---
sketch: 2018/Generativos/III
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1466
animated: false
techniques: [subdivision, grid, polar, symmetry]
primitives: [shape]
palette:
  colors: ["#2B3F3E", "#312A3B", "#F25532", "#43251B", "#C81961", "#373868", "#FFF8DC"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(random(40, 100)))", tried: [20, 70], change: large, effect: "subdivision iterations: 20 = larger, sparser cells; 70 = finer, denser cells"}
  - {name: sides, default: "pow(2, int(2+random(4)))*2 (8/16/32)", tried: [16], change: large, effect: "fixing to 16 removes the 8/32 spike-count variation -> uniform medium-density rosettes"}
  - {name: radius, default: "q.z*random(0.2, 0.9)", tried: ["q.z*random(0.4, 0.95)"], change: subtle, effect: "slightly larger central discs, shorter spikes; cell layout unchanged"}
  - {name: colors, default: "7-col warm magenta/orange/cream set", tried: ["cool blue/teal/olive/tan set"], change: large, effect: "whole image recoloured to the new palette, geometry identical"}
reusable_candidates:
  - {name: subdivideSquare, signature: "subdivideSquare(x, y, size, iterations, subMin, subMax) -> PVector[]", note: "recursive random subdivision of a square into a list of non-overlapping square cells"}
  - {name: rosette, signature: "rosette(x, y, size, sides, radius, palette) -> void", note: "central polygon + N radial spikes (each a random-coloured quad) fanning to the cell edges"}
---

## What it draws
A full-bleed mosaic of square cells in two or three sizes, produced by recursive subdivision. Each
cell is a radial "rosette": a central polygon/disc ringed by thin coloured spikes that fan out to
the square's edges, giving a starburst. Cells vary in spike density — some are one big smooth disc
(the large magenta polygon, bottom-left), others are dense multi-spike bursts (top-right). Dominant
colours are magenta/pink and orange-red, with cream, dark blue and dark teal; the background shows
through black in the gaps between spikes.

## How the code works
`setup()` (L3-9) opens a 960x960 P3D canvas, `smooth(8)`, calls `generate()` once; `draw()` is empty
so the piece is static. `keyPressed()` re-rolls the seed on any other key.

`generate()` (L22-77), with `randomSeed(seed)` (L26):
- **Subdivision** (L28-42): start with one quad covering the whole canvas — `PVector(x, y, z)` with
  `z` = cell size (L29). Repeat `sub = int(random(random(40, 100)))` times (L30): pick a random
  quad (L32), split it into `div x div` sub-quads where `div = int(random(2, 4))` (L34), append the
  sub-quads and remove the parent (L41). Result: a set of non-overlapping square cells of varying size.
- **Drawing** (L44-76): for each final cell, fill an axis-aligned square (L48-55) in a random colour;
  compute the centre (L56-57) and a radius `r = size*random(0.2, 0.9)` (L58). `getRect()` (L79-95)
  samples `div` points along the square's four edges (each corner subdivided, L87-92); `getCircle()`
  (L98-106) samples `div` points on the circle of radius `r` (L101-104). A loop (L63-75) connects each
  consecutive edge-point pair to the matching circle-point pair and fills that quad — this is what draws
  the radial spikes. `div` here is `int(pow(2, int(2+random(4))))*2` (L46) => 8, 16 or 32 points, so
  more points = denser, finer spikes.
- **Colour**: `rcol()` (L116-118) returns a random entry of the 7-colour palette (L114). Every shape —
  the square and each individual spike — gets an independent random colour, which is what makes the
  starbursts busy and multicolour.
- Renderer P3D + `smooth(8)` (L5) gives the soft antialiased edges.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_20 | `int sub = int(random(random(40, 100)));` -> `int sub = 20;` | large | larger, sparser cells (only ~4-5 across); a few big rosettes fill the bottom | variants/sub_20/frame_00001.png |
| sub_70 | `int sub = int(random(random(40, 100)));` -> `int sub = 70;` | large | much finer, denser grid of small rosettes; a couple of large ones remain | variants/sub_70/frame_00001.png |
| sides_16 | `int div = int(pow(2, int(2+random(4))))*2;` -> `int div = 16;` | large | every rosette has 16 spikes; uniform medium density, no sparse/dense mix | variants/sides_16/frame_00001.png |
| radius_0.40_0.95 | `float r = q.z*random(0.2, 0.9);` -> `float r = q.z*random(0.4, 0.95);` | subtle | subtle: central discs slightly larger, spikes a touch shorter; cell layout the same | variants/radius_0.40_0.95/frame_00001.png |
| palette_cool | `int colors[] = {#2B3F3E, #312A3B, ...};` -> cool blue/teal/olive/tan set | large | entirely recoloured to blues/teal/olive/tan; same geometry | variants/palette_cool/frame_00001.png |

## Modularisation notes
- `subdivideSquare` (L28-42) is generic and clean: a recursive random subdivision that returns a list of
  square cells. A library version would take `(x, y, size, iterations, subMin, subMax)`.
- The rosette (L44-76 + `getRect`/`getCircle`) is the reusable "generative tile": given a cell and a
  spike count + radius, draw a central polygon plus N radial spikes. Parameterise sides, radius range and
  palette.
- The 7-colour palette (L114) and `rcol()`'s independent-per-shape random pick are one-off art decisions,
  not reusable logic.
- A clean parameter object for this sketch: `{iterations, subMin, subMax, sides, radiusMin, radiusMax, palette}`.
