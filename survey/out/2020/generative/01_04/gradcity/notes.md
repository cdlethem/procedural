---
sketch: 2020/generative/01_04/gradcity
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1510
animated: false
techniques: [polar, subdivision]
primitives: [shape]
palette:
  colors: ["#2DEEFE", "#EE22CA", "#E5DE19"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: centerCount, default: 40, tried: [80], change: large, effect: "denser field, canvas fully covered, paler ground gone, finer shard texture"}
  - {name: subRange, default: "8..40", tried: ["8..12"], change: large, effect: "coarser fans: fewer, wider wedges per centre, individual radial clusters more distinct"}
  - {name: amp, default: 0.4, tried: [0.7], change: large, effect: "larger wedges and gradients, bigger-scale overlap, fewer small sharp shards"}
  - {name: wedgeAlpha, default: "random(255)", tried: [60], change: large, effect: "much lighter, pastel and washed-out; ground shows through everywhere"}
  - {name: palette, default: "cyan/magenta/yellow", tried: ["#354998/#D0302B/#F76684/#FCFAEF/#FDC400"], change: large, effect: "same geometry in warm reds/oranges/gold with cream and indigo accents"}
reusable_candidates:
  - {name: angularFan, signature: "angularFan(cx, cy, amp, subMin, subMax, splitBias, palette, alphaMax) -> void", note: "fan of translucent wedges: full circle split into N angular intervals, each interval drawn as a triangle to the centre"}
  - {name: rcol, signature: "rcol(palette) -> int", note: "uniform random pick from a palette list"}
---

## What it draws
A full-bleed chaotic composition of many overlapping, semi-transparent triangles in bright magenta, cyan and yellow, over a pale grey-beige ground. The triangles radiate from dozens of invisible random centres, forming fan or wedge clusters of varying size; where wedges overlap, the additive-looking layering produces paler green, orange and purple secondary tones. The centre of each fan fades to transparency, so dense regions read as layered shards rather than solid shapes.

## How the code works
`setup()` calls `generate()` once (line 23); `draw()` is empty, so the sketch is static. `generate()` re-seeds both random and noise (lines 87-88) and fills the background `#d1ccc2` (line 89). The main loop (lines 123-152) runs 40 times, each iteration building one fan at a random centre `(cx, cy)` (lines 138-139) with radius `amp = width*0.4` (line 140). Angles start as one full interval `[a1, a1+TAU]` (lines 125-126); then `sub = int(random(8,40))` times a random interval is split at a point `lerp(a1, a2, random(0.4, 0.6))` — biased toward the middle (lines 128-136). Each final interval becomes one triangle: the two arc endpoints at radius `amp` and the centre point (lines 144-150). The two arc vertices are filled with the same `rcol()` at `random(255)` alpha (line 145); the centre vertex is filled with alpha 0 (line 148), so each wedge is a gradient triangle fading to transparent at its fan's centre. Per-vertex fill colours are what make the wedge gradients work in P2D. Randomness enters through centre positions, split counts, split positions, colour picks and alphas; `rcol()` (lines 184-186) picks uniformly from the 3-colour palette (line 182). A large commented-out block (lines 91-121) draws random rectangles with the `grad()` helper (line 163) and a `Quad` class (line 45) is defined but never used; the triangulate/toxi imports (lines 1-2) are unused by the active code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| centerCount_80 | `for (int j = 0; j < 40; j++) {` -> `... j < 80; ...` | large (mean 0.2007, 0.814 px) | twice as many fans: canvas almost fully covered, ground barely visible, texture reads as a uniform fine shard field | variants/centerCount_80/frame_00001.png |
| sub_8_12 | `int sub = int(random(8, 40));` -> `int sub = int(random(8, 12));` | large (mean 0.1866, 0.782 px) | fewer, much wider wedges per fan; distinct radial clusters with large solid-ish triangles (also shifts the random stream, so centre positions differ) | variants/sub_8_12/frame_00001.png |
| amp_0.7 | `float amp = width*0.4;` -> `float amp = width*0.7;` | large (mean 0.17, 0.7 px) | fans reach ~75% of the width: bigger gradients, smoother large-scale overlaps, fewer small sharp shards | variants/amp_0.7/frame_00001.png |
| wedgeAlpha_60 | `fill(rcol(), random(255));` -> `fill(rcol(), 60);` | large (mean 0.1596, 0.784 px) | all wedges at alpha 60: very light, pastel, washed-out composition; pale ground visible throughout | variants/wedgeAlpha_60/frame_00001.png |
| palette_warm | `int colors[] = {#2DEEFE, #EE22CA, #E5DE19};` -> `{#354998, #D0302B, #F76684, #FCFAEF, #FDC400};` | large (mean 0.2214, 0.807 px) | identical structure recoloured: warm reds, oranges, gold with cream and indigo accents | variants/palette_warm/frame_00001.png |

## Modularisation notes
- **Generic:** the fan generator (lines 123-152) is a clean, self-contained "radial wedge field" primitive: parameterise centre count, amplitude, sub-range, split bias, palette, alpha range. `rcol`/`getColor` (lines 184-197) are reusable palette helpers (the `getColor(float)` lerp version is unused by the active code).
- **One-off art decisions:** the 3-colour neon palette, the `width*0.4` amplitude, the `random(0.4, 0.6)` split bias, the 40-fan count, and the pale `#d1ccc2` ground.
- **Dead weight to drop:** the commented rectangle block, `grad()`, the `Quad` class, the unused triangulate/toxi imports, and the `seed`/`keyPressed` interaction code.
- **Clean parameter object:** `{centerCount, ampFraction, subMin, subMax, splitBias, alphaMax, palette, background}` — everything else (centre positions, split order, colours) is per-seed randomness.
