---
sketch: 2019/generativos/fields
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 4014
animated: false
techniques: [subdivision, voronoi-delaunay, dots-stippling, 3d-mesh, grid]
primitives: [point, shape]
palette:
  colors: ["#DEE2E3", "#E7BD07", "#4FAEE6", "#0A142B", "#19645D", "#D07EBA", "#DE5621"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: subdivisions, default: 290, tried: [90, 590], change: large, effect: "lower = coarser chunkier facets, central tunnel collapses to a small cluster; higher = fine mosaic, tunnel widens into a band"}
  - {name: pickFraction, default: 0.5, tried: [1.0], change: large, effect: "1.0 subdivides uniformly; deep central tunnel disappears, dense fine clusters move to corners/edges"}
  - {name: stippleDensity, default: 5, tried: [20], change: large, effect: "4x more stipple dots; grain dominates, facets read as uniform grainy metal"}
  - {name: flapAlpha, default: 200, tried: [60], change: large, effect: "flaps nearly transparent; flatter, brighter, washed-out pastel surface with overlapping colours, less relief contrast"}
  - {name: tiltX, default: 0.25, tried: [0.1], change: large, effect: "less edge-on, more top-down view; flatter mosaic, weaker depth recession"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(Rect[] leaves, int n, pickRange) -> Rect[]", note: "iterative quad subdivision picking from first fraction of the leaf list -> anisotropic density"}
  - {name: randInTri, signature: "randInTri(p1,p2,p3) -> PVector", note: "uniform random point in triangle via sqrt(r1) method"}
  - {name: triArea, signature: "triArea(p1,p2,p3) -> float", note: "Heron's formula on edge lengths"}
  - {name: facetTriangle, signature: "facetTriangle(t, liftZ) -> 3 triangles", note: "lift one edge to z=liftZ, drop corners to z=0 -> low-poly relief flaps"}
---

## What it draws
A flat tessellated surface seen from almost edge-on in 3D: a full-canvas rectangle recursively
split into quads, densest in a central cluster where very small triangles pile up into a deep
silvery "tunnel" receding toward the middle. Every triangle is a small faceted flap lifted at one
edge, giving a crystalline low-poly metal look with a grainy, stippled texture. Dominant silvery
grey, with patches of teal, copper/orange, yellow, purple and pink.

## How the code works
- `setup()` calls `generate()` (L26); `draw()` is empty (L34-35) so the piece is a single static
  image; any key press regenerates with a new seed (L37-43).
- P3D 960x960 (L19), ortho (L90), translate to center (L91), `rotateX(PI*0.25 ± 0.2)` (L92) puts
  the canvas plane almost edge-on to the camera, `rotateZ(45° ± 0.1)` (L93), and `scale(2.2)`
  (L95) makes the plane overflow the viewport -> full-bleed composition. Directional + ambient
  lights (L83-86) give the metallic shading.
- Subdivision: one full-canvas Rect (L99); 290 iterations (L101) each pick a rect from the first
  half of the leaf list (L102) and replace it with 4 children (`subdivide`, L59-69). ~581 leaves
  remain, denser where early rects were split -> the dense central cluster / tunnel.
- Each leaf's center becomes a point (L115); `Triangulate.triangulate` (L151) Delaunay-triangulates
  them.
- Per triangle: stipple `cc = area*5*(1+rand(4))` points (L161) with stroke
  `lerpColor(rcol(), white, rand(1))` (L162) -> the grainy speckle; then fill (L169) with
  `lerpColor(rcol(), white, rand)`, alpha `rand(200)`, and draw the triangle as 3D flaps with the
  p1-p2 edge lifted to z=4 and corners dropped to z=0 (L170-183) -> faceted relief catching the
  light.
- `rcol()` (L334-336) picks a random colour from the 7-colour list (L332, #DEE2E3 duplicated);
  every use is lerped toward white by a random amount -> pastel/metallic.
- `wirePoints` (L116) are triangulated (L131) but all wire-drawing code is commented out: dead code.
- `uses_shader: true` in result.json is a false positive: `loadShader("post.glsl")` is commented
  out (L303).

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_90 | `i < 290` -> `i < 90` | large | coarser tessellation: few large facets, central tunnel reduced to a small mid-size cluster, big clean silver/orange facet bottom-right | variants/sub_90/frame_00001.png |
| sub_590 | `i < 290` -> `i < 590` | large | much finer mosaic overall; tunnel becomes a wide flat band of very small triangles | variants/sub_590/frame_00001.png |
| pick_1.0 | `rects.size()*0.5` -> `rects.size()*1.0` | large | subdivision uniform: deep central tunnel gone, fine dense clusters pushed to corners/edges, large clean facets centre | variants/pick_1.0/frame_00001.png |
| grain_20 | `*5*(1+int(random(4)))` -> `*20*(...)` | large | 4x stipple density; heavy grain dominates, triangles read as uniform grainy metal, cluster is a multicoloured speckle band | variants/grain_20/frame_00001.png |
| alpha_60 | `random(200)` -> `random(60)` | large | flaps nearly transparent; flatter, brighter washed-out pastel surface, colours overlap, relief reads softer | variants/alpha_60/frame_00001.png |
| view_0.1 | `PI*(0.25)` -> `PI*(0.1)` | large | more top-down viewpoint; flatter mosaic, tunnel shifted up-left, weaker depth recession | variants/view_0.1/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `subdivideRects` (with a `pickFraction` parameter controlling density
  anisotropy), `randInTri`, `triArea`, and the facet-flap emitter (lift height as parameter).
  The Delaunay step itself comes from the triangulate jar.
- One-off art decisions: the near-edge-on camera (rotateX ~90°, scale 2.2), the 7-colour list with
  per-use lerp-to-white, the fixed z=4 lift, the stipple density formula (area-scaled), and the
  dead wireframe code (L118-146, L187-301) which is a commented-out earlier iteration of the same
  idea.
- Clean parameter object: `{ subdivisions, pickFraction, zoom (scale), tiltX, liftZ,
  stippleDensity, flapAlpha, palette, lerpToWhite }`.
