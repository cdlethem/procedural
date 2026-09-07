---
sketch: 2018/Generativos/horizontes
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1603
animated: false
techniques: [noise-field, grid]
primitives: [shape]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(6, 40)", tried: [8, 80], change: large, effect: "fewer = a handful of thick calm bands; more = dense fine stripes"}
  - {name: det, default: "random(0.001, 0.008)", tried: [0.02], change: moderate, effect: "higher = finer, tighter ripples on band edges"}
  - {name: amp, default: "random(1/cc, 2/cc)", tried: ["5/cc"], change: large, effect: "larger = thick undulating ribbons of varying stripe thickness"}
  - {name: dc, default: "random(600)*random(1)", tried: [0.1], change: large, effect: "smaller = all bands nearly the same colour, canvas reads as flat orange"}
  - {name: ampw, default: "random(100)", tried: [400], change: moderate, effect: "larger = stronger horizontal undulation, more hilly mountain-silhouette edges"}
reusable_candidates:
  - {name: getColor, signature: "getColor(float v, int[] palette) -> color", note: "walks a palette by lerping between adjacent entries; used to pick one colour per band from a continuous value"}
  - {name: noiseBands, signature: "noiseBands(count, amp, detail, palette) -> void", note: "stacks noise-perturbed horizontal bands, each closed to the canvas bottom so later bands overpaint earlier ones"}
---

## What it draws
A full-bleed 960×960 image of roughly 40 horizontal bands stacked top to bottom,
like a stratified horizon or layered landscape. Each band has a gently undulating
top edge and is filled with one flat colour; colours cycle band to band among
orange-red, orange, mid-blue, dark indigo and near-black, with no gradient or
outline inside a band. A thin black strip shows at the very top.

## How the code works
`setup()` (horizontes.pde:5-19) sets 960×960 P2D and calls `generate()` once;
`draw()` is empty, so the piece is static (regeneration only on keypress).
`generate()` (lines 42-96) does:

- `randomSeed(seed)` (line 44) — the only randomness entry point; all draws are
  deterministic for a given seed.
- `background(0)` (line 45) — the black base, visible at the top edge.
- `cc = int(random(6, 40))` (line 47) — number of bands.
- `dc = random(600)*random(1)` (line 48) — scale of the per-band colour step.
- For each band `i` (lines 50-88):
  - Colour: `fill(getColor(ic + pow(i/(cc-1), 0.7) * colors.length * dc))`
    (line 68) walks the 5-entry palette `int colors[]` (line 123) with
    `lerpColor` between adjacent entries (`getColor(float)`, lines 131-137) —
    this is what produces the band-to-band colour cycling.
  - Vertical placement: `y = i + height*hh` with `hh = pow(i/(cc-1), 1.2)`
    (lines 52, 76) — a mildly non-linear vertical spacing.
  - Top edge is a polyline over `x` from `-ampw` to `width+ampw` (lines 74-84):
    vertical offset `dy = noise(des + x*det, des + y*det) * amp * height`
    (detail 4, line 80) is the main wave; it is multiplied by a low-frequency
    envelope `pow(noise(..., det3), 0.2)` (lines 81-82, detail 1); a small
    horizontal jitter `dx` (detail 2, line 78, amplitude `ampw/2`) roughens the
    x positions. `amp = random(1/cc, 2/cc)` (line 54) scales the wave height.
  - The shape is closed with the bottom corners (lines 85-87), so each band
    fills everything below its top edge; later bands overpaint earlier ones,
    yielding clean stacked stripes.
- The `PShader post` / `filter(post)` calls (lines 11, 92-95) are commented out;
  `result.json` reports `uses_shader: true` only because the string is present
  in the source. `arc2()` (lines 103-121) and `rcol()` are unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_8 | `int cc = int(random(6, 40));` -> `int cc = 8;` | large | 8 thick bands with broad, calm waves; colours run black/indigo at top through dark red and blue to orange at bottom | variants/cc_8/frame_00001.png |
| cc_80 | `int cc = int(random(6, 40));` -> `int cc = 80;` | large | ~80 thin stripes filling the canvas, dense fast colour cycling, no visible gaps | variants/cc_80/frame_00001.png |
| det_0.02 | `float det = random(0.001, 0.008);` -> `float det = 0.02;` | moderate | same band count; edges become fine high-frequency ripples instead of broad waves | variants/det_0.02/frame_00001.png |
| amp_5 | `float amp = random(1./cc, 2./cc);` -> `float amp = 5./cc;` | large | much larger undulation amplitude; stripes become thick wavy ribbons of varying thickness | variants/amp_5/frame_00001.png |
| dc_0.1 | `float dc = random(600)*random(1);` -> `float dc = 0.1;` | large | all bands nearly the same orange; canvas reads as flat orange with faint tonal steps and a black strip at top | variants/dc_0.1/frame_00001.png |
| ampw_400 | `float ampw = random(100);` -> `float ampw = 400;` | moderate | stronger horizontal displacement; band edges more hilly and undulating, like stacked mountain silhouettes | variants/ampw_400/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the palette walker `getColor` (continuous index →
  lerped adjacent palette colours) and the band stacker (N noise-perturbed
  horizontal polylines, each closed to the bottom so later ones overpaint
  earlier). A clean parameter object would be `{count, palette, amp (relative
  to band spacing), detail, detailScale, colorStep, spacingCurve, hJitter}`.
- One-off art decisions: the specific 5-colour palette, the three stacked
  noise octaves with different details (4 / 1 / 2) and the `pow(..., 0.2)`
  envelope that makes some bands flatter than others, and the `pow(...,1.2)`
  vertical spacing.
