---
sketch: 2019/generativos/cascada
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1914
animated: false
techniques: [noise-field, flow-field, lines-hatching]
primitives: [line]
palette:
  colors: ["#0F2442", "#0168AD", "#8AC339", "#E65B61", "#EDA787", "#212026"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: count, default: 40000, tried: [10000], change: large, effect: "far sparser field: salmon background dominates, lines read as short straight dashes"}
  - {name: det, default: "random(0.001)", tried: [0.0003], change: moderate, effect: "smoother, larger-scale field: flow bends in broad arcs, direction varies more across the canvas"}
  - {name: "lar (max walk length)", default: 400, tried: [800], change: moderate, effect: "longer continuous streaks, less dotty texture; overall look similar"}
  - {name: "str (stroke weight max)", default: 2, tried: [5], change: moderate, effect: "thicker, chunkier brush-like strokes; background shows through less"}
  - {name: "colors[]", default: "5-colour pink/blue/green", tried: ["4-colour blue set {#202130,#193766,#2FABD0,#E6F9FF}"], change: large, effect: "entire image becomes monochromatic blue (navy background, blue-to-cyan lines)"}
reusable_candidates:
  - {name: noiseFlowWalk, signature: "noiseFlowWalk(seed, nParticles, lenRange, noiseDetail, offset) -> Polyline[]", note: "random-walk polylines along a 2-D noise angle field"}
  - {name: noiseColorRamp, signature: "noiseColorRamp(palette, position, detail, offset) -> color", note: "noise-driven lerp between adjacent palette entries at a position"}
---

## What it draws
A full-bleed tangle of tens of thousands of hair-thin wavy lines, all flowing in one
general diagonal direction (upper-left to lower-right) with local curl. The background
is a flat salmon pink; the lines are a dense mix of dark blue, brighter blue, and
darker brownish-grey, so the field reads as pink on top fading into blue on the
bottom-right. No shapes or figures, just dense directional hatching with soft
clumps of colour.

## How the code works
- `setup()` (cascada.pde:11) sizes the 960x960 P2D canvas and calls `generate()`;
  `draw()` is empty, so the image is static (keyPress regenerates with a new seed).
- `generate()` (cascada.pde:33) seeds `random`/`noise` with the harness seed, then
  draws four random fields: `des`/`det` (offset/detail of the motion field, lines 40-41)
  and `desCol`/`detCol` (offset/detail of the colour field, lines 38-39).
- `count = 40000` (line 5) particles are created; each `Particle` starts at a random
  point in the canvas (Particle.pde:8-9), with a walk length `lar` of 20-400 steps
  (line 10) and stroke weight `str` of 0.8-2 (line 11).
- Each particle walks its length: at every step the angle is
  `noise(des+x*det, des+y*det)*TAU*2` (Particle.pde:14) and it moves one pixel along
  it, recording the points. The low `det` (~0.001) keeps the angle field smooth, so
  all walks share the same broad diagonal flow with local bending — the main visual.
- `show()` (Particle.pde:24) draws the recorded path as an open `beginShape()`
  polyline with no fill. Stroke colour is `getColor(noise(desCol+x*detCol,
  desCol+y*detCol)*8+random(1))` (line 27): noise at the particle position scaled
  to 8, plus a random jitter, mapped through `getColor(float)` (cascada.pde:75)
  argument changes slowly (detCol ~0.004), colour forms broad soft patches.
- Background is one random palette entry via `rcol()` (cascada.pde:49, 69-71); for
  seed 42 it landed on the salmon `#EDA787`.
- `import toxi.math.noise.SimplexNoise` and the triangulate import are unused by the
  code; noise() is Processing's own.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_10000 | `int count = 40000;` -> `int count = 10000;` | large (mean 0.190, 0.704 of pixels) | much sparser: salmon background clearly visible, lines are short straight dashes, no dense tangle | variants/count_10000/frame_00001.png |
| det_0.0003 | `det = random(0.001);` -> `det = 0.0003;` | moderate (mean 0.117, 0.517 of pixels) | flow field is broader and smoother: lines bend in large arcs and the direction varies more across the canvas instead of one uniform diagonal | variants/det_0.0003/frame_00001.png |
| lar_800 | `lar = random(20, random(100, 400))*random(1);` -> `... random(100, 800) ...` | moderate (mean 0.057, 0.192 of pixels) | streaks run longer and connect into smoother continuous lines; texture less dotty, otherwise similar | variants/lar_800/frame_00001.png |
| str_5 | `str = random(0.8, 2);` -> `str = random(0.8, 5);` | moderate (mean 0.066, 0.234 of pixels) | strokes are visibly thicker and chunkier, brush-like clumps; background peeks through less | variants/str_5/frame_00001.png |
| palette_alt | `int colors[] = {#0F2442, #0168AD, #8AC339, #E65B61, #EDA787};` -> `int colors[] = {#202130, #193766, #2FABD0, #E6F9FF};` | large (mean 0.217, 0.764 of pixels) | fully monochromatic blue: navy background, lines from dark blue to bright cyan, no salmon/green | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: the particle walk (noise angle field, per-step integration, recorded
  polyline) is a standalone flow-field routine; the noise-driven palette lerp
  (`getColor(float)`) is a reusable colour ramp. Both are candidate library
  functions (see `reusable_candidates`).
- One-off art decisions: the specific 5-colour palette and its commented
  alternatives, the salmon background pick, the `*TAU*2` angle gain (forces a
  consistent flow direction), the length distribution `random(20, random(100,400))`,
  the `+random(1)` colour jitter, and the 40000 particle count.
- A clean parameter object would be: `count`, `lenMin`/`lenMax` (walk steps),
  `strokeWeightMin`/`Max`, `noiseOffset` + `noiseDetail` (motion field),
  `colorOffset` + `colorDetail` + `colorGain` (8.0) (colour field), `palette`,
  `background`, `angleGain` (2.0*TAU).
