---
sketch: 2018/Generativos/quadis_ani
year: 2018
renderer: P2D
size: [960, 540]
libraries: []
deterministic: false
ms_first_frame: 1555
animated: true
techniques: [grid, shader]
primitives: [shape]
palette:
  colors: ["#B14027", "#476086", "#659173", "#9293A2", "#262A2C", "#D38644"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: quadTile, signature: "quadTile(x, y, size, depth, gap, cols, rows) -> void", note: "grid-aligned square with 45-degree drop shadow, per-vertex bevel gradients, and an inner subgrid of cells"}
  - {name: contrastVignetteGrain, signature: "contrastVignetteGrain(strength, vignette, grainAmt) -> PShader", note: "col*0.6+col^2*1.69 contrast curve, radial vignette, time-shifted hash grain, per-channel gamma"}
  - {name: gridAlign, signature: "gridAlign(value, cell) -> float", note: "snap a random coordinate to the cell grid (v - v % cell)"}
---

## What it draws
A dark charcoal field of randomly sized flat squares, each in a muted earth tone
(rust, slate blue, sage, ochre, grey), scrolling slowly downward. Most squares carry
long diagonal drop shadows toward the lower right, a faint bevel (dark lower-right
edge, light upper-left edge), and an inner grid of smaller same-coloured cells
separated by thin gaps. A post shader adds contrast, a vignette, and fine animated
grain, giving the whole image a flat, printed, filmic look.

## How the code works
- `settings()` (L4-8): `size(960,540,P2D)`, `smooth(8)`.
- `draw()` (L15-38): `randomSeed(seed)` then `background(rcol())` (L18-19) — one fixed
  palette colour per run, here the dark `#262A2C`. Scroll offset `dy = frameCount*4`
  (L22); `sy = floor(dy/width)` selects the visible band. Inside `pushMatrix`
  (L25-33) three `generate(seed+sy+1 / +sy / +sy-1)` calls draw width×width bands at
  y-offsets -2w, -w, 0, so the tile field scrolls vertically at 4 px/frame with no
  visible seam.
- `generate(seed)` (L47-165): reseeds `randomSeed(seed)` (L49). Loop of 20 tiles
  (L54): side `ss = width/pow(2, int(random(2, random(2,9))))` (L55) — dyadic sizes
  from w/4 down to w/256; position snapped to the `ss` grid (L56-59); depth
  `dd = ss*random(1)` (L61).
  - Two black quads at `fill(0,50)` (L74-90) extend `dd` right and down, forming the
    45° drop shadow.
  - Main square `fill(rcol())` (L92-98).
  - Per-vertex-alpha gradients: black `fill(0,10)->(0,0)` from the bottom-right
    corner (L100-108) and white `fill(255,10)->(255,0)` from the top-left (L110-118)
    — the bevel.
  - If `ss > 10` and `random(1) < 0.95` (L120): inset `bb = ss*0.01*random(0.5,1)`
    (L121; `random(0.1,0.1)` is a constant 0.1), gap `sb = 3` (L122); a dark border
    ring at `fill(0,12)` (L125-133); then a `cw × ch` subgrid, both `random(2,16)`
    (L135-136), of `rcol()` cells (L144-152), each cell with a faint white
    corner triangle `fill(255,4)->(255,0)` (L153-160).
- `rcol()` (L174-176): uniform pick from the 6-colour palette (L173).
- Post shader `data/post.glsl`: contrast curve `col*0.6 + col^2*1.69`, radial
  vignette `pow(1-dd*0.18, 3.2)`, 5% time-shifted hash grain, per-channel gamma
  (g 1.18, b 1.20). This mutes the palette and darkens the background.
- Non-deterministic: `millis()` drives the grain `time` uniform, so frames carry a
  bit of render-to-render noise; only large differences are meaningful.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `generate()` is the reusable core: a `quadTile(x, y, size, depth, gap, cols, rows)`
  function covering the shadow quads, bevel gradients, and inner subgrid. All its
  decisions (dyadic size, grid snap, 95% grid probability, gap size) are already
  parameterised by the locals.
- The scroll loop (three offset `generate` calls with band index `sy`) is a generic
  "seamless vertical scroll of a tileable band" pattern, independent of tile content.
- The post shader is a standalone, parameterisable `PShader` (contrast, vignette,
  grain) usable on any P2D sketch.
- One-off art decisions: the 6-colour palette, the 0.95 grid probability, the
  specific bevel alphas (10/50/12/4), the 4 px/frame scroll speed.
- A clean parameter object would hold: `tileCount, sizeRange (dyadic min/max power),
  gridProbability, gridCols/rows range, gap, shadowDepth, bevelAlphas, palette,
  scrollSpeed, postShaderParams`.
