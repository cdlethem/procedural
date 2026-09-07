---
sketch: 2019/generativos/lightcity
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3016
animated: false
techniques: [subdivision, voronoi-delaunay, 3d-mesh, grid]
primitives: [shape]
palette:
  colors: ["#000000", "#FFDCC8", "#121B4B", "#028594", "#E55E7F", "#FBAF34", "#F0D5CA"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: subdivisions, default: 100, tried: [200], change: moderate, effect: "finer rect subdivision -> more, smaller triangles -> denser, smaller buildings and finer window texture"}
  - {name: heightMax, default: 300, tried: [600], change: moderate, effect: "taller towers; windows extend higher, more vertical spread"}
  - {name: windowGrid, default: "16-28", tried: ["8-14"], change: moderate, effect: "fewer, larger windows; coarser, more legible grid per face"}
  - {name: litWindowColor, default: "255,220,200", tried: ["255,240,150"], change: none, effect: "no visible change; hue shift too small to register"}
  - {name: litFraction, default: "0.2-0.8 * random", tried: ["0.5-0.9 * random"], change: subtle, effect: "slightly more lit windows per face; faces a touch brighter, same structure"}
reusable_candidates:
  - {name: randomQuadSubdivision, signature: "randomQuadSubdivision(rects, iterations) -> Rect[]", note: "split one random rect into 4 quads, repeated N times; produces an inhomogeneous quadtree"}
  - {name: delaunay, signature: "triangulate(points) -> Triangle[]", note: "Delaunay triangulation via triangulate library over the rect centroids"}
  - {name: windowGrid, signature: "windowGrid(faceQuad, sub1, sub2, cellW, cellH, litFraction, onColor, offColor)", note: "lay a sub1 x sub2 grid of small boxes over a 3D quad face; per-face random lit threshold"}
---

## What it draws
A black 3D night-city scene viewed from above at a tilt: triangular-prism "buildings"
rise from a dark ground plane, each of their three vertical faces covered in a dense
grid of tiny glowing windows. The lit windows are a pale warm off-white; unlit
windows are black and disappear into the background, so the scene reads as a dense
field of warm dots on black, with building edges and faces receding into the
darkness. The whole composition is full-bleed and slightly rotated, so the city
spans the frame edge to edge.

## How the code works
`setup()` calls `generate()` (lightcity.pde:24-32); `draw()` is empty, so the image
is one static pass (frames 10/60 identical to 1).

1. Camera (lines 77-94): black background, orthographic projection, translate to
   center and back 400 in z, `rotateX(PI*0.25 + random(-0.3, 0.2))` (looking down at
   ~45 degrees with jitter), random `rotateZ`, then `scale(1.9)` so the city
   overflows the frame.
2. Subdivision (lines 96-102): start with one rect covering the full canvas; 100
   times pick a random rect from the first half of the list, `subdivide()` (line
   59) splits it into four quads and replaces it. Result: an inhomogeneous quadtree
   of ~300-400 rectangles of varied sizes.
3. Triangulation (lines 105-112): take each rect's center as a point, run
   `Triangulate.triangulate(points)` (Delaunay).
4. Extrusion (lines 174-238): for every triangle, pick one height
   `h = random(300)*random(1)` (product of two uniforms → biased to low heights);
   each of the triangle's 3 edges becomes a vertical quad face (base edge + top edge
   at height h), and `winwin2()` is called on each face with the same random
   `sub1, sub2` grid counts (lines 214-215).
5. Windows (lines 272-303): `winwin2` computes the face's edge lengths, cell size
   `ww = edge/sub2`, `hh = height/sub1`, scales both by `random(0.2, 0.9)`, then
   places a sub1 x sub2 grid of thin boxes (`box(ww, 0.1, hh)`) on the face, each
   rotated to the face angle. Each face draws one threshold
   `pos = random(0.2, 0.8)*random(1)`; a window is lit (`fill(255, 220, 200)`) if
   `random(1) < pos`, else `fill(0)` (black, invisible against the background).
   So each face has a consistent fraction of lit windows.
6. Lights (lines 81-84): ambient 120 plus two weak directional lights give the
   boxes a slight 3D shading; the look is dominated by flat lit/unlit fills.
7. `data/post.glsl` defines a luma/blur/CSB post shader, but its `loadShader`/
   `filter` call is commented out (lines 240-245), so it never affects the image.
   The `colors[]` array (line 310) and `getColor()` are likewise only referenced in
   commented-out code; the only live fills are black and the warm off-white.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subdiv_200 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 200; i++) {` | moderate | denser city: more, smaller buildings; windows much finer, texture busier | variants/subdiv_200/frame_00001.png |
| height_600 | `float h = random(300)*random(1);` -> `float h = random(600)*random(1);` | moderate | taller towers, windows stretch higher, more vertical streaks | variants/height_600/frame_00001.png |
| windows_8_14 | `int sub1/sub2 = int(random(16, 28));` -> `int(random(8, 14));` (both) | moderate | coarser grid: fewer, clearly larger window boxes per face | variants/windows_8_14/frame_00001.png |
| litcolor_255_240_150 | `fill(255, 220, 200);` -> `fill(255, 240, 150);` | none | no visible change | variants/litcolor_255_240_150/frame_00001.png |
| litpos_05_09 | `float pos = random(0.2, 0.8)*random(1);` -> `random(0.5, 0.9)*random(1);` (both occurrences) | subtle | slightly more lit windows; faces a touch brighter, structure unchanged | variants/litpos_05_09/frame_00001.png |

## Modularisation notes
Generic blocks: `randomQuadSubdivision` (iterative 4-way random split of a rect
list) and `windowGrid` (grid of small boxes over an arbitrary 3D quad with per-face
lit fraction and cell-size jitter) are directly reusable; the triangulation step is
a plain call into the triangulate library. One-off art decisions: the specific
camera rig (ortho + rotateX ~PI/4 + scale 1.9), the height distribution
`random(300)*random(1)` (the squaring biases towers to be short), and the
black/255,220,200 two-tone palette. A clean parameter object would be:
`{size, iterations (subdivisions), heightMax, heightCurve (pow exponent), sub1/sub2
range, cellScale range, litFraction range, onColor, offColor, cameraTilt,
cameraRoll, zoom}`.
