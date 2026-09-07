---
sketch: 2018/Generativos/abstracactact
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1699
animated: false
techniques: [grid, lines-hatching]
primitives: [shape]
palette:
  colors: ["#000000", "#D7D7D7", "#FFFFFF", "#155263", "#FF6F3C", "#FF9A3C", "#FFC93C"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: cc, default: "random(7, random(8, 160))", tried: [40], change: large, effect: "capping cell count at 40 gives finer, denser stripe bands with smaller kinks (random stream also shifts)"}
  - {name: k, default: 100, tried: [40], change: large, effect: "fewer walks: big flat solid black/white angular areas appear, stripe coverage thinner"}
  - {name: lar, default: "random(8, random(8, 50))", tried: [90], change: large, effect: "longer walks: longer, more winding bands with very fine high-frequency stripes"}
  - {name: sub, default: "random(1, 50)", tried: [10], change: large, effect: "shorter stamp runs: bands become short wide stripe segments, fewer long interlocking ribbons"}
  - {name: shw, default: 40, tried: [0], change: moderate, effect: "pure black/white fills instead of 40/215 midtones; same structure, crisper contrast, some large solid areas"}
reusable_candidates:
  - {name: walkStripes, signature: "walkStripes(cells, count, walkLen, layers, cellPx) -> void", note: "random-walk polygon offset into N translated copies with alternating black/white fills -> striped bands"}

## What it draws
Full-bleed black-and-white composition of dozens of angular, jagged stripe bands
crossing the canvas at many directions. Each band is a set of parallel
alternating black / off-white stripes that bend and kink where a random walk
changes direction; bands overlap and interlock, so the image reads as a dense
op-art field of zig-zag ribbons with no clear background areas in the center.

## How the code works
- `setup()` (lines 3-8): `size(960,960,P2D)`, `smooth(8)`, then one-shot
  `generate()`; `draw()` (10-11) is empty, so the sketch is static.
- `generate()` (21-81): black background; `cc = int(random(7, random(8,160)))`
  (line 24) sets a grid cell count and `ss = width/cc` the cell size (25).
  The commented-out block (27-36) would have drawn a dot grid.
- Main loop (45-80): 100 times. Each iteration builds a random walk of
  `lar = int(random(8, random(8,50)))` grid points (46, 51-55) starting at a
  random cell `ax,ay` in [-4, cc+4] (48-49), stepping +/-5 cells.
- The walk is then stamped `sub = int(random(1,50))` times (58-79): layer
  `j` is a closed `beginShape()/endShape(CLOSE)` polygon whose vertices are
  the walk points scaled by `ss` and translated by `(dx,dy) * d1` (and a
  second pass offset by `d2`), where `dx,dy` are fixed random per-iteration
  integers in [-5,5] (43-44) and `d1,d2` sweep 0->1 across layers
  (64-65, 70, 76). Consecutive layers therefore tile the band with a constant
  offset, producing the parallel stripes.
- Colour (62-69, 74-75): fill alternates per layer between 0 (black, even `j`)
  and 255-40=215 (off-white, odd `j`); within a shape the even/odd vertex
  parity adds/subtracts `shw=40` (line 59) to fill and sets the stroke to the
  complementary value, so each layer band is a mix of pure black, 40, 215 and
  255 tones. Net visual palette: black + white/off-white only.
- `rcol()`/`getColor()` and `colors[]` (88-100) are never called from
  `generate()` — dead palette code.

## Experiments
| variant | substitution | change score | observation | image |
| cc_40 | `  int cc = int(random(7, random(8, 160)));` -> `  int cc = int(random(7, 40));` | large | finer, denser stripe bands with smaller kinks; whole composition differs (random stream shifts after the changed call) | variants/cc_40/frame_00001.png |
| k_40 | `  for (int k = 0; k < 100; k++) {` -> `... k < 40 ...` | large | fewer walks: large flat solid black/white angular areas, thinner stripe coverage | variants/k_40/frame_00001.png |
| lar_90 | `    int lar = int(random(8, random(8, 50)));` -> `    int lar = int(random(8, 90));` | large | longer, more winding bands; very fine high-frequency stripes with many small kinks | variants/lar_90/frame_00001.png |
| sub_10 | `    int sub = int(random(1, 50));` -> `    int sub = int(random(1, 10));` | large | bands become short wide stripe segments; fewer long interlocking ribbons, more abrupt ends | variants/sub_10/frame_00001.png |
| shw_0 | `    int shw = 40;` -> `    int shw = 0;` | moderate | same structure, pure black/white fills (no 40/215 midtones), crisper contrast | variants/shw_0/frame_00001.png |

## Modularisation notes
- Generic: the walk->stamped-offset-polygon pipeline (lines 45-80) is a
  self-contained "striped ribbon" generator; `walkStripes(cells, count,
  walkLen, layers, cellPx)` above would capture it. The per-layer fill
  alternation (line 62) is the core op-art trick.
- One-off art decisions: the specific black/white 0/215 scheme with `shw`
  midtone jitter, the [-5,5] per-iteration `dx,dy` drift, and the double
  vertex pass (d1/d2) which gives each band a slight shear between its two
  contour loops.
- Clean parameter object: `{cells, shapeCount, walkLenMin, walkLenMax,
  layersMin, layersMax, layerStep, midtone}` — everything else is fixed.
