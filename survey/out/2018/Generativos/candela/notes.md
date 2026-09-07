---
sketch: 2018/Generativos/candela
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1880
animated: false
techniques: [voronoi-delaunay, curves, dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#F8F8F9", "#FE3B00", "#7233A6", "#0601FE", "#000000"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: n_points, default: 100, tried: [250], change: large, effect: "more dot chains, rings and endpoint dots; canvas fully filled, no empty black areas"}
  - {name: tri_alpha, default: 30, tried: [120], change: moderate, effect: "white Delaunay mesh clearly visible; whole image brightened/washed out, dot chains unchanged"}
  - {name: tri_stroke_alpha, default: 4, tried: [60], change: none, effect: "no visible change per score; only a faint thin black wireframe just perceptible (1px lines, ~1.3% of pixels)"}
  - {name: wire_steps_mult, default: 3, tried: [10], change: large, effect: "beaded chains merge into smooth thick ribbons; endpoint dots read as large solid circles"}
  - {name: maxSize, default: [20, 90], tried: [[20, 200]], change: large, effect: "dots become huge overlapping blobs; wire structure mostly lost, composition blob-like"}
  - {name: colors, default: "F8F8F9,FE3B00,7233A6,0601FE,000000", tried: ["FFFFFF,FFC930,F58B3F,395942,212129"], change: large, effect: "same structure, warm yellow/orange/green palette replaces white/red/blue/black"}
reusable_candidates:
  - {name: dotWire, signature: "dotWire(x1,y1,x2,y2, ctrl, steps, sizeFn, colorFn)", note: "chain of ellipses along a cubic curve with per-dot size and colour"}
  - {name: lerpPalette, signature: "lerpPalette(colors, t) -> color", note: "smooth colour ramp cycling through a fixed palette (getColor)"}
  - {name: triangleMeshOverlay, signature: "drawTriangleMesh(points, fillAlpha, strokeAlpha)", note: "Delaunay triangulation drawn as faint translucent triangles"}
---

## What it draws
A near-black full-bleed canvas crossed by thick chains of overlapping dots (like beads on
curved strings) that run white-to-black and pass through red and blue, with large white
dots at many endpoints. Behind them, a few large soft translucent red and blue rings and
thin circle outlines, and a very faint white polygonal (Delaunay) mesh visible across the
whole image. Dominant colours: black, red-orange, blue, white.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (key press
regenerates). Flow in `generate()` (candela.pde):

1. Background: one random palette colour (`back = rcol()`, L25); with seed 42 it is black.
2. 100 random points are generated (L37-41); each point is snapped to a 5 px grid for the
   mesh (L43-44).
3. For each consecutive pair of points, `wire()` (L107) is called. It builds a cubic
   Bézier control point (L108-110) and then two loops (L135, L150) step along the curve
   with `curvePoint`, drawing one ellipse per step. Dot size oscillates with
   `pow(cos(i*os), pwr)` mapped into `[minSize*s, maxSize*s]` (L139-140, `maxSize =
   random(20, 90)`, L131), which produces the beaded thick/thin look. Dot colour is
   `getColor(t*colors.length)` (L142, L157): a smooth lerp cycling through the whole 5-colour
   palette along the wire (L184-189). With probability 0.1 per dot a large thin stroked
   circle (`s*20`, L147) or a stroked circle plus a radial-gradient ring via `arc2()`
   (L163-165, alpha 200→0, radius s*16→s*24) is added — these make the big soft red/blue
   rings and hairline circles.
4. Finally all points are Delaunay-triangulated with the triangulate library (L68) and the
   triangles are drawn in one `beginShape(TRIANGLES)` (L72-83) with `fill(255, random(30))`
   per vertex and `stroke(0, 4)` — a barely visible white faceted overlay.

Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` (L28-29): point positions,
max dot size, oscillation phase `os`, per-dot rare-circle events, per-vertex triangle
alpha, and the background colour. No blend modes; the translucent look comes from P2D
alpha fills/strokes only.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| pts_250 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 250; i++) {` | large (mean 0.2595, 0.846) | much denser: ~2.5x the dot chains, rings and white endpoint dots; the black ground almost disappears and the whole canvas is covered | variants/pts_250/frame_00001.png |
| tri_alpha_120 | `fill(255, random(30));` -> `fill(255, random(120));` | moderate (mean 0.094, 0.465) | the Delaunay triangle mesh becomes clearly visible as a bright white faceted overlay across the whole image; picture looks washed out, chains unchanged | variants/tri_alpha_120/frame_00001.png |
| tri_stroke_alpha_60 | `stroke(0, 4);` -> `stroke(0, 60);` | none (mean 0.0057, 0.013) | no visible change per the score; at most a faint thin black triangulation wireframe is just perceptible over the white dots (1px lines affect only ~1% of pixels) | variants/tri_stroke_alpha_60/frame_00001.png |
| wire_steps_10 | `int steps = int(dist(x1, y1, cx, cy)*3);` -> `*10` | large (mean 0.2477, 0.861) | chains stop looking beaded and merge into smooth, thick ribbon-like tubes of colour; endpoint dots read as large solid white circles | variants/wire_steps_10/frame_00001.png |
| maxSize_200 | `float maxSize = random(20, 90);` -> `float maxSize = random(20, 200);` | large (mean 0.2737, 0.803) | dots grow to huge overlapping blobs; the wire/curve structure is mostly lost and the image reads as big soft red/blue/white circles | variants/maxSize_200/frame_00001.png |
| palette_warm | `int colors[] = {#F8F8F9, #FE3B00, #7233A6, #0601FE, #000000};` -> `{#FFFFFF, #FFC930, #F58B3F, #395942, #212129};` | large (mean 0.2436, 0.912) | identical layout (same seed): warm yellow/orange/olive-green palette with a dark greenish ground replaces the white/red/blue/black look | variants/palette_warm/frame_00001.png |

## Modularisation notes
- `wire()` is the core reusable block: a dot chain along a cubic curve with a size
  oscillation function and a colour function as parameters; the rare big-ring event is an
  optional callback.
- `getColor(float)` / `lerpPalette` is a clean, generic palette-ramp helper worth lifting
  as-is.
- The Delaunay overlay is a thin wrapper around the triangulate library; parameterisable
  by fill/stroke alpha and per-vertex jitter.
- One-off art decisions: the 5-colour palette, the 5 px grid snap of mesh points, the
  specific size range `random(20, 90)`, the `random(100) < 0.1` event probability, and the
  double-loop Bézier layout (two halves of the curve with different control points).
- A clean parameter object: `{n_points, dot_size_range, size_oscillation (os, pwr),
  steps_multiplier, palette, tri_fill_alpha, tri_stroke_alpha, ring_event_probability}`.
