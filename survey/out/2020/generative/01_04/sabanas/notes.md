---
sketch: 2020/generative/01_04/sabanas
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2719
animated: false
techniques: [noise-field, distortion, dots-stippling]
primitives: [point]
palette:
  colors: ["#505050", "#000000", "#ff0000", "#0000ff"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: det, default: "random(0.004)", tried: ["random(0.02)"], change: moderate, effect: "finer colour field: many small red/blue/gray clumps cover the whole canvas instead of a few large ones"}
  - {name: pointCount, default: 2200000, tried: [400000], change: moderate, effect: "sparser: blobs thin into a visible point lattice with grid-like striations"}
  - {name: alpha, default: 245, tried: [60], change: moderate, effect: "dimmer: weaker additive glow, blobs darker with less bloom"}
  - {name: bb, default: 40, tried: [300], change: moderate, effect: "point cloud confined to a centred square panel with a wide black border"}
  - {name: warpStrength, default: 50, tried: [150], change: subtle, effect: "no visible change: blob grid nearly identical, only slightly more warped edges"}
reusable_candidates:
  - {name: noiseWarp, signature: "noiseWarp(x, y, detail, maxDes, seedOffset) -> PVector", note: "smooth noise-based displacement field (angle + magnitude), applied in two passes with rescaling"}
  - {name: paletteNoise, signature: "paletteNoise(noiseValue, colors) -> color", note: "maps a noise value through a palette with lerpColor biased by pow(frac, 1.8)"}
---

## What it draws
A near-black canvas (background 10) covered edge to edge by a slightly tilted, softly
warped grid of roughly 7x8 fuzzy circular blobs. Each blob is a dense clump of fine
points in a single dominant hue: saturated red, saturated blue, or pale gray; the
gaps between blobs hold only sparse, faint dark speckle. The whole pattern glows
additively, and blob edges are soft and grainy.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static
(sabanas.pde:21-32). `generate()` (42-74) does:

1. `hint(DISABLE_DEPTH_TEST)`, `background(10)`, `blendMode(ADD)` (44-57): every point
   adds to a near-black field, which is why dense clumps glow.
2. A loop of 2,200,000 points (60): each `(x, y)` is uniform in `[bb, width-bb]` with
   `bb = 40` margin (58, 61-62).
3. Each point is displaced by the warp `def()` twice (63-68): once at full scale, then
   rescaled to a quarter (`*0.25`), warped again, and rescaled back (`*4`). `def()`
   (122-126) rotates the point by a smooth noise angle (`noise(...)*TAU*2` at detail
   `detAng < 0.01`) and pushes it along that direction by a noise magnitude up to 50 px.
   This smooth, high-amplitude warp compresses the uniform point cloud into dense
   clumps — the visible grid of blobs is a caustic-like concentration of the points,
   and the slight tilt/warp of the grid rows is the same field.
4. Colour (69): `getColor(noise(x*det, y*det)*colors.length*2 + random(2))` with
   `det = random(0.004)` (56) — a very low-frequency noise field over the canvas, so
   colour is nearly constant across each clump. `getColor(float)` (152-158) lerps
   between adjacent entries of `colors[] = {#505050, #000000, #ff0000, #000000, #0000ff}`
   (144) with `pow(frac, 1.8)`, biasing strongly toward the lower entry; the two black
   entries make most of the field invisible, leaving red, blue, and gray clumps.
5. Drawing (70-72): `stroke(col, 245)` with alpha,
   modulated by `cos(x*osc)*sin(y*osc)` (osc ~0.01-0.02), `point(x, y)`.
`noiseLine()` (76-115, uses toxi `SimplexNoise`) is defined but never called.
Randomness: seed 42 drives `randomSeed`/`noiseSeed` (46-47) plus per-point `random`
positions and the `+random(2)` colour jitter.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.02 | `float det = random(0.004);` -> `float det = random(0.02);` | moderate | colour field 5x finer: instead of a few large monochrome blobs the whole surface is a dense field of many small round red/blue/pale-gray clumps, grainier and more mottled | variants/det_0.02/frame_00001.png |
| points_400000 | `for (int i = 0; i < 2200000; i++) {` -> `... i < 400000 ...` | moderate | 5.5x fewer points: blobs lose their filled, glowing body and read as a sparse woven lattice — distinct rows and columns of point clumps, you can see individual points and the gaps between them | variants/points_400000/frame_00001.png |
| alpha_60 | `stroke(col, 245);` -> `stroke(col, 60);` | moderate | same blob grid but much dimmer: weaker additive bloom, blobs sit on a darker field with only a faint dark-red/blue haze between them | variants/alpha_60/frame_00001.png |
| bb_300 | `float bb = 40;` -> `float bb = 300;` | moderate | points restricted to a centred ~360px square: a small panel of a handful of large red/white/blue blobs floating in a wide black border | variants/bb_300/frame_00001.png |
| des_150 | `float des = noise(...)*50;` -> `... *150;` | subtle | no visible change: same grid of same-coloured blobs, edges slightly more warped and stretched but overall impression unchanged | variants/des_150/frame_00001.png |

## Modularisation notes
Generic, reusable: the two-pass noise warp (`def` + rescale) and the noise-driven
palette mapper — both are small pure functions of (x, y, parameters). One-off art
decisions: the specific 5-entry palette with black gaps, the `pow(v,1.8)` lerp bias,
the 2.2M point count, the double-warp 0.25/4 rescaling trick, and the ADD blend on a
near-black background. A clean parameter object: `{pointCount, margin (bb), colorDetail
(det), warpDetail (detAng/detDes), warpStrength (max des), strokeAlpha, weightRange
[0.4, 1], osc, palette, blendMode, background}`.
