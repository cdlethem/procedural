---
sketch: 2019/generativos/nosenose
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1637
animated: false
techniques: [polar, noise-field, particles, dots-stippling, symmetry]
primitives: [point]
palette:
  colors: ["#F20707", "#EFB632", "#C5B7E8", "#2E3AE8", "#000000"]
  selection: noise-driven
composition: radial
parameters:
  - {name: ccc_factor, default: 0.3, tried: [0.6], change: none, effect: "point density (×2 count) — no visible change"}
  - {name: alpha_mult, default: 2.4, tried: [4.0], change: none, effect: "point alpha (×4) — no visible change"}
  - {name: displacement, default: 180, tried: [300], change: subtle, effect: "fbm swirl magnitude — blades more wavy/distorted, edges undulate more"}
  - {name: detAng_factor, default: 0.08, tried: [0.16], change: subtle, effect: "distortion field detail — blades more stretched/flowing, reach slightly further"}
  - {name: radius_factor, default: 0.6, tried: [0.4], change: none, effect: "cloud radius (smaller) — no visible change"}
reusable_candidates:
  - {name: ridgedMF, signature: "ridgedMF(x, y, octaves, lacunarity, gain, offset) -> float", note: "fractal Brownian + ridged multifractal (fbm.pde)"}
  - {name: fbm, signature: "fbm(x, y) -> float", note: "4-octave 2-D value-noise fbm on a hash grid (fbm.pde)"}
  - {name: getColor, signature: "getColor(v, palette) -> color", note: "noise-driven lerp across a colour list (nosenose.pde:125)"}
  - {name: dis, signature: "dis(x, y, seed, ang, des, detail, mag) -> PVector", note: "fbm-driven polar warp of a point (nosenose.pde:99)"}
---

## What it draws
A single full-bleed blue field (seed 42 background is the palette blue) with a pinwheel of
curved stippled "blades" fanning out from a dense dark point at the centre. Roughly six
tapering arms of fine light-blue points swirl outward, each edge soft and grainy; a small
amber/gold cluster sits just left of the centre where the blades converge.

## How the code works
`generate()` (nosenose.pde:57) runs once in `setup()`; `draw()` is empty so the piece is static.
- Background: one random palette colour via `rcol()` (nosenose.pde:62,119).
- `ccc` points: `ccc = PI*0.5*radius^2*0.3` ≈ 156k, `radius = width*0.6` (nosenose.pde:75-76).
- Per point: `ang = random(TAU)`, then partially snapped to `PI/3` multiples — this is what
  creates the ~6-fold pinwheel symmetry (nosenose.pde:78-79). Radius `dis = radius*sqrt(rand)*random(0.6,1)`,
  also snapped (line 80-81), then `ang` wobbled by two `cos(dis*a)` waves + `dis*rot` (line 83).
- Base position is polar about centre (lines 84-85), then warped by `dis(xx,yy)` (line 86):
  `dis()` samples 4-octave `fbm` (fbm.pde:27) for a per-point angle and up-to-180px displacement,
  giving the soft swirling distortion (nosenose.pde:99-103).
- Colour: `getColor(noise(...) * colors.length)` (line 90) — a noise value indexes the 5-colour
  list with a lerp, so points drift between palette colours (mostly blue here). Alpha
  `random(20,40)*2.4` (line 89). Drawn as `point()` in `NORMAL` blend (lines 92-93).
- Palette is the active `#F20707 #EFB632 #C5B7E8 #2E3AE8 #000000` (line 114); other lists are
  commented out. `ridgedMF` (fbm.pde:47) is defined but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ccc_0.6 | `int ccc = int(PI*0.5*radius*radius*0.3);` -> `...0.6);` | none | no visible change (blades read marginally denser/filled, within noise) | variants/ccc_0.6/frame_00001.png |
| alpha_4.0 | `float alp = random(20, 40)*2.4;` -> `*4.0;` | none | no visible change (points slightly more solid, within noise) | variants/alpha_4.0/frame_00001.png |
| displacement_300 | `...detDes)*180;` -> `*300;` | subtle | subtle: swirl amplified — blade edges undulate more, arms more wavy and flowing | variants/displacement_300/frame_00001.png |
| detAng_0.16 | `detAng = 0.012*random(0.8, 1)*0.08;` -> `*0.16;` | subtle | subtle: finer distortion — blades more stretched/elongated and flow further outward | variants/detAng_0.16/frame_00001.png |
| radius_0.4 | `float radius = width*0.6;` -> `width*0.4;` | none | no visible change (cloud reads marginally more compact, within noise) | variants/radius_0.4/frame_00001.png |

## Modularisation notes
Generic, library-worthy: the whole `fbm.pde` tab (`random2`/`noise2`/`fbm`/`ridge`/`ridgedMF`) is a
self-contained fractal-noise module; `getColor(v, palette)` is a reusable noise-driven colour ramp;
`dis()` is a reusable fbm polar-warp (needs seed, angle/detail, displacement magnitude as params).
One-off art decisions: the `PI/3` 6-fold angle snap, the `cos(dis*a1)+cos(dis*a2)+dis*rot` wobble,
the `0.3` density factor and the specific 5-colour palette. A clean parameter object would hold:
palette[], background selection, point count, cloud radius, alpha range, distortion detail
(detAng/desAng/detDes/desDes), displacement magnitude, blade count (the angle-snap divisor), and
wobble amplitudes (a1/a2/amp1/amp2/rot).
