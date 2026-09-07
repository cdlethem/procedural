---
sketch: 2018/Generativos/moscas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1663
animated: false
techniques: [polar, symmetry]
primitives: [shape, ellipse]
palette:
  colors: ["#FFFFFF", "#0A0A0A"]
  selection: fixed
composition: scattered
parameters:
  - {name: fanCount, default: 50, tried: [15], change: large, effect: "15 fans each clearly distinct (striated rim + dark centre); most of the canvas black"}
  - {name: segRange, default: "random(350, 540)", tried: ["random(40, 80)"], change: moderate, effect: "coarser hatch: wide black gaps between slivers, fans become spiky starbursts"}
  - {name: sizeMax, default: "width*random(0.5)", tried: ["width*random(0.15)"], change: large, effect: "small fans: dense mesh of small rings with dark centres, less solid coverage"}
  - {name: c2alpha, default: 40, tried: [255], change: moderate, effect: "fans denser and brighter; hairline dark gaps reduced, same structure"}
  - {name: innerFraction, default: "s*random(0.5, 0.8)", tried: ["s*random(0.85, 0.95)"], change: large, effect: "thin annulus: fans become thin bright rings with big dark centres, web of circles"}
reusable_candidates:
  - {name: radialFan, signature: "radialFan(x, y, innerR, outerR, phase, segments, colorA, colorB)", note: "ring of N thin triangles (slivers) between two radii, alternating fills — dense radial hatch / pinwheel fan"}
---

## What it draws
A nearly black canvas covered by ~50 large overlapping radial fans. Each fan is a
bright white disc with fine radial striations (hundreds of thin slivers) around a
dark circular hole at its centre, plus a small faint dot and a soft halo at the
exact centre. Fans overlap and merge into a dense web; the dark holes read as
black circles of various sizes, and the striated white areas fill the rest of
the 960x960 frame edge to edge.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static
(lines 4-13). `generate()` (lines 23-49):

- `randomSeed(seed)` then `background(10)` — near-black background (line 29).
- Loop of 50 iterations (line 36): random centre `(xx, yy)`, random size
  `s = width*random(0.5)` (line 39).
- Palette: `rcol()` picks from the 6-colour `colors[]` list (lines 40-41, 192),
  but `c1`/`c2` are immediately overwritten with white alpha 255 and white
  alpha 40 (lines 42-43), so the named palette is never actually drawn.
- A faint halo: `fill(255, 20)` + `ellipse(xx, yy, s*0.1, s*0.1)` (lines 44-45).
- `estrella(xx, yy, s*random(0.5, 0.8), s, random(TAU), int(random(350, 540)), c1, c2)`
  (line 46): the core of the piece. `estrella()` (lines 51-67) sets
  `r1 = s1*0.5`, `r2 = s2*0.5`, `da = TAU/seg`, then for `seg` (350-540)
  iterations draws one closed 3-vertex shape: vertices at inner radius r1 at
  angle a1, outer radius r2 at angle a2 = a1 + da/2, inner radius r1 at
  a1 + da. Each is an extremely thin triangle (sliver) spanning the annulus
  r1..r2; the ~400 stacked slivers tile that annulus into a bright
  radial-hatch ring with hairline dark gaps (background showing through).
  The disc of radius r1 is never filled, which is the dark central hole.
- `ellipse(xx, yy, s*0.02, s*0.02)` (line 47) with the leftover `fill(255, 20)`
  is the small faint centre dot.

Dead code: the `Fish` class (lines 94-190, a noise-field flow follower with
`des`/`det`), `arc2()` (lines 74-92), `colors[]`/`rcol()`/`getColor()` (lines
192-204) and the computed-but-unused `cc`/`ss` (lines 31-32) are leftovers
from an earlier animated version and never execute in this render.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_15 | `for (int i = 0; i < 50; i++) {` -> `for (int i = 0; i < 15; i++) {` | large | 15 fans, each clearly distinct: bright striated rim around a dark centre; most of the canvas is black | variants/count_15/frame_00001.png |
| seg_40_80 | `int(random(350, 540))` -> `int(random(40, 80))` | moderate | coarser hatch: wide black gaps between slivers; fans read as spiky starbursts / gears | variants/seg_40_80/frame_00001.png |
| size_0.15 | `float s = width*random(0.5);` -> `float s = width*random(0.15);` | large | small fans: dense mesh of small rings with dark centres, much less solid white coverage | variants/size_0.15/frame_00001.png |
| c2alpha_255 | `c2 = color(255, 40);` -> `c2 = color(255, 255);` | moderate | fans denser and brighter, hairline dark gaps between slivers reduced; same structure | variants/c2alpha_255/frame_00001.png |
| inner_0.9 | `s*random(0.5, 0.8)` -> `s*random(0.85, 0.95)` | large | thin annulus: fans become thin bright rings with large dark centres, forming a web of circles | variants/inner_0.9/frame_00001.png |

## Modularisation notes
- `estrella()` is the reusable primitive: a radial sliver fan
  `radialFan(x, y, innerR, outerR, phase, segments, colorA, colorB)` — the
  alternating fills and hairline gaps are what produce the hatch look; a
  `gap` parameter (angular offset of the outer vertex) would make the
  pinwheel/hatch behaviour explicit.
- One-off art decisions: 50 scattered fans, size distribution `width*random(0.5)`,
  segment count 350-540, the white-on-black palette override, centre dot + halo.
- A clean parameter object: `{ count, sizeMin, sizeMax, segMin, segMax,
  innerFraction, outerSize, colorA, colorB, bgColor, centerDot, halo }`.
- The `Fish`/`arc2`/`colors[]` blocks should be deleted in any port; they are
  an unused alternate design (animated noise-field fish with a 6-colour palette).
