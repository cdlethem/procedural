---
sketch: 2015/Generativos/circuloss
year: 2015
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 221
animated: false
techniques: [dots-stippling, pixel-ops]
primitives: [ellipse, line, pgraphics]
palette:
  colors: ["#FF9900", "#424242", "#E9E9E9", "#BCBCBC", "#3299BB", "#F0F0F0", "#000000"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: maskCount, default: 5, tried: [12], change: pending, effect: "number of white mask circles"}
  - {name: maskSizeRange, default: "2^random(2,8)=[4,256]", tried: [2], change: pending, effect: "min exponent of mask circle diameter"}
  - {name: positionRange, default: "random(0.2,0.8)", tried: ["random(0.0,1.0)"], change: pending, effect: "random position window before centre bias"}
  - {name: scatterCount, default: 400, tried: [5000], change: pending, effect: "iterations of the coloured scatter loop (occluded)"}
  - {name: strokeWeight, default: 1, tried: [20], change: pending, effect: "X-line weight in coloured scatter (occluded)"}
reusable_candidates:
  - {name: centerBiasCircleMask, signature: "centerBiasCircleMask(count, sizeFn, bias) -> PGraphics", note: "N random, centre-biased, varying-size filled circles on a black PGraphics used as an opacity mask"}
  - {name: maskedScatter, signature: "maskedScatter(count, mask, brightnessThreshold, palette, sizeFn) -> void", note: "scatter primitives gated by mask.get()+brightness (draw only where the mask is bright)"}
---

## What it draws
On a black background: four to five white circles of very different sizes loosely clustered toward the upper-centre — one large (~180px diameter), two mid-size (~70px), and one tiny (~25px). That is the entire visible image; it is pure black and white with no colour anywhere. The coloured output the code actually generates is not present in the render.

## How the code works
`setup()` (lines 11-15) calls `generar()` and then `image(mask, 0, 0)`.

`generar()` (lines 25-62) builds two layers:
1. A `PGraphics mask` (lines 27-38): black background, then a 5-iteration loop (line 30) that draws a white ellipse (default fill; no `fill()` is set) at a random position in `[0.2, 0.8]` of width/height (lines 31-32), pulled 50% toward the centre (`x += (width/2-x)*0.5`, lines 33-34), with diameter `pow(2, random(2, 8))` ∈ [4, 256] (line 35).
2. The main canvas (lines 40-61): `background(240)` light grey, then a 400-iteration loop. Each iteration picks a random palette colour (`rcol()`, lines 69-71) at a random position, and **skips** if `brightness(mask.get(int(x), int(y))) < 200` (line 47) — i.e. it only draws inside the white mask circles. Where it does draw it emits a darkened offset "shadow" ellipse (line 54), the main ellipse (line 56), and two crossing lines forming an X (lines 59-60). The diameter `t` falls from `2^9=512` down to `2^2=4` as `i` goes 0→400 (line 48), so early iterations are huge and later ones tiny; because of the `continue` gate most of the 400 iterations are dropped (only the area covered by the 5 white circles gets anything).

**Key fact:** `image(mask, 0, 0)` in `setup()` (line 14) draws the opaque mask (black + white circles) **over the top** of everything `generar()` produced. The mask fills the whole 800×800, so the light-grey background, the 400 coloured circles and the X-lines are all completely hidden. The visible output is therefore just the mask: black with the white circles. Colour is chosen by `rcol()` (random from the 5-colour `paleta[]`) and darkened 5% toward black (`lerpColor(col, color(0), 0.05)`, lines 52-53), but none of it reaches the final image. (Note: line 34 uses `x` instead of `y` in the vertical bias — a latent bug that does not matter here since the mask is what shows.)

Randomness enters at: mask-circle positions and sizes (lines 31-35), the 400 scatter positions (lines 45-46), the palette pick (`rcol`), and the `random(1)` added to `t` (line 48).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic (library candidates):**
  - `centerBiasCircleMask(count, sizeFn, bias)` — the mask layer: N random, centre-biased, varying-size filled circles on a black PGraphics. Reusable as a spatial mask / blob field.
  - `maskedScatter(count, mask, brightnessThreshold, palette, sizeFn)` — scatter a set of primitives gated by a PGraphics pixel mask. The `mask.get() + brightness` gate is the reusable idea (draw only where a mask is bright).
- **One-off art decisions (and the bug):**
  - `image(mask, 0, 0)` overlaying the mask **on top of** the drawing in `setup()` — this is an oversight, not a deliberate effect: it occludes the intended colour output. Removing that line (or drawing the mask before `generar()`) would reveal the coloured scatter.
  - The specific `paleta[]` colours, the 50% centre bias, and the `2^map(i,…)` size schedule are the artist's choices.
- **Clean parameter object** would contain: `maskCount` (default 5), `maskSizeRange` (default [2, 8] as powers of two), `positionRange` (default [0.2, 0.8]), `centerBias` (default 0.5), `scatterCount` (default 400), `palette`, `sizeSchedule`. Note `scatterCount` and `palette` are currently **inert** (occluded) unless the mask-overlay line is removed.
