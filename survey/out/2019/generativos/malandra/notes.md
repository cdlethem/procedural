---
sketch: 2019/generativos/malandra
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1509
animated: false
techniques: [subdivision, grid, symmetry]
primitives: [rect, shape]
palette:
  colors: ["#638995", "#6A9796", "#FC9371", "#CD061A", "#470F0E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grainCount, default: 90, tried: [300], change: large, effect: "denser, larger pixel clusters; also shifts the random stream so the block tiling becomes coarser"}
  - {name: splitIterations, default: 60, tried: [120], change: large, effect: "finer mosaic of smaller flat blocks"}
  - {name: trapezoidsPerRect, default: 10, tried: [3], change: large, effect: "much less glassy overlay; flat blocks read clearly"}
  - {name: spreadRange, default: "random(2, 8)", tried: ["random(8, 20)"], change: moderate, effect: "bigger, more elongated translucent trapezoids sweeping across the blocks"}
  - {name: trapezoidAlphaMax, default: 180, tried: [60], change: moderate, effect: "trapezoids far more transparent; flatter, more saturated blocks show through"}
  - {name: paletteReds, default: "#CD061A x3", tried: ["#1F4E79 x3"], change: large, effect: "blue replaces red as the dominant colour, same structure"}
reusable_candidates:
  - {name: quadSplit, signature: "quadSplit(rects, iterations, ratioMin, ratioMax) -> List<Rect>", note: "repeatedly pick a rect, split it into 4 children with a random split ratio, biased toward recently added rects"}
  - {name: mirrorTrapezoids, signature: "mirrorTrapezoids(cx, cy, w, h, count, spread, alpha) -> void", note: "stack of center-anchored mirrored trapezoids fading via per-vertex alpha"}
---

## What it draws
Full-bleed abstract composition on a white ground. Large flat blocks in bright red, dark maroon, slate blue-gray and gray-teal tile the canvas in an irregular, non-uniform grid; over them float many semi-transparent, slightly skewed trapezoids that overlap into a layered, glassy texture, with the colors blending toward mauve and dusty rose where red and teal cross. Small clusters of solid pixel-sized squares sit in the upper-left and mid-right, and the center is the busiest area where many translucent layers stack.

## How the code works
`setup()` calls `generate()` (lines 21-29); `draw()` is empty, so the piece is static. `generate()` (lines 51-155) seeds `randomSeed`/`noiseSeed` from `seed` (53-54) and paints a white background (56). Three passes:

1. **Grain layer** (lines 60-75): 90 small squares with side `ss = pow(2, int(random(1,9)))` (64), position snapped to the `ss` grid (65-68), filled with `rcol()`. These produce the pixel clusters.
2. **Subdivision** (lines 77-90): starts from one inset rect (10,10,width-20,height-20, line 61). 60 times it picks an index in the 60-80% range of the growing list (78) — i.e. it tends to split recently added, smaller rects — and replaces it with 4 children whose split ratio is `lerp(random(0.2,0.8), 0.5, random(1))` ≈ 0.35-0.65 (81-82). Ends with ~241 axis-aligned rects tiling the canvas; their edges are visible as the blocky grid in the image.
3. **Render pass** (lines 92-154): for every rect, 10 trapezoids (99-131): a center-anchored half-size square (100-105) expanded by a random factor `dis` in 2..8 (107), randomly mirrored horizontally/vertically (115-118), drawn with per-vertex fill alpha going from `random(180)` to 0 (124-129) — this is what makes each shape fade and the overlaps look glassy. Then with 50% chance (135) the rect itself is painted as two triangles: one fully opaque `rcol()` and one at alpha 220 (136-153), giving the flat blocks with a subtly lighter half.


## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grain_300 | `for (int i = 0; i < 90; i++)` -> `i < 300` | large (mean 0.1633, 0.728) | much denser and larger pixel clusters (top-left, mid, mid-right); the extra random draws also shift the random stream, so the flat-block tiling is coarser/different | variants/grain_300/frame_00001.png |
| splits_120 | `for (int i = 0; i < 60; i++)` -> `i < 120` | large (mean 0.16, 0.692) | finer mosaic: many smaller flat teal/red/maroon blocks, grain clusters unchanged in spirit, glassy layer still present | variants/splits_120/frame_00001.png |
| trap_3 | `for (int j = 0; j < 10; j++)` -> `j < 3` | large (mean 0.201, 0.779) | glassy trapezoid overlay largely gone; image reads as flat tiled blocks with only faint translucent wedges | variants/trap_3/frame_00001.png |
| spread_20 | `int dis = int(random(2, 8));` -> `random(8, 20)` | moderate (mean 0.0637, 0.245) | trapezoids visibly larger and more elongated, sweeping diagonally across whole blocks; composition otherwise the same | variants/spread_20/frame_00001.png |
| alpha_60 | `fill(col, random(180));` -> `random(60)` | moderate (mean 0.066, 0.244) | trapezoids far more transparent; flat saturated red/teal blocks show through, overall flatter and lighter | variants/alpha_60/frame_00001.png |
| palette_blue | `#CD061A, #CD061A, #CD061A` -> `#1F4E79, #1F4E79, #1F4E79` | large (mean 0.1813, 0.758) | blue now dominant instead of red; peach and maroon accents remain; structure identical | variants/palette_blue/frame_00001.png |

## Modularisation notes
- **Generic / library-ready:** the quad-split routine (77-90) is a self-contained recursive subdivision with tunable iteration count and split-ratio range — a good `quadSplit` primitive. The mirror-trapezoid stack (99-131) is a reusable `mirrorTrapezoids` overlay given a center/size and per-shape alpha.
- **One-off art decisions:** the grain-square pass (60-75), the 3-weighted-red palette (182), the two-triangle half-opaque rect fill (136-153), and the inset margin of 10 px (61).
- **Parameter object:** `{seed, grainCount (90), grainMaxExp (9), splitIterations (60), splitRatioRange [0.2,0.8], trapezoidsPerRect (10), spreadRange [2,8], trapezoidAlphaMax (180), blockAlpha (220), palette[]}`.
