---
sketch: 2020/generative/01_04/papa
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate, peasy]
deterministic: false
ms_first_frame: 1600
animated: true
techniques: [noise-field, particles, voronoi-delaunay, packing, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#EA2E73", "#F7AA06", "#1577D8"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: pointCount, default: 10000, tried: [], change: null, effect: ""}
  - {name: pointSize, default: 500, tried: [], change: null, effect: ""}
  - {name: zScale, default: 2.6, tried: [], change: null, effect: ""}
  - {name: detCol, default: "0.0005-0.002", tried: [], change: null, effect: ""}
  - {name: det, default: 0.0016, tried: [], change: null, effect: ""}
reusable_candidates:
  - {name: packNoisePoints, signature: "packNoisePoints(count, maxSize, det) -> PVector[]", note: "rejection-sampled packed points, positions from 3-D simplex noise"}
  - {name: delaunayMesh, signature: "delaunayMesh(points) -> Triangle[]", note: "2-D Delaunay triangulation via triangulate lib"}
  - {name: noiseLerpColor, signature: "noiseLerpColor(colors[], detail, pos) -> int", note: "noise-indexed lerp across a fixed palette"}
---

## What it draws
A full-bleed faceted mesh that looks like folded paper or a low-poly crystal field. Dozens of
sharp triangular facets tile the whole canvas, extruded in shallow 3D so some faces tilt toward
the viewer and catch the light. Color is a patchwork of the three palette colors — magenta/pink,
gold/orange, and blue — blended into dusty muted tones, with a few near-black facets (the
third vertex of every triangle is painted black). The overall impression is a dense, spiky
polygonal texture with no empty background showing.

## How the code works
`setup()` calls `generate()` once; `draw()` calls it again every frame, so the scene re-rolls
continuously (papa.pde:24-37). `generate()`:
- Sets up a time value from `System.currentTimeMillis()` (line 57) — **not** seeded — which is
  why `deterministic` is `false`: every render (and every frame) gets different point placements
  even with the same seed.
- Translates the origin to canvas center and pushes it back in Z by -200 (line 59).
- **Point placement (lines 68-84):** loops 10000 times, taking each point's x/y from
  `SimplexNoise.noise(i*det, time*det, i)` scaled to 0.8 of the canvas, and a random size
  `s = random(500)`. A nested loop rejects any point that falls within `(existing.z + s)*0.5` of
  an already-kept point (packing/rejection sampling), so larger points push out more neighbors.
  Kept points become `PVector(x, y, s)`.
- **Z extrusion (lines 87-96):** each kept point is re-scaled to `p.z*2.6` to build the 3-D
  depth of the mesh.
- **Triangulation (line 98):** `Triangulate.triangulate` (Delaunay) connects the points into
  triangles.
- **Mesh + color (lines 102-119):** one `beginShape(TRIANGLE)` pass; per triangle the centroid is
  fed through `noise(cen.x*detCol, cen.y*detCol)` to pick a palette index, `getColor` lerps
  between two adjacent palette colors (line 139-144). Vertices 1 and 2 are filled with that
  color (the first at alpha 40, the second solid), and vertex 3 is filled black (line 116) —
  that is the source of the dark facets.
- Palette (line 131): `#EA2E73`, `#F7AA06`, `#1577D8`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic:** the rejection-packed point generator (`packNoisePoints`), the Delaunay call
  (a thin wrapper around the triangulate lib), and `noiseLerpColor` (noise-indexed palette lerp)
  are all reusable building blocks. The `packPoints` + `triangulate` + per-triangle-noise-color
  pipeline is a clean "faceted mesh from packed noise points" primitive.
- **One-off art decisions:** the specific 3-color palette, the `*2.6` z-scale, the
  `*0.5` packing tolerance, and painting the third vertex black are aesthetic choices.
- **Clean parameter object:** `{count, maxSize, det, zScale, detCol, palette[], blackVertex,
  zOffset, seed, time}` — note `time` is the unseeded source of non-determinism and would need
  to be pinned for reproducible output.
