---
sketch: 2018/Generativos/reretete2
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2146
animated: false
techniques: [subdivision, grid, noise-field]
primitives: [rect]
palette:
  colors: ["#283149", "#404b69", "#f73859", "#dbedf3"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(200)*random(0.1,1))", tried: [300], change: large, effect: "finer, busier mosaic; also reshuffles the whole layout because the substitution changes the random stream"}
  - {name: ss, default: 4, tried: [2], change: large, effect: "half-size boxes, roughly twice as fine and more regular thread-like stripes; flat patches mostly disappear"}
  - {name: det, default: "random(0.02)", tried: [0.1], change: large, effect: "higher noise scale, shorter wavelength: stripes ripple more often with finer corrugation"}
  - {name: noi_amp, default: 30, tried: [60], change: large, effect: "deeper z displacement, stronger undulation and more visible 3-D relief steps"}
  - {name: border_depth, default: "*0.5", tried: [2.0], change: large, effect: "taller border ribbons, more sculptural, larger blocky raised platforms around tiles"}
  - {name: rotY, default: "PI*0.2", tried: ["PI*0.5"], change: large, effect: "stronger shear: same texture, plane rotated further so stripes distort more diagonally"}
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(rects, iterations, minSize) -> Rect[]", note: "repeatedly pick a random rect, split into 4 children at random 30-70% midpoints, drop splits whose pieces fall below minSize"}
  - {name: noiseBorderRibbon, signature: "noiseBorderRibbon(rect, cell, depth, noiseScale, amp) -> void", note: "grid of small boxes on a rect's border, z-displaced by 3-D noise; produces the wavy striped texture"}
---

## What it draws
A full-bleed field viewed at an oblique angle: a mosaic of rectangular tiles in dark navy,
bright red/pink, and off-white, where the border of nearly every tile is a wavy, thread-like
ribbon of fine stripes that undulate like stitched fabric. A few tiles read as smoother, flatter
patches (mostly white) where the ribbon is thin. The whole plane is tilted in 3-D, so rows of
stripes shear diagonally across the canvas.

## How the code works
- `setup()` (L3-9): 960x960 P3D, `smooth(8)`, calls `generate()` once; `draw()` is empty so the
  image is static (frames 10/60 dropped as identical).
- Subdivision (L38-55): starts from one rect 1.6x the canvas (L39), then `sub =
  int(random(200)*random(0.1,1))` iterations (L40): pick a random rect, cut it into 4 children
  at a random 30-70% mid-point rounded to a multiple of 4 px (L45-48), skip the split if any
  piece is under `max = 20` px (L41, L49). Result: an irregular quadtree mosaic.
- View (L57-65): `ortho()`, translate to canvas centre, `rotateX(-PI/6)`, `rotateY(PI*0.2)`,
  ambient + directional light — this is what tilts and shears the plane in the image.
- Tiles (L67-93): for each rect, fill with `rcol()` (L69) — a random pick from the 4-colour
  palette (L121-124: #283149, #404b69, #f73859, #dbedf3) — and draw a flat quad (L70). Then on
  a 4 px grid (`ss = 4`, L73) with border depth `h = min(r.w,r.h)*random(1,8)*0.5` (L74), only
  border cells are used (z==0, z==cz-1, y==0, y==cy-1; L82); each border cell draws a small
  `box(ss)` (L88) whose z is offset by `noi = noise(des+x*det, des+y*det, des+z*det)*30`
  (L85, L87) with per-rect noise scale `det = random(0.02)` and random noise offset `des`
  (L78-79). Each box is filled with another random palette colour (L83). These noise-displaced
  box rows are the wavy stripes; the flat quads show through as smooth patches.
- Randomness enters only through `randomSeed(seed)` (L34); the harness seeds `seed` directly
  (`seed_fields: ["seed"]`), so renders are deterministic.
- `arc2` (L101-119) and `getColor` (L125-134) are dead code, never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_300 | `int sub = int(random(200)*random(0.1, 1));` -> `int sub = 300;` | large | much finer, busier mosaic: many small tiles, denser striped texture, more pronounced 3-D relief steps; layout is completely redrawn (substitution shifts the random stream, so this is not a pure iteration-count comparison) | variants/sub_300/frame_00001.png |
| ss_2 | `int ss = 4;` -> `int ss = 2;` | large | same tile layout as baseline, but stripes about twice as fine and more regular; the image reads as tightly woven fabric, with the smooth flat patches largely replaced by dense fine stripes | variants/ss_2/frame_00001.png |
| det_0.1 | `float det = random(0.02);` -> `float det = random(0.1);` | large | same tile layout; stripe undulation has a shorter wavelength — more, tighter ripples per stripe, finer corrugated look | variants/det_0.1/frame_00001.png |
| noi_60 | `float noi = noise(des+x*det, des+y*det, des+z*det)*30;` -> `...*60;` | large | same tile layout; undulations are deeper and more exaggerated, stronger 3-D relief with visible step-like distortions in places | variants/noi_60/frame_00001.png |
| h_x2 | `float h = min(r.w, r.h)*random(1, 8)*0.5;` -> `...*2.0;` | large | same tile layout; border ribbons are much taller, giving a more sculptural surface with large blocky raised platforms and deeper gaps between tiles | variants/h_x2/frame_00001.png |
| rotY_0.5 | `rotateY(PI*0.2);` -> `rotateY(PI*0.5);` | large | identical texture, plane rotated ~90 deg in Y: stronger diagonal shear and perspective foreshortening of the stripe field | variants/rotY_0.5/frame_00001.png |

## Modularisation notes
- Generic: the quadtree split loop (L38-55) — pure 2-D geometry, no canvas or palette coupling;
  parameterised by iteration count, min piece size, and mid-point range. The border-ribbon
  (L72-92) — a grid of small boxes on a rect's border with 3-D-noise z-displacement; parameterised
  by cell size, border depth, noise scale, amplitude.
- One-off art decisions: the 4-colour palette and per-primitive random colouring, the ortho
  camera angles and lighting, the 4 px cell quantisation of split points.
- Clean parameter object: `{seed, iterations, minCell, cellSize, borderDepth, noiseScale,
  noiseAmp, rotX, rotY, palette}`.
