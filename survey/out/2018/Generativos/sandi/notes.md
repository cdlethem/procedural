---
sketch: 2018/Generativos/sandi
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 3623
animated: false
techniques: [noise-field, 3d-pointcloud, blend-modes]
primitives: [point]
palette:
  colors: ["#92C8FA", "#0321A1", "#EFFF43", "#F94D21"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: maskThreshold, default: 0.01, tried: [0.05], change: subtle, effect: "raise 0.01->0.05: no visible change (only 0.3% of pixels differ; cloud already dense under ADD)"}
  - {name: det, default: "random(0.006,0.008)*0.5", tried: [0.002], change: moderate, effect: "lower geometry detail: larger, smoother, more diffuse colour blobs"}
  - {name: size, default: 540, tried: [300], change: large, effect: "smaller sampling cube: much darker, more muted cloud with bigger black gaps"}
  - {name: pointAlpha, default: 80, tried: [200], change: large, effect: "higher alpha: much brighter, washed-out additive glow, colours blow out to white"}
  - {name: count, default: 10000000, tried: [2000000], change: large, effect: "fewer points: sparser, grainier cloud, more black gaps"}
reusable_candidates:
  - {name: noise3, signature: "noise3(x, y, z, offset, detail) -> float", note: "offset+detail 3-D simplex noise sample (toxi SimplexNoise)"}
  - {name: pointCloudVolume, signature: "pointCloudVolume(halfSize, count, maskThreshold, colorFn, alpha)", note: "scatter N random points in a cube, draw only where a noise mask is below threshold"}
  - {name: lerpPalette, signature: "lerpPalette(int[] colors, float v) -> int", note: "lerp between N palette colors by a value in [0,1)"}
---

## What it draws
A full-bleed, grainy, mottled cloud of soft glowing blobs on black (seed 42). Dominant colours are blues
(light sky-blue and deep blue), broken by patches of orange, yellow-green and near-black. It reads like a
nebula or diffused watercolor: soft, noisy, no hard edges, with dark gaps where no points were drawn.
(Only `frame_00001` is the true render; `frame_00010`/`frame_00060` are a headless P3D framebuffer
artifact — white background with sparse black speckles — not animation, since `draw()` is empty.)

## How the code works
Static one-shot: `setup()` (lines 10-15) calls `generate()` once; `draw()` is empty (line 18), so it
re-renders only on keypress (lines 21-27). All drawing happens in `generate()` (lines 29-56):

- `background(0)` (30) black base; `randomSeed(seed)` (31); `blendMode(ADD)` (33) additive blending —
  overlapping semi-transparent points accumulate into bright glow.
- `translate(width*0.5, height*0.5)` (35) + random `rotateX/Y/Z(random(TAU))` (36-38): the whole 3-D
  sampling volume is viewed from a random orientation.
- Two independent noise fields: geometry `des=random(1000)`, `det=random(0.006,0.008)*0.5` (40-41);
  colour `desc=random(1000)`, `detc=random(0.006,0.008)*0.3` (42-43).
- `size = 540` (45) half-size of the sampling cube; `stroke(255,120)` (46) is a default overridden per point.
- Loop of 10,000,000 uniform random points `x,y,z in [-540,540]` (47-50).
- MASK (51): draw only where `SimplexNoise.noise(des+x*det, des+y*det, des+z*det) < 0.01` — i.e. only in
  the thin low-noise iso-contours of a 3-D noise field. This is what shapes the mottled cloud/blobs rather
  than a uniform cube.
- COLOR (52): `stroke(getColor(SimplexNoise.noise(desc+x*detc, desc+y*detc, desc+z*detc)), 80)` — a second,
  coarser noise field picks a colour by lerping the 4-colour palette (`getColor(float)`, 80-87), alpha 80.
- `point(x,y,z)` (53).
- Palette (72): `#92C8FA` light blue, `#0321A1` deep blue, `#EFFF43` yellow-green, `#F94D21` orange-red.
- The soft grainy look = 10M tiny alpha-80 points + ADD blend + `smooth(8)`: dense overlapping dots build
  soft glowing regions; the mask leaves near-black gaps.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| threshold_0.05 | `< 0.01` -> `< 0.05` (noise mask) | subtle | no visible change; cloud already dense/saturated under ADD | variants/threshold_0.05/frame_00001.png |
| det_0.002 | `float det = random(0.006, 0.008)*0.5;` -> `float det = 0.002;` | moderate | larger, smoother, more diffuse colour blobs; bigger soft patches | variants/det_0.002/frame_00001.png |
| size_300 | `float size = 540;` -> `float size = 300;` | large | much darker, more muted; deep blue/brown, larger black gaps | variants/size_300/frame_00001.png |
| alpha_200 | `...desc+z*detc)), 80);` -> `...200);` (point alpha) | large | much brighter, washed-out; pale/white regions, colours blow out | variants/alpha_200/frame_00001.png |
| iters_2000000 | `for (int i = 0; i < 10000000; i++)` -> `...i < 2000000; i++)` | large | sparser, grainier; thinner cloud, more grain and black gaps | variants/iters_2000000/frame_00001.png |

## Modularisation notes
- Generic (library-ready): `noise3` (3-D simplex sample), `lerpPalette` (lerp a palette by a float), and
  `pointCloudVolume` (scatter N points in a cube, keep those below a noise mask threshold, colour by a
  second noise field, additive blend).
- One-off art decisions: the specific palette (72), the mask threshold `0.01`, the `*0.5`/`*0.3` detail
  scale factors, alpha 80, `size = 540`, the 10M count, and the random 3-D reorientation.
- Clean parameter object: `{count, halfSize, maskThreshold, geomDetail, geomOffset, colorDetail,
  colorOffset, palette, pointAlpha, blend, rotation{ x, y, z }}`.
