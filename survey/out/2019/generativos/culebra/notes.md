---
sketch: 2019/generativos/culebra
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1491
animated: false
techniques: [grid, noise-field, dots-stippling]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#EDFFFC", "#FFFF3D", "#F393FF", "#01CCCC", "#5967FF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: 80, tried: [40], change: moderate, effect: "cell size of the underlying grid; 40 doubles cells to 24x24, finer grid lines and more, smaller squares/beams"}
  - {name: snakeCount, default: 60, tried: [120], change: subtle, effect: "number of wavy snake trails; 120 makes the centre denser and busier, same trail style"}
  - {name: ddd, default: "random(50,250)", tried: ["random(50,500)"], change: subtle, effect: "trail length in steps; 500 lets some trails stretch much longer across the canvas"}
  - {name: ss, default: "4*int(random(2,16))", tried: ["8*int(random(2,16))"], change: moderate, effect: "trail dot size; doubled makes trails thick, heavy, saturated ribbons that dominate the image"}
  - {name: det, default: "random(0.001)", tried: ["random(0.004)"], change: none, effect: "noise detail for per-cell dot size; 4x higher had no visible effect (dots look the same)"}
reusable_candidates:
  - {name: snakeTrail, signature: "snakeTrail(x, y, steps, baseSize, oscVel, oscAmp, modAmp, colorStart, colorDrift)", note: "chain of fading ellipses displaced by a decaying sine; the 'culebra' trail"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "tapered arc drawn as quad strips between two radii"}
  - {name: getColor, signature: "getColor(float v) -> int", note: "cyclic lerp through the palette array (wraps, gamma 1.1)"}
  - {name: noiseDotGrid, signature: "noiseDotGrid(grid, detail, offset)", note: "one rect outline + one noise-sized dot per grid cell"}
---

## What it draws
On a light off-white canvas, a faint 12×12 square grid (each cell outlined in light grey with a small
coloured dot of noise-driven size) carries a scatter of translucent pastel squares, pale diagonal
Dominating the centre are many wavy "snake" trails — ribbons of small overlapping dots that wiggle
sideways, fade to transparent at their tail, and change colour along their length, all in a neon-pastel
palette (cyan, yellow, pink/magenta, periwinkle blue, near-white) over a soft yellow wash in the middle.

## How the code works
`setup()` calls `generate()` once (static image; `draw()` does nothing, so frames 1/10/60 are identical).
`generate()` (culebra.pde:47):

1. Seeded by `randomSeed`/`noiseSeed(seed)`, `background(240)` off-white.
2. **Grid layer** (lines 59–73): `grid = 80`, `cc = width/grid = 12` cells. For every inner cell it
   strokes a `rect` (grey outline) and fills an `ellipse` of size `grid*0.2*noise(des+x*det, des+y*det)`
   in a random palette colour — the faint dots.
3. **Translucent quads** (lines 75–100): `cc` random axis-aligned squares in cell units, each drawn as a
   4-vertex `beginShape` with two random palette colours at random alpha (one colour per pair of
   adjacent vertices, so each quad blends two colours); `altCol` swaps which half gets which colour.
4. **Shadow/rect layer** (lines 102–142): `cc` random cells get a 4-vertex parallelogram skewed along a
   random diagonal direction (`mirH`/`mirV` ±1, depth `dis` cells) with alpha `random(200)` — the pale
   diagonal beams; then a jittered near-transparent black `rect` and a solid `rcol()` `rect` on top.
5. **Snake trails** (lines 144–195): `translate` to centre, then 60 trails. Each: position snapped to
   the grid, rotated 90° (or randomly 20% of the time), a seed `ellipse` + tapered `arc2` ring, then
   `ddd = random(50,250)` steps where each step draws an `ellipse` of size `ss` at `y=-j` with
   `x = sin(j*oscVel)*ss*oscAmp`, `oscAmp *= modAmp` (decaying/growing sway), alpha mapped to 0 over the
   last 10% of steps (fade-out tail), colour from `getColor(ic + dc*j)` — a drift through the palette.
6. **Palette** (line 236): 5 coolors.co pastels; `rcol()` = uniform random pick, `getColor(float)` =
   cyclic `lerpColor` with `pow(frac, 1.1)`.

Randomness enters everywhere from the single `seed`; the toxi `SimplexNoise` import is unused (only
`noiseSeed`/`noise()` are used), and the triangulate import is likewise unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_40 | `int grid = 80;` -> `int grid = 40;` | moderate | finer 24x24 grid; more, smaller translucent squares and diagonal beams; trails snap to a finer grid, composition denser overall | variants/grid_40/frame_00001.png |
| snakeCount_120 | `for (int i = 0; i < 60; i++) {` -> `for (int i = 0; i < 120; i++) {` | subtle | more, denser trails; centre busier with overlapping ribbons, same wavy style and palette | variants/snakeCount_120/frame_00001.png |
| ddd_500 | `int ddd = int(random(50, 250)*random(1));` -> `int ddd = int(random(50, 500)*random(1));` | subtle | some trails visibly longer, stretching across most of the canvas with long fading tails | variants/ddd_500/frame_00001.png |
| ss_8 | `float ss = 4*int(random(2, 16)*random(1));` -> `float ss = 8*int(random(2, 16)*random(1));` | moderate | trails much thicker: heavy, saturated ribbon-like snakes with bigger seed dots; background layers unchanged | variants/ss_8/frame_00001.png |
| det_0.004 | `float det = random(0.001);` -> `float det = random(0.004);` | none | no visible change: grid dots look the same size and everywhere else is identical | variants/det_0.004/frame_00001.png |

## Modularisation notes
- **Generic, library-worthy**: `snakeTrail` (decaying-sine ribbon of fading dots with colour drift —
  the core motif), `arc2` (tapered arc quad-strip), `getColor` (cyclic palette lerp), `noiseDotGrid`
  (per-cell noise-sized dots + cell outlines).
- **One-off art decisions**: the specific 5-colour palette; the three stacked background layers
  (quads / parallelogram shadows / solid rects) and their alpha ranges; the 90°-or-random rotation of
  each trail; the exact coolors.co set.
- **Clean parameter object**: `{ grid, cellCount (derived), noiseDetail (det), noiseOffset (des),
  quadCount (cc), parallelogramDepth (dis), trailCount, trailLength (ddd), trailSize (ss),
  oscVel, oscAmp, modAmp, tailFade (0.1), palette, paletteDrift (dc) }`.
