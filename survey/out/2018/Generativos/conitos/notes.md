---
sketch: 2018/Generativos/conitos
year: 2018
renderer: P3D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2437
animated: false
techniques: [noise-field, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FACC02", "#FB0603", "#0365BC", "#0D6305", "#000000", "#FFFFFF"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "random(20,200)", tried: [300], change: large, effect: "no density gain: noise gate still rejects most candidates; layout fully reshuffled (fixed literal shifts the random stream)"}
  - {name: det, default: "random(0.01)", tried: [0.003], change: large, effect: "coarser noise -> larger surviving regions; cones cluster into big blobs (top center, bottom)"}
  - {name: gate, default: 0.4, tried: [0.3], change: moderate, effect: "more candidates pass the threshold -> denser scatter of same-size cones"}
  - {name: size_scale, default: "width*1.2", tried: ["width*2.4"], change: large, effect: "2x cone radius/height -> huge overlapping cones, canvas crowded"}
  - {name: colors, default: "6-colour primary set", tried: ["grayscale"], change: large, effect: "same layout recoloured; background flips to light grey (random pick from new list)"}
reusable_candidates:
  - {name: noiseGate, signature: "noiseGate(pos, offset, detail, threshold, power) -> float", note: "3-D noise sampled at a point, gated below a threshold, remapped and power-curved; returns 0 if rejected, else 0-1 size factor"}
  - {name: noiseOrient, signature: "noiseOrient(pos, offsets, detail) -> (rx, ry, rz)", note: "three independent noise fields driving per-axis rotations"}
  - {name: flatCone, signature: "flatCone(radius, height, colorSide, colorBase, res?) -> void", note: "cone built as triangle side fan plus flat base cap, two colours, resolution auto from radius"}
---

## What it draws
A near-black field scattered with flat, billboard-like cones of wildly different sizes, all
rotated in 3D. Colours are a small saturated set: white, red, blue, yellow, green, with black
background; a few cones are cropped at the canvas edges. Most of the canvas is empty black —
the shapes are sparse, with a few large white cones dominating the upper half and small
red/green/blue fragments lower down. The cones read as solid triangles (side fan) plus a
circular base cap in a second colour (visible e.g. on the large red+yellow cone at the bottom).

## How the code works
`setup()` (L3-11) calls `generate()` once and exits; `draw()` is empty, so the piece is static
(L13-15). The `seed` field (L1) is seeded by the harness.

`generate()` (L26-65):
- A perspective camera is set up with a random fov in `PI/random(2.6,3.6)` (L31-34), then the
  origin is moved to the canvas centre (L35).
- Random noise offsets `des`, `des1-3` and details `det = random(0.01)`, `det2` (L39-44) are
  drawn once per run; `cc = int(random(20,200))` is the candidate cone count (L45).
- Main loop (L48-64): each candidate gets a random position in a 2x-canvas-wide box with
  `zz` in `[-2.4w, 0]` (L49-51). A single 3-D `noise()` sample at that point (L52) gates the
  cone: if `noi < 0.4` the candidate is skipped (L53), which is why the canvas is mostly empty.
  Survivors have their noise value remapped to 0-1 and power-curved by `pwr` (L54, L46-47),
  which biases sizes toward small cones.
- Orientation: three independent 3-D noise fields drive `rotateX/Y/Z` by up to `TAU*2` (L57-59),
  so every cone is tumbling at an arbitrary 3D angle.
- Size `ss = width*1.2*noi*random(0.8,1)` (L60) scales with the noise value, so cones cluster
  in size around the noise landscape.
- `cono(s,h)` (L67-95) builds the cone from `res = max(4, 2πr)` triangles: a side fan from the
  rim circle to the apex in colour `c1` (L76-84), and a flat base cap (rim to base centre) in
  a different colour `c2` (L86-94). `c1`/`c2` are random picks that must differ from each
  other and from the background (L72-75).

No blend modes, no lights (L36 commented out), no stroke.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_300 | `int cc = int(random(20, 200));` -> `int cc = 300;` | large (mean 0.2582, 0.461) | no density gain: the 0.4 noise gate still rejects most candidates, so the canvas stays just as sparse as baseline, only with a fully different layout (a few large white/yellow cones top, small red fragments bottom). Raising candidate count alone does not add visible cones. | variants/cc_300/frame_00001.png |
| det_0.003 | `float det = random(0.01);` -> `float det = 0.003;` | large (mean 0.1867, 0.354) | coarser placement noise: survivors cluster into big contiguous blobs (white+blue cluster top center, red/yellow/white mass bottom) instead of the baseline's isolated shapes. | variants/det_0.003/frame_00001.png |
| gate_0.3 | `if (noi < 0.4) continue;` -> `if (noi < 0.3) continue;` | moderate (mean 0.1087, 0.154) | more candidates pass the threshold: noticeably denser scatter of same-sized cones across the whole canvas (many small/medium red, blue, yellow, white cones), still black background. | variants/gate_0.3/frame_00001.png |
| size_2.4 | `float ss = width*1.2*noi*random(0.8, 1);` -> `float ss = width*2.4*noi*random(0.8, 1);` | large (mean 0.2041, 0.341) | all cones doubled: huge overlapping red, white and blue masses (giant white triangle bottom, red blob top), canvas crowded with overlapping shapes. | variants/size_2.4/frame_00001.png |
| palette_gray | `int colors[] = {#FACC02, #FB0603, #0365BC, #0D6305, #000000, #FFFFFF};` -> `int colors[] = {#111111, #444444, #888888, #BBBBBB, #DDDDDD, #FFFFFF};` | large (mean 0.77, 0.927) | same sparse layout recoloured greyscale; background flips from black to light grey (random pick from the new list), so nearly the whole canvas changes. | variants/palette_gray/frame_00001.png |

## Modularisation notes
- **Generic:** `noiseGate` (noise sample + threshold gate + power remap) is a clean reusable
  placement/size controller; `noiseOrient` (multi-axis noise-driven rotation) and `flatCone`
  (parametric cone from a triangle fan + base cap) are both reusable geometry utilities. The
  6-colour `rcol()` list with "must differ from background" rejection is a small reusable
  palette helper.
- **One-off art decisions:** the fixed 0.4 noise threshold, the `pwr` exponent range, the
  2x-canvas sampling box with z biased to the near half, and the two-colour cone split
  (side vs base) are the author's aesthetic choices, not general machinery.
- **Clean parameter object:** `{count, boxScale, zRange, noiseDetail, noiseOffsets, gate,
  power, sizeScale, orientationDetail, palette, background}`.
