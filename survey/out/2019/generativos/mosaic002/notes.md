---
sketch: 2019/generativos/mosaic002
year: 2019
renderer: P2D
size: [3250, 3250]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 2241
animated: false
techniques: [subdivision, grid, voronoi-delaunay]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#DFAB56", "#E5463E", "#366A51", "#2884BC"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: subdivisions, default: 100, tried: [400], change: large, effect: "core triangulation grows until it covers most of the canvas; outer rect field shrinks to a thin border strip"}
  - {name: pickBias, default: 0.5, tried: [1.0], change: large, effect: "subdivision spreads evenly over all rects; dense-core/sparse-periphery structure disappears, whole canvas uniformly mid-fine"}
  - {name: strokeWeight, default: 0.6, tried: [2], change: subtle, effect: "same layout; triangle edge lines slightly heavier and darker"}
  - {name: vertexDotSize, default: 3, tried: [12], change: none, effect: "no visible change; bigger dots cover only a few % of pixels"}
  - {name: shadowAlpha, default: 80, tried: [0], change: none, effect: "no visible change; per-rect vertical shading removed but below detection threshold"}
  - {name: colors, default: "#DFAB56 #E5463E #366A51 #2884BC", tried: ["#043387 #0199DC #BAD474 #FBE710"], change: large, effect: "same geometry recoloured to dark blue, cyan, pale green, yellow"}
reusable_candidates:
  - {name: subdivideMosaic, signature: "subdivideMosaic(w, h, iterations, pickBias) -> Rect[]", note: "repeatedly split a random rect (biased to first half of list = larger rects) into 4"}
  - {name: perVertexAlphaFill, signature: "drawGradientTri(p1, p2, p3, color, a1, a2, a3)", note: "triangle with per-vertex alpha: one corner tinted, rest transparent"}
  - {name: delaunayOverlay, signature: "delaunayOverlay(points, skipProb, passes)", note: "Delaunay triangulation over rect centroids, drawn in layered passes (wireframe / corner-tint / solid / lerp / stroke)"}
---

## What it draws
Full-bleed mosaic on a warm background. A large rounded, blob-like region in the
centre is densely tiled with small flat triangles in orange, red, blue, green and
tan, with scattered solid black wedges and a few two-tone corner-tinted triangles.
Around that dense core, the canvas falls away into much larger, sparsely divided
rectangles (the background mosaic) in muted greens, oranges and reds, many with a
soft top-to-bottom shading gradient. Tiny dots mark some triangle vertices.

## How the code works
`generate()` (line 81): `randomSeed(seed)`, `background(rcol())`, then `scale(scale)`
(line 88) maps the 960 design space to the 3250px canvas.

- Mosaic subdivision (lines 92-98): start with one full-canvas `Rect`; 100 times
  pick a rect from the **first half** of the list (`random(rects.size()*0.5)`, line 96)
  and split it into 4 via `subdivide()` (line 67). Picking from the first half biases
  subdivision toward the larger, earlier rects, which keeps the outer field coarse
  while a cluster of rects keeps getting subdivided — this is what produces the
  dense centre vs. sparse periphery.
- Per-rect drawing (lines 106-116): fill `rect()` with a random palette colour
  (`rcol()`, line 284, random from the 4-colour list at line 281); `shadow()`
  (line 266) overlays a quad whose per-vertex alpha goes 80→0 top to bottom, giving
  each tile a soft vertical shade; a small ellipse (5% of min dimension, line 112)
  marks the centre; each centre point is collected.
- Triangulation (lines 118-119): `Triangulate.triangulate(points)` (Delaunay) over
  all rect centres. The triangles are then drawn in five layered passes over the
  mosaic:
  1. lines 121-128: wireframe only (`stroke(0,2)`, weight 0.6, `noFill()`).
  2. lines 130-140: per-vertex alpha gradient — v1 = random colour at alpha 60,
     v2/v3 = alpha 0, so each triangle gets one tinted corner fading to nothing.
  3. lines 142-151: solid black triangles (`fill(0)`).
  4. lines 154-163: solid triangles with `getColor()`, which lerps between two
     neighbouring palette entries (line 290) — the orange↔red↔blue↔green blends.
  5. lines 166-177: `stroke(0,80)` + per-vertex alpha 20→0 fill, a darkening
     overlay pass.
  Passes 2-5 each skip ~20% of triangles randomly (`random(1) < 0.2`, e.g. line 132),
  so the final colour of any triangle is whichever later pass kept it — that is the
  source of the black wedges and the mixed colouring.
- Vertex dots (lines 254-258): 3px circles at each centroid, random palette colour.
- The `post.glsl` shader is loaded only in commented-out code (lines 260-263), so
  no filter is applied despite `uses_shader: true` in the baseline result.
- `toxi`'s `SimplexNoise` is imported (line 2) but only used inside the commented-out
  block at lines 179-252.

## Experiments
| variant | substitution | change score | observation | image |
| subdivisions_400 | `for (int i = 0; i < 100; i++) {` -> `... i < 400 ...` | large | triangulated core expands to fill most of the canvas; flat outer rects reduced to a thin border; more black wedges and small star-shaped sub-clusters | variants/subdivisions_400/frame_00001.png |
| pickBias_1.0 | `rects.get(int(random(rects.size()*0.5)))` -> `*1.0)` | large | subdivision now hits all rects evenly: no large flat outer rectangles, uniform mid-fine density across the whole canvas | variants/pickBias_1.0/frame_00001.png |
| strokeWeight_2 | `strokeWeight(0.6);` -> `strokeWeight(2);` | subtle | layout identical to baseline; triangle edge lines slightly heavier and darker | variants/strokeWeight_2/frame_00001.png |
| vertexDotSize_12 | `ellipse(p.x, p.y, 3, 3);` -> `ellipse(p.x, p.y, 12, 12);` | none | no visible change (dots are larger but cover only ~3% of pixels) | variants/vertexDotSize_12/frame_00001.png |
| shadowAlpha_0 | `fill(col, 80);` -> `fill(col, 0);` | none | no visible change (per-rect top-to-bottom shading removed, effect below threshold) | variants/shadowAlpha_0/frame_00001.png |
| palette_cool | `int colors[] = {#DFAB56, #E5463E, #366A51, #2884BC};` -> `{#043387, #0199DC, #BAD474, #FBE710};` | large | identical geometry, recoloured: dark blue, cyan, pale green, yellow; black wedges unchanged | variants/palette_cool/frame_00001.png |

## Modularisation notes
- **Generic / library candidates**: `subdivideMosaic` (iterative rect subdivision
  with a pick-bias parameter — the bias is what creates the dense-core/sparse-edge
  structure, worth exposing); `perVertexAlphaFill` (the one-corner-tint triangle
  trick is a reusable primitive); `delaunayOverlay` (layered Delaunay passes with
  per-pass skip probability and a pluggable per-triangle colour function).
- **One-off art decisions**: the exact 4-colour palette, the 5-pass drawing order
  and which pass is solid black, the 0.2 skip probability, the shadow gradient,
  and the tiny vertex dots.
- **Parameter object**: `{width, height, subdivisions (int), pickBias (0..1),
  palette (int[]), triangleSkip (float), passes: {wire, cornerTint, solid, lerp,
  darkStroke}, dotSize (float), shadowAlpha (int)}`.
