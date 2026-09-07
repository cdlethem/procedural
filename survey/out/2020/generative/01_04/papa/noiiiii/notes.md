---
sketch: 2020/generative/01_04/papa/noiiiii
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1617
animated: false
techniques: [noise-field, curves, distortion]
primitives: [shape]
palette:
  colors: ["#EA2E73", "#F7AA06", "#1577D8"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: form_cc, default: 20, tried: [8, 60], change: subtle/moderate, effect: "fewer strips: darker, sparser top layer, coloured edge loops stand out; more strips: dense multicolour wavy bands, structure clearly visible"}
  - {name: back_cc_div, default: 10, tried: [4], change: large, effect: "more back strips: whole field becomes a dark magenta/purple fine vertical texture, dominant over the form layer"}
  - {name: form_det, default: 0.001, tried: [0.006], change: subtle, effect: "higher noise detail: striations get grainier/more fragmented, same lobe silhouette"}
  - {name: palette, default: "EA2E73,F7AA06,1577D8", tried: ["07001C,2e0091,E2A218,D61406"], change: moderate, effect: "same geometry; indigo/navy field with bold gold, magenta and blue loops"}
reusable_candidates:
  - {name: pinchedCosStrip, signature: "pinchedCosStrip(width, height, rows, detail, amp, pwr, edge|center pinch) -> void", note: "QUAD_STRIP rows whose y is a simplex-modulated cosine, lerped toward mid-height with pow(|x/width-0.5|, pwr) — the pinch creates lobe/bulge silhouettes"}
  - {name: randomStripColor, signature: "randomStripColor(colors[]) -> int", note: "one flat colour per strip via random pick (rcol)"}
---

## What it draws
A full-bleed black field covered in very dense, thin vertical striations in warm
amber/orange and off-white, with sparse thin loops in pink, blue and yellow toward
the right edge. The striations bulge into two large rounded lobes that pinch tightly
together at the vertical midline, leaving a dark seam down the centre; the overall
impression is of two woven curtains or organ pipes squeezed at the waist.

## How the code works
`setup()`/`draw()` both call `generate()` (line 27, 36), which reseeds
(`randomSeed`/`noiseSeed`, lines 50-51), clears to black (line 53), then draws two
layers: `back()` then `form()`.

- `back()` (lines 61-91): `cc = int(random(120,180))/10` (lines 62-63) gives 12-17
  strips. Each strip is a `QUAD_STRIP` spanning every x-column (line 76); y is a
  simplex-noise-modulated cosine: `y = (cos(i*osc1 + j*osc2 + n)*0.5+0.5)*height`
  (line 81), then pulled toward mid-height by `pow(v, pwr1)` where
  `v = |2j/width - 1|` (lines 83-84) — so strips are free at the canvas centre and
  clamped to the midline at the left/right edges. Colour: one flat `rcol()` per
  strip, a random pick from the 3-colour palette (lines 74, 135-139).
- `form()` (lines 93-124): the top layer, `cc = 20` fixed strips (line 95) with the
  same cosine construction but the lerp uses `pow(1-v, pwr1)` (lines 116-117) —
  inverted, so these strips are clamped to mid-height at the canvas centre and free
  at the edges. This is what carves the dark central seam and the two-lobe
  silhouette; the sparse pink/blue/yellow loops on the right are the few
  `form()` strips whose random phase leaves them off-centre.
- Randomness enters per run: `seed` (line 7), all per-strip oscillation/phase
  parameters (`osc1`, `osc2`, `pwr1`, `det`, `ampNoi`, lines 66-70, 99-103), and
  per-strip colour. `draw()` re-runs `generate()` every frame, but with a fixed
  seed the output is static (frames 10/60 identical to 1).
- No blend modes; plain `noStroke()` filled shapes, P2D, `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| form_cc_8 | `  cc = 20;` -> `  cc = 8;` | subtle | darker and sparser: the dense warm amber fill thins out to fine dark-pink vertical striations over black; the few thin coloured loops (blue, yellow, pink ellipses) near the right edge stand out more; lobe silhouette and central seam unchanged | variants/form_cc_8/frame_00001.png |
| form_cc_60 | `  cc = 20;` -> `  cc = 60;` | moderate | top layer becomes 60 visible wavy strips in pink, blue, yellow and orange; the fine woven texture is gone, replaced by clearly separated smooth bands; two-lobe silhouette and central pinch still present, now traced by many parallel coloured curves | variants/form_cc_60/frame_00001.png |
| back_cc_4 | `  cc /= 10;` -> `  cc /= 4;` | large | back layer jumps from ~12-17 to ~30-45 strips; the whole field is now a dense dark magenta/purple fine vertical texture, much darker than baseline, with only a few thin gold/blue loops visible at the right edge | variants/back_cc_4/frame_00001.png |
| form_det_0.006 | `float det = random(0.001);` -> `float det = random(0.006);` | subtle | same composition, but the striations are grainier and more fragmented (fine speckle texture on the left lobe); lobe silhouette and right-edge loops unchanged | variants/form_det_0.006/frame_00001.png |
| palette_cool | `int colors[] = {#EA2E73, #F7AA06, #1577D8};` -> `int colors[] = {#07001C, #2e0091, #E2A218, #D61406};` | moderate | identical geometry, recoloured: deep indigo/navy textured field with bold gold, magenta and blue loops; the lobe shape and central seam read more clearly than baseline | variants/palette_cool/frame_00001.png |

## Modularisation notes
The generic core is one function: a set of full-width `QUAD_STRIP` rows whose y is
`(cos(i*osc1 + j*osc2 + noise)*0.5+0.5)*height`, post-processed by a power-curve
pinch toward mid-height. The pinch exponent `pwr1` and its argument
(`|2x/w-1|` vs `1-|2x/w-1|`) are the only structural decision — one value gives
edge-clamped lobes (`back`), the other gives centre-clamped lobes (`form`);
layering both is a one-off art decision. A clean parameter object would hold:
`rows`, `noiseDetail`, `noiseAmp`, `osc1/osc2` (phase per row/column),
`pinchPower`, `pinchSide` (edge|center|none), `width/height`, `colors[]` +
colour-per-strip selection mode. `rcol()` (random flat colour per strip) is a
trivially reusable helper; the commented-out palette list (lines 131-136) is just
art state.
