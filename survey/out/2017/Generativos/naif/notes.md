---
sketch: 2017/Generativos/naif
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1472
animated: false
techniques: [subdivision, grid]
primitives: [rect, shape]
palette:
  colors: ["#f13434", "#8e41bd", "#ffe931", "#fe96c7", "#f7f6f6", "#63d596", "#ff7e38", "#42b1ff"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub_max, default: 500, tried: [2000], change: large, effect: "raises the max subdivision count 4x; at seed 42 baseline the count lands near zero so it looks near-empty, but 2000 gives a busy full-bleed mosaic of colored squares with corner arcs (four-pointed stars where four arcs meet)"}
  - {name: mul, default: "1|2", tried: ["2 (always)"], change: large, effect: "forces the 2x arc size; the single visible lower-left arc nearly doubles in radius and covers more of the canvas, layout otherwise unchanged"}
  - {name: four_corners_p, default: 0.1, tried: [0.5], change: none, effect: "no visible change at seed 42 (very few rects, so the branch that draws all four corners is effectively never reached)"}
  - {name: split, default: 0.5, tried: [0.7], change: none, effect: "no visible change at seed 42 (so few rects get subdivided that the uneven horizontal split is not exposed)"}
  - {name: palette, default: "bright-8", tried: ["muted-5"], change: moderate, effect: "swaps the 8 bright colors for a muted 5-color set (near-black, cream, red, green, steel-blue); same sparse layout, every color desaturated"}
reusable_candidates:
  - {name: subdivideRect, signature: "subdivideRect(rects, iterations) -> Rect[]", note: "randomly pick a rect, split into 4 quadrants, remove original, repeat N times"}
  - {name: cornerArc, signature: "cornerArc(x, y, w, h, dir, mul) -> void", note: "draw a quarter-circle arc in one of the 4 corners of a rect"}
---

## What it draws
Seed 42 produces a mostly flat composition: a single bright-yellow field fills the whole canvas with one large sky-blue quarter-circle occupying the lower-left corner. The image reads as near-empty because the random subdivision count landed near zero for this seed, leaving only a background rectangle and a single oversized arc.

## How the code works
`setup()` sets a 960x960 P2D window and calls `generate()` once (line 7); `draw()` is empty, so the piece is static (line 11-13). `generate()` (line 38) fills the background with a random palette colour (line 39), seeds a list with the full canvas rect (line 42), then runs a random number `sub` (0..499, line 44) of subdivision steps. Each step picks a random existing rect (line 46) and splits it into four quadrants at half width/height (lines 48-53), adding all four and removing the parent (line 54). After subdivision it loops over every surviving rect (line 59): it picks a background colour and a foreground colour that differ (lines 61-63), and with 80% probability paints the rect as a solid background fill (line 65-68) and, with 80% probability again, paints a foreground arc. The arc is either four corners at once with 10% probability (line 71-75) or a single random corner (line 78) whose size is multiplied by `mul` = 1 or 2 (line 77). `cuarto()` (line 86) maps `dir` 0-3 to one of the four quadrant arcs of the rect. Colour is chosen uniformly at random from the 8-colour `colors[]` list (line 98-100). No blend modes, no noise, no transforms beyond the arc geometry.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_max_2000 | `int sub = int(random(500)*random(1)*random(1));` -> `int sub = int(random(2000)*...);` | large (mean 0.2855, 0.918) | busy full-bleed mosaic: many colored squares, each with corner quarter-circle arcs; where four arcs meet a shared corner they form four-pointed stars | variants/sub_max_2000/frame_00001.png |
| mul_2 | `int mul = (random(1) < 0.5)? 1 : 2;` -> `int mul = (random(1) < 0.0)? 1 : 2;` | large (mean 0.261, 0.59) | same sparse yellow-field layout, but the single lower-left blue arc is much larger (doubled radius), filling more of the bottom-left | variants/mul_2/frame_00001.png |
| four_corners_p_0.5 | `if (random(1) < 0.1) {` -> `if (random(1) < 0.5) {` | none (mean 0.0, 0.0) | no visible change (identical to baseline) | variants/four_corners_p_0.5/frame_00001.png |
| split_0.7 | `float nw = r.w*0.5;` -> `float nw = r.w*0.7;` | none (mean 0.0, 0.0) | no visible change (identical to baseline) | variants/split_0.7/frame_00001.png |
| palette_dark | `int colors[] = {#f13434, ...};` -> `int colors[] = {#280f04, #e2dcd0, #bf1a2b, #417f5c, #6898c1};` | moderate (mean 0.1325, 0.999) | same sparse layout, colors now muted: cream field with a steel-blue lower-left arc (instead of bright yellow/sky-blue) | variants/palette_dark/frame_00001.png |

## Modularisation notes
The generic core is the subdivision loop: start from the full-canvas rect and repeatedly split a random rect into four quadrants, which is a reusable `subdivideRect(rects, iterations)` returning the surviving list. `cornerArc(x,y,w,h,dir,mul)` is a clean reusable primitive for drawing a quarter-circle in a rect corner. The rest — the 80%/80%/10% paint probabilities, the `mul` 1|2 size jitter, and the random two-colour pick per rect — are one-off art decisions that should live in a small parameter object: `{subMax, bgPaintP, fgPaintP, fourCornersP, mulSet, palette}`. `getColor()` (line 101) is an unused lerp-between-palette helper, a candidate to keep or drop.
