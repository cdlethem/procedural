---
sketch: 2018/Generativos/gotas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1799
animated: false
techniques: [packing, polar, dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#53edb7", "#4d00b2", "#ffae44", "#fff0e5", "#ff324e"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: blobCount, default: 100, tried: [250], change: large, effect: "denser packing, canvas fully covered, black background almost gone"}
  - {name: blobMaxFrac, default: 0.4, tried: [0.2], change: large, effect: "max diameter halved, scattered look with black gaps between blobs"}
  - {name: haloAlpha, default: 80, tried: [160], change: moderate, effect: "halos more opaque, blobs less see-through, softer glow reduced"}
  - {name: rosetteCount, default: "random(50)", tried: ["random(10)"], change: none, effect: "no visible change; with seed 42 the rosette phase draws nothing"}
  - {name: petalMax, default: "random(0,50)", tried: ["random(0,5)"], change: none, effect: "no visible change; rosette phase inactive for seed 42"}
  - {name: rosetteRings, default: "random(1,3)", tried: ["random(3,8)"], change: none, effect: "no visible change; rosette phase inactive for seed 42"}
reusable_candidates:
  - {name: haloRing, signature: "haloRing(x, y, r1, r2, col, a1, a2) -> void", note: "radial glow: quad slices between two radii, alpha ramped a1->a2 (arc2)"}
  - {name: rosette, signature: "rosette(x, y, s, petals, amp, rings) -> void", note: "ring of dot clusters whose radius follows cos(ang*petals) (circulo)"}
---

## What it draws
Full-bleed dense field of overlapping translucent circles on black, in five bright
colours: deep violet, orange-amber, red-crimson, mint green and cream-white. Each
circle carries a soft blurred halo that fades out past its edge, and most circles
have a thin black outline. Sizes range from huge (up to 40% of the width) down to
pinpoint dots, which are near-zero-size circles from the same loop. The composition
reads as a flat, sticker-like packing of blobs, denser and darker at the edges.
(For seed 42 the second, rosette-based phase of the code draws nothing — see How
the code works.)

## How the code works
`setup()` (L2-7) sizes 960x960 P2D and calls `generate()` once; `draw()` is empty
so the sketch is static. `generate()` (L21-46) sets `background(0)`, reseeds with
`seed`, then:

1. **Large blobs** (L26-35): 100 iterations — random position, diameter
   `width*random(0.4)` (0-40% of width), black stroke, fill from the 5-colour
   palette via `rcol()` (L97-99, uniform random pick), `ellipse()`, then a halo via
   `arc2(x, y, s, s*1.8, 0, TAU, rcol(), 80, 0)`. `arc2` (L72-90) approximates a
   radial gradient: it splits the full circle into `cc` angular slices (count from
   circumference) and fills each quad with the colour at alpha 80 on the inner
   radius and alpha 0 on the outer (1.8x) radius — that produces the soft blurred
   edge of every blob. Alpha compositing (no blend modes) makes overlaps glow.
2. **Rosette rings** (L37-45): `sub` = 1-2 concentric rings, `div` = 0-49 rosettes
   evenly spaced by angle around the canvas centre at radius 0.1-0.8 of width; each
   rosette `circulo()` (L48-70) has 0-29 angular steps, 0-9 radial sub-rings, and a
   radius `dis = map(i, 0, sub, 0.1, cos(ang*cs)*(0.2+amp))*s` so the dot ring
   undulates into a petal shape with `cs` = 0-49 lobes. Each dot is a small ellipse
   (diameter ~`random(4)`) plus an `ss*random(60)`-scaled halo via `arc2` with the
   same 80->0 alpha ramp. For seed 42 this phase is empty: `div = int(random(50))`
   evaluates to 0, so the loop never runs — confirmed by three variants
   (rosetteCount, petalMax, rosetteRings) that only change values consumed inside
   it and produced pixel-identical output. The small dots visible in the baseline
   image are therefore near-zero-size circles from the first loop, not rosette dots.

All randomness is `random()` after `randomSeed(seed)` (L24), so renders are
deterministic for a fixed seed. `getColor()` (L100-109) is defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| blobCount_250 | `  for (int i = 0; i < 100; i++) {` -> `... i < 250 ...` | large (0.908 of pixels) | far denser: blobs cover the whole canvas, black background almost invisible, halos merge into one soft field | variants/blobCount_250/frame_00001.png |
| blobMax_0.2 | `    float s = width*random(0.4);` -> `width*random(0.2);` | large (0.775 of pixels) | all blobs at most half as big: scattered arrangement, black background clearly visible between circles, more pinpoint dots | variants/blobMax_0.2/frame_00001.png |
| haloAlpha_160 | `    arc2(x, y, s, s*1.8, 0, TAU, rcol(), 80, 0);` -> `... rcol(), 160, 0);` | moderate (0.241 of pixels) | halos twice as opaque: blobs look more solid and less see-through, the soft outer glow is reduced | variants/haloAlpha_160/frame_00001.png |
| rosetteCount_10 | `  int div = int(random(50));` -> `int(random(10));` | none (0.0) | no visible change — rosette phase draws nothing for seed 42 | variants/rosetteCount_10/frame_00001.png |
| petalMax_5 | `  int cs = int(random(0, 50));` -> `int(random(0, 5));` | none (0.0) | no visible change — rosette phase draws nothing for seed 42 | variants/petalMax_5/frame_00001.png |
| rosetteRings_7 | `  int sub = int(random(1, 3));` -> `int(random(3, 8));` | none (0.0) | no visible change — rosette phase draws nothing for seed 42 | variants/rosetteRings_7/frame_00001.png |

## Modularisation notes
- `arc2` is a generic "soft radial glow ring" (two radii, alpha ramp, slice
  count auto-scaled from circumference) — directly reusable as a halo/glow
  primitive for any blob-based sketch.
- `rcol()` + the `colors[]` array is a trivial random-from-list palette selector;
  `getColor()` (value-driven lerp between neighbouring palette entries) is an
  unused alternative worth keeping.
- `circulo` is a parametric rosette: petal count, amplitude, radial ring count and
  scale are the only knobs — a good "stippled rosette" function.
- The two-phase generate (large blobs + central rosette rings) is the one-off art
  decision; a clean parameter object would be: `{blobCount, blobMaxFrac, haloAlpha,
  haloScale, rosetteRings, rosetteCount, rosetteMaxFrac, petalMax, petalAmp,
  palette, seed}`.
