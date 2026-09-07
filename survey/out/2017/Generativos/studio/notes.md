---
sketch: 2017/Generativos/studio
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 253
animated: false
techniques: [packing]
primitives: [ellipse]
palette:
  colors: ["#DB7654", "#893D60", "#D6241E", "#F2AC2A", "#3D71B7", "#FFEEED", "#85749D", "#21232E", "#5FA25A", "#5D8EB4"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(100000*random(1)))", tried: [300], change: subtle, effect: "fewer circles, sparser pack, more green background showing; overall density still reads similar"}
  - {name: maxSize, default: 320, tried: [120], change: moderate, effect: "no large rings; much finer texture of small circles and dots"}
  - {name: strokeWeightRange, default: "p.z*random(0.01,0.08)", tried: ["p.z*random(0.03,0.12)"], change: subtle, effect: "strokes ~40% thicker on every circle, most visible on the big rings (measured 9->13 px at same crossing)"}
  - {name: segs, default: "random(3,9)", tried: ["random(8,20)"], change: subtle, effect: "ring dashes finer: more, shorter arc segments; overall look similar"}
  - {name: radiusLimit, default: "cx*1.5-s", tried: ["cx*2.0-s"], change: moderate, effect: "packing extends to all four corners; coverage uniform full-bleed instead of centre-biased"}
reusable_candidates:
  - {name: packCircles, signature: "packCircles(cx, cy, maxCount, maxSize, radiusLimit) -> PVector[]", note: "poisson-disk-ish rejection sampling of non-overlapping circles around a center"}
  - {name: dashedCircle, signature: "dashedCircle(x, y, d, startAngle, segments) -> void", note: "circle outline as contiguous random-length arc segments, each a single colour, never the background colour"}
---

## What it draws
A flat green field completely covered with hundreds of non-overlapping circle outlines of widely varying sizes, from large bold rings to tiny dots. Each outline is broken into 3–8 thick arc segments, each segment a single solid colour from a 10-colour palette (salmon, plum, red, ochre, blue, cream, muted purple, near-black, greens). The circles are packed densest near the centre and get sparser toward the edges, with one or two very large circles anchoring the composition.

## How the code works
`setup()` calls `generate()` once (line 7); `draw()` is empty, so the sketch is static. `render()` (lines 33–127) reseeds `noise`/`random` from the harness seed (lines 35–36), picks a random background colour from the 10-colour `colors[]` array (line 39), then runs the packing loop: up to `random(100000)` candidates (line 67), each with a random size `s` up to 320 (line 69), placed at a random angle and a random distance `d < cx*1.5-s` from the centre (lines 70–73) — this radial cap is what biases the pack toward the middle. A candidate is accepted only if it does not touch any previously accepted circle (distance test line 78). Each accepted point is then drawn by `colorCircle` (lines 199–217): the circumference is cut into `seg` (3–8, line 103) contiguous arc segments at random breakpoints, each stroked with a single random palette colour (re-drawn if it equals the background, line 212) and a stroke weight proportional to the circle's size (lines 108–111). The commented-out blocks (lines 42–60, 88–95, 114–124) show earlier polygon/line variants of the same idea.

## Experiments
| variant | substitution | change score | observation | image |
| cc_300 | `int cc = int(random(100000*random(1)));` -> `int cc = 300;` | subtle | sparser pack: fewer, more scattered circles, larger green gaps between them | variants/cc_300/frame_00001.png |
| maxSize_120 | `float s = random(320);` -> `float s = random(120);` | moderate | no large rings at all; dense fine texture of small circles and dots | variants/maxSize_120/frame_00001.png |
| strokeW_0.03_0.12 | `float ss = max(1, p.z*random(0.01, 0.08));` -> `max(1, p.z*random(0.03, 0.12));` | subtle | same circles/segments, strokes visibly thicker (9->13 px at a measured crossing) but rings cover few pixels | variants/strokeW_0.03_0.12/frame_00001.png |
| segs_8_20 | `int seg = int(random(3, 9));` -> `int seg = int(random(8, 20));` | subtle | dashes on every ring broken into more, shorter segments; composition unchanged | variants/segs_8_20/frame_00001.png |
| radius_2.0 | `float d = random(cx*1.5-s);` -> `float d = random(cx*2.0-s);` | moderate | circles now reach the corners; even full-bleed coverage, centre bias gone | variants/radius_2.0/frame_00001.png |

## Modularisation notes
The generic pieces: the rejection-sampling circle packer (centre + max count + max size + radius limit → accepted circles) and the segmented-arc "dashed circle" drawer (centre, size, segment count → arcs). Both are palette-independent and could ship as library functions. One-off art decisions: the 10-colour palette, the `cx*1.5` radius cap (centre bias), the stroke-weight formula (`p.z * random(0.01, 0.08)`), and the "never stroke in the background colour" rule. A clean parameter object would be `{seed, background, circleCount, maxSize, radiusLimit, segmentsRange, strokeWeightRange, palette}`.
