---
sketch: 2020/generative/01_04/gradds
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1475
animated: false
techniques: [blend-modes]
primitives: [shape]
palette:
  colors: ["#7D7FD8", "#F7AA06", "#EA79B7", "#FF0739", "#12315E"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: vertexGradient, signature: "vertexGradient(c1, a1, c2, a2) -> void", note: "full-bleed quad (TRIANGLE_STRIP, 4 corner vertices) whose per-vertex fill interpolation renders as a smooth vertical two-colour gradient"}
  - {name: randomColor, signature: "randomColor(colors[]) -> int", note: "uniform pick from a palette array"}
  - {name: alpha, line: 51, default: "random(random(256), 256)", tested: [255, 60], effect: "fill transparency of both gradient colours (both call sites); 255 gives the pure palette colours, 60 washes the gradient almost out"}
  - {name: background, line: 48, default: 230, tested: [0], effect: "backdrop the semi-transparent gradient composites over; 0 (black) makes the same two colours darker and more saturated"}
  - {name: palette, line: 65, default: "[#7D7FD8, #F7AA06, #EA79B7, #FF0739, #12315E]", tested: ["[#354998, #D0302B, #F76684, #FCFAEF, #FDC400]"], effect: "colour set; two entries (indices 3 and 0 at seed 42) are picked for the top and bottom of the gradient"}
  - {name: smooth, line: 17, default: 8, tested: [1], effect: "anti-aliasing level; no visible effect on the full-bleed gradient"}

## What it draws
A full-bleed smooth vertical gradient, seed 42: crimson-pink across the top fading
down through mauve to periwinkle blue-purple at the bottom. The colours are slightly
washed out and lighter than pure palette values because both fills are semi-transparent
over a light gray background. No shapes, lines, or texture are visible.

## How the code works
- `settings()` (lines 14-19): P3D canvas 960x960, `smooth(8)`, `pixelDensity(2)`.
- `setup()` (line 21) calls `generate()` once; `draw()` is empty, so the image is static.
- `generate()` (lines 44-58): seeds with `randomSeed`/`noiseSeed`, paints
  `background(230)` (light gray), then `beginShape()` with no mode argument, which
  defaults to TRIANGLE_STRIP.
- Four corner vertices are emitted (lines 52-56). `fill(rcol(), random(random(256),256))`
  is called before vertex 1 (line 51) and again before vertex 3 (line 54), so vertices
  1-2 carry colour c1 and vertices 3-4 carry colour c2. Processing interpolates fill
  per vertex, so the two triangles blend smoothly from c1 to c2. Because the top two
  vertices share c1 and the bottom two share c2, the result is a clean vertical
  gradient.
- `rcol()` (line 68) picks one colour uniformly from the 5-colour palette at line 65;
| alpha_255 | `random(random(256), 256)` -> `255` (both fills) | moderate (mean 0.0841, 39% px) | Same crimson-to-periwinkle gradient, now fully opaque: top (254,8,59) = pure #FF0739, bottom (126,126,214) = pure #7D7FD8; the gray wash is gone | variants/alpha_255/frame_00001.png |
| alpha_60 | `random(random(256), 256)` -> `60` (both fills) | large (mean 0.2749, 100% px) | Very pale washed-out gradient: pale pink top (236,178,190) to pale lavender bottom (206,205,226); the gray background now dominates the image | variants/alpha_60/frame_00001.png |
| background_0 | `background(230);` -> `background(0);` | large (mean 0.1523, 74% px) | Same two palette colours (deterministic seed) composited over black instead of gray: deep crimson top (179,6,41), dark periwinkle bottom (121,120,205); more saturated and darker | variants/background_0/frame_00001.png |
| palette_alt | palette array -> the commented-out alternate set (line 66) | large (mean 0.2521, 91% px) | Same index picks (3 top, 0 bottom) now map to the alternate palette: cream top (244,243,236) ~= #FCFAEF, slate blue bottom (63,81,156) ~= #354998 | variants/palette_alt/frame_00001.png |
| smooth_1 | `smooth(8);` -> `smooth(1);` | none (mean 0.0) | No visible change: anti-aliasing level does not affect the full-bleed gradient | variants/smooth_1/frame_00001.png |
  and the gray background shows through, lightening the gradient.
- The imports of `triangulate` and toxi `SimplexNoise` (lines 1-2) are never used;
  `getColor()` (lines 72-81) is a palette-lerp helper also never called. Any non-'s'
  key press regenerates with a fresh random seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The whole visual is one generic primitive: a full-bleed two-colour gradient via a
4-vertex TRIANGLE_STRIP quad with per-vertex fill interpolation (c1 on the top edge,
c2 on the bottom edge). A library function `vertexGradient(c1, a1, c2, a2)` (or a
named "gradient background" helper) would capture it exactly; the art decisions are
only the palette, the two random alpha values, and the gray background value.
`randomColor(colors[])` is a trivial reusable helper. Everything else (key-press
regeneration, saveImage timestamping) is one-off scaffolding.
