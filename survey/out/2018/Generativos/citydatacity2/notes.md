---
sketch: 2018/Generativos/citydatacity2
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1728
animated: false
techniques: [subdivision, grid]
primitives: [ellipse, rect, shape]
palette:
  colors: ["#3520A6", "#68FB77", "#FB8F2D", "#F0F962", "#874BAB"]
  selection: random-from-list
composition: full-bleed
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(rect, iterations, minSize, keepProb) -> Rect[]", note: "stochastic quadtree: split a random rect into 4 children at random 30-70% points, with min-size guard and optional per-child keep probability"}
  - {name: gradientQuad, signature: "gradientQuad(x, y, w, h, c1, c2, alpha, horizontal) -> void", note: "beginShape quad with 2 vertex colours per half, giving a 2-stop linear gradient (vertical or horizontal)"}
parameters:
  - {name: sub, default: "random(20)*random(0.1,1)", tried: ["random(200)*random(0.1,1)"], change: large, effect: "more outer quadtree splits: canvas fills with many small overlapping ellipses, mosaic covers almost everything, black gaps nearly gone"}
  - {name: max, default: 20, tried: [2], change: none, effect: "no visible change: with this seed the outer quadtree is shallow enough that the 20-px min-size guard never triggers, so lowering it to 2 alters nothing"}
  - {name: sub2, default: "random(400)*random(1)", tried: ["random(4000)*random(1)"], change: large, effect: "deeper inner quadtree: mosaic cells much smaller, circles read as fine pixelated texture instead of patchy blocks"}
  - {name: alp, default: "random(256)", tried: [255], change: large, effect: "opaque cells: hard-edged flat blocks, no soft colour blending between overlaps; mosaic looks more solid/painterly"}
  - {name: colors, default: "{#3520A6, #68FB77, #FB8F2D, #F0F962, #874BAB}", tried: ["{#001E5C, #007EC0, #00BCD4, #98C1D9, #E0FBFC}"], change: large, effect: "same geometry, cool blue/white palette replaces saturated yellow/green/orange; confirms layout is seed-driven and independent of palette"}
  - {name: ss, default: 1, tried: [6], change: moderate, effect: "6-px corner squares at each mosaic cell corner: visible dotted grid texture over the cells"}
---

## What it draws
A 960×960 black canvas covered by several large circles and ellipses in the saturated palette
(bright yellow, neon green, violet, orange, indigo). Each circle is filled with a dense mosaic of
small squares, each square a soft two-tone vertical or horizontal gradient, so the interiors read
as pixelated, semi-transparent patchwork. Fine fragments of the same mosaic also scatter on the
black background around the circles. A few 1-px corner dots sit at the corners of the mosaic cells.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (keyPress regenerates).
`generate()` (lines 32-111):
1. `randomSeed(seed)`, `background(0)` (34-36).
   times (line 40): pick a random rect, split it into 4 children at a random 30-70% point on each
   axis, dropping the original. A min-size guard `max = 20` (line 41) skips splits whose children
   would be smaller than 20 px. Result: a set of non-overlapping rects tiling the canvas.
3. **Per-rect rendering** (61-99): for each outer rect, draw an `ellipse` centred on the rect with
   the rect's w/h as radii, filled with one random palette colour (63-64) — this is where the big
   circles come from. Then a **deeper inner quadtree** (66-80) subdivides the same rect up to
   `sub2 = int(random(400)*random(1))` times (line 68), min size `max2 = 4` (line 67), but each of
   the 4 children is kept only with probability 1-p1..p4 where p1..p4 ∈ [0, 0.2) (57-60, 75-78).
4. **Mosaic cells** (83-98): each inner rect is drawn by `rect2()` (113-132) as a 1-px-inset quad
   whose vertices carry two random palette colours at a random alpha `alp = random(256)` (115);
   Processing interpolates vertex colours, so each cell is a 2-stop linear gradient, split
   vertically or horizontally (114). Four 1-px corner rects (`ss = 1`, line 92) in random colours
   mark the cell corners.
Colour is always `rcol()` (186-188): uniform random pick from the 5-colour array at line 182.
`lerpColor`/`getColor` (189-197) and `arc2` (161-179) are unused. No blend modes, no stroke,
P2D renderer with `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_200 | `int sub = int(random(20)*random(0.1, 1));` -> `...random(200)...` | large (0.3568, 0.859) | canvas nearly filled: many small ellipses, fine mosaic covers almost all area, only thin black gaps; a few large flat regions remain | variants/sub_200/frame_00001.png |
| max_2 | `float max = 20;` -> `float max = 2;` | none (0.0, 0.0) | no visible change: image identical; the min-size guard never triggers for this seed's shallow outer quadtree | variants/max_2/frame_00001.png |
| sub2_4000 | `int sub2 = int(random(400)*random(1));` -> `...random(4000)...` | large (0.2157, 0.671) | much finer mosaic: small dense cells, circle interiors read as pixel-like texture, less large-block patchiness | variants/sub2_4000/frame_00001.png |
| alp_255 | `float alp = random(256);` -> `float alp = 255;` | large (0.2637, 0.772) | cells fully opaque: hard-edged flat blocks, later cells completely cover earlier ones, no translucent blending | variants/alp_255/frame_00001.png |
| palette_cool | palette array -> `{#001E5C, #007EC0, #00BCD4, #98C1D9, #E0FBFC}` | large (0.2385, 0.865) | identical composition recoloured in cool blues/whites; geometry unchanged, only hues differ | variants/palette_cool/frame_00001.png |
| ss_6 | `float ss = 1;` -> `float ss = 6;` | moderate (0.0619, 0.178) | 6-px corner squares mark every mosaic cell corner, adding a visible dotted grid over the patchwork | variants/ss_6/frame_00001.png |

## Modularisation notes
The generic, reusable core is the stochastic quadtree (`quadtreeSplit` above): it parameterises
iteration count, min child size, and per-child keep probability, and works at two scales in this
sketch (coarse layout rects vs fine mosaic cells). `gradientQuad` (2-stop linear gradient quad)
is also generic. One-off art decisions: drawing an inscribed ellipse per layout rect, the 1-px
corner dots, the specific 5-colour palette, and the choice to let the inner mosaic spill outside
the ellipse (no clipping). A clean parameter object would contain: `seed`, `outerIterations`,
`outerMinSize`, `innerIterations`, `innerMinSize`, `keepProbability` (per child), `alphaRange`,
`cornerDotSize`, `palette`.
