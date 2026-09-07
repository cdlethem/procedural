---
sketch: 2018/Generativos/solebo
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1543
animated: false
techniques: [grid, noise-field, shader, distortion]
primitives: [rect, shape, line]
palette:
  colors: ["#1C2533", "#303A36", "#9DA37F", "#A88D40", "#C5BD77", "#EAF2D9", "#C2C8A8", "#DED9A2", "#DFE4CC"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: grid, default: 60, tried: [30], change: moderate, effect: "coarser ground grid and 2x-larger, fewer panels (loop count = grid)"}
  - {name: alpDet, default: "random(0.005,0.006)", tried: [0.002], change: subtle, effect: "slightly larger, smoother mottled patches in the ground grid; panels unchanged"}
  - {name: gridStrokeAlpha, default: 120, tried: [255], change: none, effect: "no visible change — pow(noise,2) keeps most stroke alphas low anyway"}
  - {name: shadowSpread, default: "min(w,h)*random(1,3)", tried: ["min(w,h)*random(1,8)"], change: moderate, effect: "much wider, softer halo/shadow around each panel"}
  - {name: fillAlpha, default: "random(40,80)*1.4", tried: [200], change: moderate, effect: "panels and shadows far more opaque, higher contrast, ground mostly hidden"}
  - {name: palette, default: "9 muted olive/cream colours", tried: ["{#100D93, #DF390C}"], change: large, effect: "same structure recoloured to saturated indigo/red; every pixel changes"}
reusable_candidates:
  - {name: noiseGridStroke, signature: "noiseGridStroke(cellSize, cellCount, detail, alpha, color) -> void", note: "grid of rect strokes whose alpha is pow(noise, 2) — soft mottled ground texture"}
  - {name: shadowRect, signature: "shadowRect(x, y, w, h, spread, color, alpha) -> void", note: "rect plus four alpha-fading trapezoids (top/left/bottom/right) faking a soft drop shadow"}
  - {name: grainShader, signature: "loadShader('noiseShadowFrag.glsl','noiseShadowVert.glsl') + set('displace', d)", note: "GLSL that multiplies fragment alpha by a per-pixel hash noise, adding uniform grain"}
---

## What it draws
A full-bleed abstract collage in muted olive, cream, sage and grey-green. The background is a
soft, grainy mottled field made of faint grid lines whose visibility varies in blob-like patches.
Scattered over it are translucent rectangles of many sizes — some nearly solid pale yellow or sage,
some showing the grid through their fill — and each carries a soft shadow that fades out on one or
more sides. A few small solid squares and thin dark bars punctuate the composition. Overall: a
quiet, layered, grainy composition of translucent panels with soft drop shadows.

## How the code works
`setup()` sizes 960×960 P2D, loads the `noiseShadow` shader (noiseShadowFrag.glsl) and calls
`generate()` once; `draw()` is empty, so the piece is static (solebo.pde:5-16).

`generate()` (solebo.pde:26):
1. Background: `back = lerpColor(color(255), rcol(), 0.3)` (line 28) — a lightened random palette
   colour, here a pale olive.
2. `noiseSeed(seed); randomSeed(seed)` (32-33) make the run deterministic for a given seed.
3. Shader active (36-38). Ground layer: a 60×60 grid (line 41, `gs = width/grid`); for each cell a
   no-fill `rect` is stroked with `stroke(gc, 120*pow(noise(alpDes+xx*alpDet, alpDes+yy*alpDet), 2))`
   (lines 49-56). `alpDet ≈ 0.005-0.006` (line 48) is the noise zoom, so stroke alpha varies in
   blob-like patches across the canvas — that is the mottled, patchy grid seen in the image.
4. Second layer, one per grid row (lines 77-149): a random rectangle with random position (quantised
   to 1/4-cell, lines 83-84), random size 1..~30 cells (85-86), a random palette colour (87), and
   alpha `random(40,80)*1.4` (88). An 80% chance of a thin stroke (93) then the fill-less `rect`
   (94). Four `beginShape` trapezoids (111-146) extend `bb = min(w,h)*random(1,3)` (line 89) beyond
   each edge, filled with the same colour at `alp` fading to alpha 0 — these gradient trapezoids are
   the soft shadows trailing off the rectangles. A small central ellipse (148) adds a dark core in
   some panels.
5. Colour: `rcol()` picks a random entry from the 9-colour olive/cream palette (lines 195-198);
   `getColor` (199-205) is defined but unused.
6. The fragment shader (noiseShadowFrag.glsl:19-24) sets `color.a = vertColor.a * (1.0 + pow(rand((gl_FragCoord.xy + displace) * 0.001), 0.8))` where `rand` is a per-pixel hash — alpha is scaled by 1.0–2.0 per pixel, which makes semi-transparent fills grainy and speckled; `displace` is re-randomised per rectangle (solebo.pde:37,79,97) so the grain pattern shifts between panels.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_30 | `int grid = 60;…` -> `int grid = 30;` | moderate | coarser ground texture (bigger mottled patches) and fewer, chunkier panels — both cell size and panel count scale with `grid` | variants/grid_30/frame_00001.png |
| alpDet_0.002 | `float alpDet = random(0.005, 0.006);` -> `float alpDet = 0.002;` | subtle | ground mottling slightly larger and smoother; panels identical (same random stream) | variants/alpDet_0.002/frame_00001.png |
| strokeAlpha_255 | `stroke(gc, 120*pow(…` -> `stroke(gc, 255*pow(…` | none | no visible change — pow(noise,2) keeps most stroke alphas low even at 255 | variants/strokeAlpha_255/frame_00001.png |
| shadowSpread_8 | `float bb = min(ww, hh)*random(1, 3);` -> `…*random(1, 8);` | moderate | soft shadows/halos around panels spread much wider, composition reads more washed-out at the panel edges | variants/shadowSpread_8/frame_00001.png |
| fillAlpha_200 | `float alp = random(40, 80)*1.4;` -> `float alp = 200;` | moderate | panels and shadows much more opaque; higher contrast, ground grid mostly hidden behind solid fills | variants/fillAlpha_200/frame_00001.png |
| palette_blue_red | 9-colour olive array -> `{#100D93, #DF390C}` | large | identical structure recoloured to saturated indigo and red/orange; every pixel differs | variants/palette_blue_red/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `noiseGridStroke` (grid + pow-noise alpha) is a standalone ground-texture
  function; `shadowRect` (rect + four fading edge trapezoids) is a reusable "soft drop shadow"
  primitive; the grain shader is a reusable post-effect.
- One-off art decisions: the specific 9-colour palette, the 1/4-cell position quantisation, the
  size range (1..~30 cells), the 0.3 background lightening, and the 80% thin-stroke probability.
- A clean parameter object: `{ cellCount, noiseDetail, noiseAlpha, rectCount, rectSizeRange,
  fillAlpha, shadowSpread, strokeProb, palette, grainStrength }` — everything else is fixed
  structure.
