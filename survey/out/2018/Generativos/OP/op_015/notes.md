---
sketch: 2018/Generativos/OP/op_015
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1510
animated: false
techniques: [noise-field, curves]
primitives: [shape]
palette:
  colors: ["#000000", "#FFFFFF", "#F8F8F8", "#F0B8C1", "#9FC8E6", "#FCC702", "#323232"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: amp, default: "random(1, 8)", tried: [2], change: large, effect: "lower = much flatter, near-horizontal bands; small spike artifacts where band edges cross"}
  - {name: det, default: "random(0.01)", tried: [0.004], change: large, effect: "lower = longer, gentler, fewer waves per band"}
  - {name: div, default: "int(random(4, random(8, 120)))", tried: [30], change: large, effect: "higher = more, thinner bands (baseline ~15, variant ~30)"}
  - {name: umbral, default: 0, tried: [0.6], change: large, effect: "thresholds the noise: edges snap back to grid lines where noise is low, exposing black gaps between bands, spikier peaks"}
  - {name: c2, default: 255, tried: [120], change: large, effect: "darkens gradient bottom: whole image is dark greys, no pure white"}
reusable_candidates:
  - {name: noiseRibbon, signature: "noiseRibbon(y, height, amp, detail, offsetX, offsetY, cTop, cBottom)", note: "closed band between two per-pixel noise curves, vertex fills give vertical gradient"}
  - {name: vertexFillGradient, signature: "bandBetween(topCurve, bottomCurve, c1, c2)", note: "fill(c1) before top edge vertices, fill(c2) before bottom edge vertices -> smooth gradient inside one polygon"}
---

## What it draws
A full-bleed stack of horizontal wavy bands in black and white. Each band is a
smooth undulating stripe whose edges are Perlin-noise curves; inside every band
the tone ramps vertically from black at the top edge to white at the bottom edge,
so the whole image reads as layered, draped monochrome fabric. Bands overlap
slightly, and the amplitudes vary, so some bands are tall and rolling while
others are thin and snaky. No color anywhere; pure grayscale.

## How the code works
`setup()` calls `generate()` once (line 7); `draw()` is empty, so the piece is
static (confirmed: frames 1/10/60 are byte-identical).

`generate()` (lines 22-59):
- `background(0)` (line 23).
- Parameters drawn from the seeded RNG: `div = int(random(4, random(8, 120)))`
  (line 25, number of bands), `ss = height/div` (line 26, band height),
  `det = random(0.01)` (line 27, noise x/y scale), `des = random(10000)`
  (line 28, noise-space offset), `amp = random(1, 8)` (line 29, displacement
  multiplier), `umbral = 0` (line 30, threshold, currently disabled).
- Loop over rows `j = -amp .. div+amp` (line 35), so bands spill off both ends
  of the canvas (full-bleed). For each row, a single closed polygon:
  - top edge: for `i = 0..width` per pixel, `nn = noise(des+i*det, des+y1*det)`
    (line 45), mapped and scaled to `hh = nn*ss*amp` (line 47), vertex at
    `y1+hh` (line 48).
  - bottom edge: same noise sampled at `y2 = y1+ss`, walked right-to-left
    (lines 51-55) to close the shape.
- The gradient trick: `fill(c1)` with `c1 = color(0)` black is set before the
  top-edge vertices (lines 33, 43); `fill(c2)` with `c2 = color(255)` white is
  set before the bottom-edge vertices (line 50). Processing applies the fill
  per triangle of the fan, so the band interior ramps smoothly black→white
  vertically. `noStroke()` (line 32) means bands show only through their fill.
- Randomness enters only via the five values above (all `random()` before the
  loop); with a fixed seed the whole image is deterministic.
- `colors[]` / `rcol()` / `getColor()` (lines 65-78) are unused leftovers; the
  per-row `rcol()` calls are commented out (lines 38-41), which is why the
  baseline is monochrome instead of the pastel palette in the array.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| amp_2 | `float amp = random(1, 8);` -> `float amp = 2;` | large (mean 0.4046, 98.1% px) | much flatter, near-straight bands; small spike/dip artifacts where band edges cross | variants/amp_2/frame_00001.png |
| det_0.004 | `float det = random(0.01);` -> `float det = 0.004;` | large (mean 0.3326, 83.3% px) | fewer, longer, gentler waves per band | variants/det_0.004/frame_00001.png |
| div_30 | `int div = int(random(4, random(8, 120)));` -> `int div = 30;` | large (mean 0.321, 81.1% px) | roughly double the bands, each thinner | variants/div_30/frame_00001.png |
| umbral_0.6 | `float umbral = 0;//random(0.8)*random(0.4, 1);` -> `float umbral = 0.6;` | large (mean 0.3136, 77.5% px) | edges snap back to grid lines where noise is low; black gaps appear between bands, peaks spikier | variants/umbral_0.6/frame_00001.png |
| c2_120 | `int c2 = color(255);` -> `int c2 = color(120);` | large (mean 0.2626, 82% px) | darker overall; gradient bottom is mid-grey, no pure white | variants/c2_120/frame_00001.png |

## Modularisation notes
The core generic block is the noise-ribbon builder: given a row `y`, band
height `ss`, amplitude `amp`, noise scale `det` and offset `des`, emit one
closed polygon between `noise(des+i*det, des+y*det)` and the same curve at
`y+ss`, with two vertex fills for the internal gradient. That is a clean
library function (`noiseRibbon` above); the gradient-by-vertex-fill sub-trick
is worth naming separately since it generalizes to any two-curve band.

One-off art decisions: the specific parameter ranges (`div` up to 120, `det`
under 0.01, `amp` 1-8), the black/white choice, the `umbral` threshold hook
(disabled), and the disabled pastel palette.

A clean parameter object: `{rows, bandHeight, amp, noiseScale, noiseOffset,
threshold, cTop, cBottom}` — everything else in `generate()` is derived or
fixed.
