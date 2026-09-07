---
sketch: 2019/generativos/bab
year: 2019
renderer: JAVA2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 753
animated: false
techniques: [noise-field, particles, polar]
primitives: [point, line, ellipse]
palette:
  colors: ["#F0C7C0", "#F65A5C", "#3080E9", "#50E2C6", "#F7D3C3", "#F41B9C"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: 1200, tried: [400], change: large, effect: "shorter trails: same sweep direction but broken into separate arcs, loops and spring-like bead coils; less piled-up density"}
  - {name: emitters, default: 30, tried: [10], change: large, effect: "fewer distinct figures (one big pink ring/tangle, a few tapered blobs); much more empty black showing the dot grid"}
  - {name: det1, default: "random(0.001)", tried: ["random(0.006)"], change: large, effect: "noisier flow field: strokes longer and straighter, crossing the full canvas at steeper angles; arrangement completely different from baseline"}
  - {name: step, default: 0.4, tried: [1.5], change: large, effect: "faster crawl: trails spread across nearly the whole canvas, ribbons thicker and softer, denser tangle of overlapping walks"}
  - {name: alpha, default: 250, tried: [70], change: none, effect: "no visible change: dense overlapping ellipses saturate the alpha, so lowering it barely affects the render"}
reusable_candidates:
  - {name: noiseWalk, signature: "noiseWalk(x, y, step, detail, offset) -> (x, y, angle)", note: "2-D perlin noise sampled at the walker position gives the heading; integrates into a curved trail"}
  - {name: paletteCycle, signature: "paletteCycle(colors[], t) -> color", note: "t mapped through the palette with lerp between adjacent entries, cycling via mod"}
  - {name: sineEnvelope, signature: "sineEnvelope(t) -> float", note: "0.5 + sin(t*PI)^2 * 0.5; swells stroke size in the middle of a path"}
---

## What it draws
Near-black background with a faint white dot grid visible in empty areas. A dense diagonal
band of flowing, ribbon-like trails sweeps from the lower left toward the upper right; the
trails are made of thousands of small overlapping dots and read as thick smooth strokes in
hot pink, magenta, coral, blue, teal, and pale cream. Thin hairline spokes end in small
satellite dots scattered along the trails, and rows of tiny beads ring the ribbon edges.
The upper-left corner is mostly empty with just the dot grid.

## How the code works
`generate()` (bab.pde:51) is the whole piece; `draw()` is empty and the piece is static
(frames 1/10/60 identical).

1. `randomSeed`/`noiseSeed` from a single `seed` field (line 3, 53-54); background is
   black lerped ~10% toward a random palette colour (line 56).
2. A `point(i,j)` grid every 10 px with `stroke(255, 140)` (lines 58-63) — the faint dot
   texture on the background.
3. 30 emitters (line 66), each starting at a random point in `-0.2..1.2` of the canvas so
   trails begin off-canvas. Each carries a random per-walk scale `random(0.6, 2)` (line 69)
   that shadows the global `scale`.
4. Per walk, 1200 steps (`cc`, line 80): heading is
   `noise(des1+x*det1, des1+y*det1)*2*TAU` (line 87) — a perlin flow field with a random
   offset and detail `random(0.001)`; position advances `cos(a)*0.4*scale` px (lines 93-94),
   so the walk crawls and its own trail piles up.
5. Stroke size `s` = noise-lerp of two random base sizes (lines 70-71, 89) times the
   sine envelope `0.5+sin(j*PI/cc)^2*0.5` (line 88), so each ribbon thins at its ends and
   swells in the middle.
6. Colour drifts along the path: `getColor(ic+dc*j)` (line 90) lerps between adjacent
   entries of the 6-colour palette (lines 123, 130-136), so a single trail slides through
   several palette neighbours. Filled ellipse at alpha 250 (line 91-92).
7. With 10% probability (line 96) a satellite is drawn: hairline from the walker to a point
   at distance `s` plus a small dot (lines 98-104).
8. Every step also draws `ccc = int(random(2,10))` tiny beads on a ring of radius
   `~2*s*scale` around the walker, slowly rotating via `da*j` (lines 108-113) — the bead
   fringes along the ribbons.
The triangulate import (line 1) is present but never used.

## Experiments
| variant | substitution | change score | observation | image |
| cc_400 | `int cc = 1200;` -> `int cc = 400;` | large (mean 0.3316, 0.639) | same diagonal sweep as baseline (same seed/field) but trails are shorter: broken arcs, loops and visible spring-like bead coils; top-left emptier | variants/cc_400/frame_00001.png |
| emitters_10 | `for (int i = 0; i < 30; i++) {` -> `for (int i = 0; i < 10; i++) {` | large (mean 0.1531, 0.314) | far fewer, separate figures: one large pink ring/tangle mid-canvas, a few thick tapered blobs, thin hairline arcs; large empty black areas | variants/emitters_10/frame_00001.png |
| det1_0.006 | `float det1 = random(0.001);` -> `float det1 = random(0.006);` | large (mean 0.3152, 0.646) | noisier field: long, straighter thick strokes crossing the whole canvas at steeper angles; less gentle large-scale curling; layout entirely different | variants/det1_0.006/frame_00001.png |
| step_1.5 | `x += cos(a)*0.4*scale;` -> `x += cos(a)*1.5*scale;` | large (mean 0.2571, 0.582) | 3.75x step: walks cover almost the entire canvas; ribbons thicker/softer, dense tangle of many overlapping walks with hairline fringes | variants/step_1.5/frame_00001.png |
| alpha_70 | `fill(col, 250);` -> `fill(col, 70);` | none (mean 0.0084, 0.023) | no visible change — expected a paler look, but dense overlapping ellipses saturate the alpha so the render is essentially identical | variants/alpha_70/frame_00001.png |

## Modularisation notes
- Generic: the noise-flow walker (heading from 2-D noise at the position), the cycling
  lerp palette, the sine envelope, and the dot-grid background are all reusable library
  primitives (signatures above).
- One-off art decisions: the specific 6-colour palette, the satellite-and-bead decorations
  (steps 7-8), the 0.4 px crawl speed that makes ribbons pile on themselves, and the
  off-canvas emitter margins.
- A clean parameter object: `{emitters, steps, stepSize, fieldDetail, sizeRange, palette,
  alpha, satellites: p, beads: ccc}`.
