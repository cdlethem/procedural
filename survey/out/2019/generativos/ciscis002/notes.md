---
sketch: 2019/generativos/ciscis002
year: 2019
renderer: P3D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2788
animated: false
techniques: [subdivision, voronoi-delaunay, 3d-mesh, grid]
primitives: [shape]
palette:
  colors: ["#121B4B", "#028594", "#E55E7F", "#FBAF34", "#F0D5CA", "#FFDCC8", "#000000"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: splits, default: 100, tried: [30], change: large, effect: "coarser quadtree: fewer, much larger faceted towers with thick window bands and big flat roof planes"}
  - {name: camTiltX, default: "PI*0.25+random(-0.3,0.2)", tried: ["PI*0.1+random(-0.3,0.2)"], change: large, effect: "flatter camera: near-ground view of tall facades, big foreground roof planes, dense cluster pushed to one side"}
  - {name: zoom, default: 2.1, tried: [1.2], change: large, effect: "zoomed out: whole city block visible as an island in black, edge ground plane with its window boxes shows"}
  - {name: winSub, default: "int(random(16,23))", tried: ["int(random(6,10))"], change: large, effect: "much larger, chunkier window boxes on every wall; buildings themselves unchanged"}
  - {name: hMax, default: 200, tried: [80], change: large, effect: "short low-rise towers; flat roof planes dominate, whole block reads flatter from the same camera"}
reusable_candidates:
  - {name: quadtreeCells, signature: "quadtreeCells(seed, splits) -> Rect[]", note: "repeated random 4-way subdivision of the canvas rect"}
  - {name: facadeBoxes, signature: "facadeBoxes(p1..p4, sub1, sub2, litProb) -> void", note: "grid of small boxes (lit/unlit windows) over a quad wall"}
  - {name: lerpPalette, signature: "lerpPalette(colors[], v) -> color", note: "random value -> lerp between adjacent palette entries"}
---

## What it draws
A dense, angular cityscape seen from a low oblique angle, as if looking across a field of faceted towers. Flat triangular roof planes in amber-orange, teal, pink, pale cream and dark navy tile most of the frame; the vertical walls of the towers are dark (navy/black) and covered with fine grids of small boxy windows, some unlit black, some glowing warm cream. A few flat grey and teal patches sit between the clusters, and black shows through at the edges. The overall feel is a low-angle isometric model city, full-bleed, no horizon.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (ciscis002.pde:24-35).

1. **Quadtree subdivision** (99-102, 59-69): start with one rect covering the canvas (centered, 99-97), then 100 times pick a random rect from the first half of the list and split it into 4 quadrants, adding the 4 and removing the original -> ~301 cells of varying size.
2. **Delaunay triangulation** (105-112): cell centres become points; `Triangulate.triangulate(points)` (org.processing.wiki.triangulate) triangulates them.
3. **Camera** (88-93): `ortho()`, translate to centre, z=-400, `rotateX(PI*0.25 + random(-0.3,0.2))`, `rotateZ(...)`, `scale(2.1)`. This is the oblique "looking down the streets" view; the rotation randomness is why the angle varies per seed. Lighting: ambient(120) plus two directional lights (81-84) give the flat faces their shading.
4. **Ground pass** (156-168): all triangles drawn flat at z=0 with grayscale `fill(random(200))`, 20% skipped — the flat grey/teal patches visible between buildings.
5. **Extrusion pass** (172-234): each triangle is extruded to height `h = random(200)*random(1)` (176, biased low). Top face and the three wall quads are filled with `getColor()` (180, 314-323): a random value lerps between adjacent entries of the 5-colour palette `#121B4B #028594 #E55E7F #FBAF34 #F0D5CA` (306).
6. **Windows** (210-233, 268-299): each wall quad is handed to `winwin2` with `sub1`/`sub2` = int(random(16,23)) each. It divides the quad into a sub2 x sub1 grid of small boxes (`box(ww, 0.1, hh)`, depth 0.1), each black `fill(0)` or lit warm white `fill(255,220,200)` with per-wall probability `pos = random(0.2,0.8)*random(1)`; box footprints are scaled by `random(0.2,0.9)` so they don't touch.
7. **Shader** (236-241): `post.glsl` (grain/blur/vignette) exists but the `loadShader`/`filter` call is commented out, so the final image has no post-processing. `toxi` SimplexNoise is imported (line 2) but never used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| divs_30 | `for (int i = 0; i < 100; i++)` -> `i < 30` | large | sparse coarse city: far fewer and much larger faceted towers, thick window bands, big flat roof planes, same camera | variants/divs_30/frame_00001.png |
| camX_0.1 | `rotateX(PI*(0.25)+random(-0.3, 0.2))` -> `rotateX(PI*(0.1)+random(-0.3, 0.2))` | large | much flatter camera: near-ground view, large foreground roof planes (teal/cream/orange), dense small-building cluster to the right | variants/camX_0.1/frame_00001.png |
| zoom_1.2 | `scale(2.1)` -> `scale(1.2)` | large | zoomed out: entire city block visible as an island in black; flat ground border with window boxes visible at the edges | variants/zoom_1.2/frame_00001.png |
| winSub_6 | `int sub1 = int(random(16, 23));` -> `int(random(6, 10));` | large | same buildings but much larger chunky window boxes (big dark rectangles and thick vertical bars on the walls) | variants/winSub_6/frame_00001.png |
| height_80 | `float h = random(200)*random(1);` -> `float h = random(80)*random(1);` | large | short low-rise towers; flat roof planes dominate and the block reads flatter; same camera | variants/height_80/frame_00001.png |

## Modularisation notes
Generic, library-worthy blocks:
- **Quadtree subdivision** (59-69, 99-102): pure 2-D, seedable; the "pick from first half" bias is what keeps cells from over-fragmenting in dense areas — worth keeping as a parameter.
- **Extruded Delaunay mesh**: points -> triangulate -> per-triangle top + 3 walls is a compact city/terrain primitive (height = per-triangle random).
- **Facade grid** (268-299): a window grid over an arbitrary quad with per-wall lit probability and box sizing is a reusable "building facade" function, independent of the triangulation.
- **lerpPalette** (314-323): sample a palette at a random value with wrap-around lerp.

One-off art decisions: the specific palette, the oblique camera angles, box depth 0.1, the grayscale ground pass, and the unused toxi import / commented-out grain shader.

A clean parameter object: `{seed, splits, minSub, maxSub, hMax, palette, winOn, camTiltX, zoom}`.
