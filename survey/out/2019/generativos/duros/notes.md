---
sketch: 2019/generativos/duros
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3255
animated: false
techniques: [flow-field, noise-field, grid, lines-hatching, blend-modes]
primitives: [line]
palette:
  colors: ["#F23602", "#300F96", "#C9FFF6", "#F72C81", "#09EFA6", "#fac62a"]
  selection: random-from-list
composition: full-bleed
parameters: []
parameters:
  - {name: alpha_mult, default: 0.4, tried: [1.0], change: large, effect: "3x stroke alpha: whole image far brighter, ribbons blow out near-white"}
  - {name: strokeWeight, default: 2, tried: [1], change: moderate, effect: "thinner strokes: texture darker and finer, ribbons slightly less bright"}
  - {name: defAmp, default: 100, tried: [30], change: moderate, effect: "smaller displacement: denser, more uniform texture; ribbons become wider defined bands"}
  - {name: larMax, default: 60, tried: [15], change: moderate, effect: "4x shorter strokes: mostly dark canvas with faint ribbon traces"}
  - {name: gridStep, default: 2, tried: [6], change: moderate, effect: "9x fewer sample points: nearly black, only faint ribbon traces remain"}
  - {name: bb, default: 30, tried: [240], change: moderate, effect: "draw region shrinks to a centred square with black border"}
  - {name: quantizedFlowDisplacement, signature: "def(x, y, detDef, detAmp, seed) -> PVector", note: "noise angle quantized in 1/8 steps + simplex amplitude, displaces a grid point up to 100 px"}
  - {name: shortFlowHatch, signature: "shortFlowHatch(gridStep, inset, segMax, ampMax, alpha) -> void", note: "dense grid of 0..N short polylines along a simplex angle field, ADD-blended"}
  - {name: paletteLerpColor, signature: "getColor(v, power) -> color", note: "lerp between adjacent palette entries driven by a scalar noise value"}
---

## What it draws
Full-bleed dark canvas: a dense hair-like texture of tens of thousands of tiny 1–60 px line segments fills the frame in deep maroon/red-brown across the top half and dark indigo-purple below, over black. A few bright magenta-pink ribbons stand out: one wide S-curve sweeping across the upper third, one descending from the upper-right through the centre to the lower-right, and a faint pale curve in the lower-left. Thin black margin around the edges. (Frames 10/60 render pure white in the headless P3D run — a framebuffer-clear artifact, not animation: `draw()` is empty.)

## How the code works
- `setup()` calls `generate()` once (duros.pde:21-23); `draw()` is empty (31-32), so the image is static. Any key press re-rolls the seed (34-40).
- Grid: nested loop over the canvas in 2 px steps, inset `bb = 30` px (80-83). Each sample point is `(i, j + cos(x*0.2))` — a small horizontal wobble (84-85).
| alpha_1.0 | `stroke(getColor(n2*30+ang*0.05, pwrCol), random(40, 50)*0.4);` -> same line with `*0.4` removed | large | whole image ~3x brighter: top vivid orange-red, centre saturated magenta-purple, lower-left olive; ribbons blow out to near-white pink; hair texture much more visible | variants/alpha_1.0/frame_00001.png |
| strokeWeight_1 | `strokeWeight(2);` -> `strokeWeight(1);` | moderate | same composition; hair texture finer and darker, ribbons slightly thinner and dimmer | variants/strokeWeight_1/frame_00001.png |
| amp_30 | `float amp = (float) (SimplexNoise.noise(x*detAmp, y*detAmp, seed)*0.5+0.5)*100;` -> `*30;` | moderate | overall darkness unchanged; texture denser and more uniform (strokes stay near the grid) and the ribbons become wider, better-defined pink bands | variants/amp_30/frame_00001.png |
| lar_15 | `float lar = noise(desLar+x*detLar, desLar+y+detLar)*60;` -> `*15;` | moderate | 4x shorter strokes: canvas mostly dark with faint maroon/olive tinting; ribbons reduced to thin dark-violet lines | variants/lar_15/frame_00001.png |
| gridstep_6 | `for (float j = bb; j < height-bb; j+=2) {` and the matching `i+=2` line -> both `+=6` | moderate | 9x fewer sample points: nearly black frame with only faint dark-magenta ribbon traces and barely visible hatching | variants/gridstep_6/frame_00001.png |
| bb_240 | `float bb = 30;` -> `float bb = 240;` | moderate | draw region shrinks to the central 480x480 with a black border; interior texture and ribbons are the same, cropped | variants/bb_240/frame_00001.png |
- Stroke: `getColor(n2*30 + ang*0.05, pwrCol)` with alpha `random(40,50)*0.4` ≈ 16–20 (94), `strokeWeight(2)` (81), `blendMode(ADD)` (75) over a black background (54). Low alpha + ADD makes overlapping strokes build up brightness.
- `def(x, y)` (108-116) displaces the grid point: angle from 3-D `noise`, quantized to 1/8 steps with a smooth step (110-113), multiplied by TAU (113); amplitude = simplex mapped to 0..1 × 100 px (114). Where the quantized direction rotates and amplitude is large, strokes pile into the bright ribbons; elsewhere they scatter as the fine texture.
- Palette: fixed 6 colours (143); `randPallets()` keeps a random subset of 3–5 (123-132); `getColor(v, p)` lerps between the two adjacent palette entries at `v` with a power curve (150-155). Randomness enters via `randomSeed`/`noiseSeed` (44-45) and the per-call `random()` for the palette subset and alpha.
- Renderer P3D, 960×960, `smooth(8)` (16-17).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic, library-worthy: the `def()` quantized-displacement field (angle quantization + simplex amplitude is a self-contained transform), the dense short-polyline hatch over a grid with ADD blending, and the palette-lerp colour function.
- One-off art decisions: the 6-colour neon palette and its random 3–5 subset, the `cos(x*0.2)` row wobble, the exact alpha range, and the 1/8 angle quantization step (a style choice that creates the ribbon banding).
- A clean parameter object would hold: `gridStep`, `inset (bb)`, `segMax` (lar scale), `ampMax` (def displacement), `angleDetail`/`ampDetail`, `quantizeStep`, `alphaMin/alphaMax`, `strokeWeight`, `palette[]`, `paletteSubsetSize`.
