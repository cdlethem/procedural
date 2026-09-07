---
sketch: 2016/Generativos/triangleRamp
year: 2016
renderer: P2D
size: [640, 640]
libraries: []
deterministic: true
ms_first_frame: 1701
animated: false
techniques: [grid, symmetry, pixel-ops]
primitives: [rect, line, point, pgraphics]
palette:
  colors: ["#4437D6", "#F08060", "#60B090", "#A030B0", "#FFFFFF"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(3,100) (~40 under seed 42)", tried: [12], change: moderate, effect: "coarser grid, ~12 columns; palette/grain/symmetry unchanged"}
  - {name: cc, default: "random(3,100) (~40 under seed 42)", tried: [80], change: large, effect: "fine ~8px cells, much busier texture"}
  - {name: grainMaxAlpha, default: "random(22)*random(1) (max 22)", tried: [80], change: subtle, effect: "subtle: barely stronger white veil, grid still clearly readable"}
  - {name: grainMaxAlpha, default: "random(22)*random(1) (max 22)", tried: [0], change: subtle, effect: "no visible change; alpha 0 points are fully transparent and draw nothing"}
  - {name: rampStops, default: "4 random RGB stops", tried: ["white/red/near-black fixed stops"], change: large, effect: "palette becomes black/maroon/red/pink/cream; also shifts the RNG stream so the random grid count changes too (coarser, ~7 columns)"}
reusable_candidates:
  - {name: colorRamp, signature: "ColorRamp.addColor(color, pos); getColor(t) -> color; show(x, y, w, h)", note: "4-stop lerp gradient ramp with full-bleed vertical show; stops are random RGB here"}
  - {name: mirrorGrid, signature: "mirrorGrid(count, cellDrawFn)", note: "rectMode(CENTER) grid where each cell is drawn 4 times mirrored about the canvas centre (lines 55-71)"}
  - {name: grainOverlay, signature: "grainOverlay(maxAlpha)", note: "per-pixel white points with random alpha (lines 89-94); a simple screen-like haze"}
---

## What it draws
A full-bleed mosaic of flat, unstroked squares in blues, orange-salmon, teal and magenta, arranged with 4-fold mirror symmetry about the canvas centre. The whole surface is veiled by a fine white grain that desaturates and flattens the colors. Along the thin border, where the grid does not fully cover, a vertical colour ramp is visible (magenta/purple at the top fading through blue to teal).

## How the code works
`setup()` (line 3) calls `generate()` once; `draw()` is empty, so the piece is static.

- `generateColors()` (112-118) builds a `ColorRamp` with four random RGB stops (two fixed at positions 0 and 1, two at random positions). `getColor(t)` (154-167) lerp-interpolates between adjacent stops.
- `cr.show(0, 0, width, height)` (169-174) paints the background as a vertical colour ramp: one horizontal `line()` per pixel row, stroked with `getColor(i/w)`. This is what shows through at the borders.
- The triangle branch (20-53) is dead code: `random(1) > 1` is never true.
- The live branch (55-71) draws the square grid: `cc = int(random(3, 100*random(1)))` (58) picks a random cell count; `tt = width/cc` (59) is the cell size. The loop runs i, j from -2 to cc/2 (60-61) and each cell is filled with a random ramp color (62) and drawn four times mirrored about the centre (66-68, with `rectMode(CENTER)` at 57) — hence the 4-fold symmetry and the full-bleed coverage.
- Grain (89-94): for every pixel, a white `point()` with alpha `random(22)*random(1)` (i.e. up to ~22). This washes out the grid; it is the dominant visual softener.
- The `createGraphics` copy (73-76) is vestigial (its target was the commented-out noise-warp block 78-87 using `getSmooth`, 97-105); the warp is inactive.
- Randomness enters at: the four ramp colors (115-118), `cc` (58), every cell fill (62), and every grain alpha (91). Deterministic under `--seed 42`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_12 | `int cc = int(random(3, 100*random(1)));` -> `int cc = 12;` | moderate | much coarser grid (~12 columns); same four-colour palette, grain and 4-fold symmetry | variants/cc_12/frame_00001.png |
| cc_80 | `int cc = int(random(3, 100*random(1)));` -> `int cc = 80;` | large | fine ~8px cells, much busier texture, same palette/symmetry | variants/cc_80/frame_00001.png |
| speckle_80 | `stroke(255, random(22)*random(1));` -> `stroke(255, random(80)*random(1));` | subtle | subtle: barely stronger white veil, grid still clearly readable | variants/speckle_80/frame_00001.png |
| speckle_0 | `stroke(255, random(22)*random(1));` -> `stroke(255, 0);` | subtle | no visible change; alpha-0 points are transparent and draw nothing | variants/speckle_0/frame_00001.png |
| palette_bw_red | all four `cr.addColor(color(random(255),...), ...)` lines -> fixed white(0), red(0.5), near-black(1) stops | large | palette becomes black/maroon/red/pink/cream; removing the random() calls also shifted the RNG stream, so the random grid count changed too (coarser, ~7 columns) | variants/palette_bw_red/frame_00001.png |

## Modularisation notes
Three generic blocks: the `ColorRamp` class (random-stop lerp gradient + full-bleed `show`) is reusable as-is; the 4-fold mirrored grid (55-71) is a small generic "symmetric tiling" primitive parameterised by cell count and per-cell drawing; the grain overlay (89-94) is a one-liner `maxAlpha` parameter. One-off art decisions: the dead triangle branch, the vestigial `createGraphics`/`getSmooth` warp, and the specific choice of rect fills from the ramp. A clean parameter object: `{rampStops: [4 colors + positions], gridCount: int, grainMaxAlpha: float}`.
