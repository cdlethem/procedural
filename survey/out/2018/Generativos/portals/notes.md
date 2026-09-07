---
sketch: 2018/Generativos/portals
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1530
animated: false
techniques: [distortion, curves]
primitives: [shape]
palette:
  colors: ["#24A4D2", "#FBFBFB", "#E2E72C", "#92C871", "#171D31"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: lineCount, default: 1, tried: [5], change: large, effect: "5 portals instead of 1; canvas fills with big striped tubes and a dark vertical portal"}
  - {name: lineLen, default: "width*random(0.1,0.8)*random(0.8)", tried: ["width*random(0.4,1.2)"], change: moderate, effect: "one portal, much longer and wider, still a small fraction of canvas"}
  - {name: widthFactor, default: "random(0.05,0.4)", tried: ["random(0.02,0.12)"], change: none, effect: "no visible change; tube is a tiny fraction of the canvas"}
  - {name: convergeRate, default: "random(0.01,0.02)", tried: ["random(0.05,0.1)"], change: none, effect: "no visible change; close-up portal slightly squarer"}
  - {name: wanderRate, default: "random(0.01)*2", tried: ["random(0.05)*2 (crashed)", "random(0.02)*2"], change: none, effect: "no visible change; 0.05*2 throws AssertionError, retried at 0.02*2"}
  - {name: colorCycle, default: "random(0.01,0.1)*random(3)", tried: ["random(0.1,0.3)*random(3)"], change: none, effect: "no visible change; close-up tube reads more monochrome blue"}
reusable_candidates:
  - {name: portalTunnel, signature: "portalTunnel(x1, y1, x2, y2, widthFactor, converge, wander, colorCycle) -> void", note: "stacks shrinking quads between two random-walking endpoints until they meet, forming a tunnel/portal"}
  - {name: lerpPalette, signature: "lerpPalette(int[] colors, float v) -> color", note: "smooth cyclic lerp between adjacent palette entries (getColor, line 119)"}
---

## What it draws
A nearly empty very dark gray field with a single small, slightly tilted portal in the upper-right
area: a thin tube of stacked, nested quadrilaterals in sky blue, near-white, and yellow-green,
closing into a tiny dark core. The rest of the 960x960 canvas is flat dark background.

## How the code works
- `setup()` (lines 3-11) sizes the canvas 960x960 P2D, enables `smooth(8)`, and calls
  `generate()` exactly once; `draw()` (lines 13-15) is empty, so the piece is static.
  `keyPressed()` (lines 17-23) re-rolls the seed and regenerates (interactive variant of the
  same single-shot generate).
  gets a random centre `(xx, yy)`, random direction `ang`, and initial half-length
  `width*random(0.1, 0.8)*random(0.8)` (line 94), plus a width factor
  `s = random(0.05, 0.4)` (line 98).
- `Line.draw()` (lines 37-67) is the whole effect: while the distance between its two endpoints
  exceeds 1, both endpoints random-walk (angle jitter `±0.1` rad, step `vel*dis` with
  `vel = random(0.01)*2`, lines 44, 51-57) and simultaneously converge toward each other by
  `ach*dis` along the current axis (`ach = random(0.01, 0.02)`, lines 43, 59-62). The colour index
  `ic` advances by `dc = random(0.01, 0.1)*random(3)` per step (lines 41, 48), so the fill cycles
  through the palette as the tube shrinks.
- `show()` (lines 69-83) draws one closed 4-vertex shape per iteration: a quad of half-width
  `r = dis*s` perpendicular to the segment between the endpoints. Because `dis` shrinks every
  step, the quads stack from wide to narrow, producing the nested "tunnel walls" that close into
  the small core; the random walk gives the tube its gentle wobble.
- Colour: `getColor(float)` (lines 119-125) lerps between adjacent entries of the 5-colour
  palette (line 112: sky blue, near-white, yellow-green, green, dark navy) and wraps by index, so
  the blue -> white -> yellow -> green banding seen in the baseline comes from the advancing `ic`.
- No blend modes, no shaders; P2D with `smooth(8)` antialiasing.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_5 | `for (int i = 0; i < 1; i++) {` -> `for (int i = 0; i < 5; i++) {` | large | five portals; big striped blue/yellow fan lower-left, dark navy vertical portal with white core top-centre, broad diagonal band upper-left; canvas mostly covered | variants/count_5/frame_00001.png |
| len_1.2 | `float dis = width*random(0.1, 0.8)*random(0.8);` -> `float dis = width*random(0.4, 1.2);` | moderate | one portal, now long and wide: diagonal tube from top edge to right, nested blue core with dark centre, yellow-green and white banding, pale-blue outer walls | variants/len_1.2/frame_00001.png |
| w_0.12 | `random(0.05, 0.4)` -> `random(0.02, 0.12)` (line 98) | none | no visible change; same tiny portal upper right as baseline | variants/w_0.12/frame_00001.png |
| ach_0.1 | `float ach = random(0.01, 0.02);` -> `float ach = random(0.05, 0.1);` | none | no visible change; close-up portal slightly squarer with tight concentric rings | variants/ach_0.1/frame_00001.png |
| vel_0.02 | `float vel = random(0.01)*2;` -> `float vel = random(0.02)*2;` | none | no visible change. First attempt `random(0.05)*2` crashed with AssertionError (wander step too large), retried cheaper | variants/vel_0.02/frame_00001.png |
| dc_0.3 | `float dc = random(0.01, 0.1)*random(3);` -> `float dc = random(0.1, 0.3)*random(3);` | none | no visible change; close-up tube reads more monochrome blue with white core | variants/dc_0.3/frame_00001.png |

## Modularisation notes
- `Line.draw()`/`show()` (lines 37-83) is fully self-contained and generic: a "tunnel between two
  random-walking, converging endpoints" could ship as one library function taking
  `(x1, y1, x2, y2, widthFactor, convergeRate, wanderRate, colorCycle, palette)`.
- `getColor(float)` (lines 119-125) is a reusable smooth cyclic palette lerp.
- `generate()` (lines 86-106) is the one-off art decision: the portal count (hardcoded 1), the
  size range `random(0.1, 0.8)`, and the width range `random(0.05, 0.4)` are taste knobs, not
  algorithm. A clean parameter object would be
  `{count, sizeRange: [0.1, 0.8], widthRange: [0.05, 0.4], converge: [0.01, 0.02], wander: [0.0, 0.02], colorCycle: [0.01, 0.3], palette}`.
