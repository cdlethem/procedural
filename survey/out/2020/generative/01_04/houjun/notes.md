---
sketch: 2020/generative/01_04/houjun
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 3535
animated: false
techniques: [noise-field, polar, spiral, distortion]
primitives: [line]
palette:
  colors: ["#D5D3D4", "#CF78AF", "#DA3E0F", "#068146", "#424BC5", "#D5B307", "#161026"]
  selection: noise-driven
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: radialDashField, signature: "radialDashField(center, count, len, fanSteps) -> void", note: "stochastic points, each emitting a fan of short radial dashes with noise-modulated direction and length"}
  - {name: noiseDisplacement, signature: "noiseDisplacement(x, y, z, scale) -> float2", note: "smooth 3-D noise offset field (getDes), used to warp point positions relative to a center reference"}
---

## What it draws
A full-bleed field of tiny radial dashes, denser and brighter toward the center, fading toward the
edges where a flat blue background shows (top-right corner). Dominant colours are pink and red, with
large patches of yellow, and accents of blue and green. The dashes swirl into spiral bands that wind
around the center, so the whole image reads as a soft, knitted vortex rather than a uniform texture.

## How the code works
`setup()` -> `generate()` (houjun.pde). After `randomSeed(seed)` / `noiseSeed(seed)`, the background
is one random palette colour (line 53). Six per-point noise scales are rolled once (lines 55-62):
`detAmp`, `detAng`, `detAlp`, `detCol`, `detLen`, plus `detDes`/`desDes` for the displacement field.

Main loop (lines 75-124): 300,000 iterations, each picks a random (x,y) inside the canvas with a
-120 px margin (line 69), quantized to a 2 px grid plus a 10 px sub-offset (lines 78-81). The angle
`a` starts as the angle from the canvas center (line 82), then gets a 4-fold angular perturbation
`cos(a*TAU*4)*0.3` (line 84) and a radial twist `(d+a)*TAU*0.1` (line 86) — together these produce
the spiral banding. `aa` is a noise-driven angular spread (line 85). Dash length scale `amp` comes
from 2-D noise (line 89) and is cut to a tenth beyond `d > 2.6` (line 90), which fades the edges.

Colour: 3-D noise sampled at a third z (line 87) indexes `getColor`, which lerps between two adjacent
palette entries (lines 149-155), then everything is lerped 30% toward the dark navy `#161026`
(line 100). Alpha is noise-lerped between 40 and 120 (line 106).

Positions are warped by a smooth displacement field: `getDes(x, y, 999)` / `getDes(x, y, 111)`
(lines 103-104, 127-129) subtract the field's center value, shifting each point by up to ~800 px of
smooth 3-D noise — this is what folds the uniform grid into the swirling bands.

Inner loop (lines 110-116): 24 steps, each drawing two 1-px lines from (x,y) in directions
`a-aa` and `a+aa` with length `len*amp*rad` (`len=2`, `rad=2`, line 66/108); alpha follows
`sin(PI*val)` so the fan is strongest mid-sweep, and `a += 0.1` per step so the fan itself spirals.
Each point therefore emits 48 short dashes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic, library-worthy: the radial dash fan (per-point: angle from center + radial twist + noise
spread, fan of 2xN lines with sin-shaped alpha falloff); the `getDes` noise displacement field
(sample 3-D noise at fixed z, subtract center reference); the noise-indexed palette lerp in
`getColor`. One-off art decisions: the specific 4-fold `cos(a*TAU*4)` perturbation, the edge fade
threshold `d > 2.6`, the 30% lerp toward `#161026`, the 6-colour palette, and the 300,000x24
stroke budget. A clean parameter object would be: `{count, len, fanSteps, ampScale, angScale,
edgeFadeDist, twist, palette[], darkLerp, alphaRange, dispScale, dispZ, seed}`.
