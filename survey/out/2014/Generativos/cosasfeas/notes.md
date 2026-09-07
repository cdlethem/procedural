---
sketch: 2014/Generativos/cosasfeas
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 431
animated: false
techniques: [polar, lines-hatching, dots-stippling, pixel-ops]
primitives: [line, ellipse, pixels]
palette:
  colors: ["#B4B4B4"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: figure_count, default: 20, tried: [5], change: large, effect: "far sparser: 5 rosettes with big empty grey areas"}
  - {name: passes, default: "1-49 (cc)", tried: [4], change: large, effect: "thick parallel ribbons collapse to single thin lines; dots become visible"}
  - {name: radius_range, default: "width*0.15-0.8", tried: ["width*0.05-0.3"], change: large, effect: "small gear-like figures, much more empty background"}
  - {name: stroke_weight, default: "0-10", tried: [2], change: moderate, effect: "thin delicate web of lines instead of bold thick strokes"}
  - {name: vertex_count, default: "3-19 (cant)", tried: [8], change: large, effect: "spiky stars become regular round heptagon/octagon/nonagon rosettes"}
  - {name: background, default: 180, tried: [0], change: large, effect: "same figures on near-black ground; grain no longer visible"}
reusable_candidates:
  - {name: starRing, signature: "starRing(x, y, radius, vertices, skip, color, weight) -> void", note: "star polygon (vertices on a circle, connect i to i+skip) plus dots at each vertex"}
  - {name: randomPalette, signature: "randomPalette(size, steps) -> color[]", note: "walk from a random seed colour by brightening/darkening/hue-shift/complement"}
  - {name: grain, signature: "grain(strength) -> void", note: "per-pixel random darkening of the framebuffer"}
---

## What it draws
Dense full-bleed tangle of 20 overlapping "rosette" figures on a grainy light-grey background.
Each figure is a star polygon (thick lines joining vertices spaced around a circle) with small
dots at the vertices, drawn in a gradient between two colours; repeated slightly-offset copies of
each figure stack into thick parallel ribbons. Dominant colours: red, teal, magenta/purple, blue.

## How the code works
`setup()` (line 3) sizes 600x800 and calls `generar()` (line 16); `draw()` is empty (line 8), so
the piece is static. `generar()`:
- `coloresRand()` (line 64) builds a palette of 3-19 colours: first a fully random RGB, then each
  next one is the previous one darkened ±50, hue-rotated ±50, or complemented (line 68-83).
- `background(180)` (line 18) sets the grey ground.
- 20 calls to `figura1()` (line 19). Each picks two random palette colours (line 26-27), a
  vertex count `cant` 3-19 (line 28), random angle/position (line 29-31), radius `lar` = width x
  0.15-0.8 (line 34), skip `des` 1..cant-1 (line 35), stroke weight 0-10 (line 36), and `cc` 1-49
  passes (line 37). Each pass j is offset by (cos(ang2), sin(ang2)) * j (line 41-42), so the same
  star polygon is stamped up to 49 times along one direction — this is what makes the thick
  multi-line ribbons. Stroke colour lerps col1->col2 across passes (line 40); the star lines
  connect vertex i to vertex i+des (line 45) and small filled ellipses of size `tt` 2-8 sit at
  every vertex (line 50).
- `nnoise()` (line 55) loops over every pixel and darkens it by a random amount bounded by
  brightness/10 (line 59), giving the film-grain texture over the whole image.
All randomness is seeded by the harness (deterministic).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| figures_5 | `for (int i = 0; i < 20; i++) {` -> `i < 5` | large | sparse: 5 rosettes (big teal/red one top-right, magenta star centre, red stars bottom), large empty grey areas; same red/teal/magenta/blue palette | variants/figures_5/frame_00001.png |
| cc_4 | `int cc = int(random(1, 50));` -> `random(1, 4)` | large | thick stacked ribbons gone: each figure is a single thin star polygon, vertex dots now clearly visible; still dense overall | variants/cc_4/frame_00001.png |
| lar_0.3 | `width * random(0.15, 0.8)` -> `width * random(0.05, 0.3)` | large | small gear/flower-like rosettes scattered with mostly empty background | variants/lar_0.3/frame_00001.png |
| weight_2 | `strokeWeight(random(10));` -> `random(2)` | moderate | lines uniformly thin; the tangle reads as a fine web, dots stand out; bold flat strokes gone | variants/weight_2/frame_00001.png |
| cant_8 | `int cant = int(random(3, 20));` -> `random(7, 9)` | large | figures become regular round 7/8/9-gon rosettes instead of spiky stars; thick ribbons and density unchanged | variants/cant_8/frame_00001.png |
| bg_0 | `background(180);` -> `background(0);` | large | identical composition on near-black ground; the per-pixel grain (which only darkens) is no longer visible | variants/bg_0/frame_00001.png |

## Modularisation notes
- `starRing` (figura1 inner loops, lines 44-51): generic star polygon + vertex dots; parameters
  x, y, radius, vertices, skip, colour, weight.
- `randomPalette` (coloresRand, lines 64-84): generic palette walker; parameter: step operation
  weights (darken/hue/complement).
- `grain` (nnoise, lines 55-62): generic post-effect; parameter: strength. O(n*pixels), slow at
  high res — could be replaced by a pre-rendered noise tile.
- Art decisions to keep in the sketch: 20 figures, radius range 0.15-0.8*width, pass count up to
  49, per-pass offset direction, background grey 180.
