---
sketch: 2014/Generativos/organico
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 1927
animated: false
techniques: [dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#FCFCFC", "#FFFFFF", "#000000"]
  selection: fixed
composition: scattered
parameters:
  - {name: bgDotCount, default: 1000000, tried: [3000000], change: large, effect: "3x background dots: grain noticeably denser and darker, edge vignette much heavier"}
  - {name: bgAlpha, default: 10, tried: [60], change: large, effect: "6x stroke alpha: grain becomes a coarse mid-grey texture, vignette near-black at edges"}
  - {name: cellMaxDiam, default: 200, tried: [400], change: subtle, effect: "cells same positions but up to 2x wider; one cluster now clips the right edge, still recognisably the same blobs"}
  - {name: cellMaxDots, default: 1000, tried: [300], change: subtle, effect: "cells same positions; the largest cluster visibly thinner/sparser, others barely changed"}
  - {name: cellCount, default: 5, tried: [12], change: subtle, effect: "same five cells plus seven more, several tiny; background untouched, canvas looks a busier scatter"}
  - {name: cellDotSize, default: 10, tried: [16], change: subtle, effect: "same cells, bigger dots: clusters look denser and chunkier, rims read as filled circles"}
reusable_candidates:
  - {name: stippledCircle, signature: "stippledCircle(x, y, radius, count, dotSize) -> void", note: "random dot cluster with radial bias toward the rim (sin of uniform angle)"}
  - {name: vignetteSpeckle, signature: "vignetteSpeckle(width, height, count, alpha) -> void", note: "uniform-in-cos speckle: density diverges at canvas edges, giving a dark vignette"}
---

## What it draws
A light gray canvas covered in a fine dark grain that is visibly darker toward the edges
and corners (a vignette of tiny near-invisible dots). Over it sit five round, fluffy
white "cells" or blobs of different sizes, each made of hundreds of small white
outlined dots; the dots are denser near the rim of each blob and sparser in the
middle. One pair of blobs at lower left overlaps. Background is near-white gray.

## How the code works
`setup()` (L2) sizes the window 600x800 and calls `generar()`; `draw()` is empty so
the image is static (frames 1/10/60 identical). `generar()` (L15-28) has two passes:
1. **Background grain** (L16-23): `background(252)`, then 1,000,000 ellipses of size 2
   with `stroke(0,10)` (black at ~4% alpha). Position is
   `cos(random(PI))*width/2 + width/2` (L20-21): the density of `cos` of a uniform
   angle diverges at ±1, so dots pile up at the canvas borders and thin out toward
   the center — this produces the dark-edge vignette.
2. **Cells** (L25-27): five calls to `circle()` with random center, random diameter
   `random(30,200)` and random dot count `int(random(20,1000))`.
`circle()` (L35-46) sets `stroke(0,200)` (near-opaque black) and `fill(255)`, then
plots `cantidad` ellipses of size 10 at radius `dis = sin(random(0,PI/2))*r`
(L41): since the density of `sin` of a uniform angle diverges toward PI/2, most dots
land near the rim, giving each blob a dense outer ring and hollow center.
Randomness enters only through `random()`; the sketch is deterministic per seed.
Colour is fixed: near-white background, black strokes at two alphas, white fills.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| bgDots_3000000 | `for(int i = 0; i < 1000000; i++){` -> `... i < 3000000 ...` | large (mean 0.3107, 0.947) | grain ~3x denser, background darker overall, edge vignette much heavier; cells unchanged | variants/bgDots_3000000/frame_00001.png |
| bgAlpha_60 | `stroke(0,10);` -> `stroke(0,60);` | large (mean 0.4822, 0.917) | grain becomes coarse mid-grey texture, near-black edges; biggest visual lever in the sketch | variants/bgAlpha_60/frame_00001.png |
| cellDiam_30_400 | `random(30,200)` -> `random(30,400)` | subtle (mean 0.0383, 0.125) | same five cells, some up to 2x wider, one cluster clips the right edge | variants/cellDiam_30_400/frame_00001.png |
| cellDots_20_300 | `int(random(20, 1000))` -> `int(random(20, 300))` | subtle (mean 0.0245, 0.086) | same cells; the densest cluster visibly thinner, rest barely changed | variants/cellDots_20_300/frame_00001.png |
| cellCount_12 | `for(int i = 0; i < 5; i++){` -> `... i < 12 ...` | subtle (mean 0.0327, 0.109) | original five cells plus seven new ones, several small; background untouched | variants/cellCount_12/frame_00001.png |
| cellDotSize_16 | `ellipse(xx, yy, 10, 10);` -> `ellipse(xx, yy, 16, 16);` | subtle (mean 0.0209, 0.057) | same cells with larger dots: denser, chunkier rims | variants/cellDotSize_16/frame_00001.png |

## Modularisation notes
- `circle()` (stippled circle with rim-biased dot distribution) is fully generic and
  a good library candidate: parameterize center, radius, dot count, dot size, and the
  radial bias function.
- The `cos`-based speckle loop is also generic (vignette grain); the count and stroke
  alpha are the meaningful knobs. The two-pass "grain + scattered cell clusters"
  composition is the art decision.
- A clean parameter object: `{bgDotCount, bgAlpha, cellCount, cellMinD, cellMaxD,
  cellMinDots, cellMaxDots, cellDotSize, seed}`.
- Note: `saveImage()` (L30-33) counts files in the sketch folder — one-off, not reusable.
