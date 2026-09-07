---
sketch: 2018/Generativos/rectssss
year: 2018
renderer: P3D
size: [960, 540]
libraries: [peasy]
deterministic: false
ms_first_frame: 1469
animated: true
techniques: [subdivision, grid, 3d-mesh]
primitives: [rect, pgraphics]
palette:
  colors: ["#F0EFED", "#FBC1D2", "#ED397A", "#44C7BF", "#E7E737"]
  selection: noise-driven
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: recursiveRectSubdivide, signature: "recursiveRectSubdivide(x, y, w, h, iterations, splitNoise) -> Rect[]", note: "iteratively split random live rects at noise-driven fractions; count doubles per split"}
  - {name: paletteRamp, signature: "paletteRamp(float v, int[] colors) -> color", note: "noise-driven index into a colour list with lerpColor between neighbours"}
---

## What it draws
A cream/off-white canvas tiled by a mosaic of flat, axis-aligned rectangles in pale yellow, lime green, soft pink and a teal accent. The mosaic is dense and fragmented on the left (many thin vertical strips) and resolves into a few large blocks toward the bottom-right. Between frames the rectangles breathe (slight scale changes) and their colours drift, so the palette shifts toward more pink/teal over time.

## How the code works
- `setup()` (L12-16) creates a PeasyCam (unused in the active path) and draws a 960x540 P3D window.
- `draw()` (L60-127) reseeds `randomSeed(seed)` / `noiseSeed(seed)` every frame (L67-68), so geometry is fixed per seed; only `millis()`-driven noise changes over time.
- Subdivision: one root square `(-width/2, -width/2, width, width)` (L72) is added to a list. For `div = random(100, 2000)` iterations (L74) a random live rect is picked, split at a noise-determined fraction `val = noise(i, time*...)` (L78) either vertically or horizontally (L79-88), and the original removed. List size grows by 1 per iteration, so ~100-2000 final rects.
- Rendering: each final rect is drawn as a `box()` (L109) centred on the rect, with depth `d = min(w,h)*0.1` (L99) and scale `sca = pow(noise(time*random(1)), 0.2)` (L107) — the low exponent keeps boxes near full size while letting them breathe.
- Colour: `getColor(noise(time*random(...))*colors.length*3)` (L100) maps 1-D noise through a 5-colour list with `lerpColor` between adjacent palette entries (L141-147); the time term makes colours drift per rect per frame.
- PeasyCam and the `Camera` class (L18-48) exist but are commented out of `draw()` (L64-65), so the view is fixed front-on and the depth reads as a subtle flat relief.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the recursive rect-subdivide loop (L71-90) is a clean library function — `recursiveRectSubdivide(x, y, w, h, iterations, splitNoise) -> Rect[]` — it is independent of the renderer and could feed 2D or 3D drawing.
- Generic: the noise-to-palette ramp `getColor(v)` (L141-147) is a reusable `paletteRamp(v, colors)`.
- One-off art decisions: the pastel 5-colour palette, the `pow(noise, 0.2)` breathing exponent, the `min(w,h)*0.1` depth, and the square-into-landscape-root mismatch (root is `width`-squared on a 960x540 window, so content overflows the top/bottom and is cropped).
- Parameter object: `{seed, iterations (div), splitDetail (noiseDetail), depthFactor (0.1), breatheExponent (0.2), palette[], rootAspect}`.
