---
sketch: 2017/Generativos/fields
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1563
animated: false
techniques: [grid, noise-field, distortion]
primitives: [shape, line, ellipse, rect]
palette:
  colors: ["#DB7654", "#893D60", "#D6241E", "#F2AC2A", "#3D71B7", "#FFEEED", "#85749D", "#21232E", "#5FA25A", "#5D8EB4"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: 0, tried: [4], change: large, effect: "enables quad subdivision: 1 -> 13 overlapping rotated squares of different sizes and grid densities; colours re-rolled (subdivision consumes randoms, shifting the stream)"}
  - {name: det, default: "random(0.01)*random(1) (<=0.01)", tried: ["random(0.05)*random(1)"], change: moderate, effect: "higher noise frequency -> visibly wavier cell boundaries; colour layout unchanged (same random call count)"}
  - {name: cc, default: "random(6,200)/quads.size() (~100 at seed 42, ~19px cells)", tried: ["random(6,100)/quads.size() (~53, ~37px cells)"], change: large, effect: "coarser grid, warp relatively stronger on bigger cells; colours re-rolled by shifted stream"}
  - {name: des, default: "q.z*random(0.2) (<=~384px)", tried: ["q.z*random(0.5) (<=~960px)"], change: large, effect: "2.5x noise displacement -> cells visibly buckle and pinch; colour layout unchanged"}
  - {name: strokeAlpha, default: "random(256)*random(1) (0-255)", tried: [255], change: large, effect: "all corner-to-centre X lines fully opaque -> dense crosshatch web over every cell; colours re-rolled (2 random calls removed per cell)"}
  - {name: rotate, default: "random(TWO_PI) (~15 deg at seed 42)", tried: [0], change: large, effect: "grid axis-aligned instead of tilted; colours re-rolled by shifted stream"}
reusable_candidates:
  - {name: noiseDisplacedGrid, signature: "noiseDisplacedGrid(x, y, w, h, cols, rows, detail, displacement, prob) -> void", note: "grid of quads whose corners are displaced by 2-D noise; each cell carries per-corner-to-centre lines and a centre marker"}
  - {name: lerpPaletteColor, signature: "lerpPaletteColor(palette, v) -> color", note: "sample a float v to lerp between adjacent palette entries (here biased to the next entry via pow(x, 0.01))"}
  - {name: shadedQuad, signature: "shadedQuad(p1, p2, p3, p4, col) -> void", note: "filled quad with 3% per-vertex lightening/darkening for a faceted look"}
---

## What it draws
Full-bleed mosaic of a fine grid (~100x100, cells ~19 px) of coloured quadrilaterals, the whole grid rotated ~15° from the axes. Every cell is a flat colour drawn from a 10-colour palette (warm reds/oranges/yellows, greens, medium blues, off-white, dark navy, muted purple) with no two neighbouring cells coordinated; some cells are near-white and read as just an X-cross. Faint diagonal lines join each cell's four corners to its centre, and many centres carry a tiny dot or short dash. Cell boundaries are gently wavy rather than straight, so the whole grid looks softly warped.

## How the code works
`setup()` (lines 3-8) opens a 960×960 P2D window and calls `generate()` once; `draw()` is inert, so the piece is static.

`generate()` (lines 32-79) reseeds `noiseSeed`/`randomSeed` from a fresh random int, then runs a single outer iteration (`c < 1`):
- a nearly transparent full-canvas rect (fill alpha 4, line 39) is laid down first;
- the matrix is translated to the centre and rotated by `random(TWO_PI)` (lines 41-43), which is why the grid is tilted;
- a quad list starts with one quad of side `width*2` (1920 px) centred on the origin (line 46). The subdivision loop (lines 49-58) would replace random quads with four half-size children, but it is disabled by `sub = 0;` (line 48), so exactly one quad survives;
- 100 ellipses (diameter up to `width*0.1`, lines 60-66) are scattered with random palette colours, but the opaque grid drawn afterwards covers the whole canvas, so they are never visible;
- for each quad, `cc = int(random(6, 200)/quads.size())` (line 71) sets the grid resolution (~100 at seed 42, measured cell width ~19 px), `det = random(0.01)*random(1)` (line 69) a very low noise frequency, and `des = q.z*random(0.2)` (line 73) the displacement amplitude (up to ~384 px); `rects(..., prob=1)` is called (line 74).

`rects()` (lines 81-121) tiles the quad into `c×c` cells. The skip test `if (prob < random(1)) continue;` (line 88) never fires because `prob == 1`. Each corner is displaced by `des()` (lines 26-30): a single noise sample at `noise(pos*det)` is added to both x and y, so cells shift diagonally along a smooth field — with the tiny `det`, neighbouring corners get almost the same offset, which is why the grid stays coherent but wavy. Per cell:
- the cell is drawn as a `beginShape` quad (lines 123-135) filled with `getColor(random(10))`: two adjacent palette entries are lerped with `m = pow(v%1, 0.01)`, which is ≈1 for almost all v, so the fill is effectively the second (next) palette colour; vertex 2 is lightened 3% toward white and vertex 4 darkened 3% toward black, giving each quad a faint facet;
- four `line()` calls (lines 102-105) draw corner-to-centre X's with random alpha 0-255 (`stroke(rcol(), random(256)*random(1))`, line 101) — hence some X's are strong, some nearly invisible;
- a centre marker: 50% a tiny ellipse of 8% cell size (line 109), 50% a small 90°-rotated rect of 10%×8% cell size (line 115), coloured `rcol()` (random palette entry).

Colour is the only fully random element per cell: position is fixed by the (noise-warped) grid, size by `cc`, and every visual decision per cell is an independent random draw.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_4 | `    sub = 0;` -> `    sub = 4;` | large (mean 0.2767, 0.874 of pixels) | multi-scale composition: subdivision produces 13 overlapping rotated squares of different sizes and grid densities (fine small grid top-left, coarse large cells with bold X's and markers); grey background shows in gaps; colours re-rolled (subdivision loop consumes randoms, shifting the stream) | variants/sub_4/frame_00001.png |
| det_0.05 | `    float det = random(0.01)*random(1);` -> `    float det = random(0.05)*random(1);` | moderate (mean 0.1041, 0.334 of pixels) | same colour layout as baseline (random call count unchanged); higher noise frequency gives visibly wavier, more undulating cell boundaries | variants/det_0.05/frame_00001.png |
| cc_100 | `      int cc = int(random(6, 200)/quads.size());` -> `      int cc = int(random(6, 100)/quads.size());` | large (mean 0.2743, 0.873 of pixels) | coarser grid: cells ~37 px vs ~19 px (cc ~53 vs ~100); the noise warp is relatively stronger on the bigger cells; colours and line alphas re-rolled by the shifted stream | variants/cc_100/frame_00001.png |
| des_0.5 | `      float des = q.z*random(0.2);` -> `      float des = q.z*random(0.5);` | large (mean 0.2734, 0.867 of pixels) | colour layout unchanged (same stream); 2.5x noise displacement -> cells visibly buckle and pinch, some compressed into slivers | variants/des_0.5/frame_00001.png |
| strokeAlpha_255 | `      stroke(rcol(), random(256)*random(1));` -> `      stroke(rcol(), 255);` | large (mean 0.2736, 0.87 of pixels) | all corner-to-centre X lines now fully opaque: dense crosshatch web over every cell, much busier; colours re-rolled (removing 2 random calls per cell shifts the stream) | variants/strokeAlpha_255/frame_00001.png |
| rotate_0 | `    rotate(random(TWO_PI));` -> `    rotate(0);` | large (mean 0.2753, 0.869 of pixels) | grid axis-aligned instead of ~15° tilted; colours re-rolled by the shifted stream | variants/rotate_0/frame_00001.png |

Note on scores: every cell colour, line alpha and marker is drawn from one shared random stream, so any edit that changes the number of `random()` calls re-rolls the entire mosaic. `det` and `des` keep the call count, so their scores reflect pure geometric change; for `sub_4`, `cc_100`, `strokeAlpha_255` and `rotate_0` the "large" scores mix the intended effect with a full recolour.

## Modularisation notes
- **Generic, library-ready:** `rects()` is a self-contained "noise-displaced grid of decorated quads" — parameters `cols/rows` (here equal `cc`), `detail`, `displacement`, `prob` (cell drop probability, currently pinned to 1 so it never skips) and the per-cell decoration (X-lines + centre marker) are all separable hooks. `des()` (diagonal noise displacement of a point) and `getColor()` (lerp-palette sampler) are small pure utilities.
- **One-off art decisions:** the fixed 10-colour palette (line 137); the `pow(x, 0.01)` bias in `getColor`; the random rotation in `generate()`; the disabled subdivision block (lines 47-58) and the `c < 1` loop (line 37) — the quad-subdivision machinery (pick random quad, replace with 4 half-size children) looks like an abandoned generative feature; the 100 hidden ellipses (lines 60-66).
- **Parameter object:** `{gridSize: 1920, divisions: cc, noiseDetail: det, displacement: des, cellSkipProb: prob, rotation: θ, palette: int[], markerScale: 0.08, markerSplit: 0.5, lineAlphaRange: [0, 255], subdivisions: sub}`.
