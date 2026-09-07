---
sketch: 2018/Generativos/mountain3
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1757
animated: false
techniques: [noise-field, grid]
primitives: [shape, line]
palette:
  colors: ["#061431", "#2E52DF", "#F78DF1", "#FEFEFE", "#EC3063"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 160, tried: [320], change: large, effect: "twice as many bands; stripes about half as thick, same wave shapes and colours"}
  - {name: det, default: "random(0.01)", tried: ["random(0.003)"], change: large, effect: "lower detail = smoother field over the walk; bands tilt into consistent diagonal stripes, white bg wedge appears top-right"}
  - {name: velScale, default: 4, tried: [12], change: moderate, effect: "larger steps = slightly sharper, tighter ripples; overall band structure preserved"}
  - {name: steps, default: "width*0.2 (192)", tried: ["width*0.5 (480)"], change: none, effect: "no visible change; walk already exits the right edge before 192 steps, extra steps happen off-canvas"}
  - {name: strokeWeight, default: "random(0.5,1.2)", tried: ["random(2,4)"], change: moderate, effect: "band outline lines clearly thicker, fills slightly thinner"}
  - {name: palette, default: "5 cool colours", tried: ["5 warm dark colours"], change: large, effect: "same band structure; dark brown/maroon/crimson/magenta, red background arc at top"}
reusable_candidates:
  - {name: noiseWalkBands, signature: "noiseWalkBands(rows, noiseDetail, stepVel, steps, palette) -> shapes", note: "stack of noise-driven walks, each closed to the canvas bottom, drawn top-down so only thin bands remain"}
---

## What it draws
Full-bleed canvas of horizontally flowing, gently undulating bands stacked edge to edge, in deep navy,
blue, pink, white and crimson. Band thickness is fairly even but wobbles; the top of the image shows a
large white arc where the random background colour peeks above the first band's walk. Thin crisp stroke
lines trace the top edge of each band, some with small gaps (dashes) where the stroke colour nearly
matches the neighbouring fill.

## How the code works
`setup()` calls `generate()` once (`mountain3.pde:7`); `draw()` is empty, so the image is static.
`generate()` (lines 21-79):
- Seeds `randomSeed`/`noiseSeed` with the harness seed (lines 23-24); background is one random palette
  colour (`rcol()`, line 25) — white `#FEFEFE` for seed 42, which produces the white arc at top.
- The canvas is divided into `cc = 160` horizontal rows of height `ss = 960/160` (lines 27-28).
- For each row `i` (line 34): a walk starts at `(0, (i+0.5)*ss)` (lines 39-40). The noise detail
  `det` starts as `random(0.01)` (line 33) and is jittered ×`random(0.99,1.01)` per row (line 41).
  Step velocity `vel = (0.8 + noise(lx*det, ly*det)*1.2) * 4` (lines 42, 44); each step moves
  `cos(ang)*vel` right and `sin(ang)*vel` vertically where `ang` is 2-D noise mapped to
  `[1.5π, 2.5π]` (line 46) — cos is always ≥ 0 there, so the walk only moves right; 192 steps
  (`width*0.2`, line 45) reach x ≈ 600.
- Each walk becomes a closed shape: its points, then `(xx, height)`, then `(0, height)` (lines 55-65).
  Fill and stroke are independent random palette colours (lines 52, 54), stroke weight
  `random(0.5, 1.2)` (line 53); with 10% probability the shape is drawn as open `LINES` instead of a
  filled shape (lines 55-56), which is what leaves the small gaps/dashes along band edges.
- Shapes are drawn top row to bottom row and are opaque, so shape i+1 overpaints the lower part of
  shape i; the only visible slice of each shape is the strip between its walk and the next row's walk
  — hence the banded look, with the first row's background showing above its walk as the top arc.
- Randomness enters via: background colour, per-shape fill/stroke colour, stroke weight, the
  LINES-vs-fill coin flip, `det`'s initial value and per-row jitter, and the noise field itself.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_320 | `int cc = 160;` -> `int cc = 320;` | large | twice as many, much thinner horizontal bands; same wave shapes and colours | variants/cc_320/frame_00001.png |
| det_0.003 | `float det = random(0.01);` -> `float det = random(0.003);` | large | bands become consistent diagonal stripes running top-left to bottom-right; white background wedge visible top-right | variants/det_0.003/frame_00001.png |
| vel_12 | `vel *= 4;` -> `vel *= 12;` | moderate | similar bands but slightly sharper, tighter ripples | variants/vel_12/frame_00001.png |
| steps_0.5 | `j <= width*0.2` -> `j <= width*0.5` | none | no visible change (0 pixels differ); the walk already exits the right edge before 192 steps, so extra steps run off-canvas | variants/steps_0.5/frame_00001.png |
| stroke_2_4 | `strokeWeight(random(0.5, 1.2));` -> `strokeWeight(random(2, 4));` | moderate | stroke lines outlining each band clearly thicker; fills slightly thinner | variants/stroke_2_4/frame_00001.png |
| palette_warm | cool 5-colour palette -> `{#1A1312, #3C333B, #A84257, #D81D37, #D81D6E}` | large | same band structure; dark brown, maroon, crimson, magenta; red background arc at top | variants/palette_warm/frame_00001.png |

## Modularisation notes
The generic block is the whole per-row "noise walk closed to the bottom edge" construction: given
(rows, detail, velocity scale, steps, palette, fill-mode probability) it produces the stacked-band
composition — a clean candidate for a library function. One-off art decisions: the fixed 5-colour
palette, the `[1.5π, 2.5π]` angle range (which forces rightward-only motion), the per-row `det`
jitter, the 10% `LINES` glitch, and closing shapes to the bottom edge (which is what creates the
banding). A parameter object would be: `{rows, noiseDetail, detailJitter, velocity, steps,
strokeWeightRange, palette, linesProbability}`.
