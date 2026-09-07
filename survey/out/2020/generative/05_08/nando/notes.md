---
sketch: 2020/generative/05_08/nando
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1547
animated: false
techniques: [polar, noise-field, distortion, curves]
primitives: [line]
palette:
  colors: ["#FFFFFF", "#FFB0D0", "#F7DE20", "#245C0E", "#EB6117", "#F72C11", "#C6356B", "#953DC4", "#003399", "#02060D"]
  selection: random-from-list
composition: radial
parameters:
  - {name: res, default: 56, tried: [24], change: large, effect: "fewer, much wider ribbons with visible gaps between them"}
  - {name: amp, default: 0.98, tried: [0.3], change: large, effect: "narrower ribbons, thin radiating streaks, more white space"}
  - {name: det, default: 0.0005-0.0008, tried: [0.002], change: large, effect: "higher-frequency wobble, busier finer buckling of each ribbon"}
  - {name: aa, default: 100-280, tried: [50], change: large, effect: "gentler twist, straighter smoother radial bands"}
  - {name: alpha, default: 120, tried: [255], change: moderate, effect: "more opaque colors, less see-through overlap; same structure"}
  - {name: s, default: 0.7*width, tried: [0.4], change: large, effect: "shorter ribbons, denser chaotic full-frame tangle"}
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(p, det, amp, seed) -> PVector", note: "3-D simplex displacement of a point using cos/sin of two noise channels"}
  - {name: radialRibbons, signature: "radialRibbons(cx, cy, res, s, amp, pwr, det, aa) -> void", note: "fan of noise-twisted quad-strip ribbons around a center"}
---

## What it draws
A pinwheel of ~56 semi-transparent colored ribbons radiating from the exact center of the canvas. Each ribbon is a long twisted band that starts pinched at the center and flares toward the edge, its surface buckled into smooth 3-D waves by noise. Overlapping ribbons cross in the middle and near the rim, producing dense hatched regions where many thin stroke lines pile up. Colors are saturated and varied (red, orange, yellow, green, blue, magenta, black, pink) on a near-white background.

## How the code works
`setup()` calls `generate()` (nando.pde:22). `generate()` (nando.pde:54) sets a light-gray background (61) and computes a center point. It loops `res = 56` times (67); each iteration `i` is one ribbon occupying angular cell `da = TAU/res` (68). The ribbon's two edges are at angles `a1 = da*i` and `a2 = da*(i+amp)` (86-87) with `amp = 0.98` (70), so each ribbon nearly fills its cell.

Inside, a second loop over `j = 0..799` (94) builds a `QUAD_STRIP`. Distance from center is `s1 = s*pow(v1, pwr)` (96) with `s = width*0.7` (69) and a per-ribbon random exponent `pwr` in 1..8, inverted half the time (90-91) — this is what makes some ribbons bulge at the rim and others at the hub. A half-turn offset `dm = PI*v2` (97) rotates the ribbon along its length. Each of the two edge points is pushed out on a circle (cos/sin, 98-99) then displaced by `def()` (111), which adds a 3-D simplex-noise offset scaled by `aa` (amplitude 100..280) and sampled at frequency `det` (0.0005..0.0008). Stroke color is a random palette pick at alpha 120 (89); no fill. The depth test is disabled (56) so ribbons simply overdraw.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| res_24 | `int res = 56;` -> `int res = 24;` | large | fewer, much wider ribbons with clear white gaps between them | variants/res_24/frame_00001.png |
| amp_0.3 | `float amp = 0.98;` -> `float amp = 0.3;` | large | narrow thin ribbons, fine radiating streaks, lots of white space | variants/amp_0.3/frame_00001.png |
| det_0.002 | `float det = random(0.0005, 0.0008);` -> `float det = 0.002;` | large | busier, higher-frequency wobble; each ribbon is finer and more convoluted | variants/det_0.002/frame_00001.png |
| aa_50 | `float aa = random(100, 280);` -> `float aa = 50;` | large | gentler twist; straighter, smoother radial bands with less 3-D buckling | variants/aa_50/frame_00001.png |
| alpha_255 | `stroke(rcol(), 120);` -> `stroke(rcol(), 255);` | moderate | same fan structure, but more opaque colors with less see-through overlap | variants/alpha_255/frame_00001.png |
| s_0.4 | `float s = width*0.7;` -> `float s = width*0.4;` | large | shorter ribbons; denser chaotic full-frame tangle, no clean radial fan | variants/s_0.4/frame_00001.png |

## Modularisation notes
`def()` (111) is the generic, reusable piece: a point displaced by two simplex-noise channels through a spherical cos/sin mapping. Parameterized by `det` (frequency) and `amp` (magnitude) it is a library-ready `noiseDisplace`. The ribbon fan (83-108) is the art-specific layer: `res` (count), `s` (radius), `amp` (angular width), `pwr` (width profile), `dm` (twist per ribbon) form a natural parameter object. Color is a one-off decision (fixed 10-hex list, random pick, fixed alpha 120); the commented-out palette arrays (124-129) are throwaway experiments. A clean API would expose `ribbons({res, radius, width, twist, detail, amplitude, palette, alpha})`.
