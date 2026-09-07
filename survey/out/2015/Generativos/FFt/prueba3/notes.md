---
sketch: 2015/Generativos/FFt/prueba3
year: 2015
renderer: P3D
size: [640, 640]
libraries: [minim]
deterministic: false
ms_first_frame: 2188
animated: true
techniques: [3d-pointcloud, grid, shader]
primitives: [shape]
palette:
  colors: ["#282828", "#000000", "#DCDCDC", "#FFFFFF"]
  selection: random-from-list
composition: centered
parameters:
  - {name: tt, default: 80, tried: [40], change: moderate, effect: "cube size and grid-snap cell halved: smaller, more dispersed cubes on a finer lattice"}
  - {name: camDist, default: "random(-800,-100)", tried: ["random(-300,-100)"], change: large, effect: "camera closer: much larger cubes, stronger perspective (huge foreground cubes)"}
  - {name: background, default: 40, tried: [180], change: large, effect: "light grey background: white cubes nearly blend in, low contrast"}
  - {name: fill, default: "random(220,256)", tried: ["random(0,90)"], change: moderate, effect: "cubes dark grey/near-black on dark background: cluster barely visible"}
  - {name: stroke, default: "stroke(0,8)", tried: ["stroke(0,160)"], change: none, effect: "no visible change"}
  - {name: cc, default: "random(3,100)", tried: ["random(3,30)"], change: moderate, effect: "fewer cubes: visibly sparser cluster (non-deterministic, count varies per render)"}
reusable_candidates:
  - {name: gridSnappedCloud, signature: "gridSnappedCloud(count, extent, cell) -> PVector[]", note: "random 3-D points inside a cube, snapped to a cubic grid"}
  - {name: randomPerspectiveCamera, signature: "randomPerspectiveCamera(w, h, zMin, zMax) -> (camDist, camVel, fov)", note: "random camera distance, drift velocity and field of view"}
---

## What it draws
A centred swarm of roughly thirty to a hundred 3-D cubes in near-white and light grey,
varying in apparent size with perspective, on a dark charcoal background with a soft
corner vignette. The cluster is slightly tilted and reads as a loose, scattered point
cloud in space; there is a faint overall glow. Frame 60 is close to frame 1 (same cube
layout, slightly shifted) — the scene is mostly stable with per-frame flicker.

## How the code works
- `setup()` (lines 18-40): 640x640 P3D, loads `glow.glsl` and `vignette.glsl` as full-canvas
  filters, loads and loops `../idm1.mp3`, FFT with 16 linear bands, then `generarCubes()`,
  `changeCamera()`, `changeAngle()`.
- `generarCubes()` (lines 89-102): `cc = int(random(3, 100))` cubes; each position uniform in
  `[-width/1.2, width/1.2]` on all three axes, then snapped to an 80-px grid (`x -= x%tt`),
  which is why the cubes form loose lattice-like alignments.
- `changeCamera()` (lines 110-116): `camDist = random(-800, -100)`, `camVel = random(-1, 1)`,
  random field of view applied via `perspective()`.
- `draw()` (lines 44-87): `fft.forward()` each frame; beat triggers — band 6 > 22 regenerates
  the whole cloud, band 0 > 26 re-rolls the camera (this is why the layout can jump over time
  with audio playing); rotation drifts by `random(-1,1)*band4*0.001` per axis.
  `background(40)` dark charcoal; `lights()`; translate to centre + `camDist` on z; each cube:
  `fill(random(220, 256))` — a fresh random light-grey per cube per frame (source of the
  flicker between frames), `box(80)`, `stroke(0, 8)` barely-visible dark outline.
  Finally `filter(glow)` (intensity `pow(band2*0.01, 2)`, time-animated) and `filter(vignette)`.
- Randomness enters at: initial cube positions/counts, per-frame cube fills, rotation drift,
  camera. `deterministic: false` in the baseline, so small differences between renders are
  partly noise; only large changes are meaningful.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| tt_40 | `int tt = 80;` -> `int tt = 40;` (2 occurrences: box size + grid cell) | moderate | smaller, more dispersed cubes; finer grid alignment, cluster reads as sparser dust | variants/tt_40/frame_00001.png |
| camDist_300 | `camDist = random(-800, -100);` -> `camDist = random(-300, -100);` | large | camera much closer: cubes dramatically larger, strong perspective with oversized foreground cubes | variants/camDist_300/frame_00001.png |
| background_180 | `background(40);` -> `background(180);` | large | light grey background; white cubes lose contrast and recede | variants/background_180/frame_00001.png |
| fill_90 | `fill(random(220, 256));` -> `fill(random(0, 90));` | moderate | cubes dark grey/near-black against the dark background; cluster barely distinguishable | variants/fill_90/frame_00001.png |
| stroke_160 | `stroke(0, 8);` -> `stroke(0, 160);` | none | no visible change (edge lines too thin to read even at full alpha) | variants/stroke_160/frame_00001.png |
| cc_30 | `int cc = int(random(3, 100));` -> `int cc = int(random(3, 30));` | moderate | sparser cluster with fewer cubes (non-deterministic sketch, so part of the diff is baseline noise) | variants/cc_30/frame_00001.png |

## Modularisation notes
- Generic: `gridSnappedCloud` (count, extent, cell) is a self-contained 3-D point generator;
  `changeCamera`/`changeAngle` (random perspective + orientation) are reusable; the
  audio-band-threshold trigger pattern (band > threshold -> callback) is a clean
  `reactiveThreshold(fft, band, level, fn)` candidate; per-frame random re-fill of a shape
  list is a one-line effect.
- One-off art decisions: near-white-on-charcoal palette, 80-px cube size and grid cell,
  the specific glow+vignette shader stack and its intensity curve, the music file choice.
- A clean parameter object: `{count, extent, cell, cubeSize, camZ: [min, max], camVel,
  fovRange, bgGray, fillRange: [lo, hi], strokeAlpha, beatBand, beatLevel, cameraBand,
  cameraLevel, driftBand}`.
