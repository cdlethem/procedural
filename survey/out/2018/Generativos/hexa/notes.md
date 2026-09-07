---
sketch: 2018/Generativos/hexa
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1530
animated: false
techniques: [grid, polar, symmetry]
primitives: [shape]
palette:
  colors: ["#1E211C", "#4100DB", "#EFC6D0", "#FFA305", "#FF2D2D", "#E56299"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ss, default: "random(60,320)", tried: [60, 320], change: large, effect: "min = dense fine honeycomb of many small cells; max = few giant sparse hexagons with dark ground showing between cells"}
  - {name: dy, default: "sqrt(3)*ss/4", tried: ["sqrt(3)*ss/2"], change: large, effect: "double row spacing: hexagon rows separated by dark zig-zag gaps"}
  - {name: mm, default: 120, tried: [255], change: moderate, effect: "fan triangles fully opaque: much stronger, darker faceted pyramid shading"}
  - {name: colors, default: "5 warm tones (blue/orange/red/pink/pale)", tried: ["5 cool tones (navy/periwinkle/cyan/dark-teal/white)"], change: large, effect: "identical structure, cool blue/cyan/white cast instead of warm orange/red/pink"}
reusable_candidates:
  - {name: hexTile, signature: "hexTile(x, y, s) -> shape", note: "regular hexagon centered at (x,y) via 6 polar vertices"}
  - {name: concentricHexes, signature: "concentricHexes(x, y, s, n, shrink) -> void", note: "n nested hexagons, each scaled by a random factor < shrink, random fill per layer"}
  - {name: hexTriFan, signature: "hexTriFan(x, y, s, maxAlpha) -> void", note: "6 translucent triangles from center to hex edges, alpha random per triangle"}
---

## What it draws
A full-bleed honeycomb of hexagon cells on a dark grey-green ground. Each cell holds a
stack of concentric, randomly sized hexagons in saturated blue, orange, red, pink and pale
pink, most with a small hexagon offset to the upper-left behind it. Over every cell lies a
six-pointed fan of translucent dark triangles (random alpha), which gives each cell a
soft, faceted pyramid shading. The overall effect is a flat, jewel-toned quilt with
per-cell depth.

## How the code works
`setup()` (hexa.pde:1-8) creates a 960x960 P2D window and calls `generate()` once;
`draw()` (10-12) does nothing, so the piece is static (regeneration only on key press).
`generate()` (24-61): fills the background `#1E211C` (25), translates to center (26),
then picks a random cell size `ss` in [60, 320] (31). Cell pitch is `dx = 1.5*ss`
horizontally (33) and `dy = sqrt(3)*ss/4` per row (34); the double loop (38-60) walks a
pointy-top hex grid with odd rows shifted by `dx/2` (40).
Per cell three things are drawn, all with `noStroke()`:
1. an offset layer at `(x-dx/2, y-dy)`: 100 nested hexagons starting at `ss*random(0.6)`
   (45-50), each scaled by `random(random(0.95,1))` — a random fill from the 5-colour
   `colors[]` list (115-118) per layer; this produces the small hexagon peeking out of
   the upper-left corner of each cell.
2. a centered layer: 100 nested hexagons starting at full `ss` (52-57), same shrink rule,
   same random fill — the main concentric target pattern.
3. `hexTri()` (133-150): six triangles from the cell center to consecutive hex corners,
   each filled with black at a random alpha up to `mm = 120` — the translucent shading fan.
`hex()` (121-131) draws a hexagon from six polar vertices. The `pico()` and `Tri`
classes (63-113) are defined but never used in `generate()` (dead code).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_60 | `  float ss = random(60, 320);` -> `  float ss = random(60, 60);` | large (0.2735, 0.874) | very fine dense honeycomb; many small cells, same jewel tones | variants/ss_60/frame_00001.png |
| ss_320 | `  float ss = random(60, 320);` -> `  float ss = random(320, 320);` | large (0.2654, 0.857) | only a few giant hexagons; dark ground clearly visible between cells | variants/ss_320/frame_00001.png |
| dy_x2 | `  float dy = (sqrt(3)*ss)/4;` -> `  float dy = (sqrt(3)*ss)/2;` | large (0.2736, 0.796) | rows of hexagons separated by dark zig-zag bands; cells no longer tessellate vertically | variants/dy_x2/frame_00001.png |
| mm_255 | `    float mm = 120;` -> `    float mm = 255;` | moderate (0.1278, 0.558) | fan triangles fully opaque; some faces nearly black, stronger 3D pyramid shading, outer hexagon rings less visible | variants/mm_255/frame_00001.png |
| palette_cool | `int colors[] = {#4100DB, #EFC6D0, #FFA305, #FF2D2D, #E56299};` -> `int colors[] = {#000080, #8080FF, #00FFFF, #004040, #FFFFFF};` | large (0.3128, 0.881) | same structure and density; navy/periwinkle/cyan/dark-teal/white cast, dark green ground still visible | variants/palette_cool/frame_00001.png |

## Modularisation notes
- Generic: `hex()` (polar hexagon), the nested-hexagon shrink loop (concentric layer),
  `hexTri()` (alpha fan), and the offset-hex-grid walk. All could be library functions
  with the signatures above; the grid walk needs (cellSize, cols, rows, rowShift).
- One-off art decisions: the 5-colour palette, the dark `#1E211C` ground, the 100-layer
  count, the `random(random(0.95,1))` double-random shrink, the second layer's
  `(x-dx/2, y-dy)` offset, and the alpha cap `mm = 120`.
- Clean parameter object: {cellSize, gridW, gridH, layers, shrinkMax, offsetLayer: bool,
  fanAlphaMax, palette, background}.
