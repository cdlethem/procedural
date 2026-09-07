---
sketch: 2020/generative/01_04/trastos
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1504
animated: false
techniques: [particles]
primitives: [ellipse, shape]
palette:
  colors: ["#D84004", "#E8E8E8", "#411BD6", "#242B24", "#EFEA53"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 400, tried: [100], change: large, effect: "sparser field, more background between objects"}
  - {name: sizeMax, default: 900, tried: [300], change: large, effect: "no large outlier circles; uniform small-medium field"}
  - {name: circleAlpha, default: 220, tried: [80], change: moderate, effect: "circles translucent, overlaps blend into muddy colors"}
  - {name: triRadiusFactor, default: 0.5, tried: [0.75], change: moderate, effect: "triangles extend past circle edges, spiky silhouettes"}
  - {name: dotRadiusFactor, default: 0.05, tried: [0.3], change: subtle, effect: "center dot becomes a large disk; overall field reads the same"}
reusable_candidates:
  - {name: trasto, signature: "trasto(x, y, size, palette) -> void", note: "one motif: translucent circle + inscribed triangle with one transparent vertex (gradient) + small center dot"}
  - {name: scatter, signature: "scatter(count, sizeFn, motifFn) -> void", note: "loop placing motifs at random positions with a size distribution"}
---

## What it draws
A dense scatter of flat cartoon "objects" on a dark charcoal-green background. Each object is a
translucent circle in a saturated palette colour (orange-red, royal blue, off-white, yellow, dark
green) with a solid triangle inscribed in it; the triangle reads as a soft gradient because one of
its corners fades out. A small dot sits at the center of most circles. Objects overlap freely,
sizes range from tiny specks to circles a third of the canvas, giving a busy confetti-like collage.

## How the code works
`setup()` calls `generate()` once (draw() is empty, so the image is static; line 32-34).
`generate()` (line 44) seeds `random`/`noise` from `seed`, paints the background with one random
palette colour via `rcol()` (line 48), then loops 400 times (line 51):

- Position: `xx, yy` uniform random in the canvas (line 52-53).
- Size: `ss = random(20,900)` multiplied by four independent `random(1)` factors (line 54); the
  product of uniforms biases the distribution hard toward small values with a few large outliers.
- Circle: two concentric ellipses of diameter `ss` and `ss-5` with the same fill (line 55-57);
  fill is a random palette colour at alpha 220, so circles are mostly opaque but overlap seams
  show slightly (line 55).
- Triangle: radius `r = max(0, ss*0.5-5)` inscribes the triangle in the circle (line 58-59);
  three vertices at 120° apart from a random start angle `des` (line 60-67). `fill(rcol())` is set
  before the shape, but for the third vertex `fill(rcol(), 0)` is called mid-shape (line 66),
  which in P3D recolors that vertex to transparent and makes the triangle fade toward one corner.
- Center dot: a tiny ellipse of diameter `ss*0.05` in a new random colour (line 70-71).

Randomness enters only through `random()`; the noise imports (toxi SimplexNoise) and the
triangulate library are imported (line 1-2) but never used. `rcol()` (line 81-83) picks a uniform
random palette entry; `getColor()`/`getColor(float)` (line 85-95) lerp between neighbouring palette
entries but are never called. The palette is 5 fixed colours (line 80).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_100 | `for (int i = 0; i < 400; i++) {` -> `for (int i = 0; i < 100; i++) {` | large | field much sparser; same motif, more dark background visible between objects | variants/count_100/frame_00001.png |
| sizeMax_300 | `float ss = random(20, 900)*random(1)*random(1)*random(1)*random(1);` -> `random(20, 300)*...` | large | no large outlier circles; every object small-to-medium, reads as a more uniform dot field | variants/sizeMax_300/frame_00001.png |
| alpha_80 | `fill(rcol(), 220);` -> `fill(rcol(), 80);` | moderate | circles clearly translucent: background shows through and overlaps blend into muddy orange/brown instead of flat saturated fills | variants/alpha_80/frame_00001.png |
| triR_0.75 | `float r = max(0, ss*0.5-5);` -> `float r = max(0, ss*0.75-5);` | moderate | triangles now protrude beyond their circle edges; spiky, cat-like silhouettes where triangle pokes out | variants/triR_0.75/frame_00001.png |
| dot_0.3 | `ellipse(xx, yy, ss*0.05, ss*0.05);` -> `ellipse(xx, yy, ss*0.3, ss*0.3);` | subtle | center dot grows into a large disk occupying much of the circle interior; overall density and read of the field unchanged | variants/dot_0.3/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the `trasto` motif (translucent circle + inscribed gradient triangle +
  center dot) is self-contained and parameterisable by position, size, and palette; the scatter
  loop with a size distribution (`base * random(1)^k`) is a reusable placement pattern; `rcol()`
  is a trivial random-palette picker.
- One-off art decisions: the exact 5-colour palette, alpha 220, the 4-fold `random(1)` size bias,
  the triangle's 120° spacing and single transparent vertex, the `ss*0.05` center dot size.
- A clean parameter object would be: `{palette, count, sizeMin, sizeMax, sizeBias (exponent/count of
  random factors), circleAlpha, triangleRadiusFactor, dotRadiusFactor, backgroundFromPalette}`.
