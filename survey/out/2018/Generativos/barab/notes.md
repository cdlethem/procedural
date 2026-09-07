---
sketch: 2018/Generativos/barab
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1659
animated: false
techniques: [subdivision, grid, noise-field, curves]
primitives: [rect, shape, ellipse]
palette:
  colors: ["#FE1451", "#00EFF1", "#0001DD", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: guillotineSplit, signature: "guillotineSplit(cells, splits) -> Rect[]", note: "recursive long-axis subdivision of a rectangle list"}
  - {name: lollipopLine, signature: "ll(x1, y1, x2, y2)", note: "thin line with semicircular end caps (beginShape)"}
  - {name: arcBands, signature: "arc2(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "concentric low-alpha annular band, quad-per-step"}
  - {name: paletteLerp, signature: "getColor(v) -> color", note: "lerp between adjacent palette colors for a noise-driven value"}
---

## What it draws
Full-bleed 960x960 poster-like composition. The canvas is recursively cut into a mosaic of rounded-rectangle cells (squircles); each cell is filled flat with magenta, cyan, blue or black, or left near-white with a thin black outline. Inside many cells sits a soft radial halo (dark or tinted core fading into a faint ring). A fine dot-matrix texture covers the whole background. Thin black lines connect the centers of nearby cells, ending in small dots, and about one in ten cells carries an inscribed diamond (rhombus) in a contrasting palette color.

## How the code works
`setup()` (L3-12) calls `generate()` (L35) once; the sketch is static (draw() empty, L14-16).
- Ground: `background(250)` light grey (L38); a 96x96 grid with `sep=10` (L40) places at every node a 4x4 square `fill(220,40)` plus a 2x2 dot colored by `getColor(noise(...))` at alpha 20 (L50-53) -> the speckled dot-matrix ground.
- Subdivision: starts from one inner rect (L58); `sub = int(random(4000)*random(1)*random(1))` splits (L59). Each split picks a random rect and cuts it along its long axis (L64-65: wider-than-tall => cut width, else height) at a random position (L67, L73) -> final count is roughly `sub+1` cells.
- Connectors: O(n^2) pair loop (L85-95); pairs whose centers are within `min(short side of both rects) * sep * 1.8` (L90) get an `ll()` (L143-162) shape: a thin lollipop line with semicircular caps at both ends, `fill(rcol(), 250)` -> the thin linking lines with dots.
- Cell decoration (L102-140): each cell gets either a flat rounded rect in a random palette color (L105-107) or a near-white rounded rect with black stroke and faint tint (L108-111), corner radius random up to `min(w,h)*sep*0.5` (L104, L113). 10% of cells get an inscribed diamond `beginShape` (L117-126). The soft halo is layered low-alpha fills: a noise-colored ellipse at alpha 8 (L129), a faint stroke ring (L130-131), and three concentric annular bands via `arc2()` (L134-136) at alpha 50/20/20 -> the radial glow around each cell center.
- Color: `rcol()` (L194-196) picks uniformly from the 4-color palette (L192); `getColor(v)` (L200-206) lerps between adjacent palette colors -> noise-driven tint for dots and halos.
- Randomness enters only through the seeded `random()` state (L36-37); every visual property (fill choice, radius, diamond, halo color, split positions) is drawn from it.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic, library-ready: the guillotine subdivision (long-axis recursive split of a rect list), `ll()` lollipop connector, `arc2()` annular band, `getColor()` palette lerp, and the dot-matrix ground (grid of two-size rects, noise-tinted). One-off art decisions: the specific 4-color palette, the 10% diamond overlay, the `1.8*sep` connector threshold, the halo layering recipe (alpha-8 ellipse + three 50/20/20 bands), corner-radius scale. A clean parameter object: `{sep, sub, palette[], diamondP, lineThresh (in units of sep), cornerFactor, haloAlphas[3]}`.
