---
sketch: 2017/Generativos/subsbusbu
year: 2017
renderer: P2D
size: [720, 720]
libraries: []
deterministic: true
ms_first_frame: 1611
animated: false
techniques: [recursion, subdivision, grid]
primitives: [shape]
palette:
  colors: ["#0217B2", "#FBD2DB", "#FBA1B3", "#F46680", "#F95270", "#F92C52", "#000000", "#0000FF", "#FF0000", "#FFFF00"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: "random(3000)", tried: [500, 8000], change: large, effect: "fewer subdivisions = coarse large facets; more = dense fine triangles"}
  - {name: div, default: 64, tried: [16], change: none, effect: "background lattice is fully covered by the forms, invisible"}
  - {name: "fill alpha (line 83)", default: 80, tried: [200], change: none, effect: "dead code: per-vertex fill (line 87) overwrites it before endShape"}
  - {name: "stroke alpha (line 80)", default: 20, tried: [255], change: subtle, effect: "white edges between triangles become clearly visible"}
reusable_candidates:
  - {name: subdividePolygon, signature: "subdividePolygon(PVector[] poly) -> PVector[][]", note: "quad -> 2 triangles; triangle -> 3 triangles via edge midpoints (c1, c2), vertex-centroid midpoint (cen)"}
  - {name: lerpPalette, signature: "lerpPalette(int[] palette, float index) -> color", note: "smooth colour = lerpColor(palette[i], palette[i+1], frac(index))"}
  - {name: vertexGradientShape, signature: "vertexGradientShape(PVector[] pts, color[] perVertex) -> void", note: "fill() set per vertex inside beginShape; P2D/Java2D renders it as a smooth per-vertex gradient"}
---

## What it draws
A full-bleed mosaic of triangles (and a few quads) of very different sizes, from
large corner-spanning wedges down to tiny slivers, radiating in scale from the
canvas center. Every triangle is filled with a smooth two- or three-tone gradient;
the dominant visible colours are pink, red-orange and yellow, with patches of deep
blue, purple and near-black, giving a faceted, low-poly appearance. A very faint
white line runs along the triangle edges; a diamond lattice underneath is not
visible.

## How the code works
`setup()` (lines 3-8) creates a 720x720 P2D canvas and calls `generate()` once
(`draw()` is empty, lines 10-12, so the piece is static).

`generate()` (lines 24-61):
1. Background is flat blue `#0217B2` (line 25).
2. A background lattice of 65x65 small diamonds (`romb`, lines 30-38, 63-71) is
   drawn with `fill(255, 20)` (line 32). It is completely covered by the forms and
   not visible in the output (confirmed: `div_16` variant = no change).
3. One initial form is created: the inscribed diamond (4 vertices at the four
   compass points of a circle of radius = half the canvas diagonal), centered
   (lines 40-49).
4. `sub = int(random(3000)*random(1))` iterations (line 51): a random form is
   removed and replaced by its `sub()` children (lines 52-56). `sub()`
   (lines 101-176) splits a 4-point form into 2 triangles, or a 3-point form into
   3 triangles built from the edge midpoints (c1, c2), the midpoint of two
   vertices (cen), and the original vertices (lines 152-172). The alternative
   2-way triangle split (line 139, `random(1) < 0.0`) is disabled. This
   replace-one-random-leaf loop is the recursion producing the mixed-scale
   triangulation: early splits make the large wedges, later ones the fine slivers.
5. Every form is drawn by `show()` (lines 79-99) in two passes:
   - Pass 1 (lines 84-90): `beginShape`, then for every vertex
     `fill(getColor(random(colors.length)))` is called *before* `vertex()`. In the
     P2D/Java2D renderer this yields a per-vertex fill, which the renderer
     emulates as a smooth gradient across the triangle — this is the source of the
     gradient look, not a shader or lerp along edges. `stroke(255, 20)` (line 80)
     draws the faint white edge. Note: the `fill(getColor(...), 80)` on line 83 is
     dead — it is overwritten by the per-vertex fills (confirmed: `fill_alpha_200`
     variant = no change).
   - Pass 2 (lines 92-98): the same polygon refilled with `fill(0, random(10))`
     (line 95), a near-transparent black overlay that slightly darkens/unevens
     each facet.

Colour: `getColor(v)` (lines 183-187) takes `v = random(colors.length)`, and
returns `lerpColor(palette[i], palette[i+1], frac(v))` over the 9-entry palette
(line 179: pale pink through reds, black, blue, red, yellow). Each triangle
therefore shows a gradient between 2-3 neighbouring palette colours sampled
randomly per vertex.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_500 | `int sub = int(random(3000)*random(1));` -> `int sub = int(random(500)*random(1));` | large | coarse: only a handful of large gradient facets, most of the fine slivers gone | variants/sub_500/frame_00001.png |
| sub_8000 | `int sub = int(random(3000)*random(1));` -> `int sub = int(random(8000)*random(1));` | large | dense: many more, much smaller triangles; busier, more white edge lines, same palette/gradient look | variants/sub_8000/frame_00001.png |
| div_16 | `int div = 64;` -> `int div = 16;` | none | no visible change; the diamond lattice is fully covered by the forms | variants/div_16/frame_00001.png |
| fill_alpha_200 | `fill(getColor(random(colors.length)), 80);` -> `fill(getColor(random(colors.length)), 200);` | none | no visible change; that fill is dead code (overwritten by the per-vertex fills in the loop) | variants/fill_alpha_200/frame_00001.png |
| stroke_alpha_255 | `stroke(255, 20);` -> `stroke(255, 255);` | subtle | white triangle edges now clearly visible across the mosaic, giving a faceted "wired" outline | variants/stroke_alpha_255/frame_00001.png |

## Modularisation notes
Generic / library-worthy:
- `Form.sub()` (lines 101-176): pure geometry — quad -> 2 triangles, triangle -> 3
  triangles via edge midpoints + centroid midpoint. A reusable
  `subdividePolygon(poly) -> List<poly>` with a 2-way/3-way strategy covers both
  cases (the disabled 2-way branch, line 139, shows the author intended a toggle).
- `getColor` / palette lerp (lines 179-187): generic smooth-palette sampler
  `lerpPalette(palette, index) -> color`.
- The "pick a random leaf, replace with its children, N times" driver
  (lines 52-56): a generic random-walk subdivision scheduler; the count and the
  leaf-picker are the only knobs.
- Per-vertex gradient fill (lines 84-90): `vertexGradientShape(pts, colors[])` —
  the visual signature of this sketch, and a P2D-specific trick (per-vertex fill
  inside beginShape) worth encapsulating.

One-off art decisions: the 45-degree initial diamond sized to the canvas diagonal
(lines 41-49), the invisible white diamond lattice background (lines 30-38), the
specific 9-colour palette, the double-pass fill with the dead alpha-80 line and
the near-transparent black overlay (lines 92-98).

A clean parameter object: `{ canvasSize, initialShape, subdivisionCount,
triangleSplit: "3way" | "2way", palette, overlayAlpha, strokeAlpha,
latticeDivisions (cosmetic, hidden under forms) }`.
