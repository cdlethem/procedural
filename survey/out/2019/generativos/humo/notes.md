---
sketch: 2019/generativos/humo
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1759
animated: false
techniques: [packing, grid]
primitives: [ellipse, shape]
palette:
  colors: ["#F7743B", "#9DAAAB", "#6789AA", "#4F4873", "#3A3A3A"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "annulus between two radii as a QUAD_STRIP with alpha gradient from alp1 (inner) to alp2 (outer); the halo effect"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform random pick from a palette array"}
---

## What it draws
A field of soft, out-of-focus circles on a hazy warm-gray background, like moons or bokeh lights.
Most of the image is a translucent wash made of large overlapping rings, while a handful of
solid circles stand out — a big orange disc lower-left and a big purple one in the center —
each with a small bright white dot at its exact center. A few near-opaque small dark and light
circles scatter over the haze.

## How the code works
`setup()` calls `generate()` once (line 23); `draw()` is empty, so the image is static.
`generate()` (lines 34-55) fills a black background, then loops 100 times: each "moon" gets a
random position snapped to a 10 px grid (`x -= x%10`, lines 43-44), and a size
`s = pow(2, int(random(6)))*10` (line 41), i.e. one of {10, 20, 40, 80, 160, 320}.
For each moon it draws (1) a solid `ellipse` filled with a uniformly random palette color
(`rcol()`, lines 71-73), (2) two concentric halos via `arc2()` at radius `s*6` and `s*3`
(lines 49-50), and (3) a small white dot of diameter `s*0.1` at the center (lines 52-53).
`arc2` (lines 124-139) builds the halo as a `beginShape(QUAD_STRIP)` annulus whose inner edge
uses alpha 80 and outer edge alpha 0, giving a soft radial fade — the accumulation of hundreds
of these translucent annuli is what produces the hazy background. Randomness comes only from
Processing's seeded `random()` (position, size, color), so the result is deterministic per seed.
`SimplexNoise` is imported and `noise2`/`fbm` are defined (lines 85-122) but never called.
`smooth(8)` + `pixelDensity(2)` anti-alias the edges (line 17-18).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The generic, reusable core is `arc2` — an alpha-gradient annulus — which by itself is a
compositional primitive (halos, glows, soft rings). `rcol` (random palette pick) and the
size ladder `pow(2, k)*10` (geometric size distribution) are also trivially reusable.
The one-off art decisions are: the fixed 5-color palette, the "moon" recipe (solid disc +
two halo rings at fixed 3x/6x multipliers + center dot at 0.1x), the 10 px grid snap, and
the count of 100. A clean parameter object would be:
`{count, sizeExponent, haloMultiples: [6, 3], haloAlpha, dotScale, gridSnap, palette}`.
The unused `fbm`/`noise2` block suggests the author originally planned noise-driven placement
but shipped the purely random version.
