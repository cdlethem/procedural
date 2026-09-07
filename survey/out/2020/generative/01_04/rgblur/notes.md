---
sketch: 2020/generative/01_04/rgblur
year: 2020
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1874
animated: false
techniques: [image-source, blend-modes, distortion]
primitives: [image, pgraphics]
palette:
  colors: ["#B2734B", "#A69050", "#897E6A", "#5B6066", "#292E31"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: directionalBlur, signature: "directionalBlur(pg, passes, ampStart, ampStep) -> void", note: "iterated anisotropic blur: horizontal pass with growing amplitude, then a small vertical pass each iteration"}
  - {name: paletteLerp, signature: "getColor(colors, v) -> color", note: "wrap v around the palette and lerpColor between adjacent entries with pow(v%1, 0.6) easing"}
  - {name: brushStamps, signature: "brushStamps(pg, brush, count, yDist, wRange, hRange) -> void", note: "stamp a soft brush image at random x, y = height * random(1)^2, stretched to full-width bands"}
---

## What it draws
Full-bleed field of horizontal, heavily blurred bands in a muted earth palette: rust orange and ochre at the top, slate blue-grey in the middle, and a large creamy pale ellipse in the lower right. Edges between bands are soft and smeared, as if paint strokes were blurred sideways; the overall effect is an abstract, atmospheric landscape. Static (frames 1/10/60 identical).

## How the code works
`setup()` loads `blur.glsl` and `brush.png`, then calls `generate()` once (line 29); `draw()` is empty, so the piece is static.

- `generate()` builds a `mask` PGraphics (lines 59–72): 100 random tinted brush stamps on a dark (20) background — this mask is passed to the shader (`blur.set("mask", ...)`, line 114) and modulates the blur, but is never drawn to the main canvas.
- Background is one random palette colour (`rcol()`, line 76).
- Main loop (lines 94–109): `cc = 1000` iterations stamping `brush.png`. x is uniform random; y is `height * random(1)^2` (line 96–97) which biases stamps toward the bottom (val^2 is small more often). Each stamp is stretched to `ww = width*random(0.7, 1.4)` wide (line 100) and `hh = height*random(0.1, 0.5)*random(0.5+val)` tall (line 101), i.e. wide flat bands, thicker toward the bottom. Tint cycles through the palette via `getColor(i*ac+ic)` (line 102) with random alpha, so hue drifts slowly across the 1000 stamps; 20% ADD / 20% DARKEST / 60% NORMAL blend modes (lines 104–106) create the bright additive highlights (the pale ellipse) and dark seams.
- Finally (lines 117–124): 8 iterations of the `blur.glsl` shader — a horizontal blur with amplitude growing 0.0001 + i*0.0004, followed by a weaker vertical pass — which smears the bands into the soft horizontal streaks seen in the image. (The shader's `time` uniform is set but unused per the compile warning.)

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the directional blur filter chain (8 anisotropic passes with growing amplitude), the `getColor` palette lerp with wraparound, and the brush-stamp accumulation (count, y-distribution, width/height ranges, blend-mode probabilities) are all portable; each maps to a `reusable_candidates` entry above.
- One-off art decisions: the fixed 5-colour earth palette (line 141) and the commented-out alternative palettes, the specific brush texture, and the mask PGraphics that feeds the shader.
- Clean parameter object: `{count, yBias (the ^2), wRange, hRange, palette, blendProbs [add, darkest, normal], blurPasses, blurAmpStep, seed}`. The `mask`/shader coupling could be a separate "texture-modulated blur" option.
