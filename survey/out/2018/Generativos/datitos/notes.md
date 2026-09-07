---
sketch: 2018/Generativos/datitos
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2019
animated: false
techniques: [noise-field, dots-stippling, curves]
primitives: [shape, ellipse]
palette:
  colors: ["#000000", "#33346B", "#567BF6", "#B4CAFB", "#FFFFFF", "#FFB72A", "#FF4C3D"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 500, tried: [100], change: large, effect: "5x sparser; individual clock-face dots and amber background become visible"}
  - {name: maxSizeFrac, default: 0.4, tried: [0.2], change: large, effect: "max dot diameter halved; finer, more uniform stipple, more background showing"}
  - {name: det1, default: "random(0.01)", tried: ["random(0.002)"], change: large, effect: "coarser size noise; dot sizes vary in large smooth patches instead of fine variation"}
  - {name: strokeAlpha, default: 4, tried: [40], change: moderate, effect: "white strokes of sliver arc and ellipse cores become visible; overall lighter with white rim accents"}
  - {name: arcSpan, default: 0.2, tried: [1.0], change: moderate, effect: "first arc2 crescent spans 5x more angle; thicker coloured crescent bands around many dots"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "tapered arc/sector: ring segment between two radii, alpha gradient alp1->alp2 across the span; makes fan/shutter wedges"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform random pick from a fixed color array"}
  - {name: noiseDotSize, signature: "noiseDotSize(x, y, offset, detail, maxFrac) -> float", note: "noise^2 mapped to fraction of width; smooth size variation for scattered dots"}
---

## What it draws
Full-bleed scatter of hundreds of overlapping translucent discs, rings, and wedge sectors in blues,
oranges, and reds over an amber background (seed 42; `background(rcol())`). Each dot reads like a
small clock face: a faint outer ring, a thin coloured arc, a broad semi-transparent sector, and a
small dark or bright core dot. Dot sizes vary smoothly across the canvas — clusters of large discs
where noise is high, fine speckles where it is low.

## How the code works
- `setup()` (L3-9) calls `generate()` once; `draw()` (L11-12) is empty, so the image is static.
  `keyPressed` regenerates with a new seed (L14-20).
- `generate()` (L22-66): `randomSeed(seed)`; background is a random palette colour (L26) —
  amber #FFB72A for seed 42. Four noise offset/detail pairs are drawn (L28-35): `des1/det1`
  drives dot size, `des2/det2` drives shape squish and arc angle, `des3/det3` drives the
  width/height ellipse ratio `amp`.
- Main loop (L38-65): 500 iterations, each with random `x, y` (L39-40).
  - Local detail `d = 1 + noise(...)*10` (L41) scales the size-noise frequency per dot, so
    nearby dots share a size.
  - `n = noise(...)^2` (L42) → `s = width * map(n, 0, 1, 0, 0.4)` (L43): dot diameter up to 40%
    of the canvas; squaring the noise pushes most dots toward the small end and gives occasional
    large ones.
  - `amp = 1 + noise(...)*1.8` (L44) stretches one axis, making ellipses.
  - Colour: every layer picks independently from `colors[]` via `rcol()` (L150-153) —
    7-colour palette, black/dark-navy/blue/light-blue/white/amber/red.
  - Layers per dot:
    1. `stroke(255, 4)` + `arc2(..., a-0.2, a+0.2, ..., 20, 250)` (L50-51): a tapered arc
       (angle `a = noise*TAU*2`, L47), colour random, alpha 20→250 from inner to outer radius;
       the white stroke at alpha 4 is nearly invisible.
    2. `fill(rcol()); arc(x, y, s*amp, s*amp, a-0.02, a+0.02)` (L52-53): a thin sliver arc.
    3. `arc2(x, y, s, s*amp, 0, TAU, col, 180, 0)` (L55): full ellipse, alpha 180→0 — the
       broad translucent body.
    4. `ellipse` core: `s*0.14` at alpha 60 then `s*0.1` solid (L56-59): the little centre dot.
    5. Random wedge: `arc2(x, y, s*0.6, s*0.95, a1, a1+HALF_PI*random(0.2, 1.2), rcol(), 200, 0)`
       (L61-64): a clock-hand-like sector between 60-95% radius, alpha 200→0.
- `arc2` (L128-146) splits the angular span into `cc` quads (one per degree-ish, min 2), each a
  ring segment between radii `s1/2` and `s2/2` with alpha `alp1` (inner) → `alp2` (outer); the
  per-quad gradient is what creates the fan/blade look of the wedges.
- `boxShadow`/`plane` (L68-121) are unused helpers.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_100 | `for (int i = 0; i < 500; i++) {` -> `for (int i = 0; i < 100; i++) {` | large | ~5x sparser: ~100 well-separated clock-face dots on exposed amber background; each dot's disc, wedge and core individually distinguishable | variants/count_100/frame_00001.png |
| size_0.2 | `float s = width*map(n, 0, 1, 0.0, 0.4);` -> `float s = width*map(n, 0, 1, 0.0, 0.2);` | large | all dots up to half diameter (max 20% of width): much finer stipple texture, more amber background between dots, wedges and cores shrink proportionally | variants/size_0.2/frame_00001.png |
| det1_0.002 | `float det1 = random(0.01);` -> `float det1 = random(0.002);` | large | size noise coarser: dot sizes change more slowly across the canvas, large smooth patches of similarly sized dots | variants/det1_0.002/frame_00001.png |
| strokeAlpha_40 | `stroke(255, 4);` -> `stroke(255, 40);` | moderate | near-invisible white stroke becomes visible: thin white rim accents on many dots' sliver arcs and cores; image overall lighter, layout unchanged | variants/strokeAlpha_40/frame_00001.png |
| arcSpan_1.0 | `arc2(x, y, s, s*amp, a-0.2, a+0.2, rcol(), 20, 250);` -> `arc2(x, y, s, s*amp, a-1.0, a+1.0, rcol(), 20, 250);` | moderate | first crescent spans 5x more angle: many dots show thicker, more saturated coloured crescent bands; composition otherwise unchanged | variants/arcSpan_1.0/frame_00001.png |

## Modularisation notes
- Generic: `arc2` (tapered ring segment with alpha gradient) is a clean, reusable primitive;
  `rcol` (random palette pick) and the `noise^2 → size-fraction` mapping are one-liners worth
  keeping as helpers.
- One-off art decisions: the 5-layer dot recipe (crescent + sliver + body + core + wedge), the
  specific palette, and the four independent noise offset/detail pairs.
- Clean parameter object: `{ count, maxSizeFrac, sizeDetail, sizeOffset, squishMax, angleDetail,
  palette[], bodyAlpha, wedgeAlpha, coreFrac, strokeAlpha, arcSpan }`.
