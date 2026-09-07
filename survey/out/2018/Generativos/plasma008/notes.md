---
sketch: 2018/Generativos/plasma008
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1530
animated: false
techniques: [grid, packing, lines-hatching]
primitives: [point, line, shape]
palette:
  colors: ["#000F29", "#FE0706", "#F85E8D", "#3E56A8", "#090D0E", "#06A5FF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: 40, tried: [80], change: moderate, effect: "grid visibly coarser; points snap to the bigger lattice so ray fans and triangles shift, look stays pale"}
  - {name: raysPerPoint, default: "random(3,20)", tried: ["random(3,6)"], change: large, effect: "fewer rays -> fewer intersections -> fewer, larger, more saturated triangles; line web sparser"}
  - {name: pointCount, default: 10, tried: [4], change: moderate, effect: "fewer ray centers -> sparser mesh; triangles still fill the canvas but in a different arrangement"}
  - {name: triangleMultiplier, default: 0.5, tried: [2], change: large, effect: "4x more triangles -> dense, more saturated full-bleed mosaic; web lines stand out more"}
  - {name: background, default: 252, tried: [0], change: large, effect: "black canvas: triangles blend against black so they read darker and muddier; dark web lines nearly invisible"}
reusable_candidates:
  - {name: lineLineIntersect, signature: "lineLineIntersect(x1,y1,x2,y2,x3,y3,x4,y4) -> PVector|null", note: "segment-segment intersection, null when parallel or no crossing inside both segments"}
  - {name: radialRays, signature: "radialRays(center, count, length, angleOffset) -> List<Line>", note: "n rays evenly spaced around a full circle from a point"}
  - {name: nonOverlappingPoints, signature: "nonOverlappingPoints(n, area, sizeRange, minSep) -> List<PVector>", note: "random points with a radius in p.z, rejected when dist < (s1+s2)/2"}
---

## What it draws
A pale, almost-white canvas covered by a barely visible square grid and a dense
mesh of very thin dark lines running in straight chords across the whole image.
On top, large translucent triangles in warm tones (yellow, orange, salmon-red,
pink, olive-green) overlap with normal alpha blending, producing soft blended
color regions, strongest in the center and upper right. The whole composition is
full-bleed and static; one render per seed.

## How the code works
`setup()` sizes 960x960 P2D and calls `generate()` once; `draw()` is empty (static).
`generate()` (lines 35-156):
- Palette: the 9-entry hex list (line 39) is hue-rotated by a random `hr` in
  [0,360) in HSB (lines 43-48), so every seed gets a different color family.
  Colors are drawn with `rcol()` = uniform random pick from the list (line 205).
- Faint grid: `grid = 40` (line 56); horizontal/vertical lines with
  `stroke(0,4)` (lines 58-62) and 1px points at grid nodes with `stroke(0,30)`
  (lines 64-69). Almost invisible on the `background(252)` (line 54).
- Points: 10 random points (lines 72-89) snapped to the grid
  (`x -= x%grid`), each with a size `s = width*random(0.04, 0.7)`; a point is
  rejected if `dist < (s+p.z)*0.5` to any earlier point (packing rejection).
- Rays: each point casts `cc = int(random(3,20))` rays evenly spaced around TAU
  from a random base angle `a`, each of length = the canvas diagonal
  (lines 93-104). Rays are pure geometry, never drawn.
- Intersections: every pair of rays is tested with `lineLineIntersect`
  (lines 106-117, 169-196); only crossings inside both segments are kept in
  `inters`.
- Triangles: `inters.size()*0.5` random triangles, each from 3 random
  intersection points, filled with `rcol()` at alpha `random(80)` (lines
  134-147). This is the main visible layer.
- Web: `inters.size()` random thin chords between random intersection points,
  `stroke(0,12)` (lines 149-155).
Randomness enters at: `hr`, the 10 points, sizes, `cc`, base angles, the
triangle/line pair picks. Deterministic under `randomSeed(seed)` /
`noiseSeed(seed)` (lines 51-52). No blend modes, no noise, no shaders actually
used (the shader lines are commented out, line 37).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_80 | `int grid = 40;` -> `int grid = 80;` | moderate | coarser square grid clearly visible; fewer, much larger and paler triangles, same warm family | variants/grid_80/frame_00001.png |
| cc_3_6 | `int cc = int(random(3, 20));` -> `int cc = int(random(3, 6));` | large | far fewer, much larger and more saturated triangles (teal, olive, yellow, red); line web visibly sparser | variants/cc_3_6/frame_00001.png |
| points_4 | `for (int i = 0; i < 10; i++) {` -> `for (int i = 0; i < 4; i++) {` | moderate | denser-looking warm mosaic in yellow/orange/pink; fewer ray centers so the web is less busy, grid still visible | variants/points_4/frame_00001.png |
| triangles_x2 | `for (int i = 0; i < inters.size()*0.5; i++) {` -> `inters.size()*2` | large | 4x more triangles: full-bleed, densely overlapping, strongly saturated yellow/olive/orange; web lines prominent | variants/triangles_x2/frame_00001.png |
| bg_0 | `background(252);` -> `background(0);` | large | same triangle/web geometry on black; triangles read dark and muddy, dark web lines almost disappear | variants/bg_0/frame_00001.png |

## Modularisation notes
- Generic and library-ready: `lineLineIntersect` (pure math, lines 173-196),
  the radial ray fan (lines 96-104), and the overlap-rejecting point sampler
  (lines 79-89). All three are parameterized and side-effect free.
- One-off art decisions: the 9-color palette and its random hue rotation, the
  specific alphas (4/30/12/80), grid size 40, triangle count
  `inters.size()*0.5`, and the choice to draw only intersections of rays
  (the "cut lines at birth point" idea from the header comment).
- A clean parameter object would contain: seed, canvas size, grid step, point
  count, size range, rays-per-point range, triangle multiplier, triangle
  alpha range, web-line count, web-line alpha, background, palette, hue shift.
