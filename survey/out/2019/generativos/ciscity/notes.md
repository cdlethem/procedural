---
sketch: 2019/generativos/ciscity
year: 2019
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1703
animated: false
techniques: [subdivision, voronoi-delaunay, 3d-mesh, grid]
primitives: [shape, rect]
palette:
  colors: ["#C4C2C0", "#0A0A0A", "#000000", "#FFFFFF", "#B4B4B4", "#D2D2D2"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: subdivIterations, default: 180, tried: [90], change: large, effect: "fewer subdivisions -> much coarser blocks, larger flat triangles, sparser window bands"}
  - {name: heightMax, default: 200, tried: [400], change: none, effect: "invisible: ortho top-down camera, extrusion is pure z, window xy positions do not depend on h"}
  - {name: windowProbFace1, default: 0.4, tried: [0.9], change: large, effect: "more side faces get window grids -> far denser black/white striped bands, larger dark ground areas between them"}
  - {name: windowSize, default: 14, tried: [30], change: large, effect: "windows ~2x bigger -> stripes become chunky thick bars instead of fine lines"}
  - {name: zoom, default: 2.2, tried: [3.5], change: large, effect: "zooms into the scene, same structure but fewer larger triangles and fatter stripes visible"}
  - {name: topGray, default: "random(180,210)", tried: ["random(120,150)"], change: moderate, effect: "building tops/walls become mid-gray, lower contrast against black/white windows, flatter look"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(initialRect, iterations) -> List<Rect>", note: "repeatedly pick a random rect (from the first half of the list) and replace it with 4 quads"}
  - {name: triangulatePoints, signature: "triangulatePoints(List<PVector>) -> List<Triangle>", note: "thin wrapper over org.processing.wiki.triangulate.Triangulate"}
  - {name: extrudePrism, signature: "extrudePrism(Triangle, height) -> top/side shapes", note: "draws base triangle, translated top triangle, and 3 side quads"}
  - {name: windowGrid, signature: "windowGrid(faceQuad, sub1, sub2, winSize) -> void", note: "grids of small rotated square 'windows' in random black/white across a quad face"}
---

## What it draws
A flat, orthographic view of an abstract low-poly "city" filling the whole canvas.
Light-gray triangular prisms of varying heights sit on a slightly darker gray ground;
their side walls carry dense black-and-white striped bands of small square "windows",
so the top half of the image is busy striped texture while the bottom shows larger,
mostly bare gray facets. A few near-black triangles form the shadowed ground between
buildings. Palette is purely grayscale: light gray tops/walls, black and white windows,
dark gray-black ground, light warm-gray background.

## How the code works
`generate()` (ciscity.pde:72) runs once in `setup()`; `draw()` is empty, so the image
is static. Flow:

1. Background `#c4c2c0` (line 74), `randomSeed(seed)` (75). Lights: ambient + two
   directional (78–81), `ortho()` camera (85), centered and zoomed with `scale(2.2)`
   (86, 92) so the scene overflows the canvas — full-bleed composition.
2. Quad subdivision (96–101): start with one full-canvas rect; 180 times pick a random
   rect from the *first half* of the list (line 99) and `subdivide()` it into 4 quads
   (58–68). Biasing toward early (larger) rects yields irregular block sizes.
3. Centroid points (104–109): one point per remaining rect; `Triangulate.triangulate`
   (112) Delaunay-triangulates them.
4. Ground layer (116–130): ~60% of triangles (skip if `random(1)<0.4`, line 117) drawn
   flat at z=0 with `fill(10)` — the dark ground triangles.
5. Buildings (132–195): for the other ~60% (line 133), random height
   `h = random(200)*random(1)` (136). Draw base triangle, top triangle lifted to z=h,
   and 3 side quads, all `fill(random(180, 210))` light gray (139). On each of the 3
   side faces, with probability 0.4 (177, 184, 192), `winwin()` (198–217) draws a
   grid of `sub1 x sub2` squares (`rect(0,0,14,14)`, rotated to the face angle, line
   212–213) in random black or white (`fill(255*int(random(2)))`, 209) — the striped
   window bands.
   Because the camera is orthographic and top-down (rotations commented out, 87–90),
   the vertical side walls project to lines: the visible striped bands are the rows of
   window squares drawn along the triangle edges, and building height `h` does not
   affect the image at all (see height_400).
6. Randomness enters via the subdivision pick (99), the 0.4 skips (117/133/177/184/192),
   the heights (136) and window colours (209). The `colors[]` palette and `rcol()` are
   unused (commented-out fill calls, 123/125/127).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| subdiv_90 | `for (int i = 0; i < 180; i++) {` -> `... i < 90; ...` | large (0.284, 47%) | coarser layout: fewer, much larger flat gray triangles, a couple of big black ground triangles, window bands sparser and wider | variants/subdiv_90/frame_00001.png |
| height_400 | `float h = random(200)*random(1);` -> `random(400)*random(1)` | none (0.0, 0%) | no visible change — pixel-identical: ortho top-down camera, so z-extrusion is invisible and window xy positions do not depend on h | variants/height_400/frame_00001.png |
| winProb_0.9 | `if (random(1) < 0.4) winwin(p1, p2, p3, p4, 24, 24);` -> `... < 0.9 ...` | large (0.305, 49%) | far denser black/white striped bands across the upper two-thirds, bigger dark ground regions between them | variants/winProb_0.9/frame_00001.png |
| winSize_30 | `rect(0, 0, 14, 14);` -> `rect(0, 0, 30, 30);` | large (0.167, 30%) | windows ~2x larger: stripes read as chunky thick black/white bars instead of fine lines | variants/winSize_30/frame_00001.png |
| scale_3.5 | `scale(2.2);` -> `scale(3.5);` | large (0.253, 45%) | zoomed crop of the same scene: fewer, larger triangles and fatter stripes; structure unchanged | variants/scale_3.5/frame_00001.png |
| topFill_120 | `fill(random(180, 210));` -> `fill(random(120, 150));` | moderate (0.141, 61%) | building tops and walls shift from light gray to mid-gray, lower contrast against black/white windows, flatter overall tone | variants/topFill_120/frame_00001.png |
## Modularisation notes
Generic, reusable as-is: the quad-subdivision routine (any "irregular block" layout),
the triangulate wrapper, the prism extrusion (base + top + 3 sides), and `winwin`
(face-quad window grid — works for any quad, not just building faces). One-off art
decisions: the first-half pick bias (line 99), the 0.4 skip probabilities, the
`random(200)*random(1)` height distribution, 14×14 window size, the grayscale fills,
and the `scale(2.2)` overflow. A clean parameter object would contain: iterations
(180), groundSkip/buildingSkip (0.4/0.4), heightMax (200), windowProb (0.4),
windowSub (24/20/40 per face), windowSize (14), zoom (2.2), and a grayscale
(topMin, topMax) pair.
