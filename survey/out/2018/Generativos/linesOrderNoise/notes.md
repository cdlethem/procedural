---
sketch: 2018/Generativos/linesOrderNoise
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1605
animated: false
techniques: [noise-field, lines-hatching, grid]
primitives: [point, line, rect, shape]
palette:
  colors: ["#1A1312", "#3C333B", "#A84257", "#D81D37", "#D81D6E"]
  selection: random-from-list
composition: margins
parameters:
  - {name: cc, default: 60, tried: [30], change: subtle, effect: "halve line count; spacing doubles, same sag structure; dot grid also sparser (gs = width/(cc*cg))"}
  - {name: cg, default: 5, tried: [10], change: subtle, effect: "no visible change; dot grid density doubles but below perceptual level"}
  - {name: det, default: 0.01, tried: [0.02], change: subtle, effect: "doubled noise scale: ripples finer and more uniform across rows, big concave sag attenuated"}
  - {name: lineAlpha, default: 180, tried: [255], change: none, effect: "no visible change"}
  - {name: angleRange, default: "PI*1.5..PI*2.5", tried: ["PI..PI*2"], change: subtle, effect: "same funnel composition; individual ripple phase/amplitude shifts (walk drifts up instead of right before affine fit)"}
reusable_candidates:
  - {name: noiseWalkLines, signature: "noiseWalkLines(count, margin, steps, detail, angleRange) -> PVector[][]", note: "each line is a unit-step random walk through a 2-D Perlin field, then affinely rescaled to span the frame width"}
  - {name: fitWalkToWidth, signature: "fitWalkToWidth(PVector[] pts, float targetWidth) -> PVector[]", note: "rotate to first-last axis, scale by targetWidth/dist, re-anchor at first point"}
---

## What it draws
A deep crimson field (one of the palette's reds) filled with about 60 thin, dark, semi-transparent
horizontal lines inside a small margin frame. The lines are not straight: each undulates vertically
like a contour. In the upper rows the undulation is a large smooth concave sag (ends high, middle
low); lower rows become progressively flatter with a gentle ripple, and the bottom rows bow slightly
upward. A very faint grid of dots covers the whole canvas, and a thin dark frame outlines the inner
area. No colour fills are visible — the 5-colour palette only supplies the flat background.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (regenerate on keypress).
`generate()` (lines 21-121):
- Seeds RNG and noise from `seed` (l.23-24), paints the background with a random palette colour
  `rcol()` (l.25) — with seed 42 this landed on the bright crimson `#D81D37`.
- Draws a faint dot grid: `gs = width/(cc*cg)` (l.29), `point()` at every grid node with
  `stroke(0,120)` (l.34-39) — the barely-visible texture over the red.
- Draws the margin frame: `bb=40`, one stroked rect (l.31-32, 43) plus, per row, a near-invisible
  white band `fill(255, random(8))` and a faint horizontal guide line (l.50-53).
- The main structure: for each of `cc=60` rows (l.48-83) it starts at the row's left edge (l.57-58)
  PI*1.5, PI*2.5)` (l.62), so the walk drifts generally rightward, oscillating up and down.
  `det` (noise scale) starts at `random(0.01)` and is multiplied by `random(0.99,1.01)` each row
  (l.59), so the noise wavelength drifts slowly across the stack — this is why the sag is large and
  smooth in some rows and flat-rippling in others.
- Each walk is then affinely fitted to the frame: rotate by the first-last axis, scale so the
  first-last distance becomes `ts = width-2*bb`, re-anchor at the start (l.69-80). Result: every line
  spans the full inner width, and its vertical profile is the noise walk's shape.
- A second pass (l.85-120) strokes each walk as a `beginShape(QUADS)` polyline with
  `stroke(0,180)`, `noFill()` (l.93-102) — the visible dark lines. The coloured-quad fills between
  adjacent walks (l.103-119, using `getColor(ic+vc*j)`) are commented out, which is why the palette
  shows only in the background; `ic`/`vc` (l.89-91) still consume RNG draws.
- Renderer P2D, `smooth(8)`; no blend modes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_30 | `int cc = 60;` -> `int cc = 30;` | subtle (mean 0.0428, 0.169 of pixels) | line count halved, spacing doubled; same funnel/sag structure, dot grid sparser (gs also derives from cc) | variants/cc_30/frame_00001.png |
| cg_10 | `int cg = 5;` -> `int cg = 10;` | subtle (mean 0.0339, 0.0 of pixels) | no visible change; dot grid twice as dense but below perceptual level | variants/cg_10/frame_00001.png |
| det_0.02 | `float det = random(0.01);` -> `float det = random(0.02);` | subtle (mean 0.0337, 0.167 of pixels) | ripples finer and more uniform across rows; large concave sag in upper rows attenuated | variants/det_0.02/frame_00001.png |
| lineAlpha_255 | `stroke(0, 180);` -> `stroke(0, 255);` | none (mean 0.001, 0.0 of pixels) | no visible change | variants/lineAlpha_255/frame_00001.png |
| angleRange_PI_PI2 | `PI*1.5, PI*2.5` -> `PI, PI*2` | subtle (mean 0.0349, 0.174 of pixels) | same overall funnel composition; individual line ripples shift in phase/amplitude | variants/angleRange_PI_PI2/frame_00001.png |

## Modularisation notes
- Generic: the noise-walk generation + affine fit is a clean standalone function
  (`noiseWalkLines`/`fitWalkToWidth` above) — a "contour lines from a 2-D noise field" primitive that
  does not depend on this sketch's palette or frame.
- Generic: the dot-grid overlay (cell step from `cc*cg`, faint points) is a reusable texture layer.
- One-off art decisions: the flat random-palette background, the margin frame + per-row near-invisible
  white bands, the specific angle window (PI*1.5..PI*2.5 forces rightward drift), and the commented-out
  quad-fill colouring (an unused feature that still perturbs the RNG stream).
- Clean parameter object: `{count: cc, margin: bb, steps: 1100, detail: det0, detailDrift: [0.99,1.01],
  angleRange: [PI*1.5, PI*2.5], lineStroke: [0,180], gridDiv: cg, palette, background: "random-from-list"}`.
