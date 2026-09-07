---
sketch: 2018/Generativos/plasma003
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2021
animated: true
techniques: [particles, packing, polar, symmetry, noise-field, blend-modes, 3d-pointcloud, curves]
primitives: [point]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: pointCount, default: 100, tried: [400], change: moderate, effect: "more circles packed; denser field with extra smaller circles between the large ones"}
  - {name: sphereSize, default: "0.1-0.25", tried: ["0.04-0.12"], change: large, effect: "many more, much smaller circles; denser and brighter (more additive overlap)"}
  - {name: sphereFillPoints, default: 500, tried: [150], change: moderate, effect: "thinner noise fill; spheres read more as wireframe/hollow, less solid colour"}
  - {name: rosetteFolds, default: "3-55", tried: ["3-6"], change: none, effect: "no visible change at this scale"}
  - {name: fillAlpha, default: 110, tried: [50], change: subtle, effect: "interiors slightly fainter/thinner; marginally darker overall"}
reusable_candidates:
  - {name: packCircles, signature: "packCircles(n, minR, maxR) -> PVector[]", note: "rejection-sampled non-overlapping circle centres with per-circle radius"}
  - {name: pointSphere, signature: "pointSphere(cx, cy, r, count, detail, palette) -> void", note: "additive 3-D point cloud on a sphere, colour from 3-D noise sampled in the ball"}
  - {name: rosette, signature: "rosette(cx, cy, r, folds, count, amp) -> void", note: "spirograph/rose curve with n-fold symmetry from a slowly-walking angle"}
---

## What it draws
A full-bleed field of about ten large, overlapping circles packed edge-to-edge on a black
background. Each circle is a dense additive point cloud in the warm/cool palette (reds/oranges
and blues on black): a noise-mottled interior, a thin crisp rim, a faint 3-D wireframe-sphere
lattice, a small inner ring, and a rosette/spirograph curve with some fold symmetry overlaid.
This is the frame-1 image, and it is the baseline the diff score compares against. (The sketch
is static — `draw()` is empty — but the P2D first frame is captured before the additive point
sum is fully resolved: frames 10 and 60, identical to each other, are the same composition
rendered as much brighter, near-white stippled disks.)

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so nothing is meant to change over time.
The three captured frames are not identical, but this is a P2D first-frame resolution artifact,
not animation: frame 1 is the darker, more structured (under-resolved) capture, while frames 10
and 60 (pixel-identical to each other) are the same composition fully resolved into brighter,
near-white additive disks.

`generate()` (plasma003.pde):
- L23-26: re-seed `random` and `noise`, clear to black `background(0)`.
- L27-43: placement by rejection sampling. Up to 100 attempts; each candidate gets a centre
  `(x,y)` and radius `s = width*random(0.1,0.25)` (96–240 px). It is kept only if it does not
  overlap an already-kept circle (`dist < (s+p.z)*0.5` rejects). Result: a packed, non-overlapping
  set of large circles, each stored as `PVector(x, y, s)`.
- L45: `blendMode(ADD)` — everything composites additively over black; this is what pushes dense
  point clusters toward white (the bright frames 10/60) and why lowering fill alpha or point
  counts darkens the interior.
- L46-111: for each kept circle, five point-drawing passes (all use `point()` only):
  - L56-70 (500×100 = 50 000 pts): a random walk in two angles `(a1,a2)` traces a sphere of
    radius `p.z`; colour per point is `getColor(noise(…))` (noise-driven lerp across the 5
    palette colours, L126-132) and stroke alpha pulses with `cos(alp)`. This is the noise-mottled
    interior fill.
  - L73-76 (1 000 pts): a flat ring at radius `p.z` → the crisp thin rim of each circle.
  - L80-88 (10 000 pts): a random walk drawing a 3-D wireframe sphere (x and z share a term, L87)
    → the faint spherical lattice.
  - L92-96 (1 000 pts): `a2` frozen, `a1` walks → a small fixed-latitude ring.
  - L100-110 (4 000 pts): `translate` to the centre, random `rotate`, then a curve whose angle
    `a = a1 - (a1%da)*0.05` with `da = TAU/cc` and `cc = int(random(3,55))` gives a
    rosette/spirograph with `cc`-fold symmetry, drawn as an ellipse scaled by random `amp`.
    This is the rosette overlay.
- Palette L118: `#FF3D20 #FC9D43 #3998C2 #3E56A8 #090D0E` (red, orange, blue, indigo,
  near-black). `rcol()` (L120) is random-from-list; `getColor(float)` (L126) is the noise-driven
  lerp used for the mottled fill.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_400 | `for (int i = 0; i < 100; i++)` -> `... i < 400 ...` | moderate (mean 0.053, 0.148) | denser field: more circles packed, extra smaller circles squeezed between the large ones; same blue/red wireframe-rosette look | variants/count_400/frame_00001.png |
| size_small | `width*random(0.1, 0.25)` -> `width*random(0.04, 0.12)` | large (mean 0.161, 0.492) | many more, much smaller circles; denser and brighter (more additive overlap), smaller rosettes | variants/size_small/frame_00001.png |
| points_150 | `for (int k = 0; k < 500; k++)` -> `... k < 150 ...` | moderate (mean 0.054, 0.157) | thinner noise fill: interiors read more as wireframe/hollow, less solid colour, lattice and rim more visible | variants/points_150/frame_00001.png |
| rosette_low | `int cc = int(random(3, 55))` -> `... random(3, 6)` | none (mean 0.001, 0.002) | no visible change at this scale (fewer, broader rosette petals not distinguishable) | variants/rosette_low/frame_00001.png |
| alpha_50 | `stroke(col, (cos(alp)*0.5+0.5)*110)` -> `... *50)` | subtle (mean 0.025, 0.042) | interiors slightly fainter/thinner; marginally darker overall, wireframes a touch more prominent | variants/alpha_50/frame_00001.png |

## Modularisation notes
- Generic / library-ready: the rejection-sampled circle packing (L27-43); the additive
  noise-coloured point sphere (L56-70); the n-fold rosette curve (L100-110). Each is
  parameterised cleanly and independent of the others.
- One-off art decisions: the fixed 5-colour warm/cool palette, the specific per-pass point
  counts (50 000 / 1 000 / 10 000 / 1 000 / 4 000) and alpha values (110/180/60/60), the
  `cos(alp)` alpha pulse, and the choice of ADD blending.
- A clean parameter object: `{ nAttempts, radiusRange:[min,max], pointCounts:[fill,rim,lattice,ring,rosette], alphas:[...], palette, noiseDetail, rosetteFolds:[min,max] }`.
- Note for the library: rosette-fold count in the 3-55 range has little visible effect at this
  scale (low vs high folds read similarly in a dense field), so it is a weak knob; fill point
  count and alpha are the stronger control of how "solid" vs "wireframe" each sphere looks.
