---
sketch: 2015/Generativos/texturasPencil
year: 2015
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 1648
animated: false
techniques: [noise-field, lines-hatching, dots-stippling]
primitives: [line, ellipse]
palette:
  colors: ["#E8DDCB", "#CDB380", "#036564", "#033649", "#031634"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: c, default: "int(random(2, 5))", tried: [8], change: large, effect: "more hair layers -> canvas nearly pure black, denser darker fur; also shifts the random stream so the dot blob moved to a small corner patch"}
  - {name: det, default: "random(0.05)", tried: [0.02], change: large, effect: "lower hair-field detail -> larger smoother flow swirls; stream shift also relocated the dot blob to the bottom-right corner"}
  - {name: gro, default: "random(2, 8)", tried: [8], change: large, effect: "max base stroke weight -> thicker lighter grey fur with strong light/dark contrast; stream shift also relocated the dot blob"}
  - {name: dotCount, default: 100000, tried: [300000], change: moderate, effect: "dot fill in the blob denser and more complete, smoother outline; hair unchanged"}
  - {name: dotThreshold, default: 0, tried: [0.4], change: moderate, effect: "blob shrinks to the field core: a dot band along the top edge plus a few small patches; hair unchanged"}
reusable_candidates:
  - {name: flowFieldStrokes, signature: "flowFieldStrokes(count, detail, amp, weight, invert) -> void", note: "short strokes oriented along a 2-D Perlin angle field, length modulated by the same noise, stroke weight = weight / length so weak-field areas draw thick"}
  - {name: noiseBlobDots, signature: "noiseBlobDots(count, detail, threshold) -> void", note: "white stipple dots kept only where noise > threshold, radius growing with noise value, forms an amorphous light blob"}
---

## What it draws
Full-bleed dark texture: thousands of short, densely overlapping blue-grey strokes oriented by a
smooth noise field make the whole canvas look like pencil scribbled dark charcoal, with soft
lighter/darker ridges following the noise. Over the center-right sits a large amorphous light
region (roughly a blob) densely packed with small white circles outlined in black, each with a
tiny black center dot; the circles are smallest at the blob's edge and largest at its core, with
a few scattered outliers. The background (near-white 252) is only visible in thin gaps between
hair strokes.

## How the code works
`setup()` (line 3) calls `generate()` once; `draw()` (lines 6-7) is empty, so the sketch is
static; `keyPressed` regenerates on any non-'s' key. `generate()`:

- Line 15: `background(252)` — near-white base, almost entirely covered afterwards.
- Lines 16-35 (the "pencil hair"): `c = int(random(2,5))` layers. Each layer picks a grey-blue
  stroke `stroke(random(80)*random(1), random(180,240))` (line 19, low red, high blue), a noise
  detail `det = random(0.05)` (line 21), amplitude `amp` (line 22), weight base `gro` (line 23),
  a random inversion flag `ig` (line 24), and stroke count `cant = random(10000, 100000*(c-j))`
  (line 25, so earlier layers are denser). Each of `cant` random points (lines 28-29) draws one
  line (line 33) whose angle is `noise(x*det, y*det)*TWO_PI` (line 30) and length is
  `noise(...)*amp` (line 31). `strokeWeight(gro/d)` (line 32, or `gro/(amp-d)` when inverted)
  makes strokes thick where the field is weak and thin/short where it is strong — the visual
  ridges in the dark texture. A fresh `noiseSeed` per layer (line 26) decorrelates the layers.
- Lines 37-51 (the "sugar" blob): a second, much coarser field
  (`det = random(0.0005, 0.005)`, new seed). For 100000 random points (line 39), `n =
  (noise-0.5)*2` is kept only when `n >= 0` (line 43); radius `d = pow(n*5, 1.4)*3` (line 44)
  skips points with `d < 2` (line 45). Each kept point draws a white-filled, black-stroked
  ellipse (line 49) plus a tiny center dot (line 50). The `n >= 0` half-space plus the
  `d >= 2` cut-out is what gives the blob its amorphous outline and hollow-looking edge.
- The `colors[]` array (lines 54-60) and `rcol()` (lines 62-64) are dead code: line 20 is
  commented out, so the warm palette is never used. Actual colour is the per-stroke random
  grey-blue plus white/black dots.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| c_8 | `int c = int(random(2, 5));` -> `int c = 8;` | large (mean 0.3199, 0.711) | 8 hair layers: canvas nearly pure black, fur much denser; random stream shifts so the dot blob also moved, now a small patch in the top-left corner | variants/c_8/frame_00001.png |
| det_0.02 | `float det = random(0.05)*random(1);` -> `float det = 0.02;` | large (mean 0.2963, 0.655) | hair flow field coarser: larger, smoother curls and swirls across the canvas; stream shift relocated the dot blob to a small patch in the bottom-right corner | variants/det_0.02/frame_00001.png |
| gro_8 | `float gro = random(2, 8);` -> `float gro = 8;` | large (mean 0.3115, 0.71) | max base weight: strokes visibly thicker, whole texture lighter grey, soft fur-like light/dark contrast; blob also relocated (lower center) by the stream shift | variants/gro_8/frame_00001.png |
| dots_300000 | `for (int i = 0; i < 100000; i++)` -> `for (int i = 0; i < 300000; i++)` | moderate (mean 0.0954, 0.28) | dot fill in the blob denser and more complete, outline smoother and more filled; hair texture unchanged (change happens after the hair loop and reseed) | variants/dots_300000/frame_00001.png |
| threshold_0.4 | `if (n < 0) continue;` -> `if (n < 0.4) continue;` | moderate (mean 0.1081, 0.215) | blob shrinks to the noise-field core: a band of dots along the top edge and a few small patches below; hair texture unchanged | variants/threshold_0.4/frame_00001.png |

## Modularisation notes
- `flowFieldStrokes` (lines 18-35) is fully generic given (count, det, amp, gro, invert):
  random point cloud, noise-orientated strokes, weight = weight/length. Reusable as a
  "hatch-by-field" primitive; the per-layer reseed (line 26) and decreasing count per layer
  (line 25) are the art decisions to lift into a loop around it.
- `noiseBlobDots` (lines 37-51) is generic given (count, det, threshold, radiusCurve):
  thresholding the noise field into a blob and stippling it with radius-proportional-to-noise
  dots. The `pow(n*5, 1.4)*3` radius curve and the `d < 2` skip are tunable constants.
- One-off decisions: the exact grey-blue stroke channel ranges, the double-draw of the center
  dot (line 50), the unused warm palette, and the specific combination of the two fields.
- A clean parameter object: `{layers, strokesPerLayer, fieldDetail, fieldAmp, strokeWeight,
  invert, dotCount, dotDetail, dotThreshold, dotRadiusCurve}`.
