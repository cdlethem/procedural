---
sketch: 2018/Generativos/acui
year: 2018
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 3696
animated: true
techniques: [noise-field, 3d-pointcloud, particles]
primitives: [point]
palette:
  colors: ["#92C8FA", "#0321A1", "#F94D21"]
  selection: noise-driven
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: noiseThresholdVolume, signature: "noiseThresholdVolume(size, detScale, threshold, pointCount, colorFn) -> void", note: "3D simplex noise thresholded point cloud in a bounding cube with ADD blending"}
  - {name: noiseDrivenColor, signature: "noiseDrivenColor(palette, offset, scale) -> int", note: "maps 3D noise value to a palette via lerp between adjacent colors"}
---

## What it draws

A volumetric, smoke-like cloud of tiny colored points filling the full 960×960 canvas on a black background. The dominant colors are light blue and warm orange-red, with deep navy in shadowed regions. The structure is wispy and organic—denser in some regions, sparser in others—resembling a 3D nebula or smoke plume viewed from an arbitrary angle. The ADD blend mode gives overlapping points a luminous, glowing quality. (Frame 60 shows a white background with sparse black dot clusters—this appears to be a headless P3D renderer artifact where the ADD-blended buffer saturates/corrupts after the initial frame; the meaningful visual is frame 1.)

## How the code works

1. **Setup** (lines 10-14): `size(960,960,P3D)`, `smooth(8)`, calls `generate()` once.
2. **generate()** (lines 29-57):
   - `background(0)` → black canvas.
   - `randomSeed(seed)` for reproducibility.
   - `blendMode(ADD)` → additive compositing makes overlapping points glow.
   - `translate(center)` + three `rotateX/Y/Z(random(TAU))` → arbitrary 3D viewpoint into the volume.
   - **Shape noise field** (lines 40-42): `SimplexNoise.noise(des + x*det, ...)` with `det ≈ 0.003–0.004` (range 0.006–0.008 × 0.5) and `noiseDetail(1)` (single octave, no lacunarity). A point is drawn only if noise < 0.001—a very tight threshold that carves sparse filaments out of the cube.
   - **Color noise field** (lines 43,53): a second, independent 3D noise (`desc`, `detc ≈ 0.0018–0.0024`, i.e. 0.006–0.008 × 0.3) is evaluated at the same point and passed to `getColor(float)`.
   - **getColor(float)** (lines 81-88): maps the noise value into the 3-color palette `[#92C8FA, #0321A1, #F94D21]` by `lerpColor` between adjacent palette entries—so color varies smoothly in 3D space.
   - **Point loop** (lines 48-56): 10 000 000 uniform-random positions in `[-540, 540]³`. Each that passes the threshold gets a 1-px point with alpha 130 and the noise-driven color.
3. **Randomness**: enters via the initial `random(TAU)` rotations, the noise offsets (`des`, `desc`), the noise scales (`det`, `detc`), and the per-point position `random(-size,size)`.
4. **draw()** is empty (line 18: `generate()` is commented out); regeneration only on key press.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes

- **Generic / reusable**: The "thresholded 3D noise point volume" is the core algorithm—sample N random points in a cube, keep those where a 3D noise field falls below a threshold, color survivors via a second noise field mapped through a palette. This is a clean, self-contained function.
- **One-off art decisions**: The specific palette (blue/navy/orange), the exact threshold (0.001), the two different noise scales (shape vs. color), the ADD blend mode, and the single-octave noise detail are aesthetic choices.
- **Parameter object** (suggested): `{ volumeSize, pointCount, shapeNoiseScale, shapeNoiseThreshold, colorNoiseScale, palette[], alpha, blendMode, noiseOctaves }`.
