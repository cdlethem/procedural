---
sketch: 2018/Generativos/tablab
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1550
animated: false
techniques: [noise-field, lines-hatching, grid]
primitives: [line, ellipse]
palette:
  colors: ["#0F101E", "#11142B", "#28398B", "#323E78", "#4254A3", "#FCEE6B"]
  selection: noise-driven
composition: full-bleed
reusable_candidates:
  - {name: hatchTriangle, signature: "hatchTriangle(a, b, c, lineCount, colorFn) -> void", note: "fills a triangle with parallel lines lerp'd between two edges, colour sampled per line"}
  - {name: noiseGridSnappedPoints, signature: "gridSnappedPoints(cellSize, n, reachNoise, detail) -> Point[]", note: "random points snapped to a grid with noise-limited reach"}
parameters:
  - {name: cc, default: "random(6,8)*10 (60 or 70)", tried: [140], change: large, effect: "sparser, more fragmented: individual triangle hatch fans become visible as separate starbursts, lighter blue ground"}
  - {name: det, default: "random(0.002,0.004)*3 (0.006-0.012)", tried: [0.03], change: large, effect: "finer, busier small-scale hatching; the large soft streaks break into many thin chaotic fans"}
  - {name: dis multiplier, default: 24, tried: [4], change: moderate, effect: "tighter, smaller starburst clusters; much more dark background shows between them"}
  - {name: alpha, default: 80, tried: [200], change: subtle, effect: "subtle: same composition, overlapping regions slightly denser/darker"}
  - {name: triangle count, default: "cc*40 (2400-2800)", tried: ["cc*10 (600-700)"], change: moderate, effect: "much sparser: large dark areas, one dominant yellow mass"}
---
## What it draws
A full-bleed dark navy canvas covered in dense feathery hatching: bundles of very thin pale-yellow
cream lines running in short parallel groups form soft cloud-like streaks across the whole image,
interspersed with mid-indigo and near-black blue patches. A few sharp, long, darker straight streaks
cut diagonally through the mass. The texture is fine and uniform at every scale — no focal point.

## How the code works
`setup()` (L3-8) sizes 960x960 P2D and calls `generate()` once; `draw()` (L10-12) is empty, so the
image is static (regeneration only on key press, L14-20).

`generate()` (L22-82):
- `background(rcol())` (L26) picks a random background from the 6-colour palette (L105); with seed 42
  it lands on a dark blue, giving the navy ground.
- `cc = int(random(6,8)*10)` (L28) → 60 or 70; `ss = width/cc` (L29) is the grid cell (~14-16 px).
- A dot grid (L31-37): at every grid intersection a small filled ellipse `ss*0.2` wide with
  near-invisible stroke `stroke(0,10)`; the fill is a random palette colour. Barely visible in the
  render — mostly hidden under the hatching.
- Main loop (L44-81): `cc*40` (2400-2800) triangles. Each starts from a grid-snapped anchor
  `(x1,y1)` (L45-48: `x1 -= x1%ss`). Reach is noise-driven:
  `dis = ss * int(1 + pow(noise(des + x1*det, des + y1*det), 1.3) * 24)` (L50) with
  `det = random(0.002,0.004)*3` (L40) — 1 to 25 cells. Two further grid-snapped points are chosen
  within `dis` (L52-59).
- Each triangle is hatched three times (L71-73): `tl()` (L87-98) takes one vertex and draws
  `min(edgeLen) * random(0.18, 0.3)` parallel lines (L88), each line lerp'd between the two edges
  meeting at that vertex (L90-94). So each triangle gets 3 hatch fans = a dense mesh of fine
  parallel-line bundles; the feathery streaks in the image are these overlapping fans.
- Line colour: `stroke(getColor(noise(desc + nx*detc, desc + ny*detc) * 2), 80)` (L95) — 2-D noise
  at `detc = 0.01` (L42) indexed through `getColor(v)` (L113-119), which lerps between adjacent
  palette entries. This is what paints the pale-yellow vs indigo patches, at alpha 80 so overlaps
  accumulate into the soft saturated streaks.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_140 | `int cc = int(random(6, 8)*10);` -> `int cc = 140;` | large | sparser and more fragmented: individual triangular hatch fans read as separate starbursts on a lighter blue ground, with the dot grid clearly visible | variants/cc_140/frame_00001.png |
| det_0.03 | `float det = random(0.002, 0.004)*3;` -> `float det = 0.03;` | large | finer, busier texture: many small chaotic fans, yellow spread in finer detail, large soft streaks mostly gone | variants/det_0.03/frame_00001.png |
| dis_4 | `...pow(noise(des+x1*det, des+y1*det), 1.3)*24);` -> `...*4);` | moderate | small tight starburst clusters of yellow on a much darker ground; triangles shrank so more background shows | variants/dis_4/frame_00001.png |
| alpha_200 | `stroke(getColor(...), 80);` -> `stroke(getColor(...), 200);` | subtle | no visible change: same composition and streaks, overlapping regions only slightly denser | variants/alpha_200/frame_00001.png |
| count_10 | `for (int i = 0; i < cc*40; i++) {` -> `for (int i = 0; i < cc*10; i++) {` | moderate | much sparser: left half almost empty dark hatching, one big bright yellow mass top-right | variants/count_10/frame_00001.png |

## Modularisation notes
- Generic: `tl()` hatch-fan fill is a clean library primitive (triangle + line count + colour
  function). Grid-snapping helper (`v -= v%cell`) and the noise-indexed palette lerp `getColor(v)`
  are also reusable as-is.
- One-off art decisions: the `random(0.18,0.3)` line-count coefficient, `pow(noise,1.3)*24` reach
  shaping, alpha 80, the specific 6-colour palette, and the 3-fan-per-triangle composition.
- Clean parameter object: `{cellSize, triangleCount, reachCells, noiseDetail, colorNoiseDetail,
  lineDensity, lineAlpha, palette}` — everything else in the sketch is wiring.
