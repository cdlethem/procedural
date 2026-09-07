---
sketch: 2020/generative/05_08/tractrac
year: 2020
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1735
animated: false
techniques: [image-source, dots-stippling]
primitives: [image]
palette:
  colors: ["#B85807", "#FAC440", "#F4C8BF", "#A0B9A6", "#A1B2EA"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 300, tried: [100, 1000], change: moderate, effect: "lower = sparser field with more background showing and clearer per-stamp triangle grids; higher = denser finer mosaic, stronger colour pooling"}
  - {name: alphaMax, default: 200, tried: [60], change: moderate, effect: "lower = very pale washed-out field, background dominates, colour hints only"}
  - {name: scaleMax, default: 0.8, tried: [2.0], change: moderate, effect: "higher = much larger triangles, coarser mosaic, stamp grid clearly legible"}
  - {name: colors, default: "#B85807,#FAC440,#F4C8BF,#A0B9A6,#A1B2EA", tried: ["#2B349E,#F57E15,#ED491C,#9B407D,#B48DC0"], change: large, effect: "full recolor: indigo/plum/orange instead of burnt-orange/amber pastels"}
reusable_candidates:
  - {name: scatterStamps, signature: "scatterStamps(img, count, maxScale, alphaMax, palette, rng) -> PGraphics", note: "randomly scatter tinted, rotated, scaled stamps over the canvas"}
---

## What it draws
A full-bleed, soft pastel field made of hundreds of small overlapping triangular "eye" stamps in warm burnt-orange and amber, with pale pink, sage-green, and periwinkle-blue accents. The stamps are randomly rotated and sized (mostly small), tinted at low alpha, so they layer into a hazy, watercolour-like mosaic with no focal point; denser orange clusters drift across a pale bluish ground. Static: frames 10 and 60 are identical to frame 1.

## How the code works
`setup()` loads `eye1.png` into `eyes[0]` (`eyesCount = 1`, line 25; only `eyes[0]` is ever used, line 69) and loads `blur.glsl`, but the shader is only applied inside a commented-out block (lines 83-95), so it has no effect on the output. `generate()` (lines 60-98) sets `randomSeed(seed)`/`noiseSeed(seed)` (lines 65-66, seed from line 4) and runs a loop of 300 iterations (line 70): each picks a random position (`random(width)`, `random(height)`, lines 71-72), a size `s = random(0.8)*random(0.2, 1)` (line 73, so 0-0.8 of the stamp's native size, biased toward small), a full random rotation (line 76), and a tint of a random palette colour at random alpha 0-200 (line 77, `rcol()` line 115-117 picks uniformly from the 5 colours in `colors[]` line 111). The stamp is drawn centered and scaled (lines 78-79). Because alpha is capped at 200 and stamps overlap heavily, the composition reads as a translucent stipple texture rather than discrete marks. `draw()` is empty (line 49) so the piece is static; any other key press re-rolls the seed and regenerates (lines 52-58).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_100 | `for(int i = 0; i < 300; i++){` -> `for(int i = 0; i < 100; i++){` | moderate (mean 0.0653, 0.191 of pixels) | sparser field: more of the pale background shows between stamps and each stamp's little triangle grid is more visible; same warm orange/amber palette, weaker pooling | variants/count_100/frame_00001.png |
| count_1000 | `for(int i = 0; i < 300; i++){` -> `for(int i = 0; i < 1000; i++){` | moderate (mean 0.091, 0.389 of pixels) | denser and finer: the whole canvas is covered in a tight mosaic of tiny triangles, background almost fully hidden, colour pooling stronger | variants/count_1000/frame_00001.png |
| alpha_60 | `tint(rcol(), random(200));` -> `tint(rcol(), random(60));` | moderate (mean 0.0574, 0.118 of pixels) | very washed-out: faint pale yellow/cream ground with only ghostly hints of orange, green and blue; the triangle pattern is barely visible | variants/alpha_60/frame_00001.png |
| scale_2.0 | `float s = random(0.8)*random(0.2, 1);` -> `float s = random(2.0)*random(0.2, 1);` | moderate (mean 0.0847, 0.345 of pixels) | much larger triangles: coarse mosaic with clearly legible stamp grids and big diagonal bands of warm amber over pale blue | variants/scale_2.0/frame_00001.png |
| palette_cool | `int colors[] = {#B85807, #FAC440, #F4C8BF, #A0B9A6, #A1B2EA};` -> `int colors[] = {#2B349E, #F57E15, #ED491C, #9B407D, #B48DC0};` | large (mean 0.1637, 0.882 of pixels) | complete recolor: indigo and plum triangles around a saturated orange-red centre; same composition, entirely different mood | variants/palette_cool/frame_00001.png |

## Modularisation notes
The generic block is the scatter loop in `generate()` (lines 69-80): given a stamp image, count, scale distribution, rotation range, palette, and alpha cap, it produces the composition — a natural `scatterStamps` library function. The commented-out GLSL blur loop (lines 83-95) is a separate reusable "iterative directional blur" pattern, worth extracting if a P2D renderer can run it. One-off art decisions: the specific 5-colour palette, the `eye1.png` stamp asset, the double-random scale distribution `random(0.8)*random(0.2,1)`, and the alpha cap of 200. A clean parameter object: `{stamp, count, scaleMax, scaleMin, alphaMax, palette, seed, canvasSize}`.
