---
sketch: 2018/Generativos/magik3
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1560
animated: false
techniques: [shader, noise-field, flow-field, lines-hatching, distortion]
primitives: [line]
palette:
  colors: ["#043387", "#0199DC", "#BAD474", "#FBE710", "#FFE032", "#EB8066", "#E7748C", "#DF438A", "#D9007E", "#6A0E80", "#242527", "#FCFCFA"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: lar, default: "random(1000, 10000)", tried: ["random(300, 900)"], change: subtle, effect: "fewer lines -> sparser, bolder strokes; fan size/position unchanged"}
  - {name: vel, default: "0.071", tried: ["0.3"], change: large, effect: "bigger endpoint step -> much larger, more splayed fans covering most of the canvas"}
  - {name: dc, default: "random(0.006)*random(0.1,1)^3", tried: ["random(0.06)"], change: moderate, effect: "faster palette cycling -> more rainbow stripes within each fan; fans a touch tighter"}
  - {name: noiseDetail, default: 1, tried: [4], change: subtle, effect: "more octaves -> finer, less-coherent wiggle in the walk; fans slightly smaller"}
  - {name: amp1, default: "random(10)", tried: ["random(40)"], change: subtle, effect: "larger angle range -> little visible change (walk step is tiny)"}
reusable_candidates:
  - {name: radiatingLineFan, signature: "radiatingLineFan(pivot, count, step, amp, colorCycle) -> void", note: "N lines from a shared pivot; each endpoint takes a noise-steered random-walk step, so successive lines fan out; colour cycles through a palette"}
  - {name: paletteCycle, signature: "paletteCycle(palette, offset, step, i) -> color", note: "index offset+step*i into a palette, lerped between neighbours, optionally mixed toward black"}
---

## What it draws
A flat, highly saturated hot-magenta/pink field fills the entire canvas. Scattered across it are four small ribbon- or fan-shaped forms, each a tight bundle of thousands of fine lines that radiate from a narrow pivot and splay into a curved blade. Within each fan the colour runs as a smooth gradient across the palette (one reads blue-to-teal-to-green, one yellow-to-lime, one cyan, one purple-to-violet). The fans are small against a large amount of empty pink negative space, and their edges look slightly soft and grainy with a subtle darkening toward the corners.

## How the code works
Single-shot: `setup()` (L5-18) sets a 960x960 P2D canvas, loads `data/post.glsl` (L10) and calls `generate()` (L12). `draw()` (L20-21) is empty, so it is static.

`generate()` (L41-134):
- `randomSeed(seed)` (L43); `background(rcol())` (L44) paints a solid colour chosen from the palette — here the vivid magenta field.
- Outer loop runs 4 times (L70) -> the four fans.
- Each fan: endpoints `x1,y1,x2,y2` are random, then each is lerped 92% toward the other (L82-85), collapsing them into one narrow shared pivot.
- `amp1/amp2 = random(10)` (L87-88) set the angle range; `dc` (L91) sets how fast colour cycles per line; `noiseDetail(1)` (L93); `vel` (L95) is the per-line endpoint step; `lar` (L97) is the line count.
- Inner loop (L100-122): stroke colour is `lerpColor(getColor(ic+dc*i), black, 0.16+0.16*cos(0.1*pi*i))` (L101) — a palette colour that advances with `i` and is darkened in a slow wave. `line(x1,y1,x2,y2)` (L102) draws the fan line. Then `ang1/ang2` are read from 2-D noise at the two endpoints (L104-105), and each endpoint advances by `cos/sin(ang)*vel` (L111-114) — a noise-steered random walk, so each new line drifts a little and the whole set fans out into a blade. Faint white (`255,250`) and black (`0,240`) connector lines (L117-120) add fine texture.
- The `stars` loop (L124-129) is dead code: the list is never populated, so `arc2` (L141-159) never runs.
- `filter(post)` (L132-133) applies the GLSL: a 3x3 Gaussian-ish blur mixed 0.8 (post.glsl L63), desaturation toward luma (L68), brightness/saturation/contrast via `csb` plus a radial vignette `dis` (L69), and a green-channel gamma (L73). This gives the soft, grainy, corner-darkened finish.

`getColor(v)` (L169-174) maps `v` into the palette and lerps between `colors[v]` and `colors[v+1]`; `rcol()` (L163-165) picks a random palette colour.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| lar_900 | `float lar = random(1000, 10000);` -> `float lar = random(300, 900);` | subtle | fewer, bolder visible lines (less dense hatching); fans otherwise same size/position | variants/lar_900/frame_00001.png |
| vel_0.3 | `float vel = 0.071*random(0.5, 2);` -> `float vel = 0.3*random(0.5, 2);` | large | fans much bigger and more splayed, covering far more of the canvas (bigger random-walk spread) | variants/vel_0.3/frame_00001.png |
| dc_0.06 | `float dc = random(0.006)*random(0.1, 1)*random(0.1, 1)*random(0.1, 1);` -> `float dc = random(0.06);` | moderate | colour cycles far faster within each fan (more rainbow stripes); fans look a touch tighter | variants/dc_0.06/frame_00001.png |
| noiseDetail_4 | `noiseDetail(1);` -> `noiseDetail(4);` | subtle | finer high-frequency wiggle in the line walk; fans slightly smaller/less coherent, layout similar | variants/noiseDetail_4/frame_00001.png |
| amp1_40 | `float amp1 = random(10);` -> `float amp1 = random(40);` | subtle | little visible difference; larger angle range only shuffles the tiny per-line walk directions | variants/amp1_40/frame_00001.png |

## Modularisation notes
The core is a reusable "radiating line fan": a shared pivot plus `count` lines whose endpoints take noise-steered random-walk steps (`vel`, `amp`, `noiseDetail`), with colour cycled through a palette by an index offset (`ic + dc*i`). The pivot-collapse lerp (L82-85) is a one-off art choice that makes the fans tight; the endpoint walk, the palette-cycle `getColor`, and the count/step/amp controls are the genuinely general parts. The GLSL post pass (blur + grain + vignette) is a separable, reusable filter. A clean parameter object would hold: `fanCount` (4), `linesPerFan` (lar), `step` (vel), `angleAmp` (amp), `noiseScale` (det/des) and `noiseOctaves` (noiseDetail), `colorOffset` (ic) and `colorCycle` (dc), plus the shared palette and the post-filter toggles (blur, grain, vignette strength).
