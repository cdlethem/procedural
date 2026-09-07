---
sketch: 2019/generativos/monto
year: 2019
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1487
animated: false
techniques: [subdivision, voronoi-delaunay, 3d-mesh, 3d-pointcloud]
primitives: [line, shape]
palette:
  colors: ["#DFAB56", "#E5463E", "#366A51", "#2884BC"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: biasedQuadtree, signature: "biasedQuadtree(w, h, iterations) -> Rect[]", note: "recursive 4-way subdivision picking a rect from the first half of the list each step"}
  - {name: delausnayMesh, signature: "delaunayMesh(PVector[] pts, zTop, zBottom) -> triangle list", note: "Triangulate.triangulate on lifted points, drawn as flat prisms at two z levels"}
  - {name: wireDrape, signature: "wireDrape(PVector[] lifted, keep, lift) -> curves", note: "sample a fraction of Delaunay triangles and drape a bezier curve between their vertices, endpoints lifted"}
---

## What it draws
A 3D low-poly "mountain" of blue triangular prisms seen from an oblique angle, filling most of the frame against a light-grey background. Thin near-black lines arc between the mesh vertices like slack wires, and short white vertical spikes rise from many of the vertices. With seed 42 the fill is almost entirely blue (#2884BC, shaded lighter/darker by the directional lights); the mesh reads as a faceted terrain with deep valleys and a few tall peaks.

## How the code works
- `settings()` (L17-22): 960x960 P3D window, `smooth(8)`.
- `generate()` (L73-303), run once in `setup()` (L26); `draw()` is empty, so the image is static. `randomSeed(seed)` (L76) makes it deterministic.
- Lights: grey ambient + two directional lights (L79-82) give the flat facets their shading.
- Camera: `ortho` (L86), then `rotateX(PI*0.25 + random(-0.2,0.2))` and `rotateZ(PI*(0.25 + random(-0.1,0.1)))` (L88-89) tilt the scene, and `scale(2.2)` (L91) zooms in so the mesh overflows the frame.
- Geometry: one square covering the whole canvas is subdivided 90 times (L97-100); each step picks a rect from the *first half* of the list (`rects.get(int(random(rects.size()*0.5)))`, L98) and replaces it with 4 children (`subdivide`, L59-69), producing a biased quadtree — dense clusters near one corner, sparse large cells elsewhere.
- Per rect: centre point at z=0 (L111); with 90% probability a lifted "wire point" at `z = min(r.w,r.h)*0.08*3.6` (L109-112) — smaller cells get shorter spikes. A thin white box `box(p.z*0.02, p.z*0.02, p.z)` marks each wire point (L115-123): the white spikes.
- Wires: `Triangulate.triangulate(wirePoints)` (L126); 20% of the triangles (L133) are drawn as three bezier curves (L136-138) whose endpoints are lifted by `dist*random(0.8,1)*0.3`, giving the sagging dark lines (`stroke(0,80)`, weight 0.4, L130-131).
- Terrain: `Triangulate.triangulate(points)` (L158); each triangle is drawn as a flat prism between z=0 and z=4 (L164-181), filled once per triangle with `rcol()` — a uniform random pick from the 4-colour palette (L309, L312-314). With seed 42 the picks land mostly on #2884BC.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `subdivide()` + the biased selection loop (L59-69, L97-100) is a clean generic primitive: a quadtree that clusters density where earlier splits happened (the `0.5` pick-bias and `90` iteration count are the two knobs).
- Lifting rect centres by a fraction of cell size and Delaunay-triangulating (L107-113, L158) is a reusable "cell-noise heightfield" — the `0.08`/`3.6` factors control relief amplitude.
- The wire drape (L125-153) is a nice one: triangulate a subset of points, keep a fraction of triangles, and replace each triangle with three endpoint-lifted beziers. Parameterised by keep-fraction (`0.8` skip) and lift factor (`0.3`).
- One-off art decisions: the oblique double rotation + `scale(2.2)` framing, the white boxes as spikes, the two directional lights, and the random-from-list 4-colour palette (`getColor()` lerp variant is dead code outside comments).
- A clean parameter object: `{ iterations, pickBias, spikeFactor (0.08), spikeLift (3.6), wireKeep, wireLift, meshScale, rotX, rotZ, palette }`.
