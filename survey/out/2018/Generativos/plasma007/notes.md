---
sketch: 2018/Generativos/plasma007
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1517
animated: false
techniques: [grid, polar, packing, noise-field, blend-modes]
primitives: [rect, line, point, ellipse, shape]
palette:
  colors: ["#DAAC80", "#FCC9D2", "#FC2E1D", "#235F3F", "#02272D"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: grid, default: 80, tried: [40], change: moderate, effect: "smaller = finer background grid (smaller tinted squares, denser rules and dots); points snap to finer cells, layout shifts slightly"}
  - {name: sMax (circle size, width fraction), default: 0.7, tried: [0.3], change: moderate, effect: "lower max = no huge disks; many more small/medium circles"}
  - {name: raysPerPoint (cc at line 95), default: 4, tried: [8], change: moderate, effect: "more rays per point = denser web of thin lines with more intersections"}
  - {name: ringsPerUnitSize (p.z*0.11 at line 167), default: 0.11, tried: [0.22], change: moderate, effect: "higher = double the concentric arcs per fan, finer rainbow bands"}
  - {name: colors[] palette, default: "{#DAAC80,#FCC9D2,#FC2E1D,#235F3F,#02272D}", tried: ["{#F72C11,#FFFFFF,#F7D41B,#0078A6,#000000}"], change: subtle, effect: "overall look stays similar; blue and yellow rings appear in some fans, red/green/tan still dominate"}
reusable_candidates:
  - {name: packPoints, signature: "packPoints(count, minR, maxR, seed) -> PVector[]", note: "rejection-sampled non-overlapping points snapped to a grid"}
  - {name: concentricFan, signature: "concentricFan(x, y, size, angle, rings, palette) -> void", note: "quarter-circle of nested arcs with per-ring palette colour"}
  - {name: trimToNearestIntersection, signature: "trimToNearestIntersection(Line[]) -> Line[]", note: "trim each line at the closest intersection with any other line"}
---

## What it draws
Off-white field with a faint background grid: sparse translucent tinted squares, thin horizontal/vertical rules, and tiny dots at intersections. Scattered across it are circles of very different sizes (a few huge pink ones, many small). Each circle is drawn as a soft radial-gradient disc, with a quarter-circle fan of densely nested rainbow arcs (reds, oranges, greens, tans) sweeping from the centre, a small saturated dot at the centre and a pin-prick highlight. Thin pale red/green straight lines (some dashed) connect points across the canvas.

## How the code works
- `generate()` (plasma007.pde:31) seeds `randomSeed`/`noiseSeed`, paints `background(252)`.
- Background grid (38–62): loops in steps of `grid = 80`; per cell a random tinted square `fill(rcol(), 20)` appears with 10% chance, a 2px square at cell centre, then full-width/height rules `stroke(0, 5)` and intersection dots `stroke(0, 30)` `point(...)`.
- Points (64–88): 1000 attempts at `random(width/height)` positions snapped to the grid; a candidate of size `s = width*random(0.04, 0.7)` is kept only if it doesn't overlap any kept point (`dist < (s+p.z)*0.5`, line 79) — rejection sampling / packing. Each kept point also stores a fan angle `noise(des+x*det, des+y*det)*TAU*2` (line 86): a 2-D noise field of directions.
- Lines (90–150): each point emits `cc = 4` rays equally spaced around its noise angle, length = canvas diagonal. Two passes of `lineLineIntersect` (249) then trim every ray at the closest intersection with another ray, then re-extend and trim again. Result: a sparse web of short segments.
- Stroke of the web (152–157): `stroke(rcol(), 120)`; `Line.show()` (204) draws 20% of them dotted via `lineDot` (213).
- Circles (159–195): per point, several `arc2` wedges (225, built from many small `beginShape` quads) create the radial-gradient disc (alpha ramp 0→250, plus one `blendMode(ADD)` glow, line 178), the quarter-fan of `cc = int(p.z*0.11)` concentric `arc` strokes coloured by `getColor()` (287, lerp between adjacent palette colours), a dark 10% alpha full-circle underlay, and three centre ellipses (coloured dot, random dot, white pin-prick).
- Palette (280): 5 fixed hexes, `rcol()` picks a random entry; `getColor(v)` lerps between adjacent entries for the fan rings.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_40 | `int grid = 80;` -> `int grid = 40;` | moderate | background grid visibly finer: smaller tinted squares, denser rules and intersection dots; circles snap to finer cells, composition shifts | variants/grid_40/frame_00001.png |
| srange_0.3 | `float s = width*random(0.04, 0.7);` -> `float s = width*random(0.04, 0.3);` | moderate | circles clearly smaller overall: no large disks, many more small/medium circles and fans | variants/srange_0.3/frame_00001.png |
| cc8_8 | `int cc = 4;//int(random(12, 47));` -> `int cc = 8;//int(random(12, 47));` | moderate | each point emits 8 rays instead of 4: denser web of thin lines, more intersections and dashed segments | variants/cc8_8/frame_00001.png |
| rings_0.22 | `int cc = int(p.z*0.11);` -> `int cc = int(p.z*0.22);` | moderate | fans carry ~twice as many concentric arcs: finer, denser rainbow bands inside each quarter fan | variants/rings_0.22/frame_00001.png |
| palette_alt | `int colors[] = {#DAAC80, #FCC9D2, #FC2E1D, #235F3F, #02272D};` -> `int colors[] = {#F72C11, #FFFFFF, #F7D41B, #0078A6, #000000};` | subtle | overall look similar to baseline; some fans show blue and yellow rings, but the red/green/tan dominance is retained | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: the packed-points generator (grid-snapped rejection sampling with size range), the noise angle field, the `lineLineIntersect` + nearest-intersection trim (a Voronoi-edge-style web), and `arc2`'s radial-gradient wedge are all art-agnostic.
- One-off art decisions: the specific layering order (disc → fan → dot → pin-prick), the 20% dotted-line quirk, the 5-colour palette, the 10% background-square scatter.
- Clean parameter object: `{canvas, grid, pointCount, sizeRange, raysPerPoint, ringsPerUnitSize, palette, bgSquareAlpha, lineAlpha, dotChance}`.
