---
sketch: 2020/generative/05_08/poses
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1550
animated: false
techniques: [agents, grid]
primitives: [ellipse, line]
palette:
  colors: ["#DD1616", "#72522A", "#EDF4F9", "#EA9FB6", "#202DA3"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 20, tried: [60], change: moderate, effect: "3x more figures; scene becomes a dense crowd of overlapping poses"}
  - {name: ss (figure/disc scale), default: 0.1, tried: [0.2], change: moderate, effect: "discs and all limb segments double; figures spill off-canvas"}
  - {name: discAlpha, default: 50, tried: [200], change: subtle, effect: "discs show the true palette colours (deep indigo, red, brown, pink) instead of pale pastels"}
  - {name: strokeWeight, default: "random(1,4)", tried: ["random(8,12)"], change: subtle, effect: "thick marker-like strokes; figures read as bold chunky doodles"}
  - {name: legLengthFactor (amp8), default: 1.8, tried: [4], change: subtle, effect: "legs ~2.2x longer, figures get lanky/spidery; arms and head unchanged"}
reusable_candidates:
  - {name: stickFigure, signature: "stickFigure(x, y, size, seed) -> void", note: "random jointed skeleton (head, torso, 2 arms w/ elbow+hand, 2 legs w/ knee+foot) built from connected line segments, all lengths proportional to size"}
  - {name: pastelDisc, signature: "pastelDisc(x, y, d, color[], alpha) -> void", note: "soft translucent disc anchoring a figure, snapped to a 32px grid"}
---

## What it draws
On a white background, about two dozen small, soft pastel circles (pale pink, pale lavender, pale beige, near-white) scattered across the canvas. Each circle carries a thin black stick-figure "pose": a head tick, a torso line, two bent arms and two bent legs of varying lengths, so the figures read as tiny people or gait poses in random postures.

## How the code works
`setup()` -> `generate()` (poses.pde:20-28); `draw()` also calls `generate()` each frame, but `generate()` starts with `randomSeed(seed); noiseSeed(seed)` (poses.pde:47-48) with a fixed harness seed, so every frame redraws the identical scene (frames 10/60 were dropped as identical).

For each of 20 figures (poses.pde:53):
- Position `xx,yy = random(width/height)` snapped to a 32px grid (`xx -= xx%32`, poses.pde:56-57).
- Skeleton, all segment lengths proportional to `ss`:
  - head: `ang1 = PI + random(PI)` lerped toward `PI*1.5`, head at 0.32*ss, neck at 0.18*ss, one line head->opposite neck end (poses.pde:64-72) — the vertical "torso+head" stroke.
  - shoulders: `ang2 = ang1 + random(-HALF_PI, HALF_PI)`, `amp1 = 0.1*random(1,2)`, a short crossbar line (poses.pde:74-80).
  - each arm: elbow at `amp3 = amp1*random(1.4,2.6)` in a fully random direction, then hand at the same length again (poses.pde:82-103) — two-segment bent arm, x2 for both sides.
  - hips: crossbar at `amp2 = 0.07*random(1,2)` (poses.pde:106-112), then legs at `amp8 = amp2*random(1.4,2.6)*1.8`, knee + foot, two-segment bent leg, x2 (poses.pde:114-134).
- `strokeWeight(random(1,4))`, `stroke(0)` (poses.pde:62-63). No blend modes; P2D with `smooth(8)`.

Randomness: purely `random()` (noise is imported but unused); per-figure angles are fully random for limbs, biased downward for the head/torso.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_60 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 60; i++) {` | moderate | 3x the figures (60); same first 20 poses, 40 more scattered in — dense crowd, many discs and limbs overlapping | variants/count_60/frame_00001.png |
| ss_0.2 | `float ss = width*0.1;` -> `float ss = width*0.2;` | moderate | discs double to ~192px and every limb segment doubles; several figures now run off the canvas edges | variants/ss_0.2/frame_00001.png |
| alpha_200 | `fill(rcol(), 50);` -> `fill(rcol(), 200);` | subtle | discs take on their true palette colours — deep indigo, red, brown, pink, pale blue-white — instead of the washed-out pastels; layout and strokes unchanged | variants/alpha_200/frame_00001.png |
| strokeWeight_8 | `strokeWeight(random(1, 4));` -> `strokeWeight(random(8, 12));` | subtle | strokes 4x thicker, bold marker-like lines; figures read as chunky doodles, same layout | variants/strokeWeight_8/frame_00001.png |
| legLen_4 | `float amp8 = amp2*random(1.4, 2.6)*1.8;` -> `... *4;` | subtle | legs ~2.2x longer (knee and foot segments), figures look lanky/spidery; arms, head and discs unchanged | variants/legLen_4/frame_00001.png |

## Modularisation notes
- The whole per-figure block (poses.pde:54-135) is one reusable primitive `stickFigure(x, y, size, seed)`: a hierarchical chain of 2-segment limbs with random joint angles and length factors (head 0.32, neck 0.18, arm ~0.1*2, leg ~0.07*2.5*1.8). Generalise the length factors into a parameter object.
- The 32px position snap (poses.pde:56-57) is a one-off art decision that makes discs align loosely to an invisible grid; keep it as an optional `grid` param.
- A clean parameter object: `{count, discDiameter (fraction of width), discAlpha, strokeWeight:[min,max], armLength, legLength, armBend:[1.4,2.6], legBend:[1.4,2.6], snap} plus the 5-color palette and the fixed black stroke.
