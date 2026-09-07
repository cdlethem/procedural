---
sketch: 2014/Generativos/polys
year: 2014
renderer: JAVA2D
size: [800, 600]
libraries: []
deterministic: true
ms_first_frame: 189
animated: true
techniques: [noise-field, lines-hatching, grid]
primitives: [shape, ellipse, line]
palette:
  colors: ["#EBF5D8", "#B5D0BE", "#66BAA7", "#012632", "#DA3754"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: shape-count, default: 80, tried: [30], change: moderate, effect: "fewer shapes, more negative space; larger shapes read clearly"}
  - {name: dim-range, default: [20, 200], tried: [[60, 260]], change: moderate, effect: "all shapes larger, canvas denser, halos and thick outlines dominate"}
  - {name: sides-range, default: [3, 6], tried: [6], change: moderate, effect: "every polygon becomes a hexagon; density unchanged"}
  - {name: strokeWeight-factor, default: 0.05, tried: [0.15], change: moderate, effect: "3x stroke factor, noticeably chunkier outlines on same shapes"}
  - {name: drift-rate, default: 0.02, tried: [0.2], change: none, effect: "no visible change at frame 1: drift term is frame*random(...) and frame==0 in the first draw"}
reusable_candidates:
  - {name: regularPolygon, signature: "poly(x, y, dim, sides, angle)", note: "closed regular n-gon, size = diameter"}
  - {name: hatchBackground, signature: "hatch(offset, spacing, color)", note: "full-canvas diagonal line hatch, offset animated by frame"}
---

## What it draws
A dark navy field (#012632) with a faint diagonal hatching that slides slowly. Over it, about eighty
scattered shapes in a five-colour palette: pink/red, teal, cream and pale-green outlined polygons
(triangles, quads, pentagons, hexagons) of varying sizes and stroke weights, solid circles (some with
a soft semi-transparent halo of the same colour), and a few thick diagonal X-crosses. Shapes overlap
frequently and the whole composition fills the canvas edge to edge.

## How the code works
`setup()` calls `generar()`; `draw()` calls `randomSeed(seed)` + `generar()` every frame, so each
frame is a fresh deterministic re-roll. `generar()` (polys.pde:30-66):
1. Background: `rcol()` picks a random palette colour (here navy) and a slightly lighter copy is
   used as stroke for a diagonal hatch of lines spaced 20 px, offset by `-(frameCount%20)` each
   frame — that produces the slowly sliding hatch (lines 31-36).
2. Main loop (lines 38-65): 80 iterations. Position = `random(±w/2) + noise(...)*w` — uniform random
   jittered by a per-index 1-D noise value whose time term is `frame*random(0.02)`, so shapes drift
   as frames advance. Size `dim = random(20,200)`, sides `cant = random(3,6)`, angle random.
3. Shape type: `r = int(random(3))` — 0 → outlined regular polygon via `poly()` (lines 68-76,
   `beginShape`/`vertex` at radius `dim/2`), 1 → circle: a `dim`-sized ellipse filled at alpha 50
   (the halo) plus a solid `dim*0.8` ellipse on top; 50% of circles get two thick `SQUARE`-cap
   diagonal lines forming an X. Stroke weight is `max(dim*random(0.05), 1)` — bigger shapes get
   thicker strokes.
4. Colour: every shape and the background draw from `rcol()` (lines 83-85), a uniform pick from the
   5-colour `paleta` array. No lerp, no noise-driven colour.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_30 | `for(int i = 0; i < 80; i++){` -> `for(int i = 0; i < 30; i++){` | moderate | much sparser: ~30 large scattered shapes, lots of plain hatched background showing through | variants/count_30/frame_00001.png |
| dim_60_260 | `float dim = random(20, 200);` -> `float dim = random(60, 260);` | moderate | all shapes larger, canvas much denser; big halo circles and heavy outlines dominate | variants/dim_60_260/frame_00001.png |
| sides_6 | `int cant = int(random(3,6));` -> `int cant = 6;` | moderate | every polygon is a hexagon (no triangles/quads/pentagons); same density and palette | variants/sides_6/frame_00001.png |
| stroke_0.15 | `strokeWeight(max(dim*random(0.05), 1));` -> `strokeWeight(max(dim*random(0.15), 1));` | moderate | same shapes with roughly 3x thicker outlines; chunkier, bolder look | variants/stroke_0.15/frame_00001.png |
| drift_0.2 | `float det = frame*random(0.02);` -> `frame*random(0.2)` | none | no visible change: at frame 1 the factor multiplies `frame`, which is still 0, so positions are identical | variants/drift_0.2/frame_00001.png |

## Modularisation notes
- Generic: `poly(x, y, dim, sides, angle)` (regular polygon from diameter), the hatch background
  (offset + spacing + colour), and the halo-circle pair (semi-transparent large ellipse + solid
  smaller one) are all self-contained and reusable.
- One-off art decisions: the 5-colour palette, the `random(3)` type roll with its 50% X-cross
  chance, the `dim*random(0.05)` stroke-weight coupling, and the per-index noise position scheme.
- A clean parameter object: `{count, sizeRange, sidesRange, strokeFactor, driftRate, palette,
  hatchSpacing, bgColor}`.
