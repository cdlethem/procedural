---
sketch: 2018/Generativos/repasador
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1538
animated: false
techniques: [noise-field, grid, distortion, blend-modes]
primitives: [line, shape]
palette:
  colors: ["#E6E7E9", "#F0CA4B", "#F07148", "#EECCCB", "#2474AF", "#107F40", "#231F20"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(300,360)*0.3)" (≈90-107), tried: ["*0.6" (≈180-215)], change: large, effect: "grid doubles in density; thin bright mesh covers the whole canvas, circles still readable"}
  - {name: strokeWeightH, default: 5, tried: [1], change: large, effect: "horizontal stripes lose their dominance; grid reads as a uniform fine mesh, less contrast with verticals"}
  - {name: des, default: 30, tried: [90], change: large, effect: "much stronger warp: grid ripples into large smooth waves, canvas edge visibly buckled"}
  - {name: detAng, default: "random(0.002,0.01)*0.05", tried: ["random(0.002,0.01)*0.2"], change: large, effect: "higher-frequency angle noise: lines fan into dense vertical striations, image blurs into color bands, circles nearly invisible"}
  - {name: circleCount, default: 10, tried: [20], change: subtle, effect: "subtle: a few extra overlapping circles in the center; first 10 identical (same random draws), grid unchanged"}
reusable_candidates:
  - {name: desform, signature: "desform(x, y, angOffset, angScale, desOffset, desScale) -> PVector", note: "2-D simplex noise field mapping a point to a displaced point (angle + magnitude)"}
  - {name: paletteLerp, signature: "getColor(t) -> color", note: "lerp along a fixed color list by a scalar in [0,1)"}
---

## What it draws
A near-black canvas filled with a fine, slightly wobbly grid of thin lines: horizontal
lines are thicker (stroke weight 5) than vertical ones (weight 2), so the mesh reads as
horizontal stripes with a fine cross-hatch. The line color sweeps smoothly through a
7-color palette (cream, yellow, orange, pink, blue, green, near-black) in diagonal
bands, so the whole field shifts hue from warm at the top to cool at the bottom.
Overlaid in the center are about ten filled circles of random palette colors, sized
5-50% of the width; the circles themselves are noise-wobbled (their outlines are
built from a fan of small triangles, each vertex displaced by the same noise field).

## How the code works
`setup()` calls `generate()` once (static sketch; `draw()` is empty). With
`blendMode(ADD)` and a `#010101` background:

- Line 40: `cc = int(random(300, 360)*0.3)` — number of grid lines per direction
  (≈90-108). Lines are spaced `(width - 2*bb)/cc` apart, `bb = 20` margin (lines 41-42).
- Lines 49-52: horizontal lines, `strokeWeight(5)`, each drawn as a polyline
  (`nline`, lines 87-96) of one vertex per pixel, every vertex displaced by `desform`.
- Lines 54-58: vertical lines, same but `strokeWeight(2)`.
- Line 50/56: per-line color `getColor(ic + dc*j)` — a value walk along the palette
  list (`getColor(float)`, lines 121-127 lerps between adjacent entries), so color
  changes gradually with the line index.
- `desform` (lines 103-107): two simplex-noise samples — one for a rotation angle
  (scale `detAng = random(0.002, 0.01)*0.05`) and one for a displacement magnitude
  (`detDes = random(0.002, 0.01)*0.2`, magnitude up to 30 px) — producing a smooth
  warp of the whole grid.
- Lines 60-64: 10 filled circles (`rcol()`, random palette entry) placed in the
  central 25-75% of the canvas, radius 2.5-25% of width. The `circle` helper
  (lines 67-85) draws a fan of `max(8, r*PI)` triangles from a displaced center to
  displaced rim vertices, so each circle edge is noise-wobbled like the grid lines.
- ADD blending makes overlapping line/circle coverage brighter, which is why the
  grid reads as luminous stripes on black.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_x2 | `int cc = int(random(300, 360)*0.3);` -> `... *0.6);` | large | dense fine grid covering the canvas (≈2x lines); circles in center still clear | variants/cc_x2/frame_00001.png |
| strokeWeight_1 | `strokeWeight(5);` -> `strokeWeight(1);` | large | horizontal lines as thin as verticals; uniform mesh, no dominant stripes | variants/strokeWeight_1/frame_00001.png |
| des_90 | `...*30;` -> `...*90;` in desform | large | strong ripples; whole grid undulates, canvas border buckled | variants/des_90/frame_00001.png |
| detAng_x4 | `detAng = random(0.002, 0.01)*0.05;` -> `...*0.2;` | large | fast angle noise: dense vertical striations, color bands, circles blurred out | variants/detAng_x4/frame_00001.png |
| circles_20 | `for(int i = 0; i < 10; i++){` -> `i < 20` | subtle | a few extra circles overlaid in the center; rest of image unchanged | variants/circles_20/frame_00001.png |

## Modularisation notes
- `desform` is fully generic: a 2-D noise-field displacement (angle + magnitude,
  independent noise octaves) — a strong library candidate for distorting any
  polyline or shape.
- `getColor(t)` palette-lerp is generic and reusable with any fixed color list.
- The grid-of-wobbly-lines pass (horizontal + vertical polylines through `desform`)
  is a reusable "distorted grid" primitive parameterised by line count, weight,
  color walk, and displacement strength.
- One-off art decisions: the specific 7-color palette, circle placement/size ranges,
  ADD blending, and the 20 px margin. A clean parameter object:
  `{cc, weightH, weightV, margin, angScale, desScale, circleCount, circleSizeRange, palette, blend}`.
