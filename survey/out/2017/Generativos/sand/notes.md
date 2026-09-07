---
sketch: 2017/Generativos/sand
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1518
animated: false
techniques: [curves, distortion]
primitives: [shape]
palette:
  colors: ["#F79832", "#F18315", "#DB6B01", "#9C3702", "#AD4B02"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: mo, default: "random(1, 3.5)", tried: ["4.0 + random(1, 3.5)"], change: subtle, effect: "more wave cycles -> busier wiggly boundary, but the two colour fields are unchanged (only the thin boundary moves)"}
  - {name: amp, default: "random(0.1, 0.3)", tried: ["0.5 + random(0.1, 0.3)"], change: moderate, effect: "larger amplitude -> wider S, bulges out further, left/right fields more unequal; same colours"}
  - {name: dy, default: 2, tried: [8], change: none, effect: "no visible change; strip height is invisible because each strip already renders a smooth horizontal gradient"}
  - {name: mx1, default: "random(0.4, 0.6)", tried: ["0.4 + random(0.4, 0.6)"], change: subtle, effect: "pushes the top anchor right -> steeper diagonal; colours unchanged, little overall change"}
  - {name: palette, default: "amber 5-colour list", tried: ["blue 5-colour list"], change: large, effect: "recolours the whole image (amber -> blue/indigo duotone); S geometry identical, fully decoupled from palette"}
reusable_candidates:
  - {name: wavySplit, signature: "wavySplit(w, h, waveCount, baseAmp, ampModFreq, ampModPhase, ampModDepth, topX, botX, palette, stripHeight)", note: "scan the canvas in horizontal strips; compute a wavy S curve per row and paint two colour-gradient quads (left/right of curve) plus a black-alpha vignette per side"}
  - {name: colorRamp, signature: "colorRamp(colors, v) -> int", note: "lerpColor between floor/ceil palette entries at fractional v (the sketch's getColor)"}
---

## What it draws
A single smooth S-curve runs from the top edge to the bottom edge, splitting the square into two fields. The field on the left is a lighter amber; the field on the right is a deeper amber-brown. Each field is a smooth horizontal gradient that is brightest hugging the curve and darkens toward the outer corners, so a soft glowing highlight runs along the whole S. The overall image is a warm monochrome orange duotone with one soft central dividing line.

## How the code works
- `setup()` (lines 3-8): `size(960, 960, P2D)`, `smooth(8)`, `pixelDensity(2)`, then calls `generate()` once. `draw()` (10-11) is empty, so the image is static; `generate()` re-runs only on a non-`s` keypress (13-16). The seed (line 1) makes the randomness deterministic per seed.
- `generate()` (18-94) first calls `background(255)`, then draws seven random control values (29-37): `io` (wave phase), `mo` (1-3.5 full waves), `ia`/`ma` (amplitude-modulation phase/frequency), `amp` (0.1-0.3 base amplitude), `aa = amp*random(1)*random(0.5,1)` (derived amplitude-modulation depth), and `mx1`/`mx2` (top/bottom centre-x, each 0.4-0.6).
- The core loop (42-93) scans the canvas in horizontal strips of `dy = 2` px (480 strips). For each strip at rows `i` and `i+dy` it computes the curve's x at both rows as `x = width*( lerp(mx1,mx2,v) + cos(io + v*TWO_PI*mo) * (amp + cos(ia + ma*v)*aa) )` (44-48). That is a straight diagonal (top `mx1` -> bottom `mx2`) plus a `mo`-cycle cosine wave whose amplitude is itself modulated by a second cosine (`aa`). The result is the wavy S dividing line.
- Each strip paints the region between the curve and each canvas edge as colour-gradient quads plus a black-alpha vignette (P2D interpolates `fill()` per vertex, so a 4-vertex `beginShape` is a 2x2 colour grid):
  - right side (52-59): quad `(x1,y1)-(x2,y2)-(width,y2)-(width,y1)` filled from `getColor(colors.length*0.2)` ~ colors[1] `#F18315` near the curve to `getColor(colors.length-1)` ~ colors[4] `#AD4B02` at the right edge — the amber->brown horizontal gradient.
  - left side (62-69): quad `(x1,y1)-(x2,y2)-(0,y2)-(0,y1)` from `getColor(0)` = colors[0] `#F79832` near the curve to a 0.4-lerp toward colors[1] at the left edge — the lighter amber gradient.
  - right vignette (72-81): the same right quad with a black-alpha ramp `0 -> 10 -> 20 -> 10` (0 at the curve, max at the outer edge) — darkens the far corner, brightens the curve.
  - left vignette (83-92): the mirrored ramp on the left edge.
- Stacking 480 gradient strips that each carry the same horizontal gradient produces the overall smooth duotone with the glowing S. Randomness enters only through the seven control values (29-37).
- Palette: a fixed 5-colour amber list (102). `getColor(v)` (107-113) returns `lerpColor(colors[floor], colors[ceil], frac)`, so colour is interpolated along the list rather than randomly picked. `rcol()` (104-106) is defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| mo_4.0 | `float mo = random(1, 3.5);` -> `float mo = 4.0 + random(1, 3.5);` | subtle | boundary gains extra ripples (more oscillations top-to-bottom); the two colour fields and their gradients are unchanged, so only the thin boundary moved | variants/mo_4.0/frame_00001.png |
| amp_0.5 | `float amp = random(0.1, 0.3);` -> `float amp = 0.5 + random(0.1, 0.3);` | moderate | the wave is wider (bigger amplitude); the S bulges out further and the left/right fields become more unequal; same colours | variants/amp_0.5/frame_00001.png |
| dy_8 | `int dy = 2;` -> `int dy = 8;` | none | no visible change (identical to baseline); strip height does not affect the look because each strip is a smooth horizontal gradient | variants/dy_8/frame_00001.png |
| mx1_0.8 | `float mx1 = random(0.4, 0.6);` -> `float mx1 = 0.4 + random(0.4, 0.6);` | subtle | the curve's upper anchor is pushed right (steeper diagonal); same colours, little overall change | variants/mx1_0.8/frame_00001.png |
| palette_blue | `int colors[] = {#F79832, ...}` -> blue 5-colour list | large | identical S geometry, recoloured from amber to a blue/indigo duotone (light blue left, deep indigo right); geometry fully decoupled from palette | variants/palette_blue/frame_00001.png |

## Modularisation notes
- Reusable core: a "wavy duotone split" generator. Given (waveCount, baseAmp, ampModFreq, ampModPhase, ampModDepth, topX, botX, leftColors[2], rightColors[2], vignetteAlpha[4], stripHeight), scan horizontal strips, compute the curve x per row, and emit one 4-vertex gradient quad per side plus one 4-vertex black-alpha vignette quad per side. This is the `wavySplit` function above.
- Generic helper: `colorRamp(colors, v)` (the sketch's `getColor`) — lerp between adjacent palette entries; independent of this sketch.
- One-off art decisions: the specific amber palette; the fixed per-side palette indices (right 0.2/1.0->4.0, left 0.0/0.4); the vignette alpha ramp (0,10,20,10); and the choice to build each side as a 2-vertex-pair colour gradient (P2D per-vertex fill lerp) instead of a single linear gradient.
- A clean parameter object for this sketch: `{ waveCount, wavePhase, baseAmp, ampModFreq, ampModPhase, ampModDepth, topX, botX, leftA, leftB, rightA, rightB, vignette: [a,b,c,d], stripHeight }`. The P2D per-vertex gradient trick (a 4-vertex `beginShape` with 4 `fill()`s = a 2x2 colour grid) is the key reusable rendering idiom.
