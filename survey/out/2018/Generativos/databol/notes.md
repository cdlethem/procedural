---
sketch: 2018/Generativos/databol
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1661
animated: false
techniques: [noise-field, grid, polar, curves, dots-stippling]
primitives: [ellipse, rect, shape]
palette:
  colors: ["#011731", "#A12677", "#EE3C7A", "#EE2D30", "#EC4532", "#FFCA2A", "#3DB98A", "#16A5DF"]
  selection: random-from-list
composition: radial
parameters:
  - {name: cd, default: "random(60,110)", tried: [20], change: large, effect: "coarser 1px dot lattice and bigger faint halo discs; central cluster unchanged but relatively smaller"}
  - {name: c, default: "random(1,40)", tried: [3], change: moderate, effect: "only 3 splines: sparse dot-chains along 3 visible closed loops over an open yellow field instead of a dense central blob"}
  - {name: ss, default: "random(0.1,0.3)*width", tried: ["0.5*width"], change: large, effect: "spline radius doubled: stamps fill the whole canvas, yellow background almost completely covered"}
  - {name: cc, default: "random(3,20)", tried: [8], change: large, effect: "fewer spline control points: looser, sparser cluster with more gaps showing the background dot grid"}
  - {name: dotAlpha, default: 250, tried: [120], change: none, effect: "no visible change: alpha-250 ellipses are only ~dd*0.6 (~9px) dots, too small for the halved alpha to register"}
  - {name: colors, default: "8 warm colors", tried: ["8 blues"], change: large, effect: "identical composition in a blue monochrome palette with a pale-blue background"}
reusable_candidates:
  - {name: splineLoop, signature: "splineLoop(cx, cy, radius, nPoints, jitter) -> PVector[]", note: "closed Catmull-Rom spline around center from jittered polar points"}
  - {name: splineTiles, signature: "splineTiles(points, tileRange) -> void", note: "stamp rotated rounded rects along a spline path using tangent direction"}
  - {name: noiseDotGrid, signature: "noiseDotGrid(cellCount, detail, alpha) -> void", note: "grid of ellipses gated by 2-D noise, size mapped from noise amplitude"}
---

## What it draws
A full-bleed yellow field covered in a faint grid of tiny multicolored dots. A dense, roughly circular cluster sits in the center: dozens of overlapping rounded squares, circles and squashed shapes in red, pink, magenta, cyan, teal, dark navy and yellow, densest toward the middle and thinning to the edges. Thin closed loops (spline outlines) and short rows of small colored squares are scattered around the periphery and corners.

## How the code works
`setup()` calls `generate()` once (databol.pde:8); `draw()` is empty, so the piece is static. `rcol()` (259-261) picks a random color from the 8-entry `colors[]` list (256); every color in the image comes from that list.

1. **Background** (23): filled with a random palette color (yellow `#FFCA2A` for seed 42).
2. **Noise dot grid** (25-50): a `cd`-by-`cd` grid (cd ~60-110, cell `dd = width/cd`). At each grid point, 2-D `noise()` with detail 1 and scale `det=0.01` (36); cells where amp > 0.1 get a large faint ellipse (`fill(col, 8)`, 40-41) plus a smaller solid ellipse whose size is mapped from the noise amplitude (38, 42-43) — the soft yellow patches around the cluster. Every cell also gets two 1px rects at very low alpha (45-48): the faint dot lattice visible across the whole canvas.
3. **Scatter dots** (52-65): up to 40 grid-aligned circles, most faint (`fill(col, 10)` with `stroke(col, 30)`) with a tiny solid center dot — the small rings/dots around the edges.
4. **Spline blobs** (67-158): up to 40 iterations, each building a closed Catmull-Rom spline (local `Spline` class, 179-249) from `cc` (~3-20) points placed at random angles and `atan`-biased radii around the canvas center (70-83), radius `ss` ~10-30% of width (74). It draws the loop twice (dark 86-94, then a random color 95-103), then walks the spline by arc length stamping rotated rounded rects tangent to the path (105-145) — these stamps are the dominant rounded-square tiles in the central cluster. Also two rows of small rounded rects at random positions (147-157) — the little square "barcodes".
5. **Ghost rectangles** (160-176): 100 half-transparent 45°-rotated thin tall rects with random vertex colors — the faint diagonal streaks barely visible over the yellow.

Randomness enters through the harness-set `seed` field (1, 17) and unseeded `random()` calls for all positions/sizes/colors; the piece is deterministic under a fixed seed (confirmed by result.json).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cd_20 | `int cd = int(random(60, 110));` -> `int cd = 20;` | large | coarser 1px dot lattice, large faint circular halo discs visible across the canvas; central cluster same but relatively smaller | variants/cd_20/frame_00001.png |
| c_3 | `int c = int(random(1, 40));` -> `int c = 3;` | moderate | 3 splines: sparse chains of dots/rounded squares tracing 3 visible closed loops over open yellow; the dense blob is gone | variants/c_3/frame_00001.png |
| ss_0.5 | `ss = width*random(0.1, 0.3);` -> `ss = width*0.5;` | large | stamps spread across the full canvas; yellow background almost entirely covered by overlapping tiles | variants/ss_0.5/frame_00001.png |
| cc_8 | `cc = int(random(3, 20));` -> `cc = 8;` | large | looser, sparser central cluster; more gaps let the background dot grid show through; rounded squares read individually | variants/cc_8/frame_00001.png |
| dotAlpha_120 | `fill(col, 250);` -> `fill(col, 120);` | none | no visible change (dots are ~9px; halved alpha not perceptible) | variants/dotAlpha_120/frame_00001.png |
| palette_blues | `int colors[] = {#011731, ... #16A5DF};` -> 8 blues | large | same composition, entirely blue/white palette, pale-blue background | variants/palette_blues/frame_00001.png |

## Modularisation notes
- Generic: the `Spline` class (179-249) is a self-contained closed Catmull-Rom spline with arc-length parameterization (`getPoint`, `getDir`) — a clean library candidate. `noiseDotGrid` (25-50) is a standard noise-gated grid. The stamp-along-spline loop (105-145) is generic once the spline exists.
- Art decisions: the fixed 8-color palette (256), the double loop draw (dark + colored), the `atan` radius bias (81), the 45° ghost rects (160-176), and the "data" square-barcode rows (147-157).
- Parameter object: `{cellCount (cd), noiseDetail (det), dotAlpha, scatterCount (cdc), splineCount (c), splineRadiusFrac (ss), splinePoints (cc), stampSizeFrac (maxs), palette[]}`.
- Experiments confirmed `c`, `ss`, `cc` are the composition-controlling parameters (large effects); the small-dot alpha in the grid (42-43) is visually inert at this dot size.
