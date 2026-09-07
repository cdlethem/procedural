---
sketch: 2018/Generativos/piso2
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1581
animated: false
techniques: [grid, symmetry]
primitives: [ellipse, rect, arc, shape]
palette:
  colors: ["#001800", "#F6F5FD", "#00D0FE", "#FF5400", "#007B00"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(6, 20)", tried: [8], change: large, effect: "fewer, much larger cells and motifs; whole grid coarser"}
  - {name: arcSweep, default: "PI*1.5 (270 deg)", tried: ["PI*0.5 (90 deg)"], change: moderate, effect: "arc cells become small 90-deg wedges instead of 270-deg pac-man rings; cells read thinner"}
  - {name: blobSize, default: "random(0.1, 0.5)*width", tried: ["random(0.3, 0.6)*width"], change: moderate, effect: "big translucent circles cover more of the canvas; dark diagonal band wider, less orange ground"}
  - {name: palette.orange, default: "#FF5400", tried: ["#1040C0"], change: moderate, effect: "same composition, orange replaced by blue everywhere incl. background; cooler look"}
  - {name: ringAmp, default: "random(0.3, 0.8)", tried: ["random(0.8, 1.0)"], change: none, effect: "no visible change (small rings are mostly covered by later layers)"}
  - {name: gridInsetMid, default: "ss*0.5", tried: ["ss*0.75"], change: subtle, effect: "subtle: middle nested-square outline slightly larger in each cell"}
reusable_candidates:
  - {name: tiledMotif, signature: "tiledMotif(x, y, fn) -> void", note: "draw a motif at (x,y) and its 8 neighbours offset by +/-width/+/-height for seamless wrap tiling"}
  - {name: concentricArcCell, signature: "concentricArcCell(x, y, s, sweep, rot, colors[]) -> void", note: "nested filled arcs (pac-man) with shared rotation and random colours per layer"}
  - {name: nestedSquares, signature: "nestedSquares(cx, cy, size, scales[], colorFn) -> void", note: "concentric centred-rect outlines at fixed scale steps"}
---

## What it draws
A dense full-bleed mosaic in five colours (near-black green, off-white, cyan, orange, green) on an
orange ground. The canvas is a cc-by-cc grid of small cells, each carrying a different little motif:
open diamond outlines, concentric square outlines, small ring-and-dot pairs, and pac-man-shaped
filled arcs (a 270-degree wedge with two inner wedges) all rotated by the same random angle.
Over this grid, a few large semi-transparent circles (10-50% of the canvas) sit under the motifs;
with seed 42 two large dark-green ones overlap along the diagonal, reading as a broad dark
diagonal band with a bright orange counter-band.

## How the code works
`setup()` sizes 960x960 P2D and calls `generate()` once (`draw()` is empty, line 10), so the piece
is static. All randomness is seeded: `randomSeed(seed)` at line 24, seed injected by the harness.
Layer order in `generate()` (piso2.pde):

1. Background: one random palette colour (line 22) - orange here.
2. 10 ring pairs (lines 32-48): random position, size 2-12% of width; each cell draws a stroked
   ellipse plus a filled inner ellipse at `amp = random(0.3, 0.8)` (line 36), and every motif is
   stamped 3x3 at +/-width/+/-height (lines 38-46), the wrap-tiling that lets motifs cross edges.
3. Grid of nested squares (lines 50-61): cc-by-cc centred-rect outlines at scales 1, 0.5, 0.25
   (cc = random 6-20, line 25), each outline a random palette colour - the fine square lattice.
4. 10 big filled circles (lines 63-75): size 10-50% of width, `fill(rcol(), 200)` (line 67) at
   alpha 200, also tiled 3x3 - the large soft blobs; with this seed two dark ones form the
   diagonal band.
5. Arc cells (lines 77-120): one random global rotation `rr` (line 78), per-cell size
   `sss = ss*random(0.1, 1)`, per-cell random quadrant `aa` (line 87); each cell stacks five
   concentric filled arcs of a 270-degree sweep (`a2 = a1+PI*1.5`, line 90) at scales 1, ms,
   ms*amp1 in five random colours - the pac-man wedges.
6. Diamond outlines (lines 122-139): a 4-vertex open rhombus per cell, `ss*0.5` half-diagonal,
   random stroke - the X-lattice on top.

`rcol()` (lines 167-169) picks a uniformly random colour from the 5-entry `colors[]` array;
`getColor()`/lerp variant (170-178) and the `arc2()` helper (142-160) are defined but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_8 | `int cc = int(random(6, 20));` -> `int cc = 8;` | large (mean 0.369, 0.873 of pixels) | much coarser grid: 8x8 of large cells, motifs (squares, diamonds, arcs, rings) scaled up accordingly | variants/cc_8/frame_00001.png |
| arcSweep_0.5 | `float a2 = a1+PI*1.5;` -> `float a2 = a1+PI*0.5;` | moderate (mean 0.0858, 0.215 of pixels) | arc cells shrink from 270-deg pac-man rings to small 90-deg wedges; grid reads thinner and busier | variants/arcSweep_0.5/frame_00001.png |
| bigCircle_0.3_0.6 | `float s = width*random(0.1, 0.5);` -> `float s = width*random(0.3, 0.6);` | moderate (mean 0.0578, 0.18 of pixels) | translucent blobs bigger; the dark diagonal band is wider and covers more area, orange ground reduced | variants/bigCircle_0.3_0.6/frame_00001.png |
| palette_blue | `... #FF5400 ...` -> `... #1040C0 ...` (in colors[]) | moderate (mean 0.138, 0.369 of pixels) | identical composition, all orange areas become blue, background included | variants/palette_blue/frame_00001.png |
| ringAmp_0.8_1.0 | `float amp = random(0.3, 0.8);` -> `float amp = random(0.8, 1.0);` | none (mean 0.0007, 0.002 of pixels) | no visible change | variants/ringAmp_0.8_1.0/frame_00001.png |
| gridInset_0.75 | `rect(..., ss*0.5, ss*0.5);` -> `rect(..., ss*0.75, ss*0.75);` | subtle (mean 0.0189, 0.056 of pixels) | subtle: middle concentric square outline slightly larger per cell | variants/gridInset_0.75/frame_00001.png |

## Modularisation notes
Generic: the 3x3 wrap-tiling loop (stamp a motif plus its 8 edge-neighbours) is reusable for any
motif-drawing closure; the concentric-arc cell (nested arcs, shared sweep/rotation, per-layer
colour callback) and the concentric-square outline stack are both small parameterised primitives.
One-off art decisions: the five-colour palette, the specific layer order (rings -> squares ->
big blobs -> arcs -> diamonds), the 270-degree sweep, alpha-200 blob layer, and the per-cell
random size/colour jitter. A clean parameter object would contain: cellCount (cc), palette,
ringCount/ringSizeRange/ringAmp, blobCount/blobSizeRange/blobAlpha, arcSweep, arcScaleRange,
and a seed.
