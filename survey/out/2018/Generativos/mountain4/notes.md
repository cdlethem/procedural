---
sketch: 2018/Generativos/mountain4
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1716
animated: false
techniques: [noise-field, flow-field, lines-hatching]
primitives: [shape]
palette:
  colors: ["#061431", "#2E52DF", "#F78DF1", "#FEFEFE", "#EC3063"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: det, default: "random(0.006)", tried: ["random(0.002)"], change: large, effect: "coarser noise scale -> longer, gentler waves; the bundle converges to a single sharp point at the right edge and white gaps between strands widen"}
  - {name: vel, default: 4, tried: [8], change: large, effect: "faster walk steps -> tighter, higher-frequency wiggles; right-edge convergence becomes a dense braided tangle with darker navy patches"}
  - {name: cc, default: "random(160, 640)", tried: ["random(480, 640)"], change: large, effect: "many more rows -> canvas filled edge-to-edge top to bottom (no white margins); right edge becomes a dense comb fan"}
  - {name: ribbonThickness, default: 10, tried: [40], change: moderate, effect: "hairline ribbons become broad soft bands; the right-edge convergence fans out wider and more white shows between strands"}
  - {name: dc, default: 0.1, tried: [0.35], change: moderate, effect: "palette cycles ~3.5x faster along each ribbon -> banded red/blue checker-weave pattern instead of smooth gradients; strand structure unchanged"}
  - {name: angleRange, default: "PI*1.5..PI*2.5", tried: ["PI*1.25..PI*2.75"], change: large, effect: "wider vertical angle spread -> thick bold silk-like bands, tighter right-edge braid, more pronounced white gaps"}
reusable_candidates:
  - {name: noisePolyline, signature: "noisePolyline(origin, scale, angleMin, angleMax, vel, steps) -> PVector[]", note: "walk a polyline whose heading is a 2-D Perlin-noise angle field"}
  - {name: ribbonStrip, signature: "ribbonStrip(points, thickness, palette, cycleRate, alphaFade) -> shape", note: "render a polyline as a filled quad strip, y-offset thickness, per-segment palette gradient, vertical alpha fade"}
  - {name: lerpPalette, signature: "lerpPalette(colors, v) -> color", note: "wrap v mod n and lerp between adjacent palette entries"}
---

## What it draws
A white field filled with a dense bundle of thin, wavy horizontal ribbons that all stream from the left edge toward the right, fanning out on the left and converging to a point at the right edge, like a lock of hair or silk threads blown to one side. Each ribbon is a hairline of colour that cycles through deep blue, magenta/pink, pale purple and white, and each ribbon fades to transparent over a ~10px vertical drop, giving the strands a soft, glowing, layered look. Dense blue-and-pink interweaving dominates the left two thirds; the right side thins out into sparse single strands on the white ground.

## How the code works
`setup()` (L3-8) makes a 960×960 P2D canvas, `smooth(8)`, and calls `generate()`; `draw()` is empty and regeneration only happens on key press (L13-19). All randomness comes from the single `seed` field (L1, L23-24).

`generate()` (L21-86):
- Background is one random palette colour, `rcol()` (L25; L96-98). Seed 42 lands on white `#FEFEFE`.
- `cc = random(160, 640)` rows (L27), vertically spaced by `ss = height/cc` (L28).
- One global noise scale `det = random(0.006)` (L33), jittered per row by `random(0.99, 1.01)` (L40).
- Each row starts at `(0, (i+0.5)*ss)` (L38-39). Step velocity `vel = (0.8 + noise(lx*det, ly*det)) * 1.2 * 4` → 3.2–8 px (L41-43).
- Inner loop, `width*0.4` ≈ 384 steps (L44): heading `ang = map(noise(lx*det, ly*det), 0, 1, PI*1.5, PI*2.5)` (L45) — i.e. 270°–450°, always pointing rightward with ±90° vertical spread. Position advances by `(cos ang, sin ang) * vel` (L47-48). Because every row starts at x=0 and the angle range is rightward, all ribbons travel left→right and the noise field pulls them into the visible right-edge convergence.
- Each row is drawn as a thin ribbon (L54-72): for every pair of consecutive points a QUAD spans `(p1.x,p1.y)-(p2.x,p2.y)` down by 10 px (L64-70). Fill colours `col1 = getColor(ic + dc*j)`, `col2 = getColor(ic + dc*j + dc)` (L55-62): `ic = abs(cos(i*0.2)*colors.length)` offsets each row's starting position in the palette, and `dc ≈ 0.1` advances it per segment, so colour cycles smoothly along the ribbon. `getColor(float)` (L102-107) wraps `v mod 5` and lerps between adjacent palette entries.
- The vertical fade: top two vertices get alpha 255, bottom two alpha 0 (L63-70), so every 10px-tall slice of ribbon dissolves downward — the source of the soft hairline look. `stroke(0, 8)` (L57) is a near-invisible dark seam.

## Experiments
| variant | substitution | change score | observation | image |
| det_0.002 | `float det = random(0.006);` -> `float det = random(0.002);` | large (0.2651, 75.5%) | long, gentle, low-frequency undulations; the whole bundle funnels into one sharp convergence point at the right edge, with wide white channels between strands | variants/det_0.002/frame_00001.png |
| vel_8 | `vel *= 4;` -> `vel *= 8;` | large (0.1527, 48.7%) | oscillations become sharper and higher-frequency; strands twist into a tight braid at the right-edge convergence, darker navy interlacing appears | variants/vel_8/frame_00001.png |
| cc_dense | `int cc = int(random(160, 320*2));` -> `int cc = int(random(480, 640));` | large (0.2094, 61.9%) | far denser row count: the field fills the canvas edge-to-edge with no white margins, and the right edge becomes a dense comb-like fan | variants/cc_dense/frame_00001.png |
| ribbon_40 | `vertex(p2.x, p2.y+10);` + `vertex(p1.x, p1.y+10);` -> `+40` | moderate (0.1179, 37.9%) | ribbons are 4x thicker: hairlines become broad soft bands with a stronger fade, convergence fans out wider and more white shows between strands | variants/ribbon_40/frame_00001.png |
| dc_0.35 | `float dc = random(0.099, 0.1);` -> `float dc = random(0.3, 0.4);` | moderate (0.1283, 43.2%) | colour cycles ~3.5x faster along each ribbon: instead of smooth gradients the strands show a banded red/blue checker-weave; geometry is unchanged | variants/dc_0.35/frame_00001.png |
| angle_wide | `map(noise(...), 0, 1, PI*1.5, PI*2.5)` -> `PI*1.25, PI*2.75` | large (0.1628, 48.1%) | strands become thick, bold, smoothly flowing silk bands; right-edge convergence is a tighter braid with pronounced white gaps | variants/angle_wide/frame_00001.png |

## Modularisation notes
Generic blocks:
- The noise-walk loop (L37-49) is a reusable "polyline following a noise angle field": parameters origin, noise scale, angle range, velocity, step count. This is the core `noisePolyline` candidate.
- The ribbon strip (L54-72) is a reusable polyline→filled-quad-strip renderer with thickness, per-segment palette cycling and a vertical alpha fade: `ribbonStrip`.
- `getColor(float)` (L102-107) is a clean palette-cycler (wrap + lerp) independent of the art decisions.

One-off art decisions: the specific 5-colour palette (L95), the rightward angle window `PI*1.5..PI*2.5` that forces the left→right convergence (L45), the `cos(i*0.2)` per-row palette offset (L55), the 10 px fade thickness (L68-70), and the random palette-colour background (L25).

A clean parameter object: `{rows, noiseScale, angleRange: [min, max], stepVel, stepsPerRow, thickness, palette, paletteCycleRate, paletteRowOffset}`.
