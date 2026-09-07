---
sketch: 2017/Generativos/boxes
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1730
animated: false
techniques: [grid, noise-field, 3d-mesh, distortion]
primitives: [shape]
palette:
  colors: ["#08D9D6", "#252A34", "#FF2E63", "#EAEAEA"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: "random(5, random(30,60)) per layer", tried: [10, 60], change: large, effect: "higher = finer, denser tessellation; lower = large coarse cells"}
  - {name: amp, default: "random(0.8) per layer", tried: [0.4], change: subtle, effect: "half the facet size: slightly flatter, less 3D relief"}
  - {name: det, default: "random(0.008) per layer", tried: [0.004], change: none, effect: "no visible change at this scale"}
  - {name: hue, default: "random(0.2) per layer pass", tried: [0.5], change: large, effect: "stronger per-pass hue rotation, noticeably different palette"}
  - {name: layers, default: 10, tried: [3], change: moderate, effect: "fewer rotated layers, more open background, less mottling"}
reusable_candidates:
  - {name: noiseRampColor, signature: "noiseRampColor(x, y, det, palette) -> color", note: "2-D noise sampled at offset seeds, lerped across a palette (getColor/rampColor)"}
  - {name: isoBoxGrid, signature: "isoBoxGrid(cellCount, cellSize, amp, paletteFn) -> void", note: "rotated grid of faceted pseudo-3D boxes built from 6-vertex shapes + translucent facet shading"}
  - {name: hueRotateFilter, signature: "hueRotate(canvas, delta) -> void", note: "GLSL HSV hue-shift filter applied in passes to accumulate colour drift"}
---

## What it draws
A full-bleed mosaic of tiny faceted 3D-looking boxes/cubes, like a dense tessellation of
bevelled hexagonal tiles. The cells are packed edge to edge in many hues — dominant blues,
golds/yellows, pinks/reds, with whites, greys and teal — and the whole surface is mottled
by patches where different colour regions overlap (e.g. a blue field on the right, a warm
gold/cream field on the left, a cool grey-white band in the middle). Each tile reads as a
small bevelled cube with darker left/bottom facets and brighter top ones, giving a low-relief
crystalline texture.

## How the code works
`setup()` (boxes.pde:5-13) sizes a 960x960 P2D canvas, loads `hue.glsl`, and calls
`generate()` once; `draw()` is empty (the regeneration line 16 is commented out), so the
image is static. `keyPressed` re-generates on any key, saving with `s`.

`generate()` (boxes.pde:29-105) re-seeds `randomSeed`/`noiseSeed` from a new random
`seed` (line 31-33), then runs 10 layers (line 35). Each layer: pushMatrix, translate to
centre, rotate by `random(TWO_PI)` (38), pick a grid resolution `cc = int(random(5,
random(30, 60)))` (41) over a 1.4x-width span, `ss = size/cc` cell size (42), translate to
the grid origin (44). A per-layer `amp = random(0.8)` (48) sets facet size `sss = ss*amp*0.5`
(50) and `det = random(0.008)` (49) is the noise scale for colour.

The double loop (51-99) draws, per cell, one hexagonal "box": a 6-vertex `beginShape`
(67-80) whose six vertices each get their own `rampColor(...)` fill — the per-vertex fill
makes each of the six faces a different colour, so the hexagon reads as a bevelled cube.
Two additional translucent quads (81-88, 89-96) with `fill(0,80)`, `fill(0,40)`, `fill(0,200)`
paint the top-left/bottom/right facets darker, reinforcing the 3D shading. `rampColor`
(107-111) samples 2-D Perlin noise at three offset seeds, lerps them, maps the value into
the 4-colour palette `colors = {#08D9D6, #252A34, #FF2E63, #EAEAEA}` (113) and returns
`getColor` (117-121): the value is wrapped modulo 4 and `lerpColor` interpolates between
adjacent palette entries — so colour is noise-driven, not a single random pick.

After each layer's grid is drawn, `hue.set("hue", random(0.2))` (102) and `filter(hue)`
(103) apply the GLSL hue-rotation shader (hue.glsl:28-33, an HSV hue shift) to the whole
canvas. Re-applying it 10 times with different random deltas accumulates a global hue
drift — this is why the final palette shows far more hues (blues, golds, pinks, teals)
than the 4 source colours.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_10 | `int cc = int(random(5, random(30, 60)));` -> `int cc = 10;` | large | much larger cells, coarser mosaic | variants/cc_10/frame_00001.png |
| cc_60 | `int cc = int(random(5, random(30, 60)));` -> `int cc = 60;` | large | much finer, denser tessellation | variants/cc_60/frame_00001.png |
| amp_0.4 | `float amp = random(0.8);` -> `float amp = 0.4;` | subtle | slightly flatter facets, less 3D relief | variants/amp_0.4/frame_00001.png |
| det_0.004 | `float det = random(0.008);` -> `float det = 0.004;` | none | no visible change | variants/det_0.004/frame_00001.png |
| hue_0.5 | `hue.set("hue", random(0.2));` -> `hue.set("hue", 0.5);` | large | noticeably different palette, stronger hue rotation | variants/hue_0.5/frame_00001.png |
| layers_3 | `for (int c = 0; c < 10; c++) {` -> `for (int c = 0; c < 3; c++) {` | moderate | fewer rotated layers, more open background | variants/layers_3/frame_00001.png |

## Modularisation notes
Generic, reusable blocks:
- `getColor`/`rampColor` (boxes.pde:107-121): a palette-aware noise sampler (noise value
  wrapped modulo the palette length and lerped between neighbours). Clean as
  `noiseRampColor(x, y, det, palette) -> color`.
- The per-cell faceted "box" (lines 67-96): a small primitive that draws a bevelled cube
  from a 6-vertex shape plus three translucent shading quads. Parameterised by cell size
  `ss`, facet ratio `amp`, and a per-vertex colour function, it is a clean
  `isoBoxGrid(cellCount, cellSize, amp, paletteFn)`.
- The GLSL hue-rotation filter (hue.glsl) is a standard HSV hue-shift; reusable as a
  `hueRotate(canvas, delta)` post-filter, and the "apply N times with random deltas"
  pattern is the sketch-specific way of accumulating global colour drift.

One-off art decisions:
- The 10-layer loop with random per-layer rotation, `cc`, `amp`, `det` (lines 35-50):
  the stacking/overlap and per-layer randomness are the compositional choice.
- The specific 4-colour palette and the two `fill(0,80/40/200)` shading alpha values.

A clean parameter object for this sketch would contain: `layers` (int), `cc` (int or
range), `amp` (0-1 facet ratio), `det` (noise detail), `hueStep` (per-pass hue rotation),
`palette` (int[]), `span` (1.4x-width grid multiplier), and `seed`. The deterministic
re-seeding (lines 31-33) means the whole image is reproducible from `seed` alone once the
parameters are fixed.
