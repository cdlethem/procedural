---
sketch: 2020/generative/01_04/gradd
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 4703
animated: false
techniques: [noise-field, polar, spiral, lines-hatching, distortion, curves]
primitives: [shape]
palette:
  colors: ["#FE829C", "#000000", "#BB6633", "#3B382B", "#DF9BFB"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "random(4000,8000)*0.8*amp", tried: ["random(1000,2000)*0.8*amp"], change: large, effect: "fewer segments: ribbons coarser and sparser, long threads read as distinct curves"}
  - {name: alp, default: 24, tried: [8], change: large, effect: "one-third alpha: pale pastel tangle, dark knot fades to mauve"}
  - {name: strokeWeight, default: 1.2, tried: [3.0], change: large, effect: "2.5x weight: white ground mostly covered by bold hatching"}
  - {name: colors, default: "FE829C,000000,BB6633,3B382B,DF9BFB", tried: ["072457,EFA300,CED1E2,D66953,28422E"], change: moderate, effect: "same geometry in navy, mustard, pale blue-grey, coral, dark green"}
  - {name: det, default: 0.002, tried: [0.008], change: moderate, effect: "4x noise scale re-orients arcs; bold black hatch fans appear (top right)"}
  - {name: layers, default: 3, tried: [6], change: moderate, effect: "2x layers: same composition, denser; centre knot and violet mass intensify"}
reusable_candidates:
  - {name: arcSpiral, signature: "arcSpiral(cx, cy, turns, sub, r1, r2, pwrR, s1, s2, pwrS, c1, c2, det) -> void", note: "dense spiral of noise-oriented open arcs; alpha/weight peak mid-ribbon"}
  - {name: noiseArc, signature: "noiseArc(x, y, r, det, k) -> [a1, a2]", note: "two noise samples on a circle, mod HALF_PI, give an oriented arc span"}
---

## What it draws
A full-bleed tangle of hair-fine thread-like curves on an off-white ground. The
lines run in long sweeping bundles across the canvas in dusty pink, mauve,
violet and rust brown; where bundles overlap they build up into denser
cross-hatched clumps, including a dark near-black knot centre-left, a violet
mass on the right edge, and a few scattered black fan-shaped hatch patches.
The overall impression is of a loose, scribbled web rather than discrete shapes.

## How the code works
`setup()` calls `generate()` once (gradd.pde:23-24); `draw()` is empty, so the
image is static (gradd.pde:34-36).

- `generate()` seeds RNG/noise (48-49), fills with `background(254)` (51), and
  sets a 3-D `perspective()` camera with a random FOV (55-58); the geometry
  itself never uses z, so it renders as 2-D.
- Outer loop `kk` runs 3 times (60); each pass pushes the matrix and
  translates to a random offset of up to half the canvas (62), so three
  independent "centres" scatter the ribbons across the frame.
- Inner loop `k` runs 30 ribbons per centre (65). Per ribbon: two colours `c1,c2`
  drawn randomly from a 5-colour palette (70-71, 164, 168-170); `amp`
  (73) sets the total angular sweep to `amp*TAU` (74); `sub` (75) is the
  segment count (~3200-22000, scales with amp); radii `r1..r2` (77-78) and
  arc sizes `s1..s2` (81-82) are random fractions of `width`.
- Per segment `i` (89-126): `v = i/sub`; radius `r = pow(lerp(r1,r2,v), pwrR)`
  (92) and sweep angle `a = da*i` (85,93) place the point on a power-law
  spiral; arc size `s = pow(lerp(s1,s2,v), pwrS)` (94); colour lerps c1->c2
  (95); alpha `24*sin(PI*v)` (96) and weight `1.2*pow(sin(PI*v),1.2)` (98)
  fade in and out so ribbon ends are invisible; the small arc's orientation is
  two noise samples on a circle of radius `r`, modded to `HALF_PI` and sorted
  (102-111), so the noise field steers which way each arc opens; an `osc`
  term (113) modulates the radius and a small jitter (117-118) roughens the
  path; `arc2()` (133-150) strokes an open arc of `res` vertices with the
  lerp'd alpha.
- Randomness enters only through `randomSeed(seed)`: the three offsets, the
  per-ribbon amp/sub/radii/sizes and the two colour picks. With a fixed seed
  the output is identical (baseline frames 10/60 dropped as identical).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_1000 | `float sub = int(random(4000, 8000)*0.8*amp);` -> `...random(1000, 2000)...` | large | coarser, sparser ribbons; the long sweeps read as clear individual threads, central knot breaks into loose loops | variants/sub_1000/frame_00001.png |
| alp_8 | `float alp = 24*sin(PI*v);` -> `8*sin(PI*v)` | large | same tangle but pale pastel; near-black knot fades to soft mauve, right-edge violet stays the strongest colour | variants/alp_8/frame_00001.png |
| weight_3 | `strokeWeight(1.2*pow(sin(PI*v), 1.2));` -> `3.0*pow(...)` | large | bold dense hatching; most of the white ground is covered, pink/brown/brown-bands dominate | variants/weight_3/frame_00001.png |
| palette_alt | `int colors[] = {#FE829C, #000000, #BB6633, #3B382B, #DF9BFB};` -> `{#072457, #EFA300, #CED1E2, #D66953, #28422E};` | moderate | identical geometry; colours become navy, mustard, pale blue-grey, coral, dark green | variants/palette_alt/frame_00001.png |
| det_0.008 | `float det = 0.002*v;` -> `0.008*v` | moderate | arc orientations re-randomised; a bold black hatch fan appears top right, otherwise similar tangle | variants/det_0.008/frame_00001.png |
| layers_6 | `for (int kk = 0; kk < 3; kk++)` -> `kk < 6` | moderate | same three-centre composition but denser; central knot and right violet mass intensify, coverage grows | variants/layers_6/frame_00001.png |

## Modularisation notes
Generic and reusable: the ribbon generator (spiral of noise-oriented open
arcs with sinusoidal alpha/weight envelope) is a clean `arcSpiral(cx, cy,
turns, sub, r1, r2, pwrR, s1, s2, pwrS, c1, c2, det)`; `noiseArc` (the two
modded noise samples that choose an arc span) is a small standalone helper.
Art-specific decisions: the 3 random-centre layering, the particular palette
and its commented-out alternates, the `cos(x*2.01)*2` jitter, the exact
`amp`/`sub` ranges, and the 24-alpha / 1.2-weight envelope constants. A
parameter object would hold: layers, curvesPerLayer, amp range, sub range,
r1/r2/pwrR, s1/s2/pwrS, alphaMax, weight, det (noise scale), oscAmp range,
palette, and the global seed.
