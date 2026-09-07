---
sketch: 2020/generative/01_04/lamida
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1612
animated: false
techniques: [polar, lines-hatching, blend-modes]
primitives: [line]
palette:
  colors: ["#C91F10", "#BA1D0E", "#110E33", "#7F4365"]
  selection: lerp-between
composition: radial
parameters:
  - {name: layers, default: 400, tried: [120], change: moderate, effect: "fewer arc layers: large flat fan sectors and more empty gaps, less additive glow"}
  - {name: alpScale, default: 0.22, tried: [0.55], change: large, effect: "higher alpha: much brighter, large blown-out white areas, center almost fully white under ADD"}
  - {name: strokeWeight, default: "random(1, random(1, 2))", tried: "random(3, random(3, 6))", change: large, effect: "thicker strokes: spokes become chunky bars/ribbons, coarser texture"}
  - {name: r2Range, default: "width*random(0.2, 0.8)", tried: "width*random(0.3, 1.1)", change: moderate, effect: "arcs extend further out toward canvas edges, darker empty corners"}
  - {name: twistAmp, default: 0.1, tried: [0.4], change: subtle, effect: "no visible change at this magnitude; arcs look essentially the same"}
reusable_candidates:
  - {name: radialSpokes, signature: "radialSpokes(cx, cy, rIn, rOut, count, twist, alphaFn, colorFn, weight) -> void", note: "concentric arc of radial line segments around a center, per-segment angle offset"}
  - {name: lerpPalette, signature: "lerpPalette(colors, v) -> color", note: "smoothly interpolate between adjacent palette entries via lerpColor with pow-eased fraction"}
---

## What it draws
A radial burst on black: hundreds of thin line segments arranged in concentric arcs around a small dark hole slightly left of center, spanning roughly 40% to 90% of the canvas width. The arcs read as partial rings of spokes — some dense, some sparse — in deep red, orange-red, pink-magenta and dark navy. Where many strokes overlap they additively brighten into near-white bands. The overall effect is a pinwheel / fan-like explosion of layered arcs.

## How the code works
- `setup()` calls `generate()` once (line 24); `draw()` is empty (line 35), so the image is static. Frames 10/60 of the baseline are nearly white with a few stray strokes — a headless P3D buffer artifact, not animation.
- `generate()` (lines 46-87): black background (line 48), `blendMode(ADD)` (line 58), center at (width*0.5, height*0.5) (lines 55-56).
- Outer loop `k = 0..400` (line 60): 400 "layer" rings, each with a small random Z translation (line 62) that is visually irrelevant.
- Per layer: inner radius `r1 = width*random(0.01,0.3)` (line 63), outer radius `r2 = width*random(0.2,0.8)`, then `r1 = lerp(r1, r2, random(random(0.8)))` (lines 64-65) so rings cluster toward the outer radius.
- Segment count `res = int(random(22,93)*int(random(100)))` (line 66) — typically a few hundred, then reduced by a random fraction (line 68), giving the sparse-vs-dense arc variety.
- Angle step `da = TAU*random(1*random(1))/res` (line 67): random fraction of a full turn per segment, so each layer covers a random arc span, not a full circle.
- Inner loop (lines 76-84): for each segment, angle `a = da*i + sin(i*TAU*rot/res)*0.1` (line 78) — the sine adds a wobble/twist; `rot` is a random 0..3 rounded to 1/8 (lines 70-71). A line is drawn from `(cx+cos(a)*r1, cy+sin(a)*r1)` to the same angle at radius `r2` (lines 82-83) — a radial spoke at a fixed angle, so consecutive segments form an arc.
- Colour: `getColor(a*a*vc+dc)` (line 79) walks the 4-colour palette `colors[]` (line 97: #C91F10, #BA1D0E, #110E33, #7F4365) with `lerpColor` between adjacent entries (lines 106-111), so colour varies smoothly along the arc. `vc = random(0.2)` controls how fast colour cycles with angle.
- Alpha: `random(120,240)*0.22*random(0.6,1)` modulated by `1-abs(sin(v*PI*alpOsc))` (lines 74-75, 79) — per-segment alpha fades in/out along the arc, making the ADD blending brighten some arcs into white.
- Stroke weight: `random(1, random(1,2))` (line 80), i.e. 1..2 px, so strokes are thin and the additive accumulation does the work.
- Imports of `triangulate` and `toxi` SimplexNoise are present but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| layers_120 | `for (int k = 0; k < 400; k++)` -> `... k < 120; ...` | moderate (mean 0.0975, 23.1% px) | fewer arc layers: large flat fan sectors, more empty gaps, less additive glow | variants/layers_120/frame_00001.png |
| alpha_0.55 | `random(120, 240)*0.22*...` -> `*0.55*...` | large (mean 0.2246, 86.5% px) | much brighter, large blown-out white areas, center almost fully white under ADD | variants/alpha_0.55/frame_00001.png |
| weight_3_6 | `strokeWeight(random(1, random(1, 2)))` -> `random(3, random(3, 6))` | large (mean 0.2744, 88.1% px) | thicker strokes: spokes become chunky bars/ribbons, coarser texture | variants/weight_3_6/frame_00001.png |
| r2_0.3_1.1 | `width*random(0.2, 0.8)` -> `width*random(0.3, 1.1)` | moderate (mean 0.085, 29.3% px) | arcs extend further out toward canvas edges, darker empty corners | variants/r2_0.3_1.1/frame_00001.png |
| twist_0.4 | `sin(i*TAU*rot/res)*0.1` -> `*0.4` | subtle (mean 0.0441, 12.9% px) | no visible change at this magnitude; arcs look essentially the same | variants/twist_0.4/frame_00001.png |

## Modularisation notes
- Generic: the per-layer spoke-arc generator (radius pair, segment count, arc span, sine twist, per-segment colour and alpha functions) is a clean library function; the `lerpPalette` helper (line 106) is directly reusable.
- One-off art decisions: the 4-colour palette, the `ADD` blend mode, the lerp-bias of `r1` toward `r2` (lines 64-65), the `random(random(0.8))` double-random for organic spread, and the 400-layer count.
- A clean parameter object: `{center, layers, rInMin, rInMax, rOutMin, rOutMax, segMin, segMax, twistAmp, rotSteps, colorSpeed, alphaBase, alphaMod, weightMin, weightMax, blend, palette}`.
- The `translate(0,0,random(40))` Z jitter (line 62) has no visible effect in 2D and could be dropped.
