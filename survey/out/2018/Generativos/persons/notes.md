---
sketch: 2018/Generativos/persons
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1518
animated: false
techniques: [grid, voronoi-delaunay]
primitives: [ellipse, line, shape]
palette:
  colors: ["#2B00BE", "#F73859", "#9896F1", "#D59BF6", "#EDB1F0"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: grid, default: "int(random(40,60))", tried: [20], change: subtle, effect: "coarser cells -> fewer, larger figures; background unchanged"}
  - {name: meshAlpha, default: 30, tried: [120], change: none, effect: "no visible change; 4x alpha on 1px white mesh lines stays below the visibility threshold"}
  - {name: meshKeep, default: 0.4, tried: [1.0], change: none, effect: "no visible change; the extra triangles are 1px lines at ~12% white alpha"}
  - {name: palette, default: "cool blues/pinks/purples", tried: ["#2474AF,#2474AF,#F0CA4B,#F07148,#E6E7E9,#107F40"], change: large, effect: "background becomes light grey; figures blue/orange/green/yellow"}
  - {name: hh, default: "random(0.2,1)", tried: ["random(0.9,1)"], change: subtle, effect: "no short stubby figures; crowd is uniformly tall"}
  - {name: sca, default: 0.8, tried: [1.6], change: subtle, effect: "figures ~2x larger (width and height scale together), some overlap"}
reusable_candidates:
  - {name: scatterOnGrid, signature: "scatterOnGrid(cells, minDist) -> PVector[]", note: "random points snapped to a grid cell with a minimum-distance rejection test"}
  - {name: drawFigures, signature: "drawFigures(points, cellSize, palette) -> PVector[]", note: "ellipse bodies + head dot + two leg lines per point, returns head positions"}
---

## What it draws
A pale lilac (#D59BF6) field scattered with dozens of simple abstract figures:
vertical ellipses (deep blue, red-pink, periwinkle, pale pink) of varying height,
each with a tiny dot for a head and two thin splayed legs. A faint white
triangular mesh (Delaunay) links the figures, and a barely visible grid runs
underneath. Figures drawn in the background's own colour read as pale silhouettes.

## How the code works
Static sketch: `setup()` -> `generate()` once, empty `draw()` (lines 12-20).

1. Background: one random palette colour `rcol()` (line 32, palette at line 154);
   here a pale lilac (#D59BF6).
2. Grid: `grid = int(random(40,60))` (line 39) gives cell size `ss = 960/grid`;
   faint white grid lines at alpha 12 (lines 42-46).
3. Points: `grid*2` candidates at random positions (10% outside the canvas),
   snapped to the grid (`x -= x%ss`, lines 53-58), rejected if within 5px of an
   existing point (lines 60-69).
4. First triangulation of the body points via the triangulate library (line 72);
   40% of triangles drawn as white lines at alpha 30 (lines 74-83;
   `random(1) < 0.6` skips 60%).
5. Figures (lines 91-128): persons sorted by y (line 87); each gets a dark shadow
   ellipse at its base (fill alpha 8, lines 103-106), a body ellipse of height
   `ss*6.2*hh` where `hh = random(0.2,1)` (line 101, 115), a head dot of height
   `ss*8.2*hh` (line 119), and two leg lines from the base to the body, splayed
   by a random angle (lines 121-125). Body colour c1 and head colour c2 are
   random palette picks, re-drawn until distinct from each other and the
   background (lines 108-111).
6. Second triangulation of the head positions, drawn as black triangles at alpha
   10, again 40% kept (lines 132-145).

All randomness is seeded (`randomSeed`/`noiseSeed`, lines 34-35) so each keypress
regenerates a deterministic variant. No shaders, no blend modes beyond alpha.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_20 | `int grid = int(random(40, 60));` -> `int grid = 20;` | subtle | background unchanged; fewer, larger, more sparsely spaced figures (coarser 48px cells); mesh and faint grid still present | variants/grid_20/frame_00001.png |
| mesh_alpha_120 | `stroke(255, 30);` -> `stroke(255, 120);` | none | no visible change; pixel check shows only the 1px mesh lines brightened slightly (max delta 37/255) | variants/mesh_alpha_120/frame_00001.png |
| mesh_keep_1.0 | `if (random(1) < 0.6) continue;` -> `if (random(1) < 0.0) continue;` (both mesh loops) | none | no visible change; the added triangles are 1px lines at ~12% white alpha, below the visibility threshold | variants/mesh_keep_1.0/frame_00001.png |
| palette_warm | palette line -> `{#2474AF, #2474AF, #F0CA4B, #F07148, #E6E7E9, #107F40};` | large | background becomes light grey; figures blue/orange/green/yellow; same layout and figure style | variants/palette_warm/frame_00001.png |
| hh_uniform | `float hh = random(0.2, 1);` -> `float hh = random(0.9, 1);` | subtle | short stubby "egg" figures gone; crowd is uniformly tall, heads all near the top of their cells | variants/hh_uniform/frame_00001.png |
| sca_wide | `float sca = 0.8;` -> `float sca = 1.6;` | subtle | figures ~2x larger (width and height scale together); chunkier bodies, larger head dots, some figures overlap | variants/sca_wide/frame_00001.png |

## Modularisation notes
Generic blocks: `scatterOnGrid` (points snapped to a grid + min-distance
rejection), the two Delaunay mesh passes (a generic "draw N% of a triangulation"
helper), and `drawFigures` (ellipse body + head + legs parameterised by cell
size, height factor, and palette). One-off art decisions: the specific palette
and its duplicate blue entry (biases bodies toward blue), the "reject until
distinct from background" colour loop, and the y-sort that makes colour
assignment depth-ordered. A clean parameter object: `{cells, pointCount,
meshKeep, meshAlpha, heightRange, bodyScale, palette, background}`.
