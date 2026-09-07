---
sketch: 2019/generativos/bebo
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1566
animated: false
techniques: [grid, lines-hatching]
primitives: [rect]
palette:
  colors: ["#241B15", "#9E9F97", "#D8D8D0", "#FE4D7B", "#003F7F"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: 20, tried: [10], change: large, effect: "finer dot grid and 10px snap step -> denser fine texture, smaller squares"}
  - {name: count, default: 60, tried: [120], change: large, effect: "twice as many tunnels -> much denser, busier overlapping web, background barely visible"}
  - {name: steps, default: 700, tried: [1500], change: subtle, effect: "more squares per tunnel -> slightly denser, more continuous ribbons; overall look barely changes"}
  - {name: stroke_alpha, default: 180, tried: [60], change: moderate, effect: "fainter strokes -> washed-out, translucent, pink-dominant look"}
  - {name: lerp_exponent, default: 0.6, tried: [1.0], change: large, effect: "linear spacing along path -> even square ribbons instead of clusters bunched at the start"}
reusable_candidates:
  - {name: squareTunnel, signature: "squareTunnel(x1, y1, s1, x2, y2, s2, steps, exponent, strokeColor) -> void", note: "draws N stroked squares lerp'd between two grid-snapped anchors, size interpolated, position biased by pow() exponent"}
  - {name: dotGrid, signature: "dotGrid(cellSize, dotSize, color, alpha) -> void", note: "evenly spaced small rects across the full canvas at low alpha"}
---

## What it draws

A dark near-black (#241B15) canvas overlaid with a faint uniform grid of tiny white dots. On top, roughly sixty "tunnels" of thin stroked squares are traced between pairs of random grid-snapped points. Each tunnel starts as a larger square at one end and shrinks (or grows) to a smaller square at the other, with the squares densely packed near the start and spread toward the end. The result is a dense, woven, hatched fabric of overlapping square outlines in grey, off-white, vivid pink (#FE4D7B), and dark blue (#003F7F) that reads as a complex angular, crystalline web across the full frame.

## How the code works

`setup()` calls `generate()` once (line 24). `generate()` first paints the background `#241B15` (line 50) and then loops `grid`-spaced positions across the canvas drawing a 2×2 white rect at alpha 14 (lines 54–58) — this is the subtle dot grid.

The main loop runs 60 iterations (line 60). Each iteration:
- picks two sizes `s1`, `s2` as random multiples of `grid` (1–9 cells → 20–180 px) (lines 61–62);
- picks two anchor points `(x1,y1)`, `(x2,y2)` and snaps each coordinate down to the nearest multiple of its size (lines 65–73);
- draws 700 stroked squares (`noFill()`, `stroke(rcol(), 180)`) along a path from anchor 1 to anchor 2. The lerp parameter `vv` is `pow(map(k,0,20,0,1), 0.6)`, which compresses the first ~20 steps near the start and spreads the rest (line 90). Square size is `lerp(s1, s2, vv)` (line 93), so each square in the tunnel interpolates in size. Stroke color is a random palette entry at alpha 180 (line 88).
- stamps two 2×2 white dots at the two anchors (lines 137–138).

The palette `colors[]` (line 147) has 5 entries; `rcol()` (line 148–150) picks a random index each call. `triangulate` and `SimplexNoise` are imported but never used in this sketch.

The sketch is static: `draw()` is empty (line 32); `keyPressed` regenerates with a new seed only on manual keypress.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_10 | `int grid = 20;` -> `int grid = 10;` | large | much finer dot grid; squares snap to 10px so the whole web reads finer and denser, with more small squares and tighter hatching | variants/grid_10/frame_00001.png |
| count_120 | `for (int i = 0; i < 60; i++) {` -> `... i < 120 ...` | large | double the tunnels; image is far busier, dark background mostly covered by overlapping pink/white/blue square webs | variants/count_120/frame_00001.png |
| steps_1500 | `for (int k = 0; k <= 700; k++) {` -> `... k <= 1500 ...` | subtle | squares more densely packed along each path; ribbons look slightly more continuous but overall composition nearly the same | variants/steps_1500/frame_00001.png |
| stroke_alpha_60 | `stroke(rcol(), 180);` -> `stroke(rcol(), 60);` | moderate | strokes much fainter; web looks translucent and washed out, pink dominates, white/grey strokes nearly disappear | variants/stroke_alpha_60/frame_00001.png |
| lerp_exponent_1.0 | `float vv = pow(map(k, 0, 20, 0, 1), 0.6);` -> `... , 1.0);` | large | squares spread evenly along each path instead of clustering at the start; tunnels read as smooth even ribbons/funnels | variants/lerp_exponent_1.0/frame_00001.png |

## Modularisation notes

The square-tunnel primitive (lines 60–139) is the reusable core: given two grid-snapped anchors and two sizes it draws a sequence of stroked squares whose position and size are lerp'd with a power-curve bias. Parameterising the step count, exponent, stroke colour, and alpha would make it a library function.

The dot-grid background (lines 53–58) is a trivial, self-contained helper worth factoring out separately.

The palette is a fixed 5-colour array chosen at random per stroke; a clean parameter object would carry the palette list, the count of tunnels, the grid size, the per-tunnel step count, the lerp exponent, and the stroke alpha.

The commented-out `beginShape(QUADS)` block (lines 98–129) was an earlier filled-polygon version of the tunnel; it is dead code. The `getColor()`/`getColor(float)` functions (lines 151–159) implement noise-driven palette lerp but are unused.
