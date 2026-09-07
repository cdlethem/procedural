---
sketch: 2017/Generativos/spiral2
year: 2017
renderer: P2D
size: [920, 920]
libraries: []
deterministic: true
ms_first_frame: 1668
animated: false
techniques: [spiral, polar]
primitives: [shape]
palette:
  colors: ["#EAA104", "#F9BBD1", "#51D17C", "#47A1BC", "#EA2525"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: discCount, default: 20, tried: [6], change: large, effect: "fewer discs; bigger pinwheels with black background visible between them"}
  - {name: sub, default: 32, tried: [96], change: large, effect: "3x angular segments per ring; cells much finer, discs read as dense radial fans"}
  - {name: div, default: 32, tried: [16], change: large, effect: "half the rings; radial cells 2x thicker, coarser bladed look"}
  - {name: twistFactor, default: 0.2, tried: [0.8], change: large, effect: "4x per-ring twist; arms wind into clear multi-turn spirals"}
  - {name: dc, default: "int(random(1,10))", tried: ["int(random(1,2))"], change: large, effect: "much slower hue advance per segment; arms hold one colour in long sector-like stretches"}
reusable_candidates:
  - {name: spiralDisc, signature: "spiralDisc(x, y, radius, rings, segments, twistPerRing, colorSpeed) -> void", note: "quadrilateral cells in polar space with per-ring angular twist, colour lerp'd along a palette walk"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], t) -> color", note: "getColor(): walk a palette with linear interpolation between adjacent entries"}
---

## What it draws
A black canvas almost fully covered by large, overlapping pinwheel/spiral discs of vivid
segments (dominant orange, teal and green, with red and pale pink accents). Each disc is
a many-armed spiral of flat quadrilateral cells whose hue cycles around the arms; a few
discs are so small they read as tight little coils (bottom-left corner). The cells are
crisp flat colour with no strokes.

## How the code works

`setup()` (L3-8) sizes a 920x920 P2D canvas and calls `generate()`. `draw()` (L10-17)
does nothing (regeneration only on key press), so the image is static.

`generate()` (L29-40): `background(0)`, then places 20 discs at random positions
(`random(width)`, `random(height)`, L34-35) with random radii
`s = random(0.1, 0.8)*width*random(0.1, 1)` (L36) — the double random makes radii span
~9 px to ~740 px, hence the mix of canvas-covering giants and tiny coils.

`cir()` (L42-77) draws one disc as `div`=32 concentric rings of `sub`=32 quadrilateral
cells (L43-44). The spiral twist comes from `da2 = TWO_PI/sub*random(0.2)` (L46): each
ring j is rotated by `da2*j` (L50-51), so the arms wind around the centre. Each cell
(L60-65) is a quad between ring radii `d1 = j*s/32` and `d2 = (j+1)*s/32` and angles
`a1..a2` plus the per-ring twist offsets. A second, nearly transparent quad (L66-74,
`fill(0, 0/16/30)`) is drawn over each cell — a faint darkening gradient toward the
outer corner, barely visible.

Colour: `getColor` (L85-91) takes a float, mod it by palette length, and lerpColors
between two adjacent entries of the 5-colour palette (L80). Inside `cir` the walk is
`dc*i + dc2*j` (L58) where `dc = int(random(1,10))*colors.length/sub` (L47) sets how
many palette steps the hue advances per angular segment and `dc2 =
random(colors.length)*random(0.4)` (L48) how much it shifts per ring — producing the
cycling hue around arms and the banded rings.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_6 | `for (int i = 0; i < 20; i++)` -> `for (int i = 0; i < 6; i++)` | large (mean 0.2102, 0.733) | few discs; bigger pinwheels, black background visible between them | variants/count_6/frame_00001.png |
| sub_96 | `int sub = 32;` -> `int sub = 96;` | large (mean 0.1558, 0.577) | 3x finer angular cells; dense radial-fan look, tiny coil in lower-left much finer | variants/sub_96/frame_00001.png |
| div_16 | `int div = 32;` -> `int div = 16;` | large (mean 0.1708, 0.624) | half the rings; thicker radial cells, coarser bladed fans | variants/div_16/frame_00001.png |
| twist_0.8 | `float da2 = TWO_PI/sub*random(0.2);` -> `float da2 = TWO_PI/sub*random(0.8);` | large (mean 0.1861, 0.697) | 4x twist per ring; arms wind into clear multi-turn spirals (top-centre disc) | variants/twist_0.8/frame_00001.png |
| dc_1 | `float dc = int(random(1, 10))*colors.length*1./sub;` -> `float dc = int(random(1, 2))*colors.length*1./sub;` | large (mean 0.2234, 0.781) | hue advances far slower per segment; long single-colour sector-like arms, banded rings | variants/dc_1/frame_00001.png |

Note: with the fixed seed 42 every substitution also reflows the shared `random()`
stream, so disc positions/sizes differ between variants too; the "large" scores
include that layout shift, not only the intended parameter effect.

## Modularisation notes
- `cir()` is fully generic: position, radius, twist, ring/segment counts and the two
  colour-walk speeds are already parameters — a clean `spiralDisc` library function
  with signature above. The `div`/`sub` constants and `random(0.2)` twist factor are
  the artistic decisions to expose.
- `getColor` is a standalone palette utility (`paletteLerp`), reusable by any sketch
  that walks a fixed palette with lerp.
- `generate()`'s 20-disc random scatter (count, radius range) is a composition
  parameter object: `{count, radiusMin, radiusMax, positions}`.
- The near-transparent overlay quad (L66-74) is a one-off shading trick; optional
  `shading` flag, default off (effect is negligible, alpha 0-30/255).
