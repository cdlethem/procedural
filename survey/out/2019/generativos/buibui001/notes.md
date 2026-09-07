---
sketch: 2019/generativos/buibui001
year: 2019
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1556
animated: false
techniques: [subdivision, 3d-mesh, grid, lines-hatching]
primitives: [line, rect, shape]
palette:
  colors: ["#43748E", "#FFC301", "#FFE6D8", "#F399AB"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: iterations, default: 800, tried: [200], change: large, effect: "fewer splits = far fewer, much larger slabs; central cluster becomes coarse, big flat panels dominate"}
  - {name: wireAlpha, default: 50, tried: [200], change: subtle, effect: "composition identical; wireframe boxes and marker grids slightly darker, small black top-boxes now visible as dots"}
  - {name: cameraZ, default: 380, tried: [150], change: large, effect: "camera much closer: buildings larger, steeper close-up recession, panels fill the frame"}
  - {name: palette, default: "[#43748e, #ffc301, #FFE6D8, #F399AB]", tried: ["[#121B4B, #028594, #016C40, #FBAF34, #CF3B13, #E55E7F, #F0D5CA]"], change: large, effect: "same geometry; colours shift from pastel pink/yellow/cream to orange/teal/green/rose, much more saturated"}
  - {name: zoom, default: 1.3, tried: [1.0], change: moderate, effect: "whole scene slightly smaller, more of the large border panels and surrounding void visible"}
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(rect, iterations) -> Rect[]", note: "randomly split one rect into 4 offset half-size children, repeat N times"}
  - {name: truncatedPyramid, signature: "truncatedPyramid(w, h, d, aw, ah)", note: "6-face solid from a base rect and a smaller offset top rect"}
  - {name: targetMarker, signature: "targetMarker(d, gridLines) -> void", note: "grid + needle + crosshair + double rect floating in front of a cell"}
---

## What it draws
A perspective view into a dense 3-D "city" of boxes: a tight cluster of small pastel
buildings (pinks, mustard yellow, cream, olive, dusty blue) fills the centre and recedes
into the distance, while a few huge flat panels of solid colour (lavender, pink, olive,
grey) form the borders, some carrying faint wireframe outlines, a small wire grid with a
diagonal needle, and tiny crosshair/target markers. Black background; everything is lit
with a soft ambient + cool directional light.

## How the code works
Static sketch: `setup()` calls `generate()` once; `draw()` is empty (frames 10/60 are
identical to frame 1, `dropped_frames` in result.json).

- **Camera** (buibui001.pde:61-70): `fov = PI/random(1.3, 1.4)` (~129°), `perspective()`
  with near `cameraZ/100` and far `cameraZ*100`, then `translate(w/2, h/2, 380)`, small
  random `rotateX/Y` (≤ `random(0.3)` rad) and full random `rotateZ`, `scale(1.3)`. This
  places the camera close to the scene looking slightly down, giving the steep recession.
- **Subdivision** (72-83): one `Rect(0, 0, 2.8w, 2.8h)` is seeded; 800 iterations pick a
  random rect and replace it with 4 children offset by ±0.25·w/h at half size. Small
  rects (< 4 px) are skipped. Result: a quadtree-like set of ~1600 nested rects, densest
  in the centre of the original rect.
- **Buildings** (89-116): for each rect — `stroke(0, 50)` wireframe `box(w, h, d)` where
  `d = min(min(w, h), 200)`; a filled truncated pyramid `piras(w, h, d, aw, ah)` (153-198,
  6 `beginShape` faces, top scaled by random `aw/ah` ∈ {0.4, 1.0, 1.6}) with
  `fill(getColor())` — `lerpColor` between two adjacent palette entries (205, 214-222),
  which is why the image shows olive/green and mauve mixes of the 4 base colours; two thin
  edge boxes (106-107); a small lid box in front of the top face (109-110) and a tiny
  pin/needle box at the centre (112-113).
- **Markers** (119-142): second loop over the same rects, each at `z = d*1.14`: a 10×10
  `grid` of thin lines (145-151), a line out 40 units in z, a 1×1×1 black box, ±4-unit
  crosshair, and two concentric no-fill rects scaled by `min(min(w, h)*0.5, 8)` — the
  target/crosshair marks visible on the big flat panels.
- **Lighting** (57-59): `background(0)`, `ambientLight(200, 190, 180)`,
  `directionalLight(50, 60, 70, 0.3, 0, -1)` — the flat panels read as near-uniform
  because the light is weak and mostly ambient.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| iter_200 | `for (int i = 0; i < 800; i++) {` -> `for (int i = 0; i < 200; i++) {` | large | far fewer, much larger slabs; dense centre shrinks to a coarse cluster, big flat panels (yellow, pink, olive, lavender) fill the frame, target markers much bigger | variants/iter_200/frame_00001.png |
| wire_alpha_200 | `stroke(0, 50);` -> `stroke(0, 200);` | subtle | same layout; box wireframes and marker grids slightly darker, small black top-boxes now readable as dark dots on many roofs | variants/wire_alpha_200/frame_00001.png |
| cameraZ_150 | `translate(width*0.5, height*0.5, 380);` -> `translate(width*0.5, height*0.5, 150);` | large | camera much closer: buildings loom larger, steeper perspective, scene fills frame edge to edge | variants/cameraZ_150/frame_00001.png |
| palette_alt | `int colors[] = {#43748e, #ffc301, #FFE6D8, #F399AB};` -> `int colors[] = {#121B4B, #028594, #016C40, #FBAF34, #CF3B13, #E55E7F, #F0D5CA};` | large | identical geometry; saturated orange/teal/green/rose scheme replaces the pastel pink/yellow/cream one | variants/palette_alt/frame_00001.png |
| zoom_1.0 | `scale(1.3);` -> `scale(1.0);` | moderate | same scene slightly smaller; more of the large border panels and edge void visible | variants/zoom_1.0/frame_00001.png |

## Modularisation notes
- `quadSubdivide` (72-83) is generic: input rect + iteration count + min-size cutoff;
  the 4-child ±0.25/half-size split is a specific choice (a plain 4-way split would be
  the boring variant).
- `piras` (153-198) is a reusable 3-D solid: base rect + scaled top rect, 6 faces.
- `grid` (145-151) and the marker block (119-142) are reusable as a "surveyor's target"
  primitive.
- One-off art decisions: the double loop (buildings then markers on the same rects), the
  thin edge boxes and lid/pin boxes, the odd `perspective` near/far pair, `stroke(0, 50)`
  wireframes over the fills.
- A clean parameter object: `{ iterations, minSize, depthCap (=200), topScale ∈ [0.4, 1.6],
  cameraZ (=380), rollMax (=0.3), zoom (=1.3), wireAlpha (=50), palette[], gridLines (=10) }`.
