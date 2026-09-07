---
sketch: 2020/generative/05_08/manchist
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1680
animated: false
techniques: [noise-field, image-source, particles]
primitives: [image]
palette:
  colors: ["#EF3428", "#E5D256", "#70B394", "#519FCF", "#DE6DAC", "#8F61B4", "#141514", "#E7E7EE"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: noiseWalkTrail, signature: "noiseWalkTrail(origin, stamps, noiseDetail, noiseAmp, stepVel, sizeFn, tintFn, image) -> void", note: "stamp an image along a random walk whose heading is driven by 1-D noise; per-stamp size follows a sin^p envelope"}
  - {name: lerpPalette, signature: "lerpPalette(colors, v, gamma) -> color", note: "wrap a float into the palette and lerp between adjacent entries"}
---

## What it draws
A dense full-bleed field on a purple ground: dozens of overlapping, softly blurred
"eye" shapes stamped from a source image, stretched into streaks, blobs and rings,
and tinted across the palette (orange-red, pink, yellow, teal, purple) plus some
untinted black-and-white and rainbow-streaked copies. The shapes cluster into
swirling trails that curl around the canvas with no clear focal point.

## How the code works
- `setup()` (L27) loads two eye images (`eye1.png`, `eye2.png`), a blur GLSL
  shader (loaded but never applied — the `filter(blur)` block L132-145 is
  commented out), then calls `generate()` once; `draw()` (L46) is empty, so the
  piece is static and regenerated only on keypress.
- `generate()` (L58) seeds RNG/noise, fills the background with a random palette
  colour (`rcol()`, L163), then runs 120 independent "trails" (L71).
- Each trail starts at a random point snapped to a 20 px grid (L72-76) and walks
  `cc` steps (100-500, L86). At every step the heading angle comes from
  `noise(desAng + k*detAng, i) * TAU * 2` (L102) — a 1-D noise sample per trail
  (`i` is the trail index, so each trail has its own noise slice) — plus a
  constant offset `aa`; position advances by `cos/sin(ang)*vel` (L121-122,
  `vel` ~ 0-2). This is what makes the shapes curl into swirling ribbons.
- Each step stamps `eyes[0]` (L69, L118) with `tint(getColor(ic + dc*k), alp)`
  (L108): colour walks linearly through the wrapped, gamma-lerped palette
  (`getColor(float)`, L171-177) along the trail, at alpha 200-256, so successive
  stamps blend into a continuous colour gradient. Stamp size is
  `img.width * s * amp` with `amp = pow(sin(v*PI), 0.1)` (L103) — near zero at
  the trail ends, nearly constant in the middle — so trails fade in and out.
  `s` is a small random multiplier (L78-79), so stamps range from tiny to
  roughly eye-sized.
- Randomness: trail count fixed at 120; start point, size, palette index `ic`,
  colour drift `dc`, step count `cc`, angle offset, velocity, noise detail
  `detAng` (0-0.006) and noise domain offset `desAng` (0-100) are all per-trail
  random (L72-92).
- The rainbow streaks in some blobs are the source image's own colours showing
  through where tint alpha is lower; the flat-coloured blobs are the same image
  dominated by the tint.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- The trail walk (L96-123) is the reusable core: given an image, a noise-detail
  and a per-step size/tint function, it stamps along a noise-steered walk.
  Parameterise: trail count, start-grid snap, steps-per-trail range, noise
  detail, velocity range, size envelope (`pow(sin(v*PI), p)` with exponent p),
  alpha range, palette walk (`ic`, `dc`).
- `getColor(float)` (L171) and `rcol()` (L163) are generic palette helpers
  (wrap + gamma lerp between adjacent palette entries).
- One-off art decisions: the specific 8-colour palette (L159), the eye source
  images, the commented-out blur post-pass (L132-145), keypress regeneration.
- A clean parameter object: `{trails, steps:[min,max], noiseDetail:[min,max],
  velocity:[min,max], size:[min,max], alpha:[min,max], gridSnap, sizeExp,
  palette, bgFromPalette, image}`.
