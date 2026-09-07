---
sketch: 2019/generativos/lightcityLines
year: 2019
renderer: P3D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1671
animated: false
techniques: [subdivision, voronoi-delaunai, 3d-mesh, grid]
primitives: [rect]
palette:
  colors: ["#121B4B", "#028594", "#E55E7F", "#FBAF34", "#F0D5CA"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: maxHeight (random(300) in height line), default: 300, tried: [100], change: large, effect: "shorter slabs, lower flatter skyline, fewer solid-black clusters, more white"}
  - {name: nSubdiv (loop count), default: 40, tried: [80], change: large, effect: "finer tile patchwork, many more small faces, busier denser image with more black patches"}
  - {name: winRes (sub1 range), default: "random(16,28)*0.5 = 8-13", tried: ["random(6,10)*0.5 = 3-5"], change: moderate, effect: "fewer, taller windows per face; faces read as dense vertical hatching"}
  - {name: strokeWeight, default: 0.3, tried: [1.0], change: large, effect: "much heavier image: strokes thicken into solid black masses, windows merge"}
  - {name: zoom (scale()), default: 2, tried: [4], change: large, effect: "closer view: larger tiles and windows, fewer buildings in frame, more empty white ground"}
  - {name: winW (ww range), default: "random(0.2,0.9)", tried: ["random(0.85,0.95)"], change: moderate, effect: "windows wider with less gap; faces denser, overall structure similar to baseline"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(seed, nPasses) -> Rect[]", note: "pick a random rect, split into 4, repeat; produces an uneven tile field"}
  - {name: windowedExtrude, signature: "windowedExtrude(tri, h, sub1, sub2) -> void", note: "draw a window grid on each of a triangle's 3 extruded side faces"}
---

## What it draws
A dense black-on-white 3D "city" filling the whole canvas: an irregular patchwork of
triangular slabs, each extruded upward to a random height, whose three side faces are
covered with grids of tiny outlined rectangles ("windows"). Overlapping thin strokes make
many windows read as solid black. The field is tilted in perspective (ortho camera), so
the slabs form a low, faceted terrain with a few tall towers, full-bleed to the frame edges.

## How the code works
- `settings()` (L16-21): `size(960, 960, P3D)`, `smooth(8)`.
- `generate()` (L75): white background, `randomSeed(seed)` (L85). Camera: `ortho()`,
  translate to centre, `rotateX(PI*0.25 + random(-0.3, 0.2))` (L89) gives the tilted
  `scale(2)` (L92) and `strokeWeight(0.3)` (L93).
- Tile field: start with one full-canvas rect (L96); 40 times pick a rect from the first
  half of the list and split it into 4 quadrants (`subdivide`, L61-71, L98-101). This
  yields an uneven quad patchwork, biased so earlier (bigger) rects get subdivided.
- Points: one point per tile centre (L104-108), triangulated with
  `Triangulate.triangulate` (L111).
- Buildings: for each triangle (L117-145) pick a random height
  `h = random(300)*random(random(0.8, 1))` (L119) and a window resolution
  `sub1, sub2 = int(random(16,28)*0.5)` (L121-122, i.e. 8-13). Each of the 3 side faces
  of the extruded triangle is sent to `winwin` (L155-188): it builds a grid
  (sub2 × sub1 cells) on the quad, and per cell draws a `rect` of size
  `ww = dis1/sub2 * random(0.2,0.9)`, `hh = dis2/sub1 * random(0.2,0.9)` (L163-167),
  rotated onto the face (rotateZ by face angle, rotateX HALF_PI).
- Colour: `noFill()`/`fill(255)`/`stroke(0)` (L113-116) — the render is pure black and
  white. The 5-colour palette (L195) and `rcol()`/`getColor()` (L200-212) exist but are
  unused in `generate()` (they were for an earlier/other variant). Solid-black windows
  come from many overlapping 0.3px strokes, not from fills.
- `draw()` is empty (L33-34); everything happens once in `setup()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| height_100 | `float h = random(300)*...` -> `random(100)` | large | lower flatter skyline; slabs much shorter, more white, fewer solid-black clusters | variants/height_100/frame_00001.png |
| subdiv_80 | `for (int i = 0; i < 40; i++)` -> `i < 80` | large | finer tiles, many more small windowed faces; busier, more dense black patches | variants/subdiv_80/frame_00001.png |
| winres_coarse | `int sub1 = int(random(16, 28)*0.5)` -> `random(6, 10)` | moderate | fewer, taller windows per face; faces read as dense vertical hatching | variants/winres_coarse/frame_00001.png |
| weight_1.0 | `strokeWeight(0.3);` -> `strokeWeight(1.0);` | large | strokes ~3x thicker; windows merge into solid black masses, much heavier image (a few stray pink AA specks bottom-centre) | variants/weight_1.0/frame_00001.png |
| zoom_4 | `scale(2);` -> `scale(4);` | large | zoomed in: bigger tiles and windows, fewer buildings visible, more empty white ground | variants/zoom_4/frame_00001.png |
| winw_0.85_0.95 | `ww *= random(0.2, 0.9);` -> `random(0.85, 0.95);` | moderate | windows wider with less gap between columns; faces denser, same structure as baseline | variants/winw_0.85_0.95/frame_00001.png |

## Modularisation notes
- Generic: `subdivide` (random recursive quad subdivision over a rect list) — a clean
  "uneven tile field" primitive parameterised by pass count and pick-bias;
  `winwin` (window grid on a quad face) — a "façade" primitive parameterised by cell
  resolution and cell size range.
- One-off art decisions: the tilt angles (L89-90), the `scale(2)` zoom, black/white
  stroke-only look, the unused colour palette, the exact 40 subdivision passes.
- Clean parameter object: `{ seed, nSubdiv (40), maxH (300), winRes (16,28), winW (0.2,0.9),
  winH (0.2,0.9), strokeW (0.3), zoom (2), tiltX, rotZ }`.
