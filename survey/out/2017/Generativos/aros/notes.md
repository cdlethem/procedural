---
sketch: 2017/Generativos/aros
year: 2017
renderer: P3D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 1574
animated: true
techniques: [noise-field, polar, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#09080C", "#D1370C", "#094C22", "#C997A7"]
  selection: noise-driven
composition: centered
parameters: []
reusable_candidates:
  - {name: annulusMesh, signature: "annulusMesh(outerR, bandWidth, thickness, res, sub) -> quad mesh", note: "flat 3D ring (annulus) tessellated as outer/inner walls + top/bottom quads"}
  - {name: noiseVertexColor, signature: "noiseVertexColor(x, y, z, detail, palette[]) -> color", note: "per-vertex fill from 3-D Perlin noise folded into a palette via lerpColor"}
---

## What it draws
A single 3-D ring (a flat annulus, like a thin washer) floating in the centre of a black
960x960 field. The band reads as bright silvery-white with soft dusty-pink tint, broken by
scattered patches of orange-red and dark green. The ring is tilted in 3-D (viewed at a
shallow angle) and rotates slowly: frame 10 and 60 show the same ring at slightly different
tilts. The ring occupies roughly the middle third of the canvas; everything else is black.

## How the code works
- `setup()` (L3-8) opens a 960x960 P3D window, `smooth(8)`, calls `generate()`. `draw()`
  (L10-12) calls `generate()` every frame, so the whole scene is regenerated per frame.
- `generate()` (L24-40): `lights()` + `background(0)` (L25-26); `randomSeed(seed)` (L28)
  makes the per-frame random draw order reproducible for a fixed seed; `det =
  random(0.01)` (L29) sets the noise scale for vertex colour; origin moved to centre
  (L30); `time = millis()*0.001` (L31). A single loop (L32, `i < 1`) applies small
  time-scaled rotations `rotateX/Y/Z(time*random(-0.1,0.1))` (L33-35) — this is why the
  ring's orientation drifts between frames (the non-deterministic part; `millis()` is not
  seeded). Then `aro(s, h, g)` (L38) with `s = width*random(0.4, 0.8)` (outer diameter
  scale), `h = width*random(0.04, 0.1)` (thickness), `g = width*random(0.008, 0.012)`
  (band width).
- `aro()` (L43-96) builds the flat annulus: outer radius `r1 = s*0.5`, inner radius
  `r2 = r1 - g` (L44-45), half-thickness `h *= 0.5` (L49) spanning `z in [-h, h]`. It
  tessellates with `res = 128` segments around the main circle (L46) and `sub = 16`
  bands across the thickness (L48). For each `(i, j)` cell it emits four closed quads:
  outer wall (L64-69), inner wall (L71-76), bottom face (L78-83), top face (L85-90).
  `noStroke()` (L51) — the `stroke(255)` in `generate()` is never used.
- `vert()` (L98-101) wraps `vertex()`: before each vertex it sets
  `fill(getColor(noise(x*det, y*det, z*det)*colors.length*2))` (L99), so every vertex is
  coloured by 3-D Perlin noise at its position, scaled by `det`.
- `getColor()` (L109-115) folds the noise value with `abs` + `% colors.length` and lerps
  between two adjacent palette entries (L114). Palette (L104) is the coolors.co set
  white / near-black / orange-red / dark-green / dusty-pink.
- Randomness enters at: seed (L1), `det` (L29), rotation angles (L33-35), and `s/h/g`
  (L38). Lighting from `lights()` gives the band its bright rim shading.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `aro()` is a generic parametric annulus/torus-cross-section mesh builder:
  `annulusMesh(outerR, bandWidth, thickness, res, sub)`. The quad-emission loop (L52-94)
  is pure geometry with no art decisions; `res`/`sub` are resolution knobs.
- `vert()` + `getColor()` form a generic `noiseVertexColor(x, y, z, detail, palette)` —
  3-D noise sampled at vertex position, folded into a palette with a lerp. The `*2`
  multiplier on the noise (L99) and the `% colors.length` fold (L111) are the only
  art-specific choices.
- One-off art decisions: the single-ring composition, the `millis()`-driven tumble
  (L31-35), the black background + `lights()`, and the specific 5-colour palette.
- A clean parameter object: `{seed, outerRadius, bandWidth, thickness, res, sub,
  noiseDetail, palette, rotationSpeed}`. The `s/h/g` random ranges (L38) would become
  explicit fields; `det` (L29) becomes `noiseDetail`.
