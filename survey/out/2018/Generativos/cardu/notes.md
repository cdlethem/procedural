---
sketch: 2018/Generativos/cardu
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1725
animated: false
techniques: [noise-field, 3d-pointcloud]
primitives: [ellipse]
palette:
  colors: ["#E6E7E9", "#F0CA4B", "#F07148", "#EECCCB", "#2474AF", "#107F40", "#231F20"]
  selection: noise-driven
composition: scattered
parameters:
  - {name: count, default: 200000, tried: [50000], change: large, effect: "field thins to a sparse band; individual dots/slivers and the cube's near edge become distinct"}
  - {name: sizeMul, default: 5, tried: [15], change: large, effect: "3x bigger dots stop blending into texture; canvas becomes confetti of separate coloured ellipses, near-black background mostly covered"}
  - {name: alpha, default: 180, tried: [60], change: large, effect: "field much dimmer; colour zones persist but the whole image is darker and the black background shows through"}
  - {name: noisedetail, default: 0.001, tried: [0.02], change: large, effect: "coarser noise: wider, smoother colour regions (large gold/white/teal zones) and clumped, larger dots instead of fine even speckle"}
  - {name: zrange, default: 480, tried: [40], change: large, effect: "points compressed into a thin slab; the cube reads as a dense flat sheet/band with soft edges, texture more uniform"}
reusable_candidates:
  - {name: noisePointField, signature: "noisePointField(count, range, detail, des, sizeFn, colorFn) -> points", note: "random 3-D points with per-point noise-driven size, rotation, colour"}
---

## What it draws
A full-bleed field of ~200 000 tiny dots (ellipses up to ~5 px) scattered in a 3-D cube and
projected onto a near-black canvas. Dots read as a dense speckled texture: green/teal and blue
clusters on the left, gold and orange bands through the centre, pale grey/white at lower left,
fading to near-black at the right and top edges where dots are sparse and dim. Because the dots
are rotated in 3-D, many appear as thin slivers rather than round spots.

## How the code works
`setup()` calls `generate()` once (cardu.pde:10); `draw()` is empty, so the piece is static.

- Seeds `randomSeed`/`noiseSeed` from `seed` (lines 30-31), paints background `#010101` (line 32),
  translates to centre (line 34) and applies three random whole-view rotations
  `rotateX/Y/Z(random(TAU))` (lines 36-38) — the cube orientation differs per seed.
- Builds five `Noise` instances (lines 40-44) wrapping toxi `SimplexNoise.noise`, each with a
  random detail in (0, 0.001) and random offset in (0, 1000); `Noise.get(x,y,z)` (Noise.pde:10-12)
  maps world position through that detail/offset to a 0-1 value.
- Main loop (lines 47-60): 200 000 iterations; each point is placed at a uniform random position
  in the cube [-480, 480]³ (lines 48-50). Size `s = nsize.get(x,y,z)*5` (line 51) is noise-driven,
  0-5 px. The point is pushed, translated to (x,y,z), rotated three times with noise angles
  `*TAU` (lines 54-56, all `rotateX`), filled with `getColor(ncol.get(x,y,z))` at alpha 180
  (line 57), drawn as `ellipse(0,0,s,s)` (line 58).
- Colour: `getColor(float v)` (lines 77-83) wraps `v` into 0-1, picks two adjacent entries of the
  7-colour palette `colors[]` (line 70: off-white, gold, orange, pale pink, blue, green, near-black)
  and lerps between them — so colour is noise-driven, producing smooth regional colour zones.
- `blendMode(ADD)` (line 28) makes overlapping dots accumulate brightness; the 3-D rotations plus
  perspective (P3D) turn round dots into slivers and thin out the far side of the cube, which is
  what produces the dark sparse regions.
- `rcol()` (lines 71-73) is dead code (unused); `keyPressed` regenerates with a new seed on any
  key, and `s` saves a frame.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_50000 | `for (int i = 0; i < 200000; i++)` -> `for (int i = 0; i < 50000; i++)` | large (0.196, 57%) | field thins to a diagonal band from lower-left to upper-right; individual dots and slivers are distinct, bright white/blue near edge at lower left, gold/orange mid-band, sparse dark edge at right; most of the canvas is now black background | variants/count_50000/frame_00001.png |
| size_15 | `float s = nsize.get(x, y, z)*5;` -> `float s = nsize.get(x, y, z)*15;` | large (0.541, 96%) | dots 3x larger and no longer blending: canvas is confetti of separate coloured ellipses (orange, gold, green, white, blue) with visible black gaps; the central dark diagonal channel remains | variants/size_15/frame_00001.png |
| alpha_60 | `fill(getColor(ncol.get(x, y, z)), 180);` -> `fill(getColor(ncol.get(x, y, z)), 60);` | large (0.182, 64%) | same structure but much darker overall; colour zones (green/blue left, orange centre, gold right) are muted and the right half is near-black with faint dim slivers | variants/alpha_60/frame_00001.png |
| noisedetail_0.02 | `new Noise(random(0.001), random(1000));` -> `new Noise(random(0.02), random(1000));` (all 5 instances) | large (0.207, 64%) | coarser noise: broad smooth colour regions (large gold field centre, white lower-left, teal upper-left) and clumped, chunkier dots instead of fine even speckle | variants/noisedetail_0.02/frame_00001.png |
| zrange_40 | `float z = random(-480, 480);` -> `float z = random(-40, 40);` | large (0.297, 75%) | points compressed into a thin slab: the cube reads as a dense flat sheet/band with soft edges; colour zones persist (green upper-left, blue mid, orange mid-right) but the volume looks planar and denser | variants/zrange_40/frame_00001.png |

## Modularisation notes
- Generic: the `Noise` wrapper (Noise.pde) — 3-D simplex noise with detail/des; reusable as-is.
  The point-cloud loop is a clean candidate: `count`, cube `range`, size multiplier, alpha,
  palette, colour mode (noise-driven lerp vs random-from-list), and blend mode are all
  parameterisable; the per-point rotation trio is the distinctive flourish.
- Art decisions: the fixed 7-colour palette, the whole-view random rotations, the ADD blend with
  alpha 180, and the `*5` size cap. The triple `rotateX` (instead of X/Y/Z) looks like a quirk
  worth keeping as a "spin" parameter rather than "fixing".
- Suggested parameter object: `{count, range, sizeMul, alpha, detail, palette, blend, spin}`.
