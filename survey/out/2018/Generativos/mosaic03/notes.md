---
sketch: 2018/Generativos/mosaic03
year: 2018
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1534
animated: false
techniques: [recursion, subdivision, grid, symmetry]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#DFAB56", "#E5463E", "#366A51", "#2884BC"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ite, default: 8, tried: [12], change: moderate, effect: "deeper recursion = more, smaller nested circles/squares toward each canvas corner"}
  - {name: des, default: 0.5, tried: [0.0], change: moderate, effect: "recursion offset; 0.0 makes each quadrant's fractal converge toward its own centre instead of the canvas centre"}
  - {name: palette, default: "DFAB56/E5463E/366A51/2884BC", tried: ["2D132C/801336/C72C41/EE4540"], change: large, effect: "full recolour; warm red/maroon/plum set replaces gold/red/green/blue, same structure"}
  - {name: shadowAlpha, default: 180, tried: [90], change: subtle, effect: "lower = more transparent diagonal shadow wedges; hazier, more blended look"}
  - {name: shadowFlipP, default: 0.5, tried: [0.2], change: none, effect: "no visible change (same seed keeps the random shadow-flip sequence ~identical)"}
reusable_candidates:
  - {name: fractalTile, signature: "fractalTile(x, y, w, h, depth, offset) -> void", note: "recursively subdivide a centered rect by half, drawing a 2x2 colour block + central circle + diagonal shadow wedge at each level"}
  - {name: quadrantMosaic, signature: "quadrantMosaic(ite, palette, des) -> void", note: "four symmetric fractalTile calls, one per canvas quadrant"}
  - {name: shadowWedge, signature: "shadowWedge(x, y, w, h, alpha, flipP) -> void", note: "semi-transparent quad over a rect with one random diagonal half made transparent"}
---

## What it draws
A 4-fold symmetric mosaic of flat colour squares that fills the entire canvas, in four tones:
ochre/gold, brick red, dark green and blue. Each large square carries a soft diagonal two-tone
"shadow" wedge, and a circle sits at the centre of each 2x2 group of squares. The pattern is
fractal: every 2x2 group repeats at half size toward the inner corner of its quadrant, so the
squares and circles get progressively smaller and denser toward the centre of each quadrant
(corner of the canvas). Background is light grey but fully covered.

## How the code works
- `setup()` (mosaic03.pde:8): `size(960,960,P3D)`, `smooth(8)`, `pixelDensity(2)`. Loads
  `post.glsl` into `post` but the `filter(post)` call is commented out (lines 116-118), so the
  shader is never actually applied (all drawing is 2D on the P3D renderer).
- `generate()` (:102): `randomSeed(seed)`, `background(230)`, `rectMode(CENTER)`, then four
  `rect1(...)` calls, one per canvas quadrant, each with recursion depth `ite=8`. `draw()` (:18)
  re-runs `generate()` every 60 frames with the same seed, so the image is identical each time
  (the sketch is static).
- `rect1()` (:43) is the recursive divider: it draws one tile via `modulo(x,y,w,h)`, then recurses
  into the centre sub-rectangle (half width/height) at depth `ite-1` until `ite<=0`. The recursion
  direction is set by `dx,dy` (each `+des` or `-des`, `des=0.5`), so each quadrant's fractal
  converges toward the canvas centre.
- `modulo()` (:62) halves `w,h` and draws the 2x2 block: four `rect()`s, each filled
  `colors[(c+des)%4]` where `des` is a per-quadrant offset (0/2/4/6) and `c1..c4 = 1,0,3,2`, so the
  four squares of a group show four different palette colours permuted per quadrant. Each rect also
  gets a `shadow()` overlay. Then one `ellipse()` (the central circle) filled `colors[(des/2+1)%4]`.
- `shadow()` (:121) draws a quad (beginShape/vertex) over each rect filled with `rcol()` (a random
  palette colour) at alpha 180, but randomly makes one diagonal half transparent
  (`random(1) < 0.5`). This produces the soft diagonal two-tone wedge seen over every square.
- Colour: the palette is the four fixed hexes at :143 `{#DFAB56,#E5463E,#366A51,#2884BC}`. `rcol()`
  (:146) picks one at random. No noise is actually sampled (SimplexNoise / triangulate are imported
  but unused). Randomness enters only through `rcol()` (the shadow fills) and the shadow-diagonal
  flip; the grid and circle colours are deterministic per quadrant.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ite_12 | `, 8);` -> `, 12);` (all 4 rect1 calls) | moderate (0.068, 32%) | same 4-fold mosaic; recursive corner detail extends deeper with smaller, more numerous nested circles/squares toward each canvas corner | variants/ite_12/frame_00001.png |
| des_0.0 | `float des = 0.5;` -> `float des = 0.0;` | moderate (0.086, 35%) | big blocks and central circles in the same places, but each quadrant's recursive nesting converges toward its own centre rather than the canvas centre | variants/des_0.0/frame_00001.png |
| palette_warm | `int colors[] = {#DFAB56,#E5463E,#366A51,#2884BC};` -> `{#2D132C,#801336,#C72C41,#EE4540};` | large (0.339, 100%) | identical structure recoloured entirely into warm reds/maroons/dark plums; no gold/green/blue | variants/palette_warm/frame_00001.png |
| shadowAlpha_90 | `fill(col, 180)` -> `fill(col, 90)` | subtle (0.037, 10%) | diagonal shadow wedges more transparent; mosaic looks hazier and colours blend more softly (flat fills show through more) | variants/shadowAlpha_90/frame_00001.png |
| shadowFlip_0.2 | `random(1) < 0.5` -> `random(1) < 0.2` | none (0.009, 3%) | no visible change from baseline | variants/shadowFlip_0.2/frame_00001.png |

## Modularisation notes
- **Generic (library-ready):** `fractalTile(x,y,w,h,depth,offset)` — the recursive half-subdivision
  of `rect1` is the reusable core; it needs no knowledge of the palette, the shadow, or the
  quadrant, only the depth and the centre offset. `shadowWedge` is a self-contained 4-vertex quad
  with a random diagonal flip.
- **One-off art decisions:** the specific 2x2 colour permutation (`c1..c4`, per-quadrant `des`
  offset), the fixed 4-hex palette, the 0.5 subdivision ratio (hardcoded in both `rect1` and
  `modulo`), the 180 shadow alpha, and the 4-fold symmetric layout of the four top-level `rect1`
  calls.
- **Clean parameter object:** `{ palette: int[4], depth: int, ratio: float (0.5),
  recursionOffset: float (des=0.5), shadowAlpha: int (180), shadowFlipP: float (0.5) }`.
  The 0.5 subdivision ratio is duplicated in two functions and should be a single field.
