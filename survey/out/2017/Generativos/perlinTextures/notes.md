---
sketch: 2017/Generativos/perlinTextures
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 984
animated: false
techniques: [noise-field, grid]
primitives: [shape, line]
palette:
  colors: ["#1E211C", "#A60000", "#00A600", "#0000A6", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(180, 480)", tried: [400], change: moderate, effect: "more, thinner bands: strata average out into a smooth green-to-mint vertical gradient, bottom saturates brighter, only thin contour lines remain"}
  - {name: det, default: "random(0.01)", tried: [0.001], change: moderate, effect: "much longer x-wavelength: broad smooth vertical swells, lavender top, large near-white bottom — composition reorganises (98.6% of pixels changed)"}
  - {name: det2, default: "random(0.01, 0.1)*random(1)", tried: [0.002], change: moderate, effect: "adjacent bands cohere into one smooth melting teal/green flow with large soft drips instead of independent wavy strata"}
  - {name: fillAlpha, default: 6, tried: [20], change: large, effect: "band edges become clearly visible as dense wavy contour lines across the canvas; colours saturate faster, bottom near-white"}
  - {name: strokeAlpha, default: 22, tried: [90], change: none, effect: "no visible change — 1-px anti-aliased strokes are negligible against the fills"}
  - {name: gridAlpha, default: 5, tried: [25], change: subtle, effect: "8-px hairline grid becomes faintly visible across the image; band texture unchanged"}
reusable_candidates:
  - {name: noiseBands, signature: "noiseBands(bandCount, xDetail, yDetail, amplitude, fillAlpha, strokeAlpha, palette) -> void", note: "stacked closed shapes, each top edge a per-pixel 1-D noise curve shifted by band index, closed to the bottom, ADD-blended so overlap accumulates toward the bottom"}
  - {name: faintGrid, signature: "faintGrid(step, alpha) -> void", note: "canvas-wide vertical+horizontal hairlines"}
---

## What it draws

A full-bleed soft texture on a near-black olive background. The top is a pale mauve/lavender haze, the middle shows wavy horizontal strata in muted greens and creams, and the bottom builds into a bright pale yellow-green glow. Thin wavy contour lines trace the band edges. Overall look: blurred topographic strata in a desaturated pastel triad (red/green/blue added over a dark ground).

## How the code works

`setup()` (L1-6): 960x960, `smooth(8)`, calls `generate()` once; `draw()` is empty (per-frame regen at L9 is commented out), so the image is static. `generate()`:

- Dark background `#1E211C` (L23), `blendMode(ADD)` (L24).
- A faint grid: vertical + horizontal lines every 8 px, white alpha 5 (L27-31) — barely visible hairlines.
- One pass (L34-52) drawing `cc = random(180, 480)` horizontal "bands". For each band `j`: fill = random triad colour alpha 6, stroke = random triad colour alpha 22 (L41-42). The top edge is a per-pixel curve `y = noise(i*det+des, j*det2)*(height/2) + map(j, 0, cc, -width, width)` (L44-47), then closed with the two bottom corners (L48-50), i.e. each band fills from its wavy top edge down to the canvas bottom.
- `map(j, 0, cc, -width, width)` shifts band 0's edge above the canvas and the last band's edge below it, so the lower the y, the more bands cover it. Under ADD blending the overlap accumulates into the bright bottom glow; the top stays dark. The noise scales (`det < 0.01`, `det2 <= 0.1`, L35-36) give each edge long-wavelength undulation, producing the wavy strata.
- Randomness enters at L35-39 (`det`, `det2`, `des`, `cc`) and per-band at L41-42 via `rcol()` (L83-87: `#A60000`, `#00A600`, `#0000A6`). All from the seeded stream, hence deterministic.
- A commented-out second variant (L53-79) would draw polar noise blobs; it is not active.

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_400 | `int cc = int(random(180, 480));` -> `int cc = 400;` | moderate | band spacing ~6 px: strata average out into a smooth green-to-mint vertical gradient, dark green top, bright bottom; only thin contour lines remain | variants/cc_400/frame_00001.png |
| det_0.001 | `float det = random(0.01);` -> `float det = 0.001;` | moderate | much longer, broader waves: wide vertical swells, lavender top, large near-white bottom — the whole composition reorganises | variants/det_0.001/frame_00001.png |
| det2_0.002 | `float det2 = random(0.01, 0.1)*random(1);` -> `float det2 = 0.002;` | moderate | adjacent bands cohere: one smooth melting teal/green flow with large soft drips, white lower half | variants/det2_0.002/frame_00001.png |
| fill_alpha_20 | `fill(rcol(), 6);` -> `fill(rcol(), 20);` | large | band edges clearly visible as dense wavy contour lines (pink/green on mauve) across the whole canvas; colours saturate faster, bottom near-white | variants/fill_alpha_20/frame_00001.png |
| stroke_alpha_90 | `stroke(rcol(), 22);` -> `stroke(rcol(), 90);` | none | no visible change — 1-px anti-aliased strokes stay negligible against the fills | variants/stroke_alpha_90/frame_00001.png |
| grid_alpha_25 | `stroke(255, 5);` -> `stroke(255, 25);` | subtle | no visible band change; the 8-px hairline grid becomes faintly visible across the image | variants/grid_alpha_25/frame_00001.png |

## Modularisation notes

- Generic: `noiseBands` (the L34-52 block) is a reusable "strata" generator — parameterised by band count, x/y noise detail, offset, amplitude, fill/stroke alpha, and a colour list. `faintGrid` (L27-31) is trivially reusable.
- Art decisions: the dark olive ground, the ADD blend with very low alphas (6/22) that creates the accumulation glow, the triad palette, the `map(j,0,cc,-width,width)` diagonal drift that biases brightness to the bottom.
- Clean parameter object: `{bandCount, xDetail, yDetail, offset, amplitude, fillAlpha, strokeAlpha, drift (map range), palette, gridStep, gridAlpha, background}`.
