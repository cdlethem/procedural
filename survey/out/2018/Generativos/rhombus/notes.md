---
sketch: 2018/Generativos/rhombus
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1550
animated: false
techniques: [recursion, symmetry]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#FFC7E3", "#FFCC01", "#48BD04", "#003398"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
parameters:
  - {name: count, default: 100, tried: [25], change: large, effect: "fewer figures: bright green background shows through, figures sparse"}
  - {name: sub, default: 10, tried: [4], change: large, effect: "shallower nesting: flat 4-point stars instead of deep funnels, much smaller, background visible"}
  - {name: alp, default: 100, tried: [200], change: large, effect: "darker black-tinted shade facets, stronger contrast, image overall darker"}
  - {name: s, default: 0.5, tried: [0.05], change: large, effect: "figures ~10x smaller: small nested stars on dark field with faint large rhombus shadows"}
  - {name: depthRatio, default: "sqrt(4/5)", tried: ["sqrt(4/2)"], change: large, effect: "steeper/faster funnel: figures larger and deeper, canvas mostly covered, green only in gaps"}
  - {name: rhombusFacets, signature: "drawRhombus(x1, y1, x2, y2, color, alpha) -> void", note: "render a line segment as a 3D-looking funnel: central triangles in the fill colour, four side quads shaded with black at fixed alpha"}
---

## What it draws
A full-bleed scatter of roughly a hundred nested "funnel" figures on a dark olive
background. Each figure is a small stack of rotated squares that shrink toward the
centre, looking like an open 3D pyramid or square spiral. Facets alternate between
solid palette colours (white, pink, yellow, green, blue) and darker black-tinted
versions of those colours, giving every figure a faceted, folded-paper look.
Figures are placed at random positions and rotations at random scales, so the
canvas is a dense collage of differently-sized funnels, some tiny, some large.

## How the code works
`setup()` (rhombus.pde:3-8) sets 960x960 P2D, `smooth(8)`, then calls `generate()`
once; `draw()` is empty, so the sketch is static (key press regenerates).

`generate()` (21-54): `randomSeed(seed)`, `background(rcol())` picks one of the 5
palette colours at random (157-160). Then 100 iterations (line 26):
- an initial horizontal line of half-length `s = random(0.5)` centred at the origin (27-30);
- `sub = 10` times (31-35): take the **last** line and append `getLine()` (137-144),
  which is the perpendicular line through the same centre with half-length
  `des = h*sqrt(4./5)` — i.e. each step rotates 90° and shrinks by `sqrt(4/5)` (~0.894),
  building a 4-fold symmetric nested star of 11 lines;
- the stack is translated to a random position and rotated by `random(TAU)` (38-40);
- the lines are drawn from largest to smallest (44-51). Each line's colour is
  `rcol()`, re-drawn until it differs from the previously drawn line's colour (46-47),
  so adjacent nested levels never share a colour.
| count_25 | `for (int j = 0; j < 100; j++)` -> `j < 25` | large | sparse: bright green background now visible between ~25 unchanged nested funnel figures | variants/count_25/frame_00001.png |
| sub_4 | `int sub = 10;` -> `int sub = 4;` | large | figures collapse to flat 4-pointed stars (4 facets + small 1-2 level centre), far smaller, no deep tunnel; green background shows through | variants/sub_4/frame_00001.png |
| alp_200 | `float alp = 100;` -> `float alp = 200;` | large | same layout as baseline but the black-tinted side facets are much darker (near-black in deep areas); stronger contrast, overall darker | variants/alp_200/frame_00001.png |
| s_0.05 | `float s = random(0.5);` -> `random(0.05);` | large | all figures ~10x smaller: small coloured nested stars scattered over a dark olive field with faint large soft rhombus shadows | variants/s_0.05/frame_00001.png |
| des_sqrt2 | `float des = h*sqrt(4./5);` -> `h*sqrt(4./2);` (drawRhombus block) | large | funnels steeper and figures larger/deeper; canvas almost fully covered, green visible only in gaps | variants/des_sqrt2/frame_00001.png |
the dark "folded" facets (80-114). `des = h*sqrt(4./5)` sets the funnel's depth;
`shw = h*0.8` sets how far the invisible (alpha 0) vertices extend past the
endpoints, which shapes the silhouette of each nested square.

Randomness enters at: background colour, per-figure position/rotation/scale
(`s`), and per-level colour. The nesting structure itself is deterministic given
`sub` and the ratio `sqrt(4./5)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic**: `nestedPerpendicularLines` (iterative rotation-by-90° + shrink) is a
  reusable pattern generator; `drawRhombus` is a self-contained primitive that turns
  any segment into a faceted funnel with a depth ratio, shade alpha, and extend
  factor as parameters. The "adjacent levels get different colours" loop (46-51) is a
  small reusable helper.
- **One-off art decisions**: the 5-colour palette, the specific ratios
  `sqrt(4/5)` (depth) and `0.8` (extension), alpha 100 for the shading, 100 figures,
  10 nesting levels, initial size `random(0.5)`.
- **Clean parameter object**: `{count, nestDepth, depthRatio, extendFactor,
  shadeAlpha, sizeRange, palette, seed}` — everything else in the sketch is wiring.
