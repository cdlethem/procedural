---
sketch: 2018/Generativos/inthewordl
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1477
animated: false
techniques: [polar, noise-field, symmetry]
primitives: [shape]
palette:
  colors: ["#2F2624", "#207193", "#EF4C31", "#EE4E7C", "#FFFFFF"]
  selection: noise-driven
composition: radial
parameters:
  - {name: div, default: "int(random(4, 80))*4 (16-316 sectors)", tried: [180, 220], change: moderate, effect: "more sectors: 4-lobed diamond becomes sharper, finer angular facets"}
  - {name: sub, default: "int(random(8, random(8, 700))) (up to ~699 rings)", tried: [150], change: large, effect: "fewer, much wider color bands; outer area becomes broad flat wedges"}
  - {name: pwr, default: "random(0.8, random(1, 20))", tried: [3], change: large, effect: "rings spread evenly over the radius instead of crowding the center"}
  - {name: d2, default: "random(20)", tried: [4], change: large, effect: "larger smoother lobes in the center; outer bands fold into jagged zigzag stripes"}
  - {name: shw2, default: "random(80)", tried: [8], change: subtle, effect: "no visible change"}
reusable_candidates:
  - {name: polarNoiseRings, signature: "polarNoiseRings(cx, cy, outerRadius, rings, sectors, ringExponent, noiseScale, palette, shadowAlpha) -> void", note: "concentric noise-wobbled sectors with palette-mapped fill and black-alpha shading"}
  - {name: paletteColor, signature: "paletteColor(palette[][], v) -> color", note: "lerp across a looping color list by scalar index v"}
---

## What it draws
A centered, kaleidoscopic radial composition: concentric bands of flat quadrilaterals radiating
from the middle, each band's radius wobbled by noise so the rings bulge and pinch like a
crumpled star. The dominant colors are red and pink, with teal, near-white, and dark
charcoal/brown segments; faint black-alpha shading on sector edges gives a faceted,
low-3D look. The outer bands reach the canvas corners (full-bleed), the center is a dense
pinwheel of small facets.

## How the code works
`setup()` (L3-8) creates a 960×960 P2D canvas and calls `generate()` once; `draw()` is
empty, so the image is static (L10-11). All randomness is seeded from `seed` via
`noiseSeed`/`randomSeed` (L24-25).

Key parameters in `generate()`:
- `ss` (L27): outer radius, `width * random(0.38, 0.42) * 2` ≈ 730–806 px.
- `sub` (L28): number of concentric rings, up to ~699.
- `div` (L30): angular sectors, `int(random(4, 80)) * 4` (16–316); `da = TWO_PI/div`.
- `pwr` (L38): ring-density exponent `random(0.8, random(1, 20))`; the radius of ring `j`
  is `pow(map(j, 0, sub, 0, 1), pwr) * ss`, so high `pwr` crowds rings into the center.
- `shw1` (L45) / `shw2` (L46): black-alpha amounts for inner/outer edge shading.

Main loop (L48-95): for each ring `j` and sector `i`, the ring's outer/inner radii at angles
`a1`, `a2` are modulated by 2-D noise sampled on a circle: `p = 0.5 + noise(cos(a)*d2,
sin(a)*d2) * pwr` (L53-54). Each sector is drawn as a 4-vertex filled shape (L64-70) whose
color comes from `getColor` (L136-142): the palette index is
`pow(map(j, 1, sub, 0, 1), 0.5 + noise(...)) * 4` (L60), i.e. color band = ring position
wobbled by noise, lerped across the 5-color list `{#2F2624, #207193, #EF4C31, #EE4E7C,
#ffffff}` (L132). Two extra shapes overlay translucent black on the a1 edge (alpha `shw1`)
and on the outer edge (alpha `shw2`) (L72-93), producing the faceted shading. No blend
modes, no strokes on the fills (`noStroke()` L41); `stroke(0, 40)` (L32) is set but never
used because all shapes are filled with `noStroke()` active.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_dense | `int div = int(random(4, 80))*4;` -> `int div = int(random(45, 55))*4;` | moderate | sharper 4-lobed diamond star, finer angular facets, same red/pink/teal palette | variants/div_dense/frame_00001.png |
| sub_150 | `int sub = int(random(8, random(8, 700)));` -> `int sub = int(random(8, random(8, 150)));` | large | far fewer, much wider bands; broad flat pink/red/teal wedges outside, dense small diamond at center | variants/sub_150/frame_00001.png |
| pwr_low | `float pwr = random(0.8, random(1, 20));` -> `float pwr = random(0.8, random(1, 3));` | large | rings distributed evenly from center to edge; round concentric bands instead of center-crowded pinwheel | variants/pwr_low/frame_00001.png |
| d2_4 | `float d2 = random(20)*random(1)*random(1);` -> `float d2 = random(4)*random(1)*random(1);` | large | center wobble becomes large smooth 4-petal lobes; outer rings fold into jagged zigzag stripes | variants/d2_4/frame_00001.png |
| shw2_8 | `float shw2 = random(80)*random(1);` -> `float shw2 = random(8)*random(1);` | subtle | no visible change | variants/shw2_8/frame_00001.png |

## Modularisation notes
The whole `generate()` is one generic algorithm: a polar "noise rings" field renderer. A
clean parameter object would be: `outerRadius`, `rings`, `sectors`, `ringExponent`,
`radialNoiseScale`, `colorNoiseScale`, `palette[]`, `innerShadowAlpha`, `outerShadowAlpha`,
`center (cx, cy)`. The per-sector quad drawing (L64-93) and the `getColor` lerp (L136-142)
are reusable as-is. One-off art decisions: the specific 5-color palette (L132), the
`*4` sector multiplier (L30), the black-alpha shading trick, and the `4x` color-index
range (L60). The `keyPressed` regeneration (L13-19) and `saveImage`/`saveFrame` helpers are
harness concerns, not art logic.
