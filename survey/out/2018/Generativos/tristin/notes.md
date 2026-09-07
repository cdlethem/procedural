---
sketch: 2018/Generativos/tristin
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1494
animated: false
techniques: [3d-pointcloud, noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#92C8FA", "#0321A1", "#F94D21"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: count, default: 1800, tried: [900], change: moderate, effect: "half the shards; far more black visible, same style"}
  - {name: size, default: 80, tried: [200], change: large, effect: "much larger shards covering the canvas; several big shapes"}
  - {name: det, default: "random(0.006,0.008)*0.5", tried: ["random(0.006,0.008)*2.0"], change: subtle, effect: "no visible change in density/scale; only shard arrangement and bending differ"}
  - {name: deformAmp, default: 8, tried: [40], change: moderate, effect: "shards more stretched and twisted, more thin slivers"}
  - {name: palette, default: ["#92C8FA", "#0321A1", "#F94D21"], tried: [["#EFFF43", "#0321A1", "#F94D21"]], change: subtle, effect: "pale-blue shards become yellow/olive; deep blue and orange unchanged"}
reusable_candidates:
  - {name: noiseDeform3D, signature: "noiseDeform3D(x, y, z, offset, detail, amp) -> PVector", note: "3D simplex-noise displacement; note original samples z-free 2D noise and repeats it for both angles, so displacement is planar"}
  - {name: paletteLerp, signature: "paletteLerp(colors, t) -> color", note: "lerp between adjacent palette entries for t in [0, len)"}
---

## What it draws
Black canvas densely covered with thousands of small, semi-transparent flat triangles (a few large ones)
scattered everywhere at random sizes. Dominant colours: pale blue, deep blue, and burnt orange-red,
overlapping so that blended patches of mauve and grey-brown appear. No structure is legible — a
chaotic full-bleed confetti of 3D shards.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (tristin.pde:5-14).
`generate()` (lines 26-50): clears to black, `randomSeed(seed)`, translates to the centre and applies
three random rotations in 3D (lines 32-35), which tumbles the whole point cloud. It picks a noise
offset `des = random(1000)` and a noise scale `det = random(0.006, 0.008)*0.5` (lines 37-38).
`[-width, width]^3` (lines 45-47), and four vertices each independently jittered by
`random(-size, size)` with `size = 80` (line 48) — so each shape is a small irregular quad whose
corners can be up to 160 units apart.
`p()` (lines 52-68) draws the quad with `beginShape/vertex/endShape`; each vertex is pushed through
`deform()` and gets its own `fill(getColor(), random(255))` — a colour lerped between two adjacent
entries of the 3-colour palette (`{#92C8FA, #0321A1, #F94D21}`, line 84) with fully random alpha.
`deform()` (lines 71-76) displaces a vertex by a noise-driven offset: 3D simplex noise is sampled at
`(des + x*det, des + y*det)` — z is never sampled, and the same call is repeated for both angles
(a1 == a2), so the displacement vector `(cos²a, cos a sin a, sin a) * noise*8` lives in a 2D plane:
the "3D" cloud is actually a set of flattened, warped sheets. Randomness enters via the seed (harness
sets `seed`), the anchor positions, the per-vertex jitter, the per-vertex alpha, and the random
palette pick; the noise field provides the large-scale bending.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_900 | `for (int i = 0; i < 1800; i++) {` -> `... i < 900 ...` | moderate | same shard look at half the density; large patches of black between shards | variants/count_900/frame_00001.png |
| size_200 | `float size = 80;` -> `float size = 200;` | large | shards much bigger; several giant translucent shapes dominate the canvas, coverage far higher | variants/size_200/frame_00001.png |
| det_high | `det = random(0.006, 0.008)*0.5;` -> `*2.0;` | subtle | no visible change in density or scale; only the arrangement/bending of the shards differs | variants/det_high/frame_00001.png |
| deform_40 | `SimplexNoise.noise(des+x*det, des+y*det)*8;` -> `*40;` | moderate | shards more stretched and twisted, with more thin slivers and spiky fragments | variants/deform_40/frame_00001.png |
| palette_yellow | `int colors[] = {#92C8FA, #0321A1, #F94D21};` -> `... #EFFF43 ...` | subtle | pale-blue shards become yellow/olive; deep blue and orange unchanged | variants/palette_yellow/frame_00001.png |

## Modularisation notes
- Generic: `noiseDeform3D` (noise-displacement of a point), `paletteLerp` (adjacent-entry lerp with
  random alpha), the "N random quads in a 3D box, each vertex independently jittered" loop — a
  parameter object would be `{count, box, jitter, noiseOffset, noiseDetail, noiseAmp, palette,
  alphaRange, rotations}`.
- One-off art decisions: the flat black background, the specific blue/orange palette, and the
  z-free / repeated-angle sampling in `deform()` (looks like a leftover that accidentally makes the
  cloud look like scattered paper shards rather than a volumetric cloud).
