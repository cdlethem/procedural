---
sketch: 2018/Generativos/mayo
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1645
animated: false
techniques: [image-source]
primitives: [image]
palette:
  colors: ["#01903B", "#FEE643", "#F3500A", "#0066B8", "#583106", "#F4EEE0"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 1000, tried: [300], change: large, effect: "fewer pouches; brown background (#583106) clearly visible in gaps"}
  - {name: maxScale, default: 0.5, tried: [0.15, 1.5], change: large, effect: "caps the top of the size distribution: 0.15 = all small pouches with much exposed background; 1.5 = a few near-full-canvas pouches dominate"}
  - {name: scaleSkew, default: "random(0.5)*random(1)", tried: ["random(0.5)"], change: large, effect: "removing the second uniform random removes the small-size bias; pouches become uniform and larger on average"}
  - {name: colors[], default: "6-colour list", tried: ["6-colour dark grey list"], change: none, effect: "no visible change: the pouch layer fully occludes the background, so the random background colour is never seen"}
reusable_candidates:
  - {name: scatterImage, signature: "scatterImage(src, count, minScale, maxScale, skew) -> void", note: "randomly scatter one source image over the full canvas at skewed random scales"}

## What it draws
A full-bleed collage of "Natura" mayonnaise pouches (the source photo `mayonesa.png`)
stamped at random positions and sizes over a flat solid background. The pouches overlap
so densely that the background (dark brown, `#583106` for seed 42) is almost invisible;
the image reads as an unbroken field of lime-yellow and leaf-green pouches.

## How the code works
`setup()` (mayo.pde:4-10) sets 960x960 P2D with `smooth(8)`, loads `mayonesa.png` into
`PImage mayo`, and calls `generate()` once; `draw()` is empty so the piece is static
(frames 10/60 are identical). `generate()` (lines 24-31) paints the background with one
random colour from the 6-colour `colors[]` list (`rcol()`, lines 60-62 — for seed 42 the
draw lands on the dark brown `#583106`, which the pouch layer then covers almost
completely), then loops 1000 times (line 27) drawing the pouch image at
`random(width), random(height)` with `imageMode(CENTER)`. The scale factor is
`ss = random(0.5)*random(1)` (line 28): the product of two uniform randoms biases the
distribution toward small values (max 0.5 of the native pouch size, mean ~1/8), which is
why the collage reads as many small-to-medium pouches with no giant ones. Randomness
enters only through the background colour, the positions, and the scales; there is no
noise, no transforms, no blend modes. The `arc2()` and `getColor()` helpers (lines
34-72) are dead code, never called.

## Experiments
| variant | substitution | change score | observation | image |
| count_300 | `for (int i = 0; i < 1000; i++) {` -> `... i < 300 ...` | large | sparser collage; the dark-brown background shows through the gaps between pouches | variants/count_300/frame_00001.png |
| maxscale_0.15 | `float ss = random(0.5)*random(1);` -> `random(0.15)*random(1)` | large | all pouches small; much of the canvas is exposed brown background | variants/maxscale_0.15/frame_00001.png |
| maxscale_1.5 | `float ss = random(0.5)*random(1);` -> `random(1.5)*random(1)` | large | a handful of near-full-canvas pouches dominate, still dense overall | variants/maxscale_1.5/frame_00001.png |
| skew_uniform | `float ss = random(0.5)*random(1);` -> `random(0.5)` | large | small-size bias gone; pouches are uniform, mid-to-large, denser-looking | variants/skew_uniform/frame_00001.png |
| palette_dark | `int colors[] = {#01903B, ...}` -> 6 dark grey tones | none | pixel-identical: the pouch layer fully occludes the background, so the background palette is never visible | variants/palette_dark/frame_00001.png |

## Modularisation notes
Generic, library-worthy core: a `scatterImage(src, count, scaleFn)` stamping loop — full-bleed
random placement of one source image with a configurable scale distribution (the
`random(a)*random(1)` skew is a reusable "toward-small" distribution worth isolating as a
named option, e.g. `skew = product-of-uniforms`). The palette/background choice is a
one-off art decision (a single random background colour; the palette's real role is
background variety across seeds, not per-element colouring). A clean parameter object:
`{ image, count, maxScale, scaleSkew, backgroundPalette, backgroundMode: 'random'|'fixed' }`.
The dead `arc2()` and `getColor()` helpers are unrelated leftovers from other sketches and
should not be ported.
