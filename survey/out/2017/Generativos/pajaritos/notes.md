---
sketch: 2017/Generativos/pajaritos
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1561
animated: false
techniques: [subdivision]
primitives: [shape]
palette:
  colors: ["#f2f2e8", "#ffe41c", "#ef3434", "#ed0076", "#3f9afc"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: iterations, default: 1000, tried: [300], change: large, effect: "fewer splits = fewer, larger quads; sliver tangle thins out"}
  - {name: edgeT, default: "0.1-0.9", tried: ["0.4-0.6"], change: large, effect: "narrowing the split range = more uniform, balanced tiling"}
  - {name: underAlpha, default: 16, tried: [80], change: none, effect: "no visible change; underlay pass is covered by the opaque fill pass"}
  - {name: strokeAlpha, default: 220, tried: [100], change: subtle, effect: "seams/strokes slightly thinner"}
  - {name: displaceScale, default: 0.1, tried: [1.0], change: none, effect: "no visible change; displacement only affects the hidden underlay pass"}
reusable_candidates:
  - {name: randomQuadSubdivide, signature: "randomQuadSubdivide(quad, iterations) -> List<Quad>", note: "repeatedly split a random quad in two with a random interior chord until N pieces tile the canvas"}
  - {name: formShow, signature: "formShow(quad, palette, strokeColor, strokeAlpha) -> void", note: "fill a quad with a lerp-between-palette colour (one vertex 8% darker) and a dark stroke"}
---

## What it draws
Full-bleed mosaic of flat quadrilaterals tiling the 960x960 canvas. The left half is a dense
tangle of thin slivers and small triangles; the right half is dominated by a few large flat
quads. Colours are saturated magenta-red, blue, yellow and orange, with cream and purple
patches. Every shape is outlined with a thin near-black stroke, and each shape has one slightly
darker corner.

## How the code works
- `setup()` (lines 3-8): P2D 960x960, `smooth(8)`, `pixelDensity(2)` (unavailable on the headless
  display, see stderr), calls `generate()` once; `draw()` is empty so the image is static.
- `generate()` (lines 18-42): background = one random palette colour; re-rolls and seeds the RNG
  (lines 21-22). The whole canvas starts as one 4-vertex `Form` (lines 24-31). A 1000-iteration
  loop (line 33) picks a form uniformly at random and calls `sub()` on it, so after 1000 splits
  there are 1001 quads that exactly tile the canvas.
- `Form.sub()` (lines 101-135): with 50% probability (line 104) picks points on the top and
  bottom edges, otherwise on the left and right edges; each point is a lerp along the edge with a
  random t in (0.1, 0.9) (lines 106-122). The quad is split into two quads sharing the chord;
  the first child is returned and the original form is mutated into the second child.
- `Form.show()` (lines 71-99): picks one random vertex index `sel` (line 73). Pass 1: no stroke,
  fill black alpha 16 (line 75), draws the quad with the `sel` vertex pushed away from the
  centroid by a small random amount `dd = random(s)*random(0.1)*random(1)` (line 82). Pass 2:
  stroke black alpha 220 (line 91), fill = `getColor(random(5))` which lerps between two adjacent
  palette colours (lines 161-167); the `sel` vertex is filled 8% darker (line 96), producing the
  shaded corner on each shape. Experiments (under_80, dd_1.0 both scoring "none") show pass 1 is
  effectively invisible: the opaque pass-2 fill covers it, so the visible seams are just the
  pass-2 strokes.
- Palette (line 156): cream #f2f2e8, yellow #ffe41c, red #ef3434, magenta #ed0076, blue #3f9afc.
  `linesIntersection` (lines 138-153) and `shuffleArray` (lines 169-176) are defined but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| iter_300 | `for (int i = 0; i < 1000; i++) {` -> `... i < 300; ...` | large | fewer, larger quads; the dense sliver tangle thins out and large flat quads dominate | variants/iter_300/frame_00001.png |
| split_0.4_0.6 | `random(0.1, 0.9)` -> `random(0.4, 0.6)` (8 occurrences) | large | balanced splits; tiling is more uniform and rectilinear with far fewer extreme slivers | variants/split_0.4_0.6/frame_00001.png |
| under_80 | `fill(0, 16);` -> `fill(0, 80);` | none | no visible change; the black underlay is covered by the opaque fill drawn after it | variants/under_80/frame_00001.png |
| stroke_100 | `stroke(0, 220);` -> `stroke(0, 100);` | subtle | seams/strokes slightly thinner (8% of pixels, all at shape edges) | variants/stroke_100/frame_00001.png |
| dd_1.0 | `random(s)*random(0.1)*random(1)` -> `random(s)*random(1.0)*random(1)` | none | no visible change; vertex displacement only applies to the hidden underlay pass | variants/dd_1.0/frame_00001.png |

## Modularisation notes
- Generic: the random quad subdivision loop + `sub()` is a reusable "stochastic quad tiling"
  primitive (parameters: iterations, edge sample range, split-orientation probability). The
  iteration count and edge-t range are the two parameters with large visual effect.
- Generic: `getColor` lerp-between-adjacent-palette sampling.
- One-off / dead art decisions: the black underlay pass with a displaced vertex is invisible in
  the output (both of its numeric parameters scored "none") — a library port can drop it. The
  darker `sel` corner, the fixed 5-colour palette, and the black strokes are the visible
  stylistic choices.
- A clean parameter object: `{iterations, edgeTMin, edgeTMax, orientBias, strokeColor, strokeAlpha,
  palette, backgroundMode}`.
