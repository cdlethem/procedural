---
sketch: 2019/generativos/nana
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 1437
animated: false
techniques: [grid, dots-stippling]
primitives: [rect]
palette:
  colors: ["#80D2F0", "#D4F5F4", "#472176", "#030234", "#F7CE5B"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: s, default: 20, tried: [40], change: large, effect: "grid cell size / snap; also scales the big-square range s*10 -> chunkier 40px-aligned blocks, more navy background shows through"}
  - {name: ss, default: "random(s*10) -> 0..200", tried: ["random(s*2) -> 0..40"], change: large, effect: "big filled squares shrink to small chips; image becomes sparse, wireframe-dominated, mostly dark navy"}
  - {name: wireSize, default: 120, tried: [240], change: subtle, effect: "thin outlines double to 240px; coarser wireframe grid, fills untouched"}
  - {name: dotSize, default: 5, tried: [15], change: subtle, effect: "medium dots grow 3x; otherwise identical"}
  - {name: colors, default: "80D2F0,D4F5F4,472176,030234,F7CE5B", tried: ["F7AA06,35B1CA,DA4974,B9100F,214CA2"], change: large, effect: "whole palette swaps to red/amber/teal/pink/blue; same geometry, completely different mood"}
reusable_candidates:
  - {name: gridSnapRect, signature: "gridSnapRect(grid, count, sizeRange, palette) -> void", note: "draw N rects of random size snapped to a grid, fill random palette colour"}
  - {name: paletteSwap, signature: "rcol(palette) -> int", note: "uniform random colour from a list; the sketch carries several alternative palettes as commented lines"}
---

## What it draws
A full-bleed 960x960 mosaic of flat-coloured rectangles snapped to a 20px grid: big blocks
(20–200px) in light blue, pale cyan, purple, dark navy and gold, overlaid with a layer of thin
120px square outlines in the same colours, then sparse 5px and 1–2px dots of the same palette.
The dark navy background shows through as a connective tissue. Looks like a pixelated,
low-contrast city block / quilt pattern; no curves, no gradients, no strokes on the fills.

## How the code works
- `setup()` calls `generate()` once (nana.pde:21-29); `draw()` is empty, so the sketch is static.
  `randomSeed(seed)`/`noiseSeed(seed)` at :54-55 make it deterministic given the `seed` field (harness-injected).
- `generate()` (:52-114) fills `background(rcol())` (:57) with a random palette colour (here dark navy),
  then runs four independent passes, each drawing 200 rects whose positions are snapped to a
  `float s = 20` grid via `x -= x % s; y -= y % s` (:67-70 etc.):
  1. 200 filled squares `ss = random(s*10)` (0–200px), each with a second smaller filled square
     `ss*0.1` on top in another random colour (:66-79) — this is where the big colour blocks and the
     little inset squares inside them come from.
  2. 200 stroked (noFill) squares fixed at 120x120 (:82-90) — the thin wireframe grid overlay.
     Default stroke weight (1px).
  3. 200 filled 5x5 squares (:92-100) — the medium dots.
  4. `s *= 0.25` then 200 filled `random(2)` (1–2px) squares on the 5px sub-grid (:103-113) — the finest dots.
- Colour: `rcol()` (:146-148) picks uniformly at random from `colors[]` (:140), a 5-colour list;
  several alternative palettes are kept as commented lines (:141-145). `getColor()` (:149-157)
  lerp-based colour lookup is defined but never called.
- Renderer: P2D with `smooth(8)` (:17); `pixelDensity(2)` is unavailable on the headless display (warning in stderr).
- The `triangulate` import (:1) and `arc2()` (:116-133) are dead code, never invoked.
- Randomness enters only via `random()` for positions, sizes and colours; no noise is used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| s_40 | `float s = 20;` -> `float s = 40;` | large (mean 0.3381, 62.1%) | coarser 40px grid: chunkier, better-aligned blocks; big squares now range 0–400px (s*10 scales too), so coverage differs and more dark navy background shows between blocks; sparser, more blocky composition | variants/s_40/frame_00001.png |
| ss_s2 | `float ss = random(s*10);` -> `random(s*2);` | large (mean 0.3625, 61.3%) | large filled squares shrink to small 0–40px chips: canvas becomes mostly dark navy background with sparse colour chips; the 120px wireframe outlines and dots now dominate the look | variants/ss_s2/frame_00001.png |
| wireSize_240 | `rect(x, y, 120, 120);` -> `rect(x, y, 240, 240);` | subtle (mean 0.0399, 12.2%) | filled mosaic unchanged; thin outlines double to 240px giving a coarser wireframe grid. Only the 1px lines differ, hence the small score | variants/wireSize_240/frame_00001.png |
| dotSize_15 | `rect(x, y, 5, 5);` -> `rect(x, y, 15, 15);` | subtle (mean 0.0171, 3.9%) | medium dots grow from 5px to 15px and read slightly bolder; the rest of the image is identical | variants/dotSize_15/frame_00001.png |
| colors_alt | `#80D2F0, #D4F5F4, #472176, #030234, #F7CE5B` -> `#F7AA06, #35B1CA, #DA4974, #B9100F, #214CA2` | large (mean 0.3232, 98.7%) | identical geometry, completely different mood: red and amber dominate with teal, pink and dark blue accents; warm high-contrast vs the baseline's cool pastel quilt | variants/colors_alt/frame_00001.png |

## Modularisation notes
- Generic blocks: the "N rects snapped to a grid with random size range and random palette fill"
  pattern repeats 4x verbatim — one library function `gridSnapRect(grid, count, sizeRange, palette)`
  would collapse the whole sketch. `rcol()`/palette swap is trivially reusable.
- One-off art decisions: the specific 4-pass layering (fills, wireframe, dots, sub-dots), the
  10x / 0.25x size ratios, and the chosen 5-colour palettes.
- A clean parameter object: `{grid: 20, passes: [{count, sizeFn, mode: fill|stroke, palette}], background: "palette"|color}`.
