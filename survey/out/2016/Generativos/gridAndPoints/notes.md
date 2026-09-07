---
sketch: 2016/Generativos/gridAndPoints
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 240
animated: false
techniques: [grid, noise-field, dots-stippling, pixel-ops]
primitives: [ellipse]
palette:
  colors: ["#FAFAFA", "#0A0A0A"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: count, default: "random(10, ~200) per layer", tried: [40], change: large, effect: "fixed count=40 gives a regular uniform dot grid with slight wobble instead of the chaotic lacy baseline"}
  - {name: det, default: "random(0.1)", tried: [0.03], change: large, effect: "lower detail = much larger, smoother size/position waves; gentle undulating field instead of fine lacy texture"}
  - {name: layers, default: 5, tried: [2], change: large, effect: "fewer invert layers = less thresholding; large overlapping dots on white, coarser and denser stipple"}
  - {name: fill, default: 10, tried: [100], change: large, effect: "grey dots (100) interact with the INVERT passes differently: mostly-black image with white crescent dots and grey patches"}
  - {name: sizeScale, default: 0.5, tried: [1.5], change: large, effect: "bigger dots overlap heavily: flat mid-grey ground with small black dots, weak thresholding"}
reusable_candidates:
  - {name: noiseDotGrid, signature: "noiseDotGrid(count, detail, sizeScale, offsetX, offsetY) -> void", note: "grid of ellipses, position and radius jittered by 2-D Perlin noise"}
  - {name: invertLayers, signature: "invertLayers(n) -> void", note: "repeat the INVERT filter to build a thresholded, posterized look"}
---

## What it draws
A dense, full-bleed black-and-white texture of dots: rows and columns of small
circles wobble in position and size, so dense patches merge into solid black
masses while sparse patches leave white ground, giving a lacy, halftone-like
mosaic. The pattern is uniform across the canvas with no focal point. Static:
`draw()` is empty, everything is produced once by `generate()`.

## How the code works
`setup()` (line 1-5) calls `generate()` once; `draw()` is empty so the image is
- `background(250)` (line 21) sets the near-white ground.
- Outer loop (line 22) repeats 5 times: each pass first applies
  `filter(INVERT)` (line 23) to the whole canvas, then draws a new dot layer on
  top. The repeated invert+draw cycle is the core trick: each new layer of dark
  dots gets thresholded against the previous one, which is what pushes the
  mid-greys into hard black/white clusters.
- Grid resolution per pass: `count = int(random(10, 200*random(1)))` (line 24)
  is a random count between 10 and ~200 per pass; cell size `ss = width/(count+1)`
  (line 25).
- Per-cell ellipse (lines 31-37): radius `s = ss*(0.5 + noise(i*det+34, j*det+34)*0.5)`
  (line 33) — noise-driven size between 0.5 and 1.0 cell widths; centre
  displaced by `ss*noise(...)*0.5` in x (line 34) and y (line 35), i.e. up to
  half a cell of jitter. `det = random(0.1)` (line 28) is the noise sample
  spacing, so the wobble is a low-frequency blobby field.
- Dots are drawn `noStroke(); fill(10)` (lines 29-30): near-black on the
  inverted background.
- Randomness enters only through `random()` for `count` (line 24) and `det`
  (line 28), plus the fixed-seed noise fields. Colours are fixed (fill 10 on
  background 250); the black/white contrast is a by-product of the INVERT
  filter, not of the palette.
- `smooth(8)` (line 3) anti-aliases the ellipses.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_40 | `int count = int(random(10, 200*random(1)));` -> `int count = 40;` | large (mean 0.3278, 0.509 of pixels) | orderly uniform dot matrix: even rows/columns of near-identical black dots with faint wobble, white grid lines between them; far more regular than the lacy baseline | variants/count_40/frame_00001.png |
| det_0.03 | `float det = random(0.1);` -> `float det = 0.03;` | large (mean 0.4667, 0.653 of pixels) | large smooth waves of dot size/position: broad soft blobs of big dots alternating with big regions of tiny dots; the wobble is much lower-frequency | variants/det_0.03/frame_00001.png |
| layers_2 | `for (int k = 0; k < 5; k++) {` -> `for (int k = 0; k < 2; k++) {` | large (mean 0.5229, 0.663 of pixels) | coarse dense field of large overlapping black dots on white; the white ground shows as thin gaps between dots, much less fine lacy structure | variants/layers_2/frame_00001.png |
| fill_100 | `fill(10);` -> `fill(100);` | large (mean 0.3093, 0.926 of pixels) | image is mostly black with scattered white crescent/dot shapes and mid-grey patches; the grey dots change how the INVERT passes threshold the layers | variants/fill_100/frame_00001.png |
| size_1.5 | `float s = ss*(0.5+noise(...)*0.5);` -> `*1.5);` | large (mean 0.287, 0.397 of pixels) | dots grow past one cell and overlap: a flat mid-grey ground with small black dots, weak black/white thresholding | variants/size_1.5/frame_00001.png |

## Modularisation notes
Two blocks are generic: the noise-displaced dot grid (lines 24-38) is a
self-contained "stippled noise grid" primitive parameterized by count, detail,
and size scale; the repeated `filter(INVERT)` + overlay (lines 22-23) is a
generic "posterize by inversion" step that turns any grayscale layering into a
thresholded pattern. One-off art decisions: the 5-layer count, the random
per-pass resolution, and the specific noise offsets (34, 100) that decorrelate
the three noise fields (size, x, y). A clean parameter object: `{layers, count,
detail, sizeScale, jitter, dotColor, bgColor}`.
