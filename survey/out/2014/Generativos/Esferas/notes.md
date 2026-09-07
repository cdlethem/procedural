---
sketch: 2014/Generativos/Esferas
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 161
animated: false
techniques: [lines-hatching, grid]
primitives: [rect]
palette:
  colors: ["#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: growth, default: "exp(i)", tried: ["exp(i/2)", "i*10"], change: large, effect: "slower growth widens the graduated short-bar region; linear growth turns the bars into a smooth triangular ramp filling ~half the canvas"}
  - {name: barWidth, default: 5, tried: [10], change: large, effect: "wider, more spaced comb; same overflow structure, cluster reads coarser and denser white area"}
  - {name: anchor, default: "height/2", tried: ["height/3"], change: none, effect: "no visible change - full-height overflow bars dominate, only 7 short bars move a few pixels"}
  - {name: "palette[0]", default: "#FFFFFF", tried: ["#FF0000"], change: none, effect: "no visible change - palette and rcol() are dead code, fill() is never called so bars stay default white"}
reusable_candidates:
  - {name: expBars, signature: "expBars(width, barW, growth, anchor) -> void", note: "vertical bars whose height is exp(i), full-bleed once exp overflows the canvas"}
---

## What it draws
On a black 600x600 canvas, a dense comb of thin white vertical bars fills the left quarter of
the image. The leftmost ~7 bars are short, of increasing height, centered on the horizontal
midline; every bar after that overflows the canvas and reads as a full-height white line.
The rest of the canvas (right ~three quarters) is empty black. No spheres despite the name.

## How the code works
- `setup()` (L5-8) sizes the canvas 600x600 and calls `generar()` once; `draw()` (L10-12) is
  empty, so the sketch is static.
- `generar()` (L14-20): `background(0)` (black), then `for (i = 0; i < width/5; i++)` — 120
  iterations — draws `rect(i*5, height/2 - h/2, 5, h)` with `h = exp(i)` (L17). Bar `i` is 5px
  wide at x = i*5, centered vertically on `height/2`.
- The visual is an overflow accident: `exp(i)` exceeds the 600px canvas height at i=8, so bars
  8..119 have `h` of thousands-to-infinity and paint as full-height columns. Only bars 0..7
  (h = 1, 3, 7, 20, 54, 148, 403, 1096 px) show their true exponentially growing length.
- Colour: `fill()` is never called, so the default white (255) is used. `paleta[]` (L1-3,
  single entry `#FFFFFF`) and `rcol()` (L32-34, random pick from the list) are dead code,
  never invoked.
- Randomness: none (rcol never called); render is fully deterministic.
- `keyPressed` regenerates on any key except 's' (save), irrelevant to the render.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| growth_i_over_2 | `float h = exp(i);` -> `float h = exp(i/2);` | large | graduated region of short-to-medium bars extends further right (bars 0..14 show distinct lengths) before full-height lines begin; wider, more textured left cluster | variants/growth_i_over_2/frame_00001.png |
| growth_linear | `float h = exp(i);` -> `float h = i*10;` | large | completely different picture: bars grow linearly, forming a smooth stepped triangular ramp that fills the left ~half of the canvas, diagonal edge at mid-canvas, right half black | variants/growth_linear/frame_00001.png |
| barwidth_10 | `i < width/5; i++)` + `rect(i*5, ..., 5, h);` -> width 10 | large | same structure with twice-as-wide bars: coarser comb, thicker lines, more solid white area in the left cluster | variants/barwidth_10/frame_00001.png |
| anchor_height_over_3 | `height/2-h/2, 5, h);` -> `height/3-h/2, 5, h);` | none | no visible change; full-height overflow bars cover the anchor shift of the 7 short bars (0.8% of pixels differ) | variants/anchor_height_over_3/frame_00001.png |
| palette_red | `#FFFFFF` -> `#FF0000` | none | no visible change; bars remain white, confirming `paleta[]`/`rcol()` are never used (default fill) | variants/palette_red/frame_00001.png |

## Modularisation notes
- Generic block: the bar loop (L16-19) is a clean one-parameter family — bar width, growth
  function (`exp` vs linear vs noise), vertical anchor — and would make a small
  `expBars(canvas, barWidth, growth, anchorY)` utility.
- One-off / art decisions: the exponential growth that overflows (the whole look depends on
  the bug); the left-anchored tiling that leaves the right side empty.
- Dead code to drop in any reuse: `paleta[]`, `rcol()`, `saveImage()`.
- A clean parameter object: `{barWidth: 5, count: width/barWidth, growth: i -> exp(i), anchor: 0.5*height, fill: 255, background: 0}`.
