---
sketch: 2015/Generativos/cubitos
year: 2015
renderer: P3D
size: [800, 400]
libraries: []
deterministic: true
ms_first_frame: 1494
animated: true
techniques: [grid, noise-field, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#261C21", "#6E1E62", "#B0254F", "#DE4126", "#EB9605"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: mt, default: 1, tried: [2, 5], change: moderate, effect: "grid step tt=10*mt; larger mt = bigger, sparser cubes, coarser mosaic"}
  - {name: det, default: 0.005, tried: [0.002], change: moderate, effect: "colour-noise scale; smaller = smoother, broader colour bands; relief unchanged"}
  - {name: mz, default: 0.5, tried: [2.0], change: large, effect: "mouse-distance z push; 2.0 pushes the whole wall out of camera view, leaving a flat dark background"}
  - {name: zAmp, default: 0.6, tried: [2.0], change: moderate, effect: "relief height scale (tt*zAmp); 2.0 exaggerates it - flat areas thin to slivers, receded areas become tall columns"}
reusable_candidates:
  - {name: noiseVoxelWall, signature: "noiseVoxelWall(cell, heightScale, colorDetail) -> wall", note: "grid of P3D boxes, z-displaced by per-cell noise, colour lerped through a palette by a second noise field"}
---

## What it draws
A full-bleed wall of small cubes (10 px cells) in warm tones — dominant orange and
red-orange, with crimson and a few purple/magenta patches, on a dark reddish-brown
background. Some regions show flat, full square faces; others recede, showing thin
edge-on slivers with dark gaps between cubes, so the wall reads as a lumpy 3D relief.
Over 60 frames the relief pattern and colour regions shift around.

## How the code works
- `paleta[]` (lines 1-7): 5 colours, dark brown → purple → crimson → red-orange → orange.
- `mt = 1` (line 9) sets the grid step `tt = 10*mt = 10` (line 39); boxes are `box(tt)`,
  so cells tile the canvas exactly.
- `generar()` (lines 37-59) runs in `setup()` and again on every `draw()` (line 19), so
  the whole wall is regenerated each frame — the sketch is animated.
- Background: random palette colour (`rcol()`, lines 61-63).
- Nested loops (lines 43-44) step the canvas in `tt` increments. Per cell:
  - colour: `noise((i+frameCount*0.1)*0.005, (j+frameCount)*0.005)` (line 46) scaled by
    palette length, then `lerpColor` between the two adjacent palette entries (line 47) —
    a smooth noise-driven colour field that drifts as `frameCount` advances.
  - height: `noise(i, j) * tt * 0.6` (line 50) — per-cell pseudo-random z (noise detail
    1.0 at pixel scale) giving the lumpy relief; the tiny `frameCount*0.007` offset makes
    it crawl almost imperceptibly.
  - mouse bump: `zz = dist(x,y,mouseX,mouseY) * mz` (line 51, `mz = 0.5`) pushes cells
    away from the mouse along z.
  - `translate` + `box(tt)` (lines 52-53); `lights()` in `draw()` (line 18) shades the
    box faces.
- Randomness: only the background colour (`rcol()`) and the mouse handler (lines 27-30),
  which is never triggered headless.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| mt_2 | `int mt = 1;` -> `int mt = 2;` | moderate (mean 0.0578, 0.239 of pixels) | 20 px cubes: sparser, chunkier wall; large flat colour blocks of orange/red/crimson, dark gaps where cubes recede | variants/mt_2/frame_00001.png |
| mt_5 | `int mt = 1;` -> `int mt = 5;` | moderate (mean 0.0852, 0.364 of pixels) | 50 px cubes: coarse mosaic of big squares, strong relief; orange, crimson and dark brown, dark gaps between receded cubes | variants/mt_5/frame_00001.png |
| det_0.002 | `float det = 0.005;` -> `float det = 0.002;` | moderate (mean 0.0742, 0.209 of pixels) | smoother, banded colour field (orange left -> crimson right, purple patch top-left); cube relief unchanged | variants/det_0.002/frame_00001.png |
| mz_2.0 | `float mz = 0.5;` -> `float mz = 2.0;` | large (mean 0.2648, 0.907 of pixels) | no visible cubes at all: the mouse-distance z push moves the entire wall out of the camera's view; image is a flat very dark brown (the background colour) | variants/mz_2.0/frame_00001.png |
| zamp_2.0 | `*tt*0.6;` -> `*tt*2.0;` | moderate (mean 0.06, 0.269 of pixels) | stronger relief: flat areas thin to dark slivers, receded areas become tall columns with big dark gaps; colour shifts toward crimson | variants/zamp_2.0/frame_00001.png |

## Modularisation notes
- Generic: the `generar()` voxel-wall builder — a grid of boxes whose z-height comes from
  a per-cell noise sample and whose colour is a noise-driven lerp through a palette.
  Clean parameter object: `{cell, heightScale, colorDetail, palette, backgroundMode,
  mouseStrength}`.
- One-off art decisions: the specific 5-colour warm palette, the two different noise
  scales for colour (0.005) vs height (1.0), the `frameCount*0.1` drift speed, and
  regenerating the entire wall every frame rather than animating a persistent scene.
