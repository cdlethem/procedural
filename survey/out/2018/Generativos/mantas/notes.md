---
sketch: 2018/Generativos/mantas
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1642
animated: false
techniques: [particles, voronoi-delaunay, distortion, symmetry]
primitives: [pgraphics, line]
palette:
  colors: ["#F8F8F9", "#FE3B00", "#7233A6", "#0601FE", "#000000"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: pointCount, default: 200, tried: [60], change: large, effect: "fewer circles; vivid blue background shows through; sparser targets, longer mesh edges"}
  - {name: sizePower, default: "width*random^3", tried: ["width*random"], change: large, effect: "a few full-canvas circles; flat colour fields replace the bullseye scatter"}
  - {name: fillAlpha, default: "random(120,255)", tried: ["random(240,255)"], change: none, effect: "no visible change - the alpha fill is overwritten by solid fill(c1)/fill(c2) inside circle(), dead parameter"}
  - {name: meshStrokeAlpha, default: 80, tried: [255], change: none, effect: "no visible change - thin 1px lines over opaque fills, only ~2% of pixels touched"}
  - {name: noiseMaxDist, default: 80, tried: [240], change: large, effect: "circle edges and mesh lines clearly more wobbly/lobed"}
reusable_candidates:
  - {name: desform, signature: "desform(x, y, angleDes, angleScale, distDes, distScale, maxDist) -> PVector", note: "noise-driven polar offset of a point (angle + distance from 2-D noise)"}
  - {name: wobblyCircle, signature: "wobblyCircle(x, y, r, segments, desform, c1, c2) -> void", note: "fan of distorted triangles approximating a circle, two alternating fills"}
  - {name: wobblyEdge, signature: "wobblyEdge(x1, y1, x2, y2, segments, desform, c1, c2) -> void", note: "straight segment sampled through desform, stroke lerped between two colours"}
---

## What it draws
Full-bleed scatter of large, soft-edged overlapping circles in red, blue, purple, white and black, many of them concentric "bullseye" targets; later circles cover earlier ones. The circle edges are softly faceted (each circle is a fan of small triangles in two alternating colours), which reads as blurred overlap and gives muddy orange/violet transition zones. Over everything lies a fine web of faint curved lines — a triangulation of the circle centres, gently wobbled.

## How the code works
`setup()` -> `generate()` (mantas.pde:5-10). `rcol()` (158-160) picks a random colour from the 5-colour `colors[]` list (155); the background is one such colour (25-30).

- 200 points (41-54): random `x,y` in canvas; size `s = width*random(1)*random(1)*random(1)` (44) — product of three uniform randoms biases sizes small, with a few large outliers. Each point gets 3 stacked circles: `circle(x,y,s)` and `circle(x,y,s*0.9)` with alpha 120-255, then a solid inner `circle(x,y,s*0.4)` (46-52) — the bullseye look.
- `circle()` (124-146): not a real circle but a fan of `max(8, r*PI)` triangles, each vertex pushed through `desform()`, with two alternating fill colours — that is why edges look softly faceted/wobbly rather than smooth.
- `desform()` (118-122): offsets a point by `noise(...)*80` in a noise-driven angle direction (up to ~80 px of displacement); `desAng/detAng/desDes/detDes` (113-116, re-rolled per seed at 32-35) set the noise field. This is the single source of all the wobble in circles and lines.
- Triangulation (57): `Triangulate.triangulate(points)` (org.processing.wiki.triangulate) connects the 200 centres into a Delaunay mesh; each edge is drawn by `curvi()` (64-73).
- `curvi()` (77-91): samples each edge at `max(2, dist*0.8)` segments, pushes sample points through `desform()`, strokes with `lerpColor(c1,c2,v)` at alpha 80 — the faint curved web.
- No blend modes beyond default alpha compositing; P2D renderer with `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_60 | `for (int i = 0; i < 200; i++) {` -> `... i < 60 ...` | large (0.306, 84% px) | sparser scatter; bright blue background visible between targets; mesh spans long gaps | variants/count_60/frame_00001.png |
| sizeExp_1 | `float s = width*random(1)*random(1)*random(1);` -> `width*random(1);` | large (0.289, 81% px) | a handful of full-canvas circles; big flat red/blue/white fields, bullseye structure lost | variants/sizeExp_1/frame_00001.png |
| fillAlpha_240 | `fill(rcol(), random(120, 255));` -> `random(240, 255)` | none (0.0, 0% px) | no visible change (parameter is dead: `circle()` re-fills with solid `fill(c1)`/`fill(c2)`) | variants/fillAlpha_240/frame_00001.png |
| meshAlpha_255 | `stroke(lerpColor(c1, c2, v), 80);` -> `..., 255);` | none (0.008, 2% px) | no visible change: thin lines over opaque fills barely register | variants/meshAlpha_255/frame_00001.png |
| distort_240 | `... *80; ` -> `... *240; ` | large (0.165, 48% px) | circle edges and mesh lines visibly more wobbly and lobe-like | variants/distort_240/frame_00001.png |

## Modularisation notes
- Generic: `desform()` (noise-displace a point by angle+distance), `wobblyCircle` fan construction, `wobblyEdge` sampled-and-distorted segment, and the "stack N scaled circles with decreasing radius and rising opacity" bullseye recipe.
- One-off art decisions: the 5-colour list, `s = width*random^3` size distribution, alpha ranges (120-255 fills, 80 stroke), the 80-px max displacement, 200 points.
- A clean parameter object: `{count, sizeDist (power/exponent), radiiFrac [1.0, 0.9, 0.4], fillAlphaRange, strokeAlpha, noiseMaxDist, noiseDetail, palette, triangulate: bool}`.
