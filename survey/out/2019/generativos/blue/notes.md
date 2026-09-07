---
sketch: 2019/generativos/blue
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1554
animated: false
techniques: [noise-field, curves]
primitives: [shape]
palette:
  colors: ["#EBEAEF", "#BCBBBF", "#C9D5EA", "#C6D1EA", "#001C8D"]
  selection: lerp-between
composition: centered
parameters:
  - {name: det, default: "random(0.001)*4.1", tried: ["*12.0", "*1.5"], change: moderate, effect: "higher multiplier = finer wiggles along the ribbon edges; lower = broader, smoother folds"}
  - {name: dc, default: "random(0.01)", tried: ["random(0.05)"], change: moderate, effect: "faster palette cycling: more white/gray mixed into the bands, deep-blue patch relocates"}
  - {name: alpha, default: 120, tried: [40, 220], change: "moderate (40), subtle (220)", effect: "40 = noticeably paler, more white showing through; 220 = slightly denser, more saturated wash"}
  - {name: count, default: 10000, tried: [3000], change: moderate, effect: "shorter strip covers less of the noise path: fewer, larger sails, sparser star with longer thin spikes"}
reusable_candidates:
  - {name: noiseRibbon, signature: "noiseRibbon(seed, detail, count, paletteStart, paletteDrift, alpha) -> quad-strip", note: "QUAD_STRIP of N quads whose vertices follow two offset 1-D simplex noise traces, filled with a cycling lerp palette"}
  - {name: cycleLerpColor, signature: "cycleLerpColor(palette[], v) -> color", note: "index v wraps the palette and lerps adjacent entries with pow(frac, 0.9) for a smooth cycling hue drift"}
---

## What it draws
One large translucent ribbon mass filling most of a white 960x960 canvas. Overlapping
"paper-sail" shapes in pale periwinkle, dusty blue and grayish-lavender cross in a spiky,
star-like pattern; thin hairline banding is visible where the strip folds densely, and a
small mid-blue region sits at the left edge. The whole form reads like translucent fabric
or smoke on white.

## How the code works
- `settings()` (blue.pde:14-19): P3D renderer, 960x960 (`swidth*scale`, scale=1), `smooth(8)`,
  `pixelDensity(2)` (ignored on the `:2` display — warning in baseline stderr).
- `generate()` (blue.pde:34-60), called once from `setup()`; `draw()` is empty, so the sketch is static.
  - `background(255)` white; `noiseSeed(seed)`/`randomSeed(seed)` (seed field, harness sets 42).
  - `det = random(0.001)*4.1` (line 41): 1-D noise frequency, sampled at `i*det` for i in 0..9999.
  - `ic = random(colors.length)` (line 45) picks the palette start; `dc = random(0.01)` (line 46)
    is the palette advance per quad.
  - `beginShape(QUAD_STRIP)` (line 48): 10,000 quads (line 49). Each quad's four vertices come
    from four 1-D `SimplexNoise.noise` traces: `noise(i*det, 0)`, `noise(0, i*det)`, and the same
    with a `100` offset on the second argument (lines 50-53), mapped to `[0, width]`.
  - `fill(getColor(ic+dc*i), 120)` (line 55): per-quad colour from the cycling palette at alpha 120,
    no stroke — the overlap of thousands of translucent quads builds the banded, sail-like look.
- `getColor(float v)` (blue.pde:85-91): wraps `v` mod 5 and `lerpColor`s `colors[int(v)]` with
  `colors[int(v+1)]` using `pow(v%1, 0.9)` — a near-linear smooth cycle through the 5-colour
  blue/gray palette `{#EBEAEF, #BCBBBF, #C9D5EA, #C6D1EA, #001C8D}`.
- Randomness: only `det`, `ic`, `dc` (all from the seeded RNG); the noise traces are then
  deterministic. `keyPressed` re-seeds and regenerates interactively.
- `gradient.png` sits in the sketch folder but is never loaded by the code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_x12 | `float det = random(0.001)*4.1;` -> `... *12.0;` | moderate (mean 0.0969, 0.395) | same star composition but the ribbon edges are visibly finer and wavier; the mid-blue patch shifts toward the lower left | variants/det_x12/frame_00001.png |
| det_x1_5 | `float det = random(0.001)*4.1;` -> `... *1.5;` | moderate (mean 0.1044, 0.443) | folds become much broader and smoother; fewer, larger sails, more white gaps between them, large mid-blue region in the centre | variants/det_x1_5/frame_00001.png |
| dc_0.05 | `float dc = random(0.01);` -> `random(0.05);` | moderate (mean 0.0805, 0.325) | geometry unchanged; colours cycle ~5x faster across the strip: bands mix more white/gray, the deep-blue region relocates to the upper right, overall read is lighter | variants/dc_0.05/frame_00001.png |
| alpha_40 | `fill(getColor(ic+dc*i), 120);` -> `..., 40);` | moderate (mean 0.054, 0.161) | clearly paler and thinner wash; white shows through everywhere, deep blue much fainter | variants/alpha_40/frame_00001.png |
| alpha_220 | `fill(getColor(ic+dc*i), 120);` -> `..., 220);` | subtle (mean 0.0428, 0.113) | subtle: slightly denser, more saturated wash; deep-blue areas a touch darker, same shapes | variants/alpha_220/frame_00001.png |
| count_3000 | `for (int i = 0; i < 10000; i++) {` -> `i < 3000` | moderate (mean 0.1048, 0.424) | shorter strip covers less of the noise path: sparser composition, fewer larger sails, longer thin spikes, more white canvas visible | variants/count_3000/frame_00001.png |

## Modularisation notes
- Generic: the noise-ribbon construction (quad strip from two offset 1-D noise traces with a
  cycling lerp palette fill) is a clean reusable primitive — `noiseRibbon(seed, detail, count,
  paletteStart, paletteDrift, alpha, offset)`. `cycleLerpColor(palette, v)` is independently
  reusable as a palette utility.
- One-off art decisions: the fixed 5-colour blue/gray palette, the `100` offset between the two
  noise traces (ribbon thickness), alpha 120, the `*4.1` multiplier on the random detail, and the
  single-mass-on-white composition.
- Clean parameter object: `{seed, detail, count, noiseOffset, palette, paletteStart, paletteDrift,
  alpha, size}` — everything else in the sketch is scaffolding (export/save/keyPress).
