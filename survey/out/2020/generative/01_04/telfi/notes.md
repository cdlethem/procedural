---
sketch: 2020/generative/01_04/telfi
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1877
animated: false
techniques: [noise-field, distortion, grid]
primitives: [shape]
palette:
  colors: ["#000000", "#FFFFFF", "#F4EFA1", "#E8E165", "#DC4827", "#5779A2", "#031A01"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(60,140))*2", tried: [300], change: large, effect: "finer checker cells: small dense warped mesh instead of broad bands"}
  - {name: kkk, default: 0.001, tried: [0.0003], change: large, effect: "stronger, wider swirl: whole grid bends into huge folds around a central vortex"}
  - {name: coarseAmp (120*2), default: 240, tried: [600], change: large, effect: "bigger displacements: grid tears and rips, more chaotic voids"}
  - {name: noiseDetail, default: 4, tried: [8], change: large, effect: "stronger fine ripples: band edges frayed and noisier, same large folds"}
  - {name: step (j+=), default: 0.5, tried: [1.0], change: moderate, effect: "coarser strip sampling: band edges visibly more jagged/combed, overall look similar"}
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, coarseAmp, fineAmp, coarseScale, fineScale, zSeed) -> PVector", note: "two-octave simplex-noise XY displacement (240px + 60px) with a rotation component"}
  - {name: warpedChecker, signature: "warpedChecker(sub, cell, displace, invertPass) -> void", note: "two QUAD_STRIP checker passes, second with INVERT blend"}
---

## What it draws
A full-bleed black-and-white checkerboard that has been folded and smeared by a large-scale
noise field: the checker cells bow into long curved bands, swirl around the center, and
break up into moiré-like ripples and dense dark clusters. The texture reads as a warped
checkered fabric; the black and white stay pure with no greying except anti-aliasing at
cell edges.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (telfi.pde:21-32).
Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` (telfi.pde:46-47); `noiseDetail(4)`
sets 4 octaves (telfi.pde:49).

- Checker resolution: `sub = int(random(60, 140))*2` columns (telfi.pde:58); cell size
  `ss = width*2/sub` (telfi.pde:59).
- Pass 1 (telfi.pde:66-79): for each of `sub+40` columns, a `QUAD_STRIP` of vertices stepped
  in 0.5px down the canvas; fill alternates `((i+200)%2)*255` per column, giving vertical
  black/white bars. Every vertex is displaced by `def()` (telfi.pde:103-120).
- Pass 2 (telfi.pde:81-94): identical but rotated 90° (rows instead of columns) and drawn
  under `blendMode(INVERT)` (telfi.pde:80), so the two bar grids combine into a checkerboard.
- `def()` (telfi.pde:103-120): rotates (x, z) around Y by an angle from 2-D simplex noise
  (`kkk = 0.001` sample scale, amplitude 0.2), then adds a coarse noise displacement of
  amplitude `120*2` px (scale `detDes`, random < 0.001) and a fine one of amplitude `30*2` px
  (scale `detDes2`). The very small scales mean the coarse term acts almost like a smooth,
  slowly varying warp — the source of the large folds and swirls; the fine term roughens the
  edges into ripples.
- The `colors[]` palette and `rcol()`/`getColor()` (telfi.pde:129-145) are defined but never
  called; all fills are pure black or white. The `toxi`/`triangulate` imports are unused.
- `translate(width/2, height/2, 200)` (telfi.pde:63) centers the warp so the rotation
  happens around the canvas middle.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_300 | `int sub = int(random(60, 140))*2;` -> `int sub = 300;` | large | much finer cells: small dense warped checker mesh, distortion still visible but cells tiny | variants/sub_300/frame_00001.png |
| kkk_0.0003 | `float kkk = 0.001;` -> `float kkk = 0.0003;` | large | stronger wider swirl: grid bends into huge smooth folds and a central vortex, cells stretched into long curved bands | variants/kkk_0.0003/frame_00001.png |
| coarseAmp_300 | `*120*2;` -> `*300*2;` (both 777/333 noise lines) | large | bigger displacement: grid tears and rips more violently, larger voids, more chaotic folds | variants/coarseAmp_300/frame_00001.png |
| noiseDetail_8 | `noiseDetail(4);` -> `noiseDetail(8);` | large | stronger fine ripples: band edges frayed and noisier, same large-scale folds as baseline | variants/noiseDetail_8/frame_00001.png |
| step_1.0 | `j+=0.5` -> `j+=1.0` (both strip loops) | moderate | coarser strip sampling: band edges visibly more jagged/combed, overall structure unchanged | variants/step_1.0/frame_00001.png |

## Modularisation notes
- Generic: `def()`-style two-octave noise displacement (coarse + fine amplitude, independent
  z-slice seeds) — a reusable `noiseDisplace` with a rotation term; the `QUAD_STRIP`
  bar-grid + INVERT second pass is a generic "warped checkerboard" compositor.
- One-off art decisions: the exact amplitudes (240/60 px), the 0.5px vertex step, the
  `*2` on the random sub range, the `200` margin padding on the strip loops, the INVERT
  blend choice (could be XOR or plain overlay).
- Clean parameter object: `{sub, cellStep, coarseAmp, fineAmp, coarseScale, fineScale,
  rotationAmp, zOffset, invertPass: bool}`.
