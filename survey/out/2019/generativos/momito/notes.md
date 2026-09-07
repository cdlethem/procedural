---
sketch: 2019/generativos/momito
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1543
animated: false
techniques: [subdivision, voronoi-delaunay, 3d-mesh, grid]
primitives: [shape]
palette:
  colors: ["#DFAB56", "#E5463E", "#366A51", "#2884BC"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: randomQuadtree, signature: "randomQuadtree(canvasW, canvasH, iterations, pickRange) -> Rect[]", note: "repeatedly split a random rect from the first half of the list into 4 quadrants; density clusters where random picks concentrate"}
  - {name: delaunayWedgeMesh, signature: "delaunayWedgeMesh(points, topZ) -> drawn 3D wedge per triangle", note: "Delaunay-triangulate 2D points, draw each triangle as wedges between z=topZ and z=0 for a faceted relief look"}
  - {name: spikeBars, signature: "spikeBars(points, prob, heightFactor, widthFactor) -> boxes", note: "thin vertical boxes on a random subset of points, height proportional to local cell size"}
---

## What it draws
A full-bleed low-poly faceted plane viewed from a tilted angle, almost entirely one dark
green (the single colour picked for this seed). Facets are densest in a cluster toward the
upper-left where they are small, and dissolve into large flat triangles across the rest of
the canvas; dark crease lines run along the wedge edges. Thin pale vertical bars (spikes)
stand on scattered points of the plane, mostly short, a few tall.

## How the code works
- `settings()` (L17-22): 960x960 P3D, `smooth(8)`, `pixelDensity(2)` (unavailable on headless display, harmless warning).
- `setup()` calls `generate()` once (L24-32); `draw()` is empty, so the image is static (baseline frames 10/60 dropped as identical).
- Lighting (L79-82): ambient + two directional lights give the facets their shading.
- Camera (L86-89): ortho, centred, `rotateX(PI*0.25 ± 0.2)` and `rotateZ(PI*0.25 ± 0.1)` — the tilted view; `scale(2.2)` (L91) zooms the quadtree past the canvas edges so the plane is full-bleed.
- Quadtree (L94-100, `subdivide` L59-69): one rect covering the canvas is split into 4 quadrants 290 times, each time picking a random rect from the first half of the list. Result ~1161 rects, clustered where picks repeat.
- Points (L107-113): one 2D point at each rect centre; 90% of them also become "wire points" lifted to `z = min(w,h)*0.08*3.8`.
- Spikes (L115-123): a thin box (`z*0.02` cross-section, height `z`, rotated by a random quarter turn) at each wire point — the pale vertical bars.
- Mesh (L146-169): `Triangulate.triangulate` on the rect centres; each triangle is drawn as three wedges between `z=4` and `z=0`, which creates the stepped relief and the dark crease lines.
- Colour (L151, L298-303): `fill(rcol())` is set **once before the loop**, so every triangle gets the same single colour, randomly chosen from the 4-colour palette `#DFAB56 #E5463E #366A51 #2884BC`. Seed 42 lands on the dark green.
- Randomness: `seed` field (set to 42 by the harness), the quadtree picks, rotation jitter, and the 0.9 wire probability.
- `uses_shader` is true in result.json but the `loadShader`/`filter` calls are commented out (L287-290), so no post-processing actually runs.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic and library-worthy: the random quadtree (`randomQuadtree`), the Delaunay wedge mesh
(`delaunayWedgeMesh` — the wedge trick of splitting each triangle between two z levels is the
core trick), and the spike bars (`spikeBars`). One-off art decisions: the specific camera tilt
(quarter turns ± jitter), `scale(2.2)` full-bleed zoom, the single-colour-per-frame choice
(`fill` set once — switching to per-triangle `rcol()` would give a multi-colour mosaic), the
4-colour palette, and the light setup. A clean parameter object would be: `{size, iterations,
pickRange, topZ, spikeProb, spikeHeightFactor, spikeWidthFactor, rotX, rotZ, zoom, palette,
colorMode: "single"|"perTriangle"}`.
