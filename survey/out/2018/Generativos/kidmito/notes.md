---
sketch: 2018/Generativos/kidmito
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1591
animated: false
techniques: [grid, lines-hatching, dots-stippling]
primitives: [rect, ellipse, line]
palette:
  colors: ["#E6E7E9", "#F0CA4B", "#F07148", "#EECCCB", "#2474AF", "#107F40", "#231F20"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(20, 40))", tried: [10], change: large, effect: "coarse 10x10 grid: much larger cells, dots, circles and hatch blocks, same composition"}
  - {name: dotSideFraction, default: 0.1, tried: [0.3], change: subtle, effect: "centre square of each cell 3x wider (0.3*ss); rest of image identical"}
  - {name: coloredCellFraction, default: 0.2, tried: [0.5], change: large, effect: "half the cells get a palette colour: dense multicolour mosaic, pale field lost"}
  - {name: circleSizeRange, default: "ss*int(random(1, 5))", tried: ["ss*int(random(2, 9))"], change: moderate, effect: "circles up to 9 cells wide, several overlap and dominate the grid"}
  - {name: veilAlpha, default: 70, tried: [255], change: large, effect: "full-canvas veil opaque: image becomes near-flat orange, only the hatch line grid faintly visible"}
  - {name: hatchCount, default: 10, tried: [30], change: subtle, effect: "three times more orange hatch patches; lines are 1px so overall pixel change stays small"}
reusable_candidates:
  - {name: cellGrid, signature: "cellGrid(cellCount, cellFill, cellStroke, dotFraction, dotFill) -> void", note: "canvas tiling: one rect per cell + small centered rect"}
  - {name: hatchBlock, signature: "hatchBlock(x, y, w, h, lineCount, color) -> void", note: "grid-aligned rectangle filled with ccc+1 vertical and horizontal 1-px lines"}
---

## What it draws
A 960×960 canvas tiled by a ~24×24 grid of squares: most cells are a pale off-white
with a faint dark outline, a minority are solid random colours (orange, yellow, blue,
green, dark brown, pink). Each cell carries a small square in its centre, mostly pale,
occasionally coloured. Overlaid are ~20 large translucent circles (1–4 cells across,
snap to half-cell) in the same palette, and ~10 grid-aligned rectangular patches of
fine orange hatching (dense horizontal + vertical 1-px line grids). A single
translucent colour wash over the whole canvas gives the whole image a pinkish cast.

## How the code works
`setup()` -> `generate()` once (empty `draw()`; any key re-runs with a new seed) —
static, single-shot. Flow (kidmito.pde):
1. L39-46: seed the PRNGs, near-black background, `stroke(0, 50)` — the 50-alpha black
   outline is what draws the faint grid lines around every cell.
2. L48-59: `cc = int(random(20, 40))` cells per side, `ss = width/cc`. Double loop
   draws each cell rect (L55, stroke 0,50) filled off-white `#E6E7E9` unless
   `random(1) < 0.2` picks a palette colour via `rcol()` (L54), then a small centered
   square of side `ss*0.1` at `x+ss*0.45` filled `rcol()` (L57).
3. L63-72: `cc` circles at random positions snapped to `s/2` (`xx -= xx%(s*0.5)`),
   diameters `ss*int(random(1,5))`, opaque `rcol()` fill — they look muted in the
   baseline only because the translucent veil of step 4 is painted over them.
4. L74-96: a rect-subdivision block that never fires: the condition at L80
   (`r.x+r.w < p.x` with `p.x > r.x`) is unsatisfiable, so `rects` stays the single
   full-canvas rect. The loop at L90-96 then draws ONE full-canvas rect with
   `fill(rcol(), 70)` (L94) — a 70-alpha colour veil over everything; this also sets
   `stroke(col)` (L93) which the hatching reuses.
5. L100-117: 10 grid-aligned hatching blocks: position snapped to `ss`, size
   `int(random(1,8))*ss` square-ish, `ccc = int(random(3,28))` so `ccc+1` vertical
   lines (L108-111) and `ccc+1` horizontal lines (L113-116) span the block, all in the
   single stroke colour from step 4.
Palette: 7 fixed hex values (L125), `rcol()` picks uniformly at random (L126-128);
`getColor()` (noise-free lerp variant, L129-139) is unused. Imports (triangulate,
toxi SimplexNoise) are never used in the code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_10 | `int cc = int(random(20, 40));` -> `int cc = 10;` | large | coarse 10x10 grid: big cells, big centre dots, circles spanning 1-4 cells (up to ~384 px), huge hatch blocks; composition identical, everything scaled up | variants/cc_10/frame_00001.png |
| dot_0.3 | `rect(x+ss*0.45, y+ss*0.45, ss*0.1, ss*0.1);` -> `rect(x+ss*0.35, y+ss*0.35, ss*0.3, ss*0.3);` | subtle | no visible change except the centre square of every cell is ~3x wider; cells, circles, hatching unchanged | variants/dot_0.3/frame_00001.png |
| prob_0.5 | `fill(((random(1) < 0.2)? rcol() : #E6E7E9));` -> `< 0.5` | large | about half the cells are now solid palette colours: busy multicolour mosaic, the pale off-white field is gone | variants/prob_0.5/frame_00001.png |
| circle_2x9 | `float s = ss*int(random(1, 5));` -> `float s = ss*int(random(2, 9));` | moderate | circles now 2-9 cells wide; several overlap and cover large areas, grid mostly visible between them | variants/circle_2x9/frame_00001.png |
| veil_255 | `fill(col, 70);` -> `fill(col, 255);` | large | the full-canvas veil becomes opaque orange: grid, dots and circles are hidden; only the hatch line grid, in a slightly different orange, is faintly visible | variants/veil_255/frame_00001.png |
| hatch_30 | `for (int k = 0; k < 10; k++) {` -> `k < 30` | subtle | three times as many orange hatch patches spread over the canvas; lines stay 1 px, so the background and all other elements look almost the same | variants/hatch_30/frame_00001.png |

## Modularisation notes
Generic blocks: the cell grid (L48-59) is a clean parameterizable `cellGrid(count,
baseFill, coloredFraction, dotFraction, dotFill, cellStroke)`; the hatching block
(L100-117) is a `hatchBlock(x, y, w, h, lineCount, color)`; the full-canvas alpha veil
(L90-96, degenerate case of the subdivision) is a reusable "wash" step. One-off art
decisions: the dead subdivision loop (L74-88 — remove entirely; it only exists to set
the stroke colour for the hatch), the snap-to-half-cell rule for circles, the 7-colour
palette, the 20% colored-cell probability. A clean parameter object:
`{cellCount, cellStroke, coloredCellFraction, dotSideFraction, dotFillFn,
 circleCount, circleSizeRange, veilColor, veilAlpha, hatchCount, hatchSizeRange,
 hatchLineCountRange, palette}`.
