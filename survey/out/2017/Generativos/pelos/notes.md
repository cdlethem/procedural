---
sketch: 2017/Generativos/pelos
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 958
animated: false
techniques: [subdivision, noise-field, lines-hatching]
primitives: [line, pgraphics]
palette:
  colors: ["#155263", "#FF6F3C", "#FF9A3C", "#FFC93C"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: "random(1000)", tried: ["random(200)"], change: large, effect: "fewer subdivision iterations: fewer, larger tiles and a much darker overall tone (fewer light tiles)"}
  - {name: sub, default: "random(2, 5)", tried: ["random(2, 9)"], change: large, effect: "splits into up to 8 slices: many smaller tiles, fine comb-like stripes in the corners"}
  - {name: d, default: "random(14, 20)", tried: "random(30, 40)", change: moderate, effect: "longer hairs: softer, flowing fur, less grainy, whole image slightly darker"}
  - {name: hairDensity, default: "w*h*random(0.7, 1.2)", tried: "w*h*random(2, 3)", change: large, effect: "~3x stroke density: fur goes near-black, only a few light patches remain"}
  - {name: strokeAlpha, default: 70, tried: 150, change: large, effect: "higher stroke alpha: much denser, darker fur, tile boundaries stand out more"}
  - {name: det1, default: "random(0.02)", tried: "random(0.06)", change: moderate, effect: "higher angle-noise detail: smaller, busier local swirls; finer mottled texture"}
reusable_candidates:
  - {name: splitRects, signature: "splitRects(x, y, w, h, iterations, maxSplits, minSlice) -> Rect[]", note: "random quadtree-ish subdivision: repeatedly split a random rect into 2-4 equal slices along its longer-or-random axis"}
  - {name: hairField, signature: "hairField(w, h, countPerPx, length, detail) -> PGraphics", note: "per-rect noise-directed short strokes (angle + displacement from 2D Perlin)"}
---

## What it draws
A white square canvas packed with a mosaic of axis-aligned rectangles of varying sizes (a thin white
margin frames the whole thing). Every rectangle is filled with a dense field of very short, black,
low-alpha hair-like strokes whose direction is organized by noise: some tiles read as light gray
fur, others as dark, almost solid patches, and the swirls of the hairs form local vortices and
combs. The overall impression is a patchwork of animal-fur tiles in grayscale.

## How the code works
- `setup()` (pelos.pde:3-8): 960x960, `smooth(8)`, then `generate()` once; `draw()` is empty, so
  the piece is static.
- Subdivision (pelos.pde:34-62): starts from one rect inset by `bb = 16` from the edges.
  Repeats `cc` times (seed 42 gives a random count 0-999 from `int(random(1000)*random(1)*random(1))`):
  pick a random rect, split it into `sub = random(2, 5)` -> 2/3/4 equal slices (horizontal or
  vertical with 50/50), keeping only the split if each slice is wider than 5 px. This builds the
  mosaic of tiles; more iterations -> smaller tiles.
- Hair field (pelos.pde:64-93): for every surviving rect, a `PGraphics` of exactly the rect's size is
  created on white background. `rnd` is forced to 1 (line 70), so every tile gets hairs. For
  `ccc = w*h*random(0.7, 1.2)` strokes (count proportional to tile area, so density is uniform per
  tile): a point is drawn at random position, angle from `noise(des + x*det1, des + y*det1)`, and
  displacement from a second independent noise channel scaled to `d = random(14, 20)` px stroke
  length. `des` is a random per-tile noise offset (line 74), so each tile's swirl pattern is
  unrelated to its neighbors. Strokes use `stroke(0, 70)` — black at ~27% alpha — so darkness is
  purely a function of how much the noise-driven strokes overlap: where the field curls, strokes
  pile up and the tile goes near-black; in straighter flow it stays light gray.
- The color array at line 102 (#155263, #FF6F3C, #FF9A3C, #FFC93C) and the `rcol`/`getColor`
  helpers are dead code in the baseline: the only place they are used (line 87) is commented out,
  which is why the baseline renders monochrome black-on-white.
- Randomness enters via the global seed (line 1, harness-seeded to 42): subdivision choices,
  per-tile noise offset `des`, details `det1`/`det2`, length `d`, and stroke count.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `int cc = int(random(1000)*random(1)*random(1));` -> `...random(200)...` | large (mean 0.1536, 0.562) | fewer, larger tiles; overall much darker, only a few light tiles left | variants/cc_200/frame_00001.png |
| sub_9 | `int sub = int(random(2, 5));` -> `int sub = int(random(2, 9));` | large (mean 0.1848, 0.605) | many more, smaller tiles; fine striped/comb texture, esp. top-right and bottom-left | variants/sub_9/frame_00001.png |
| d_30 | `float d = random(14, 20);` -> `float d = random(30, 40);` | moderate (mean 0.1036, 0.425) | clearly longer hairs: soft, flowing fur, less grainy, slightly darker overall | variants/d_30/frame_00001.png |
| density_2 | `int ccc = int(w*h*random(0.7, 1.2));` -> `...random(2, 3)` | large (mean 0.1868, 0.662) | fur near-black and much denser everywhere; a few light patches survive | variants/density_2/frame_00001.png |
| alpha_150 | `gra.stroke(0, 70);` -> `gra.stroke(0, 150);` | large (mean 0.1583, 0.715) | darker, denser fur; tile edges more visible, high-contrast dark mosaic | variants/alpha_150/frame_00001.png |
| det1_0.06 | `float det1 = random(0.02)*random(1);` -> `float det1 = random(0.06)*random(1);` | moderate (mean 0.0688, 0.261) | smaller, busier local swirls; finer, more mottled hair direction | variants/det1_0.06/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: (1) the random rect-subdivision loop (a `splitRects` primitive:
  start-rect, iteration count, split range, min-slice threshold, axis policy); (2) the
  noise-directed hair field (`hairField(w, h, density, length, detail, offset) -> PGraphics`),
  which is the real "fur" generator and is self-contained per tile.
- One-off art decisions: `bb = 16` margin, forcing `rnd = 1`, the black-alpha stroke choice, the
  0.7-1.2 area-proportional density, and the commented-out palette (the intended colored
  variant is one line away and worth reviving as a `palette` parameter).
- Clean parameter object: `{ inset, iterations, splitRange: [2, 4], minSlice: 5,
  hairDensity: [0.7, 1.2], hairLength: [14, 20], detail: ~0.02, strokeAlpha: 70, palette?: colors[] }`.
