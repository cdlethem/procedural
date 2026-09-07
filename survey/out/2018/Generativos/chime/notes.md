---
sketch: 2018/Generativos/chime
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1503
animated: false
techniques: [3d-pointcloud]
primitives: [rect]
palette:
  colors: ["#F4D3DE", "#F7E843", "#409746", "#373787", "#E12E29"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: boxCount, default: 1200, tried: [400], change: moderate, effect: "sparser field, more green background showing"}
  - {name: maxW, default: 200, tried: [600], change: large, effect: "wider, bigger cards; large yellow/green slabs dominate"}
  - {name: scatterVolume, default: 500, tried: [150], change: large, effect: "much denser; background mostly hidden, huge near-camera plane across center"}
  - {name: fov, default: "PI/random(2.2,3.0)", tried: ["PI/random(1.2,1.8)"], change: large, effect: "wider angle: stronger perspective, near planes much bigger"}
  - {name: maxD, default: 2, tried: [40], change: moderate, effect: "boxes show visible thickness (3D side faces) instead of flat cards"}
  - {name: strokeWeight, default: 0.5, tried: [3], change: subtle, effect: "no visible change; stroke alpha 20 keeps edges faint"}
  - {name: boxGrid, signature: "boxGrid(w, h, d, cw, ch, cd, gap) -> void", note: "grid of boxes with per-cell inset; called 1x1x1 here so it degenerates to a single box"}
  - {name: confettiScatter, signature: "confettiScatter(count, volume, maxW, maxH, maxD) -> void", note: "scatter thin boxes at random positions/rotations in a centered cube, random camera"}
  - {name: lerpRampColor, signature: "lerpRampColor(palette[], t) -> int", note: "cyclic lerp between adjacent palette entries, continuous ramp over a color list"}
---

## What it draws
Full-bleed confetti field on a muted mid-green background: hundreds of flat,
thin rectangular planes in random orientations, from a few large near-camera
cards (yellow, pink, light green) down to many small fragments (red, dark
purple, blue, yellow). Faint dark outlines are visible on the box edges.
Dense and uniform across the canvas; a couple of oversized planes dominate
the center and left.

## How the code works
Static single-pass P3D render: `setup()` calls `generate()` once, `draw()` is
empty (lines 3-11).

- Seeding: `randomSeed(seed)` / `noiseSeed(seed)` (lines 23-24).
- Background: `getColor(random(10))` (line 25) — a color sampled from the
  cyclic lerp ramp, giving the muted mid-green ground.
- Camera: `fov = PI/random(2.2, 3.0)` (line 27), `cameraZ` from the fov,
  `perspective()` (lines 28-30); camera moves to canvas center and gets three
  random full-`TAU` rotations (lines 32-35), so every render is a different
  arbitrary 3D viewpoint.
- Main loop (lines 44-56): 1200 boxes. Each is rotated by multiples of
  `TAU/8` per axis (lines 46-48 — only 8 discrete orientations per axis, so
  `[-500, 500]^3` (line 49, `size = 500` line 37), then drawn with
  `boxGrid(w, h, d, 1, 1, 1, 1)`. Dimensions: `w < 200` (line 50),
  `h < 80` (line 51), `d < 2` (line 52) — thin cards. `boxGrid` with 1x1x1
  cells (lines 59-80) draws one `box(w-1, h-1, d-1)`.
- Edges: `stroke(0, 20)`, `strokeWeight(0.5)` (lines 39-40) — barely visible
  dark outlines; `scale(1.2)` (line 42) slightly enlarges everything.
- Colour: 5-colour palette (line 88); `getColor(v)` (lines 96-102) lerps
  between adjacent palette entries cyclically, so each box gets an independent
  random point on the ramp (line 53) — the visible spread from pinks through
  yellows, greens, purples to reds. A noise-driven fill variant exists but is
  commented out (line 74).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_400 | `for (int i = 0; i < 1200; i++) {` -> `... i < 400 ...` | moderate | sparser field, more of the green background showing | variants/count_400/frame_00001.png |
| wmax_600 | `float w = random(200)*random(0.4, 1);` -> `float w = random(600)*random(0.4, 1);` | large | wider cards; big yellow and green slabs dominate the frame | variants/wmax_600/frame_00001.png |
| size_150 | `float size = 500;` -> `float size = 150;` | large | much denser; background mostly hidden, huge pale-yellow plane across the center | variants/size_150/frame_00001.png |
| fov_wide | `float fov = PI/random(2.2, 3.0);` -> `float fov = PI/random(1.2, 1.8);` | large | stronger perspective: near planes much bigger, more size variation | variants/fov_wide/frame_00001.png |
| dmax_40 | `float d = random(2);` -> `float d = random(40);` | moderate | boxes show visible thickness (3D side faces) instead of flat cards | variants/dmax_40/frame_00001.png |
| weight_3 | `strokeWeight(0.5);` -> `strokeWeight(3);` | subtle | no visible change (stroke alpha 20 keeps edges faint) | variants/weight_3/frame_00001.png |

## Modularisation notes
- Generic: `boxGrid` (grid of inset boxes) is directly reusable, though this
  sketch only exercises the 1x1x1 case; the confetti scatter loop (random
  position + quantized rotation + thin box + ramp color) is the core
  reusable pattern; the cyclic-lerp `getColor` ramp is a general palette
  helper.
- One-off art decisions: `TAU/8` rotation quantization (what makes the planes
  read as aligned families instead of pure chaos), the `d < 2` flatness, the
  specific 5-colour palette, background sampled from the same ramp,
  `stroke(0, 20)`/`weight 0.5`, `scale(1.2)`.
- Clean parameter object: `{count, volume, maxW, maxH, maxD, fovRange,
  rotQuant, palette, rampBackground, strokeAlpha, strokeWidth, scale}`.
