---
sketch: 2018/Generativos/arabe
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1566
animated: false
techniques: [subdivision, grid]
primitives: [rect, shape]
palette:
  colors: ["#F19617", "#251207", "#15727F", "#CEAB81", "#BD3E36"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(1,8))", tried: [7], change: moderate, effect: "fixing the step count reshuffles the random stream: coarser, smoother mosaic, faint checker"}
  - {name: checkerDiv, default: "int(random(2,16))", tried: [32, 2], change: moderate, effect: "32 = fine near-noise checker in subdivided patches; 2 = coarse 2x2 check per tile"}
  - {name: checkerAlpha, default: 90, tried: [255], change: moderate, effect: "opaque checker hides diagonal tile fills; canvas becomes a high-contrast fine pixel mosaic"}
  - {name: palette, default: "#F19617,#251207,#15727F,#CEAB81,#BD3E36", tried: ["#15727F,#7D57C6,#3DC1CD,#F72C11,#FACD00"], change: moderate, effect: "same layout; teal/purple/red/ochre replaces warm-brown dominance"}
reusable_candidates:
  - {name: subdivideRect, signature: "subdivideRect(rects, steps, minDiv, maxDiv) -> PVector[][]", note: "repeatedly split one random rect into an n×n grid, n random in [minDiv,maxDiv)"}
  - {name: lerpPalette, signature: "lerpPalette(colors, v) -> color", note: "map float v to lerp of two adjacent palette entries"}
---

## What it draws
A full-bleed 960×960 mosaic of square tiles at a few different sizes, like a
patchwork of pixel-art regions. Warm oranges, browns and tans dominate; there
are blocks of muted teal/green-grey, a large smooth orange-tan gradient
region, and a dark brown/teal checkerboard patch in the bottom-right corner.
Within each tile, two diagonal half-squares of slightly different color meet
along a diagonal, and a fine semi-transparent checker grid overlays each tile.
No strokes, no outlines, no visible text.

## How the code works
- `generate()` (arabe.pde:22-82): background is set to a random palette color
  then immediately overwritten with black (line 23-24) — only visible where
  tiles fail to cover, which they don't.
- Subdivision loop (arabe.pde:26-41): starts with one PVector representing the
  whole canvas `(0,0,width)` (x, y, size). For `sub = int(random(1,8))` steps
  it picks a random rect from the list, replaces it with an `int(random(2,6))`
  ×`div` grid of smaller squares, so the canvas becomes a patchwork of squares
  at a few discrete sizes.
- Tile drawing loop (arabe.pde:44-81): for each rect it draws a quad with
  `beginShape()` (line 52-69) whose two triangles get `lerpColor(col,
  getColor(), random(0.5))` fills — a coin flip (line 51) chooses the diagonal
  direction, producing the two-tone diagonal split inside each tile.
- Then (arabe.pde:71-80) it overlays a fine grid of small rects sized
  `r.z/int(random(2,16))`, each filled with `getColor()` at alpha 90 (line
  77), which creates the semi-transparent checkerboard texture inside every
  tile.
- Colour (arabe.pde:90-104): fixed 5-color palette line 90; `getColor(v)`
  lerps between two adjacent palette entries for a float `v`; `getColor()`
  wraps it around a random index. So every fill is a random blend of two
  neighbouring palette colors. Randomness: seed set by harness (line 1 field
  `seed`), all variation comes from `random()` calls in `generate()`.
- A commented-out alternate palette exists at line 89 (yellow/orange/pink/purple/teal).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_7 | `int sub = int(random(1, 8));` -> `int sub = 7;` | moderate (mean 0.14, 72% px) | coarser, smoother mosaic of large near-uniform tiles; checker overlay faint; muted warm/teal, no dark checker block (layout reshuffled because removing the `random()` call shifts the stream) | variants/sub_7/frame_00001.png |
| div_32 | `int div = int(random(2, 16));` -> `int div = 32;` | moderate (mean 0.11, 55% px) | subdivided patches (top-right, bottom-right) become a very fine 32x32 checker, near-noise texture; large tiles unchanged | variants/div_32/frame_00001.png |
| div_2 | `int div = int(random(2, 16));` -> `int div = 2;` | moderate (mean 0.12, 60% px) | checker overlay is a coarse 2x2 check inside each tile; large soft tiles, mauve/orange check in bottom-right | variants/div_2/frame_00001.png |
| alpha_255 | `fill(getColor(), 90);` -> `fill(getColor(), 255);` | moderate (mean 0.13, 68% px) | opaque checker hides the diagonal tile fills entirely; whole canvas is a busy high-contrast fine pixel mosaic with broad orange/teal/brown swaths | variants/alpha_255/frame_00001.png |
| palette_cool | `int colors[] = {#F19617, #251207, #15727F, #CEAB81, #BD3E36};` -> `int colors[] = {#15727F, #7D57C6, #3DC1CD, #F72C11, #FACD00};` | moderate (mean 0.13, 77% px) | identical layout, new colors: teal/green dominant on the left, red-orange and yellow-ochre on the right, purple accents | variants/palette_cool/frame_00001.png |

## Modularisation notes
- Generic: the subdivide-rect-into-grid loop (arabe.pde:29-41) is a clean
  library function `subdivideRect(rects, steps, minDiv, maxDiv)`; the
  lerp-between-adjacent palette sampler (arabe.pde:98-104) is reusable as
  `lerpPalette(colors, v)`; the two-triangle diagonal tile fill is a small
  primitive `diagonalTile(x, y, s, c1, c2)`.
- One-off art decisions: the fixed 5-color warm/teal palette; the alpha-90
  checker overlay density `random(2,16)`; the black background reset at
  line 24 (dead code, can drop); the `keyPressed` regenerate/save behavior.
- Clean parameter object: `{steps: 1..8, subDivRange: [2,6], checkerDivRange:
  [2,16], checkerAlpha: 90, palette: [5 colors], size: 960, seed}`.
