---
sketch: 2018/Generativos/chea02
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1670
animated: false
techniques: [lines-hatching, dots-stippling]
primitives: [line, rect, ellipse]
palette:
  colors: ["#FACD00", "#FB4F00", "#F277C5", "#7D57C6", "#00B187", "#3DC1CD"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: nSegments, default: 60, tried: [20], change: large, effect: "fewer segments = much sparser web; individual curves and concentric rings become visible, large empty areas"}
  - {name: lineAlpha, default: 10, tried: [100], change: none, effect: "no visible change - the faint straight base lines contribute almost nothing either way"}
  - {name: stepDensity, default: 2, tried: [8], change: moderate, effect: "4x more steps per segment = thicker, denser, more saturated ribbons, same overall composition"}
  - {name: ampRange, default: 400, tried: [200], change: moderate, effect: "halving the start-size range thins strokes near segment starts; web reads slightly lighter, central green arc more prominent"}
  - {name: alpRange, default: 40, tried: [120], change: moderate, effect: "higher start alpha = more opaque strokes, web more saturated, especially mid-band and lower orange area"}
reusable_candidates:
  - {name: decorateSegment, signature: "decorateSegment(p1, p2, color, count, ampRange, alphaRange, osc) -> void", note: "place rotated square outlines and small dots along a line segment, lerping size/angle/alpha from p1 to p2"}
---

## What it draws
Full-bleed tangle of very translucent overlapping strokes on a solid green/teal ground. The strokes form a loose web of sweeping curves and zigzag ribbons in magenta/pink, orange, and yellow-green, denser in the lower half and in a diagonal band across the top left. No solid shapes: everything reads as layered see-through outlines, with occasional small bright specks (tiny ellipses) sitting at the ends of short segments.

## How the code works
`setup()` calls `generate()` once (draw() is empty, so the image is static). `generate()` (lines 22-60):
- Seeds `random`/`noise` with `seed` (line 24-25) and fills the background with one random palette colour (`background(rcol())`, line 26) — here a mid green.
- Palette (line 88): six fixed hex colours; `rcol()` (line 89-91) picks one at random.
- Outer loop (line 30): 60 iterations. Each picks two random points up to 200 px outside the canvas (lines 31-34) and one random colour (line 35), then draws a single straight `line` with alpha 10 — barely visible (line 36-37).
- Inner loop (lines 47-58): `cc = int(dist*2)` (line 41) steps along the segment. At each step it lerps position between the two endpoints, lerps a rotation angle between two random angles, and lerps a size `amp` between two random values in 0..400 (lines 42-43, 48-54); it strokes a centred, rotated square outline (`noFill`, line 29) plus one small ellipse whose size oscillates with `cos(j*osc1)` (line 55-56). Alpha of these strokes lerps between two random values 0..40 (lines 44-45, 49).
- So the visible image is not the straight lines but the thousands of overlapping rotated square outlines; their edges, densely sampled along each segment with smoothly lerped angle/size, read as flowing curves. Heavy alpha overlap builds the saturated web.
- `arc2()` (line 62-80) is dead code - never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| nLines_20 | `for (int i = 0; i < 60; i++) {` -> `... i < 20 ...` | large | web much sparser: roughly a third of the stroke coverage, individual sweeping curves and a set of concentric rings visible mid-right, large empty green areas | variants/nLines_20/frame_00001.png |
| lineAlpha_100 | `stroke(col, 10);` -> `stroke(col, 100);` | none | no visible change | variants/lineAlpha_100/frame_00001.png |
| stepDensity_8 | `int cc = int(dist*2);` -> `int cc = int(dist*8);` | moderate | same 60-segment composition but ribbons are clearly denser and more saturated; curves read as thicker bands, more texture in the pink top and the bottom web | variants/stepDensity_8/frame_00001.png |
| amp1_200 | `float amp1 = random(400);` -> `random(200);` | moderate | subtle thinning of part of the web (smaller squares near segment starts); mid green arc more prominent against the rest | variants/amp1_200/frame_00001.png |
| alp1_120 | `float alp1 = random(40)*random(1);` -> `random(120)*random(1);` | moderate | strokes more opaque: web reads more saturated overall, strongest in the mid green band and the lower orange area, colours blend into a thicker mat | variants/alp1_120/frame_00001.png |

## Modularisation notes
- Generic: `decorateSegment` — walk a segment with N steps, lerp position/angle/size/alpha, draw rotated rect outlines + dots. Parameterisable (step count, size range, alpha range, oscillation frequency) and renderer-agnostic.
- Generic: `rcol()` / `getColor(float)` — random palette pick and fractional lerp-between-neighbours colour sampler; both are small library utilities.
- One-off art decisions: the 60-segment count, the 200 px overshoot of the endpoints, the `dist*2` step density, the 0..400 size range, the 0..40 alpha ceiling, and the specific 6-colour palette. A clean parameter object would be: `{nSegments, endpointMargin, stepDensity, ampRange, alphaRange, oscRange, palette, background}`.
- `arc2()` is dead code (never called) — drop it.
