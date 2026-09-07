---
sketch: 2018/Generativos/mosaic
year: 2018
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1569
animated: false
techniques: [subdivision, voronoi-delaunay]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#DFAB56", "#E5463E", "#366A51", "#2884BC"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: subdivisionIters, default: 100, tried: [200], change: pending, effect: "pending"}
  - {name: colors, default: "4-col warm/cool set", tried: ["5-col pastel/warm set from commented line 225"], change: pending, effect: "pending"}
  - {name: triStrokeAlpha, default: 120, tried: [255], change: pending, effect: "pending"}
  - {name: triStrokeWeight, default: 0.6, tried: [2.0], change: pending, effect: "pending"}
  - {name: dotScale, default: 0.05, tried: [0.2], change: pending, effect: "pending"}
  - {name: triFillAlpha, default: 60, tried: [160], change: pending, effect: "pending"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(width, height, iterations) -> Rect[]", note: "repeatedly split a random existing rect into 4 quadrants; leaves a self-similar mosaic of cells"}
  - {name: topEdgeShadow, signature: "topEdgeShadow(x, y, w, h, color, alpha) -> void", note: "two-vertex gradient quad, opaque at top edge fading to transparent at bottom"}
  - {name: delaunayOverCenters, signature: "delaunay(points) -> Triangle[] (triangulate lib)", note: "triangulate cell centres, draw thin strokes plus per-triangle gradient fills"}
---

## What it draws
A full-bleed square mosaic: the canvas is tiled by recursively split rectangles, so the
top-left region is a dense checkerboard of small cells while the bottom-right stays as
few large blocks. Every cell is a flat colour from a 4-colour palette (mustard, red,
dark green, blue), carries a subtle darker gradient at its top edge, and has a small
dot at its centre. Thin dark lines connect the cell centres in a Delaunay
triangulation, and some triangles carry a faint translucent fill (reddish or dark),
giving a quiet wireframe overlay on top of the flat mosaic.

## How the code works
- `setup()` (L8–16): 960x960 P3D, loads `post.glsl`, calls `generate()`. `draw()` is
  empty — the piece is drawn once and is static. Any key press reseeds and regenerates
  (L21–27); the harness pins `seed := 42`.
- `generate()` (L57–206):
  - Mosaic: starts from one full-canvas rect (L64–65); a loop of 100 iterations (L67)
    picks a random rect from the first half of the list and splits it into 4 equal
    quadrants, removing the parent (`subdivide`, L43–53). Picking only from the first
    half biases which regions get subdivided, producing the uneven density.
  - Per cell (L74–84): flat `fill(rcol())` rect (L76–77); `shadow()` (L208–217) draws
    a quad over the cell with the cell's shadow colour at alpha 80 on the top two
    vertices fading to alpha 0 on the bottom two — the top-edge darkening. `dir` arg
    is unused. A small centre dot: `s = min(r.w,r.h)*0.05`, `fill(rcol())`, `ellipse`
    at the centre (L80–82); the centre point is collected for the triangulation (L83).
  - Triangulation: `Triangulate.triangulate(points)` (L87) over all cell centres.
    Pass 1 (L89–99): `stroke(0,120)`, `strokeWeight(0.6)`, `noFill()`, draws every
    triangle — the thin dark wireframe. Pass 2 (L101–111): skips 20% of triangles
    randomly, fills each kept triangle with a per-vertex gradient (`fill(rcol(),60)`
    at p1, alpha 0 at p2/p3) — the faint reddish sheen. Pass 3 (L115–125): same skip,
    gradient `fill(0,20)` at p1 to 0 — the faint darkening.
  - Colour: `rcol()` (L226–228) picks uniformly from the 4-colour `colors[]` (L223).
    `getColor`/`getColor(float)` (L229–237) is an unused lerp-between-colours helper;
    the SimplexNoise import (L2) is only used inside the large commented-out block
    (L127–200).
  - The `post.glsl` shader (loaded L13 and L202: 3x3 blur, grain, saturation/contrast
    boost, vignette) is never applied — `filter(post)` is commented out (L205). The
    baseline image shows no grain/vignette, consistent with this.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `subdivideRects` (recursive 4-way split with a pick-bias parameter and
  iteration count) is a clean library primitive; `topEdgeShadow` is a trivial
  two-vertex gradient quad; the Delaunay-over-points wireframe + per-triangle
  gradient-fill pass is a reusable overlay (needs the triangulate lib).
- One-off art decisions: the 4-colour palette and uniform `rcol()` selection; the
  "pick from first half of the list" bias; the three specific overlay passes with
  their skip probabilities (0.2) and alphas (60/20); the unused grain/vignette
  shader and commented-out flow-line experiment.
- Clean parameter object: `{ iterations, pickBias (fraction of list pickable),
  palette[], dotScale, triStroke {alpha, weight}, triFill {alpha, skipProb,
  darkAlpha, darkSkipProb}, shadowAlpha }`.
