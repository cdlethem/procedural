---
sketch: 2017/Generativos/circlesAlpha
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 316
animated: false
techniques: [grid, symmetry]
primitives: [ellipse, line]
palette:
  colors: ["#E25300", "#F5D600", "#D5456C", "#7AC0DF"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: c, default: "int(random(80)*random(0.1,1))", tried: ["int(random(80)*random(1))"], change: subtle, effect: "allowed cluster count up to 80; seed 42's redraw landed low, so same 3x3 layout - side/corner clusters turn pale blue-grey, center gains a small core ring"}
  - {name: cc, default: "int(random(5, 10))", tried: ["int(random(12, 16))"], change: moderate, effect: "12-15 tightly spaced rings per cluster instead of 5-9; white ring outlines distinct in every cluster"}
  - {name: fillAlpha, default: 20, tried: [100], change: moderate, effect: "fills 5x more opaque: top/bottom clusters clearly yellow, side clusters solid olive, central overlap a dark-red band"}
  - {name: dw/dh, default: "int(random(2, random(20))) (seed 42: 3)", tried: [10], change: large, effect: "10x10 lattice scatters clusters over 121 points; they overlap into a full-bleed orange wash with a central figure-8, black background almost gone"}
  - {name: maxStroke, default: "random(random(256))", tried: [255], change: subtle, effect: "crisp white concentric ring outlines now visible in all clusters (faint in baseline); no color or density change"}
reusable_candidates:
  - {name: gridPoints, signature: "gridPoints(cols, rows) -> PVector[]", note: "lattice of (cols+1)x(rows+1) points spanning the canvas"}
  - {name: concentricRings, signature: "concentricRings(x, y, size, rings, palette, alpha) -> void", note: "concentric ellipses shrinking toward the center, drawn 4-fold mirrored across the canvas axes"}
---

## What it draws
On a black background, a faint low-contrast white grid (here a 3x3 cell lattice) with clusters of
concentric circles centered on the grid intersections. Each cluster is 5-10 translucent rings in
orange, tan, or pink-red, the largest ring nearly a full cell wide, fading to a small inner circle.
The whole image is symmetric about both center axes; the central cluster (pink-red) is the most
saturated, edge clusters are partly cropped by the canvas.

## How the code works
- `setup()` (circlesAlpha.pde:1) sets a 960x960 JAVA2D canvas and calls `generate()`; `draw()` is
  empty so the sketch is static (regenerates only on a key press, line 11).
- `generate()` (line 21): black background; picks random grid density `dw`, `dh` in ~2..20
  (lines 26-27; seed 42 gives 3x3), builds the point lattice (lines 30-36), and draws faint white
  grid lines with `stroke(255, 40)` (lines 38-46).
- Then `c = int(random(80)*random(0.1, 1))` (line 53) chooses a small number of cluster centers.
  Per cluster (lines 54-69): a random lattice point, a size `s` = one cell * random(1, dw) or
  random(1, dh) (line 58, so up to a full canvas width/height), and `cc = int(random(5, 10))`
  (line 59) rings. Ring `j` has diameter `s*map(j, 0, cc, 1, 0)` (line 63), a white stroke with
  random alpha up to `maxStroke = random(random(256))` (lines 52, 60), and a fill of a random
  palette color at alpha 20 (line 61, palette at line 72).
- Each ring is drawn four times at (x,y), (width-x,y), (width-x,height-y), (x,height-y)
  (lines 64-67) — that is the 4-fold symmetry.
- Colour: fixed 4-color list, `random-from-list` per cluster; the visible orange/tan/pink-red
  dominance is the overlap of alpha-20 fills, not the stroke. Blue (#7AC0DF) and yellow (#F5D600)
  are present in the code but rare in this seed's render.
- `rectMode(CENTER)` (line 3) is set but no rects are drawn.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| c_80 | `int c = int(random(80)*random(0.1, 1));` -> `int c = int(random(80)*random(1));` | subtle | same 3x3 lattice and cluster positions; side and corner clusters now pale blue-grey (blue palette color visible where baseline was tan) and the center cluster gains a small inner core ring; no visible density increase (seed 42's new count landed low) | variants/c_80/frame_00001.png |
| cc_12 | `int cc = int(random(5, 10));` -> `int cc = int(random(12, 16));` | moderate | 12-15 tightly spaced concentric rings per cluster instead of 5-9; thin white ring outlines now distinct in all clusters; colors unchanged (orange top/bottom, pink center, olive sides) | variants/cc_12/frame_00001.png |
| fillAlpha_100 | `fill(rcol(), 20);` -> `fill(rcol(), 100);` | moderate | fills 5x more opaque: top/bottom center clusters clearly golden-yellow (the hidden #F5D600), side clusters solid olive, central cluster shows a dark-red outer band where two pink clusters overlap; much more saturated overall | variants/fillAlpha_100/frame_00001.png |
| grid_10 | `int dw = int(random(2, random(20)));` -> `int dw = 10; random(2, random(20));` (same for dh) | large | 10x10 lattice: clusters scattered over many more points and overlapping into a full-bleed orange wash; central figure-8 of two large overlapping circles, yellow corner clusters, small pink edge clusters, dense web of thin circle outlines; black background nearly gone | variants/grid_10/frame_00001.png |
| maxStroke_255 | `float maxStroke = random(random(256));` -> `float maxStroke = 255; random(random(256));` | subtle | thin white ring outlines now crisp and clearly visible in every cluster (barely visible in baseline); no change in color, count, or density | variants/maxStroke_255/frame_00001.png |

## Modularisation notes
- Generic: the point lattice builder (lines 30-36) and the concentric-ring drawing with 4-fold
  mirroring (lines 62-68) are both reusable as-is; the grid lines (38-46) are a trivial optional
  overlay.
- One-off art decisions: the specific 4-color palette, the alpha-20 fill / random-alpha stroke
  combination, and the `random(80)*random(0.1,1)` skew that keeps cluster counts small.
- Clean parameter object: `{cols, rows, clusterCount, ringsPerCluster [min,max], maxSizeInCells,
  fillColor, fillAlpha, strokeAlphaMax, gridLineAlpha, palette}`.
