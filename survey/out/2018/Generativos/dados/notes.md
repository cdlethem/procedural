---
sketch: 2018/Generativos/dados
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1763
animated: false
techniques: [voronoi-delaunay, grid, particles, curves, dots-stippling]
primitives: [line, ellipse, rect, shape]
palette:
  colors: ["#FFFFFF", "#FFCB43", "#FFB9D5", "#1DB5E3", "#006591", "#142B4B"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: triangulateMesh, signature: "triangulateMesh(points: PVector[]) -> ArrayList<Triangle>", note: "Delaunay triangulation of scattered points via triangulate lib, filled with translucent random colours"}
  - {name: stippledWire, signature: "stippleWire(x1, y1, x2, y2, sag, palette) -> void", note: "connects two points with two rows of small dots along a curve (curvePoint), sizes modulated by cos"}
  - {name: dotGrid, signature: "dotGrid(cells, cellSize, dotFraction, alpha) -> void", note: "full-canvas grid of tiny square dots with random alpha"}
  - {name: arcRings, signature: "arcRings(x, y, r1, r2, a1, a2, color, shd1, shd2) -> void", note: "annulus approximated by many small quads between two radii (arc2)"}
---

## What it draws
A full-bleed 960×960 composition in white, yellow, pink and teal blues. Large translucent
triangles (a Delaunay mesh of ~30 points) overlap the canvas; their soft fills (white,
pink, pale yellow, blue) create big colour zones. A fine yellow line grid runs across the
whole image, with a sparse field of tiny pale dots and a second, denser grid of small
square dots. Small circles mark the mesh vertices, and faint dotted curved "wires"
connect them. A few barely-visible thin arcs sit in the background.

## How the code works
`setup()` calls `generate()` once (line 9); `draw()` is empty (line 12), so the piece is
static. All randomness is re-seeded from the `seed` field (lines 28-29), making it
deterministic per seed.

1. Background: one palette colour (`rcol()`, line 25); in the baseline it is white.
2. Arcs (lines 32-39): 5 random `arc2()` annuli, 0.5 px white strokes at alpha 4, fills
   from the palette at random alpha 100-200 — the faint background rings.
3. Speckle (lines 42-49): 2000 tiny ellipses (size ~random(3)) in full-alpha palette
   colours, scattered uniformly — the fine dot texture.
4. Grids (lines 51-67): 26 repetitions, each picking a subdivision `sub = 2^(1..6)` and
   drawing a full vertical+horizontal line grid with a random palette colour at alpha
   200-255 and weight `ss*random(0.05)`, plus a few random solid cells. Layers
   accumulate; the last yellow 8-way grid dominates visually.
5. Mesh (lines 69-116): 30 points snapped to a 16-way grid (with ±4 cells of overshoot)
   are Delaunay-triangulated with `Triangulate.triangulate` (line 83); the triangles are
   drawn in one `beginShape(TRIANGLES)` with per-vertex random palette fills at alpha
   `random(200)*random(1)` (very translucent) and 1-2 px strokes. Each vertex then gets
   two concentric circles (lines 104-116) and a `wire()` dotted curve to the previous
   point: two rows of small ellipses sampled along `curvePoint` with a sag control point
   (lines 152-201), colours lerped through the palette via `getColor`.
6. Dot grids (lines 119-128): 2 iterations of a `cc = random(200)` × `cc` grid of tiny
   squares (10% of a cell) at random alpha ≤200 — the densest dot texture, drawn last so
   it sits on top.

Colour is always a palette pick (`rcol`) or a lerp across the palette (`getColor`);
there is no noise, no blend mode beyond source-over with alpha, and no shaders.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the four building blocks are reusable as listed in `reusable_candidates` —
  Delaunay mesh with translucent fills, stippled curve connector, dot grid, and the
  `arc2` annulus. Each is a self-contained function with a palette argument.
- One-off art decisions: the fixed 7-colour palette (with two duplicated whites, line
  208), the 26 stacked random grids, the specific layering order (arcs → speckle →
  grids → mesh → dots), and the vertex-circles-on-mesh motif.
- A clean parameter object would need: `seed`, `background` (palette index), `arcCount`,
  `speckleCount`, `speckleMaxSize`, `gridLayers`, `gridMaxSub`, `meshPoints`,
  `meshGrid`, `dotGridIters`, `dotGridMaxCells`, `dotSizeFraction`, and the palette
  itself.
