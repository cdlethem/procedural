---
sketch: 2019/generativos/inside
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3154
animated: false
techniques: [recursion, subdivision, grid, dots-stippling]
primitives: [rect, point]
palette:
  colors: ["#1100FF", "#FF2200", "#2F3034", "#FFC338", "#CAC9C5"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: bb, default: 8, tried: [16], change: large, effect: "larger cell unit -> fewer, larger subdivisions; grain becomes sparse and faint on a mostly-white field"}
  - {name: div, default: 50000, tried: [300], change: large, effect: "fewer subdivision steps -> a few large readable Mondrian blocks, much lighter grain, airy"}
  - {name: grain (w*h multiplier in shadow), default: 1.0, tried: [0.01], change: large, effect: "100x fewer shadow points -> blocks stop filling; only a sparse scattered dot field remains"}
  - {name: colors palette, default: "1100FF,FF2200,2F3034,FFC338,CAC9C5", tried: ["EF9F00,E56300,D15A3D,D08C8B,68376D"], change: large, effect: "warm orange/purple palette replaces the cool blue dominance; structure unchanged"}
  - {name: shadow point alpha, default: 150, tried: [40], change: large, effect: "lower point alpha -> paler, more translucent grain; white shows through, washed-out pastel"}
reusable_candidates:
  - {name: recursiveSubdivide, signature: "recursiveSubdivide(rect, depth, cellUnit) -> Rect[]", note: "randomly subdivide a rect into 4 (or 1 inset) children, Mondrian-style"}
  - {name: pointShadow, signature: "pointShadow(x, y, w, h, grain, alpha) -> void", note: "scatter w*h random points over a rect to make a grainy stipple wash"}
---

## What it draws
A Mondrian-style composition of nested rectangles filling the whole 960x960 canvas: large flat
blocks in blue, red-orange, cream and dark charcoal, each subdivided into smaller offset
rectangles with a visible gap between parent and child. The entire surface is then buried under a
dense blue pointillist grain that gives every block a rough, stippled, almost screen-printed
texture; the blue wash dominates, with red, orange and cream blocks breaking through it.

## How the code works
`setup()` -> `generate()` (inside.pde:24). `generate()` seeds RNG (58-59), clears to white (61),
starts with one full-canvas `Rect` (66), then runs a loop of `div = int(random(50000))`
subdivision steps (69-70). Each step picks a random rect from the list (71), splits it either into
four offset children (79-87, probability `0.3*random(random(10))`) or into one inset child
(89), using a cell unit `bb = 8` (63) and a border `bw = bb*pow(2, ...)` (77) as the gap.
Before removing the parent it calls `shadow(...)` (92), which scatters `w*h` random `point()`s
(105-112) in a random palette colour at alpha ~150 (line 104). The two `fill(...)` calls (93, 96)
are set but the actual `rect()` draw calls (94, 97) are commented out, so the ONLY visible output
is the shadow stipple points. Colours come from `rcol()` (131-133), a random pick from the
5-colour `colors[]` array (126). The blue dominance in the baseline comes from the sheer density of
overlapping semi-transparent points saturating the surface. Static: `draw()` is empty (32-33);
frames 1/10/60 identical.

## Experiments
| variant | substitution | change score | observation | image |
| bb_16 | `float bb = 8;` -> `float bb = 16;` | large (0.204, 0.784 px) | far sparser: faint multicoloured speckle on a mostly-white field; larger gaps, fewer visible blocks | variants/bb_16/frame_00001.png |
| div_300 | `int div = int(random(50000));` -> `int div = 300;` | large (0.1554, 0.72 px) | a few large readable Mondrian blocks in pale blue/red/cream/grey; much lighter grain, airy | variants/div_300/frame_00001.png |
| grain_0.01 | `w*h*1.0` -> `w*h*0.01` | large (0.4587, 0.996 px) | 100x fewer points: blocks no longer fill; only a sparse scattered coloured-dot field on white | variants/grain_0.01/frame_00001.png |
| palette_warm | `int colors[] = {#1100ff, #FF2200, #2F3034, #FFC338, #CAC9C5};` -> `{#EF9F00, #E56300, #D15A3D, #D08C8B, #68376D};` | large (0.2482, 0.878 px) | same structure, now dominated by warm orange/amber/red/purple instead of cool blue | variants/palette_warm/frame_00001.png |
| alpha_40 | `stroke(rcol(), 150*random(0.7, 1));` -> `stroke(rcol(), 40*random(0.7, 1));` | large (0.2445, 0.955 px) | paler, more translucent grain; white shows through, washed-out pastel version of baseline | variants/alpha_40/frame_00001.png |

## Modularisation notes
- `recursiveSubdivide` (the 69-100 loop) is generic: given a rect, a subdivision count, a cell
  unit `bb`, and a 4-way vs inset probability, it produces a Mondrian hierarchy. Parameter object:
  `{rect, steps, cellUnit, fourWayProb, borderExp}`.
- `pointShadow` (103-113) is generic and independent: `{x,y,w,h, grain, alpha}` -> stipple wash.
  The `w*h` point count is the main cost driver; it is what produces the grain and also the render
  time.
- `rcol`/`getColor` palette selection is a one-off art decision (fixed 5-colour array).
- The whole thing is a two-stage composition: structure (rect hierarchy) then texture (stipple),
  cleanly separable into library functions.
