---
sketch: 2018/Generativos/persons04
year: 2018
renderer: P2D
size: [720, 720]
libraries: [triangulate]
deterministic: false
ms_first_frame: 1533
animated: true
techniques: [grid, agents, noise-field]
primitives: [ellipse, rect, line, curve]
palette:
  colors: ["#2B00BE", "#F73859", "#9896F1", "#D59BF6", "#EDB1F0"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: gridCount, default: "int(random(40, 60)*0.5)", tried: ["int(random(40, 60)*1.0)"], change: moderate, effect: "denser grid (cell size halved) -> figures ~half size, ~2x more, finer grid lines"}
  - {name: countPersons, default: "int(gridCount*1.6)", tried: ["int(gridCount*3.2)"], change: subtle, effect: "~2x more figures, denser crowd, same figure proportions"}
  - {name: gridLineAlpha, default: 12, tried: [80], change: none, effect: "no visible change; 1px grid lines only marginally brighter"}
  - {name: headWidth, default: "size*0.12", tried: ["size*0.35"], change: none, effect: "no visible change; heads remain tiny dots at this scale"}
  - {name: heightBody, default: "size*5.2*hh", tried: ["size*8.0*hh"], change: subtle, effect: "torsos visibly elongated, figures read as tall pillars"}
  - {name: colors, default: "6 purple/pink tones incl. #2B00BE x2", tried: ["teal/orange/warm set"], change: large, effect: "completely different look: warm tan background, orange/teal/sand figures"}
reusable_candidates:
  - {name: gridAgents, signature: "gridAgents(count, gridSize, minDist) -> Agent[]", note: "grid-snapped positions with minimum-distance rejection sampling"}
  - {name: noiseArm, signature: "noiseArm(x, y, t, detail) -> PVector", note: "3-D Perlin noise mapped into a target range to wiggle a limb endpoint"}
  - {name: rcol, signature: "rcol(colors) -> int", note: "random colour from a fixed list, with retry loops to avoid the background colour"}
---

## What it draws
A flat, poster-like scene of about 40 tiny stylised figures scattered across a pale lilac
background. Each figure is a rounded-rectangle torso in deep indigo, periwinkle, or coral red,
with a tiny head dot, two thin straight legs (sometimes splayed), faint curve "arms", and a
soft grey ellipse shadow on the ground. A faint white square grid of thin lines crosses the
whole canvas; figures vary a lot in height and sit at grid-snapped positions, so the
composition reads as a crowd of people walking on a tiled floor.

## How the code works
- `setup()` (persons04.pde:18) creates a 720x720 P2D canvas and calls `generate()`.
- `generate()` (persons04.pde:61) seeds random/noise with `seed`, picks `backColor` from the
  fixed 6-colour list (persons04.pde:231, purple `#2B00BE` appears twice and is excluded from
  the background), then `gridCount = int(random(40, 60)*0.5)` (line 69) which also sets
  `gridSize` (line 70) and `countPersons = int(gridCount*1.6)` (line 77). Each `Person` is
  placed at a random point snapped to the grid (Person.pde:40-41) and rejected if within 5 px
  of an existing person (persons04.pde:86-93).
- Every frame, `draw()` (persons04.pde:26) redraws the background, draws the faint white grid
  lines with `stroke(255, 12)` (line 33), sorts persons by y (ComparePersons, persons04.pde:247)
  so lower figures overlap higher ones, then calls `update()` + `show()` on each.
- `Person.update()` (Person.pde:60): legs swing with `cos/sin(angle + time*rotAngle)`
  (lines 81-85), so every figure walks in place; hands wander using 3-D Perlin noise sampled
  at detail 0.01 and mapped into body-relative ranges (lines 97-98); occasionally a person
  picks a new random grid target and eases toward it at 0.3 px/frame (lines 62-71).
- `Person.show()` (Person.pde:111): shadow = two faint black ellipses at the feet
  (`fill(0, 8)`, lines 117-119); legs = two 1.2 px strokes in the pants colour
  (lines 123-125); hip ellipse (line 128); torso = rounded `rect` in shirt colour
  (line 131); head = tiny skin-coloured ellipse (line 136); arms = unfilled `curve()`
  in shirt colour (lines 142-143); hands = two small ellipses (lines 146-147).
- Colour: `rcol()` (persons04.pde:232) picks randomly from the list; each body part retries
  until it differs from the background (and shirt differs from skin) (Person.pde:45-50).
- `deterministic` is false in the baseline: `time = millis()*0.001` (persons04.pde:30) is
  wall-clock, so the leg-swing and hand-noise poses at capture time differ between runs even
  with the same seed; positions and colours are seed-stable.

## Experiments
| variant | substitution | change score | observation | image |
| gridCount_1.0 | `gridCount = int(random(40, 60)*0.5);` -> `... *1.0);` | moderate | figures ~half size and ~2x more (count scales with gridCount), grid cells halved so lines denser; background slightly more saturated (non-deterministic run-to-run) | variants/gridCount_1.0/frame_00001.png |
| persons_3.2 | `int countPersons = int(gridCount*1.6);` -> `*3.2);` | subtle | ~2x more figures (roughly 80), denser crowd, individual figures unchanged in size/proportion | variants/persons_3.2/frame_00001.png |
| gridAlpha_80 | `stroke(255, 12);` -> `stroke(255, 80);` | none | no visible change per score; grid lines only marginally brighter, same layout | variants/gridAlpha_80/frame_00001.png |
| headWidth_0.35 | `headWidth = size*0.12;` -> `size*0.35;` | none | no visible change; heads remain tiny dots, same layout | variants/headWidth_0.35/frame_00001.png |
| heightBody_8.0 | `heightBody = size*5.2*hh;` -> `size*8.0*hh;` | subtle | torsos clearly elongated (~1.5x), figures read as tall pillars; same positions | variants/heightBody_8.0/frame_00001.png |
| palette_alt | `int colors[] = {#2B00BE, #2B00BE, #F73859, #9896F1, #D59BF6, #EDB1F0};` -> `{#0F4C5C, #0F4C5C, #E36414, #FB9E3E, #F2CC8F, #91AEB5};` | large | whole look changes: warm tan background, figures in dark teal, orange and sand; composition identical | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: the grid + minimum-distance placement loop (persons04.pde:77-106) is a reusable
  "scatter agents on a grid" primitive; `rcol()` with background-exclusion is a small palette
  utility; the noise-driven limb endpoint (Person.pde:97-98) is a reusable "wander" function.
- One-off art decisions: the specific 6-colour list, the body-part proportions in
  `Person.init()` (Person.pde:31-38), the shadow-ellipse trick, the y-sort for depth.
- A clean parameter object would hold: `colors[]`, `backColor`, `gridCount`,
  `personsPerGrid` (the 1.6 multiplier), `minDist` (5), `gridLineAlpha` (12),
  `bodyHeight` (5.2), `headScale` (0.12), and per-person randoms seeded from `seed`.
- The triangulate import and the commented-out triangulation/threes/rain code are dead weight;
  a clean version drops the `triangulate` dependency entirely.
