---
sketch: 2020/generative/05_08/rabia
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1554
animated: false
techniques: [grid, particles]
primitives: [ellipse, line]
palette:
  colors: ["#DD1616", "#72522A", "#EDF4F9", "#EA9FB6", "#202DA3"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: n, default: 200, tried: [500], change: moderate, effect: "5x more figures; canvas gets dense and overlapping, especially in the lower half"}
  - {name: haloAlpha, default: 50, tried: [150], change: moderate, effect: "elliptical halos become strong opaque-looking discs in red/blue/pink that compete with the figures"}
  - {name: strokeWeight, default: "random(1,8)", tried: ["random(4,12)"], change: subtle, effect: "lines slightly thicker, mostly visible on the large bottom figures; composition unchanged"}
  - {name: sizeBase, default: 0.1, tried: [0.2], change: moderate, effect: "figures 2x larger; bottom half becomes a tangle of overlapping limbs"}
  - {name: legAmp, default: 1.8, tried: [3.5], change: subtle, effect: "leg segments longer on some figures; positions and sizes unchanged, overall field nearly identical"}
reusable_candidates:
  - {name: stickFigure, signature: "stickFigure(x, y, size, pose) -> void", note: "random-pose articulated line figure (head, arms with elbows+hands, legs with knees+feet) built from chained cos/sin segments"}
  - {name: snappedScatter, signature: "snappedScatter(n, cell, w, h) -> [x,y][]", note: "n random points snapped to a fixed grid cell"}
  - {name: lerpPaletteBg, signature: "lerpPaletteBg(colors[], v) -> color", note: "background colour lerped between two adjacent palette entries"}
---

## What it draws
A full-bleed field of tiny stick figures in angry running/falling poses, scattered across a
muted blue-violet background. Each figure is a few thin line segments in one of five colours
(bright red, olive-brown, off-white, pink, dark blue), and each sits on top of a soft
translucent circular blob. Figures in the lower half of the canvas are noticeably larger than
those at the top, giving a rough sense of depth. Denser and busier towards the bottom.

## How the code works
`setup()`/`draw()` both call `generate()` (lines 20-34); every call redraws the same seed, so
frames 1/10/60 are identical (static). `generate()` (lines 45-136):
- `randomSeed(seed)`/`noiseSeed(seed)` (47-48) make the run deterministic; background is a
  lerp between two adjacent entries of the 5-colour palette `colors[]` (lines 144, 149-158),
  which is why the base is a blue-violet mix of `#202DA3` and `#DD1616`.
- Loop of 200 figures (line 52): position is random then snapped to a 32px grid
  (`xx -= xx%32`, lines 55-56) — the grid technique.
- Figure size `ss = width*0.1*(0.5+yy/height)*random(2)` (line 57): grows linearly with `yy`,
  which produces the depth cue (bigger at the bottom).
- Each figure: a translucent ellipse `fill(rcol(), random(50))` (line 59) — the soft halo;
  then a chain of line segments (stroke weight `random(1,8)`, line 62) with angles
  `ang1..ang11` (lines 64-134): a body line, a crossbar, two elbow→hand arm segments, and two
  knee→foot leg segments, all chained with `lerp(random angle, HALF_PI, random)` so limbs
  tend to dangle downward — the "angry fall" pose.
- Colour per figure is `rcol()` (lines 145-147), a uniform random pick from the 5-colour list.
- Imports of triangulate/toxi (lines 1-2) are unused in this sketch.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_500 | `for (int i = 0; i < 200; i++)` -> `for (int i = 0; i < 500; i++)` | moderate | field is far denser; figures overlap each other and the halos merge into big patches, strongest in the lower half | variants/count_500/frame_00001.png |
| alpha_150 | `fill(rcol(), random(50));` -> `fill(rcol(), random(150));` | moderate | halos turn into large near-opaque discs (red, blue, pink) that now dominate the background; figures still readable on top | variants/alpha_150/frame_00001.png |
| weight_12 | `strokeWeight(random(1, 8)*random(1));` -> `strokeWeight(random(4, 12)*random(1));` | subtle | strokes slightly thicker, visible mainly on the big bottom figures; overall composition and density look the same | variants/weight_12/frame_00001.png |
| size_0.2 | `float ss = width*0.1*(0.5+yy/height)*random(2);` -> `float ss = width*0.2*(0.5+yy/height)*random(2);` | moderate | all figures about twice as large; the bottom half becomes a dense tangle of overlapping limbs and halos | variants/size_0.2/frame_00001.png |
| legs_3.5 | `float amp8 = amp2*random(1.4, 2.6)*1.8;` -> `float amp8 = amp2*random(1.4, 2.6)*3.5;` | subtle | a few figures show visibly longer dangling legs; figure positions, sizes and overall density unchanged | variants/legs_3.5/frame_00001.png |

## Modularisation notes
- The whole per-figure construction (lines 53-134) is a self-contained `stickFigure(x, y, ss,
  strokeColor)` routine: chained `cos/sin` segment growth with a downward bias — a good
  library primitive for "random-pose stick figure".
- Grid snapping (lines 55-56) and the y-dependent size (line 57) are small generic scatter
  helpers: `snappedScatter` and a depth-scaled placement.
- Palette handling (`rcol`, `getColor`, lines 144-158) is a reusable two-stage palette:
  uniform pick for elements + adjacent-lerp for the background.
- One-off art decisions: the exact limb angle ranges (`-HALF_PI..HALF_PI` around `PI+rand(PI)`),
  the amplitude multipliers (`0.08`, `0.05`, `1.8`), and the 5-colour list.
- Clean parameter object: {n, cell, sizeBase, sizeYFalloff, alpha, strokeWeightRange,
  limbAmpArms, limbAmpLegs, palette}.
