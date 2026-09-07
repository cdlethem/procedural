---
sketch: 2014/Generativos/crucesitas
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 427
animated: false
techniques: [lines-hatching, dots-stippling, symmetry]
primitives: [line, ellipse, pgraphics, image]
palette:
  colors: ["#FCEFE1", "#FCC07F", "#FC6D82", "#823954", "#070526"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: crossCount, default: 150, tried: [300], change: moderate, effect: "denser field of stitch rows, overlapping into a plaid lattice"}
  - {name: crossScale, default: "random(3,10)", tried: ["random(3,30)"], change: large, effect: "much larger, heavier X stitches; marks dominate the canvas"}
  - {name: chainLen, default: "int(random(1,15))", tried: ["int(random(1,30))"], change: subtle, effect: "some rows run longer, overall soft look barely changes"}
  - {name: circleScale, default: "random(3,120)", tried: ["random(3,300)"], change: moderate, effect: "ghost circles become large overlapping pale rings across the canvas"}
  - {name: circleAlpha, default: 12, tried: [80], change: none, effect: "no visible change; circles stay nearly invisible"}
  - {name: hatchCount, default: 20, tried: [80], change: subtle, effect: "a few more diagonal dash clusters; overall texture similar"}
reusable_candidates:
  - {name: stitchRow, signature: "stitchRow(x, y, steps, step, thickness, horizontal, color) -> void", note: "a run of X 'stitches' (paired crossing lines) marching along one axis"}
  - {name: hatchCluster, signature: "hatchCluster(x, y, lines, gap, maxLen, weight, color) -> void", note: "short parallel 45-degree diagonal lines with randomized lengths"}
---

## What it draws
A dusty rose canvas covered in rows of small "X" stitch marks — like cross-stitch running along
horizontal and vertical lines — in cream, orange, pink and near-black. The marks sit at a soft,
out-of-focus depth: some rows are crisp and dark, many are blurred into the background. Faint
large circles (barely visible pale rings) drift behind, and a scatter of short diagonal hatched
dashes (dark navy and orange) lies on top.

## How the code works
Single-pass `generar()` called from `setup()` (lines 11, 17); `draw()` is empty, so the image is
static. All colours come from `rcol()`, a uniform random pick from the 5-colour `paleta` array
(lines 1-7, 87-89); the background is one such pick (line 18).

1. **Cross stitches** (lines 19-36): 150 iterations. Each picks a position, a scale `t =
   random(3,10)`, and a chain length `c = int(random(1,15))`. A 50/50 choice sets `dx` or `dy` to
   `random(2,3)` (lines 27-28), so the chain runs horizontally or vertically. `j` from `-c` to
   `c-1` draws two short crossing lines at offset `t*j*(dx,dy)` — a pair of diagonals forming an
   "X" at each step (lines 32-35). So each iteration is a *row* of X marks, not a single cross.
   `strokeWeight(t*0.3)` (line 29) makes longer chains thicker. Every 10th iteration the whole
   canvas gets `filter(BLUR, 1)` (line 20), accumulating a progressive soft blur.
2. **Faint circles** (lines 38-46): 100 ellipses with random diameter `random(3,120)`, drawn
   with `stroke(255,12)` and `fill(255,8)` — nearly transparent white, so they read as ghost
   rings barely above the background.
3. **Diagonal hatch overlay** (lines 48-74): a separate `PGraphics` buffer. 20 iterations, each
   drawing `c = int(random(1,6))` parallel 45° lines at vertical offsets `y + t*j*dy` with
   individual random lengths `tt = t*random(1,10)` (lines 61-64) — the short slanted dash
   clusters. The buffer is then blurred (`gra.filter(BLUR, 1)`, line 71) and composited twice
   (lines 70-72) for a doubled, hazy exposure before being drawn over the main canvas (line 74).

`keyPressed` regenerates on any key except 's' (save) — lines 77-80.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| crossCount_300 | `for (int i = 0; i < 150; i++) {` -> `for (int i = 0; i < 300; i++) {` | moderate | far denser: stitch rows fill the whole canvas and cross into a plaid-like lattice | variants/crossCount_300/frame_00001.png |
| crossScale_30 | `float t = random(3, 10);` -> `float t = random(3, 30);` | large | X stitches are several times bigger and heavier; large rows dominate and most of the background is covered | variants/crossScale_30/frame_00001.png |
| chainLen_30 | `int c = int(random(1, 15));` -> `int c = int(random(1, 30));` | subtle | some rows stretch into long runs, but the soft overall impression is nearly unchanged | variants/chainLen_30/frame_00001.png |
| circleScale_300 | `float t = random(3, 120);` -> `float t = random(3, 300);` | moderate | the ghost circles are now large: big overlapping pale rings visible across the whole image | variants/circleScale_300/frame_00001.png |
| circleAlpha_80 | `stroke(255, 12);` -> `stroke(255, 80);` | none | no visible change; rings remain nearly invisible even at 8x alpha | variants/circleAlpha_80/frame_00001.png |
| hatchCount_80 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 80; i++) {` | subtle | a few more short diagonal dash clusters appear; overall texture stays similar | variants/hatchCount_80/frame_00001.png |

## Modularisation notes
- **Generic / library-ready**: the X-stitch row (paired crossing lines advanced along one axis
  with a fixed step, square caps) and the 45° hatch cluster (parallel lines, randomised
  lengths, one fixed orientation) are both parameterisable primitives. The "random from palette"
  colour helper is trivially reusable. The PGraphics blur-then-double-composite (lines 68-73)
  is a reusable "soft ghost" post-effect.
- **One-off art decisions**: the progressive whole-canvas `filter(BLUR,1)` every 10th stroke
  (bakes blur into the drawing order, not separable), the near-invisible white circle pass, and
  the 5-colour palette itself.
- **Parameter object**: `{crosses: 150, crossScale: [3,10], chainLen: [1,15], step: [2,3],
  strokeScale: 0.3, blurEvery: 10, circles: 100, circleScale: [3,120], circleAlpha: 12,
  hatches: 20, hatchLines: [1,6], hatchScale: [1,5], palette: [...]}`.
- **Caveat**: the cross orientation (h vs v) is a per-iteration coin flip; to make a
  deterministic "grid of stitches" you'd need to pass orientation explicitly rather than random.
