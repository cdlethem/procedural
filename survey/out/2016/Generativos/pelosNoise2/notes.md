---
sketch: 2016/Generativos/pelosNoise2
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1146
animated: false
techniques: [noise-field, lines-hatching]
primitives: [line]
palette:
  colors: ["#FAFAFA", "#000000"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: sep, default: 2, tried: [4], change: large, effect: "halves density; sparse strokes reveal the flow as individual hair lines on light gray"}
  - {name: det, default: 0.003, tried: [0.001], change: moderate, effect: "lower detail = larger, smoother, coarser swirls (still near-black)"}
  - {name: strokeAlpha, default: 120, tried: [20], change: large, effect: "much lighter, mid-gray textured surface instead of solid black"}
  - {name: maxLen, default: 30, tried: [10], change: large, effect: "shorter strokes; flow breaks into short dappled ticks, less continuous"}
  - {name: zScale, default: 1, tried: [4], change: moderate, effect: "shifts the 3-D noise depth sample; different swirl pattern but still dark"}
reusable_candidates:
  - {name: noiseLineField, signature: "noiseLineField(sep, detail, z, angleOffset, minLen, maxLen) -> void", note: "draw short line strokes on a jittered grid, oriented and sized by 3-D Perlin noise"}
---

## What it draws
A dense field of very short black hair-like strokes covering the whole square, flowing
along a smooth Perlin-noise direction so the strokes curl into large eddies and swirls.
Because hundreds of thousands of semi-transparent strokes overlap on a light-gray
background, the sheet reads as almost solid black with a few soft, lighter patches (a
bright diagonal band lower-right) where the strokes happen to point away from the viewer
and overlap less. It looks like dark fur or flowing smoke rendered with fine hatching.

## How the code works
`setup()` (lines 7-11) sizes the canvas to 960x960 and calls `generate()` once. `draw()`
(lines 13-18) increments `frame` and re-calls `generate()` each frame but exits after
`frame > 2`, so the sketch is effectively a 3-frame still (only frame 1 is kept).

`generate()` (lines 20-41):
- Re-seeds noise and random with `seed` (lines 21-22).
- `background(250)` paints a light gray field (line 24); `stroke(0, 120)` sets a
  semi-transparent black stroke (line 25) — the low alpha is what makes the dense
  overlaps accumulate toward solid black.
- `sep = 2` (line 26) is the grid spacing; `det = 0.003` (line 27) is the noise scale.
- `da = map(frame, 0, 60, 0, TWO_PI)` (line 28) and `z = cos(da/4)*1` (line 29) set a
  slowly evolving angle offset and the 3-D noise depth coordinate (both are 0/1 for
  frame 0, so the first frame is static-looking).
- Two nested loops (lines 31-40) walk a grid from -10 to width+10 in steps of `sep`.
  Each cell's point is jittered by `random(-0.5, 0.5)` (lines 33-34).
- `n = noise(x*det, y*det, z)` (line 35) samples 3-D Perlin noise; the stroke angle is
  `a = n*TWO_PI + da` (line 36) and its length is `d = map(n, 0, 1, 2, 30)` (line 37) so
  longer strokes sit in the high-noise regions. `line(...)` (line 38) draws each short
  segment. The combination of the jittered grid + noise angle + noise length is what
  produces the fur/hatching texture and the large curling eddies.
- No palette beyond the two fixed colors; no blend mode beyond the default source-over
  with alpha; JAVA2D renderer.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sep_4 | `  int sep = 2;` -> `  int sep = 4;` | large | much lighter and sparser; strokes now legible as individual hair lines curling in eddies on light gray, the solid-black look gone | variants/sep_4/frame_00001.png |
| det_0.001 | `  float det = 0.003;` -> `  float det = 0.001;` | moderate | still near-black; swirls are larger, smoother and coarser (fewer, bigger eddies), fine detail gone | variants/det_0.001/frame_00001.png |
| alpha_20 | `  stroke(0, 120);` -> `  stroke(0, 20);` | large | far lighter; mid-gray textured surface with the fur visible as faint light specks instead of solid black | variants/alpha_20/frame_00001.png |
| len_10 | `      float d = map(n, 0, 1, 2, 30);` -> `      float d = map(n, 0, 1, 2, 10);` | large | still dark (sep=2 stays dense) but strokes much shorter; flow reads as short dappled ticks, less continuous than baseline hairs | variants/len_10/frame_00001.png |
| zscale_4 | `  float z = cos(da/4)*1;` -> `  float z = cos(da/4)*4;` | moderate | looks close to baseline (still near-black); the swirl pattern shifted to a different 3-D noise slice but overall darkness is unchanged | variants/zscale_4/frame_00001.png |

## Modularisation notes
- Generic, reusable block: `generate()` is essentially a `noiseLineField` — a jittered
  grid of short strokes whose angle and length come from 3-D Perlin noise. Parameterized
  as `(sep, detail, z, angleOffset, minLen, maxLen)` it is a self-contained library
  function independent of the art decisions.
- One-off art decisions: the near-black look (light background + alpha-120 black stroke
  + `sep=2` density) is a deliberate accumulation effect, not inherent to the field.
  `da`/`z` animation over 60 frames, the 3-frame auto-exit in `draw()`, and the
  `saveFrame` export are presentation scaffolding, not part of the core field.
- Clean parameter object: `{sep, noiseDetail, noiseZ, angleOffset, minLen, maxLen,
  bg, strokeColor, strokeAlpha, jitter}`.
