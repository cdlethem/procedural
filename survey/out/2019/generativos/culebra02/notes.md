---
sketch: 2019/generativos/culebra02
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1515
animated: false
techniques: [grid, noise-field, particles, curves]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#EDFFFC", "#FFFF3D", "#F393FF", "#01CCCC", "#5967FF"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: grid, default: 80, tried: [120], change: moderate, effect: "larger cells: fewer, bigger blocks/dots, snakes snapped to a coarser grid"}
  - {name: snake_count, default: 60, tried: [20, 150], change: subtle, effect: "fewer snakes = sparser canvas; 150 = denser but score stays subtle (snakes are small vs canvas)"}
  - {name: trail_length, default: "random(50,250)", tried: ["random(10,60)"], change: subtle, effect: "snakes shrink to short wiggles and rings; long fading tails disappear"}
  - {name: snake_size, default: "4*int(random(2,16))", tried: ["8*int(random(2,16))"], change: moderate, effect: "trails become thick fat ribbons instead of thin dotted lines"}
  - {name: background, default: 240, tried: [0], change: large, effect: "black canvas: all elements glow at high contrast, grid lines turn white"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "ring/annulus drawn as quads with radial alpha fallop"}
  - {name: getColor, signature: "getColor(float v) -> color", note: "walk a palette by lerp between adjacent entries with pow(frac, 1.1)"}
  - {name: snakeTrail, signature: "snakeTrail(x, y, size, steps, oscVel, oscAmp, modAmp, palette, colorStep) -> void", note: "chain of ellipses stepping up with sin(j*oscVel)*size*oscAmp x-offset and tail alpha fade"}
  - {name: gridDots, signature: "gridDots(cellSize, detail, offset) -> void", note: "stroked grid cells each with a noise-sized dot at center"}
---

## What it draws
Light gray canvas with a faint 80 px square grid. Scattered over it: small multi-colored dots (pink, yellow, teal, blue) of varied size, a few large semi-transparent pastel squares and solid color blocks with offset shadow-like trapezoids, and dozens of wavy "snake" trails built from chains of small circles in purple, pink, yellow, teal, blue and white. Each snake meanders vertically with a sinusoidal wiggle, starts from a small circle plus a soft gradient ring, and fades out toward its tail.

## How the code works
`settings()` (L14-19): 960x960 P2D, `smooth(8)`, `pixelDensity(2)`. `setup()` (L21-29) seeds (`randomSeed`/`noiseSeed`, L51-52) then calls `generate()` once; `draw()` (L31-37) only re-rolls the seed every 120 frames (regeneration commented out), so the image is static.

`generate()` draws four layers:

1. **Noise grid dots** (L59-73): `grid = 80`, `cc = width/grid = 12`. For every interior cell: `stroke(230)` rect outline plus a center ellipse of size `grid*0.1*noise(des+x*det, des+y*det)` with `det = random(0.001)`, filled `rcol()` — the faint field of small colored dots.
2. **Translucent squares** (L76-100): `cc` random rectangles in grid units (`ww`,`hh` = `random(1, cc*0.5)` cells, position snapped to grid), 4-vertex shape whose two diagonal vertex pairs get two different random palette colors with alpha `random(255)` — the big pastel see-through squares.
3. **Shadowed blocks** (L102-142): another `cc` grid cells, each with a mirrored trapezoid "shadow" (4-vertex shape, offset `dis = random(2,8)`, alpha up to 200), a near-invisible black rect (alpha `random(20)`), then a solid `rcol()` rect — the solid color blocks with offset shadows.
4. **Snakes** (L144-195): 60 trails. Each snake: random position scaled to 0.4-1.0 and snapped to the grid; rotated by `HALF_PI * int(random(4))` (or random full angle with p=0.2); base ellipse `ss*1.8` plus an `arc2()` gradient ring (alpha 100 -> 0). Then a chain of `ddd = int(random(50,250))` ellipses: each step moves up by 1 px (`yy-j`) with `dx = sin(j*oscVel)*ss*oscAmp`, `oscAmp *= modAmp` (0.97-1.03) each step; alpha fades over the last 10% via `map(j, ddd*0.9, ddd, 255, 0)`; color `getColor(ic + dc*j)` walks the palette. This produces the wavy vertical snake trails.

`arc2()` (L199-216): ring of ~`PI*max(s1,s2)*0.25` quads with per-quad alpha from `alp1` (inner) to `alp2` (outer). `rcol()` (L239-241): uniform random pick from `colors[]` (L236, 5 pastel colors). `getColor(float)` (L245-251): lerps between adjacent palette entries, `pow(frac, 1.1)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_120 | `int grid = 80;` -> `int grid = 120;` | moderate | grid cells ~50% larger (8x8 instead of 12x12); blocks, dots and shadows bigger; snakes snap to the coarser grid and look chunkier | variants/grid_120/frame_00001.png |
| snakes_20 | `for (int i = 0; i < 60; i++) {` -> `... i < 20 ...` | subtle | visibly fewer snake trails; background and grid show through more | variants/snakes_20/frame_00001.png |
| snakes_150 | `for (int i = 0; i < 60; i++) {` -> `... i < 150 ...` | subtle | more snakes, denser center; score still subtle (each snake is small relative to canvas) | variants/snakes_150/frame_00001.png |
| trail_short | `int ddd = int(random(50, 250)*random(1));` -> `int ddd = int(random(10, 60)*random(1));` | subtle | long fading tails gone; snakes reduce to short wiggles plus their start rings | variants/trail_short/frame_00001.png |
| snakesize_8 | `float ss = 4*int(random(2, 16)*random(1));` -> `float ss = 8*...` | moderate | snake trails become thick fat ribbons; dominant feature of the image | variants/snakesize_8/frame_00001.png |
| bg_dark | `background(240);` -> `background(0);` | large | black canvas; pastels and white glow at high contrast, grid lines render white | variants/bg_dark/frame_00001.png |
## Modularisation notes
Four cleanly separable blocks: (1) `gridDots` — generic noise-sized dot grid (cell size, noise detail/offset as params); (2) the two random-rect overlays are one-off art decisions but both follow the same "grid-snapped random rect + random palette + alpha" pattern (parameterize: count, max size, alpha range, shadow offset); (3) `snakeTrail` — the core reusable primitive (position, size, steps, oscVel/oscAmp/modAmp, palette, color step, tail-fade fraction); (4) `arc2` and `getColor` are directly library-ready. A clean parameter object: `{cell, snakeCount, trailSteps, snakeSize, oscVel, oscAmp, palette, background, blockCount, alphaRange}`.
