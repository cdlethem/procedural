---
sketch: 2015/Generativos/caritas
year: 2015
renderer: JAVA2D
size: [640, 640]
libraries: []
deterministic: true
ms_first_frame: 151
animated: false
techniques: [agents, curves]
primitives: [ellipse, shape]
palette:
  colors: ["#28222C", "#1A1715", "#671616"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: headSize, default: "random(10, 240)", tried: ["random(300, 640)"], change: moderate, effect: "head grows to ~400px and dominates the canvas; eyes and mouth scale up proportionally"}
  - {name: headHue, default: "random(50)", tried: ["random(180, 240)"], change: subtle, effect: "peach head becomes pale light blue; only ~6% of pixels change because the head is mostly off-canvas"}
  - {name: eyeScale, default: "random(0.08, 0.18)", tried: ["random(0.02, 0.06)"], change: none, effect: "no visible change"}
  - {name: mouthWeight, default: "headSize*random(0.04, 0.18)", tried: "headSize*random(0.005, 0.02)", change: none, effect: "no visible change"}
  - {name: eyeAlpha, default: "random(80)", tried: ["random(255)"], change: none, effect: "no visible change (image identical to baseline)"}
reusable_candidates:
  - {name: randomFace, signature: "randomFace(headSize, hueRange, eyeScale, mouthWeight) -> Person", note: "single cartoon face: head ellipse + 2 eyes + curve mouth, all sizes derived from headSize ratios"}
---

## What it draws
One cartoon face on a plain light-gray background, positioned at a random spot — in the seed-42 baseline it sits at the left edge, partly cut off. The face is a big desaturated peach circle (head) with two small dark round eyes and a thick dark-maroon curved line for a mouth. Nothing else is drawn.

## How the code works
`caritas.pde` `setup()` (lines 1-5): `size(640,640)`, `colorMode(HSB, 360, 100, 100)`, then `generate()`; `draw()` is empty so the piece is static (one face per run, redrawn on any key press). `generate()` (lines 15-19) constructs one `Person` and calls `show()`.

`Person.pde`: the constructor (line 5) picks a random `age` that is never used. `show()` (lines 7-37) draws everything with all geometry random:
- Position: `x = width/2*random(0,2)`, `y = height/2*random(0,2)` (lines 8-9) — uniform over the canvas, so the face is often clipped by the edges.
- Head: `headSize = random(10, 240)` (line 10); one filled `ellipse` (line 13) with HSB `fill(random(50), random(8, 40), random(80, 100))` (line 12) — hue 0-50, low saturation, high brightness, which is the peach/salmon tone.
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| headSize_640 | `float headSize = random(10, 240);` -> `float headSize = random(300, 640);` | moderate | head grows to ~400px covering the left half, still clipped at the edge; the eye (now large enough to show its translucent lid ring) and the maroon mouth scale up proportionally | variants/headSize_640/frame_00001.png |
| hue_240 | `fill(random(50), random(8, 40), random(80, 100));` -> `fill(random(180, 240), random(8, 40), random(80, 100));` | subtle | subtle: head colour shifts from pale peach to pale light blue; same size/position, and because the head is mostly off-canvas only ~6% of pixels differ | variants/hue_240/frame_00001.png |
| eyeScale_0.06 | `float eyeSize = headSize*random(0.08, 0.18);` -> `float eyeSize = headSize*random(0.02, 0.06);` | none | no visible change (eye area is ~0.1% of the canvas) | variants/eyeScale_0.06/frame_00001.png |
| mouthWeight_0.02 | `strokeWeight(headSize*random(0.04, 0.18));` -> `strokeWeight(headSize*random(0.005, 0.02));` | none | no visible change (mouth stroke covers only ~0.5% of pixels) | variants/mouthWeight_0.02/frame_00001.png |
| eyeAlpha_255 | `fill(#28222C, random(80));` -> `fill(#28222C, random(255));` | none | no visible change (frame is pixel-identical to baseline) | variants/eyeAlpha_255/frame_00001.png |

Randomness is the entire composition: every position, size, and the head colour come from `random()`. No noise, no blend modes, plain JAVA2D.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `Person.show()` is a self-contained "draw one cartoon face at a random position" routine; a clean `randomFace(params)` would take a parameter object: `{headSize: [10,240], hue: [0,50], sat: [8,40], bri: [80,100], eyeScale: [0.08,0.18], eyeSepScale: [0.12,0.5], mouthWeightScale: [0.04,0.18], eyeAlpha: [0,80]}` plus the fixed accent colours (`#28222C`, `#1A1715`, `#671616`).
- One-off art decisions: the HSB mode is set in the main tab while `Person.pde` mixes HSB calls (head) with packed-hex calls (eyes, mouth) — a library version should take colours explicitly, not rely on the global colour mode.
- The `age` field is dead code (generated, never used).
- The single-face-per-frame structure (empty `draw()`, regenerate on keypress) is the sketch's workflow, not the art: a library function should just draw one face per call.
