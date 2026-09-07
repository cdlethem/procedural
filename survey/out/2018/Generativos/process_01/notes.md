---
sketch: 2018/Generativos/process_01
year: 2018
renderer: P3D
size: [720, 720]
libraries: []
deterministic: false
ms_first_frame: 1504
animated: true
techniques: [noise-field, subdivision, grid, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#2CB4F2", "#E63B68", "#F0C6B6", "#D8D8D8", "#27B2F0", "#2D27A1", "#EA3C3B", "#F86404", "#F9AA08", "#06AA82"]
  selection: random-from-list
composition: centered
parameters:
  - {name: sub, default: "random(4, random(80))", tried: ["random(4, random(25))"], change: moderate, effect: "fewer subdivision iterations: coarser grid, larger tiles, fewer decorations"}
  - {name: ss, default: "width*0.6", tried: ["width*0.85"], change: moderate, effect: "whole scene missing: only flat background rendered (likely pushed out of the ortho viewport)"}
  - {name: det, default: "random(0.1)", tried: ["random(0.01)"], change: moderate, effect: "lower noise scale: kept tiles form larger contiguous blocks, layout differs"}
  - {name: amp, default: "random(0.3, 0.5)", tried: ["random(0.65, 0.8)"], change: moderate, effect: "higher threshold: fewer tiles kept, sparser checkerboard with gaps"}
  - {name: minS, default: "ss/128", tried: ["ss/32"], change: subtle, effect: "larger minimum tile: bigger tiles and larger decorations, scene occupies similar area"}
reusable_candidates:
  - {name: quadtreeSubdivide, signature: "quadtreeSubdivide(size, iterations, minSize) -> PVector[]", note: "random quadtree: repeatedly split a random square into 4 half-size children, stop when child <= minSize"}
  - {name: boxColors, signature: "boxColors(w, h, d, perFaceRandom) -> void", note: "axis-aligned 6-face box drawn with beginShape/vertex, each face an independent random palette colour"}
  - {name: boxRound, signature: "boxRound(w, h, d, roundness) -> void", note: "rounded-rectangle prism: rounded 2D outline extruded in Z, side quads random-coloured"}
  - {name: rcol, signature: "rcol(int[] palette) -> int", note: "random pick from a colour list"}
---

## What it draws
A slowly rotating isometric 3D scene centred on the canvas: a flat checkerboard-like
field of square tiles subdivided at several scales, each tile a flat slab in one of
orange, yellow, red, green, teal or blue, over a pale peach background. Scattered on
top of the tiles are 3D objects: a tall tower of concentric rounded slabs, a large
teal sphere, a two-tone blue/orange box, and small grids of thin coloured bars. Some
tiles stay bare; the overall layout is asymmetric and open.

## How the code works
`setup()` (L6-14) sizes 720x720 P3D, builds an unused 512x512 PImage of random greys
(`createNoise`, L285-297; the `image(noise,0,0)` call is commented out, L143), then
calls `generate()`. `draw()` (L16-18) calls `generate()` every frame, so the whole
scene is re-randomised and re-drawn each frame; the only time dependence is the
camera: `time = millis()*0.0002` (L30) feeds `rotateZ(-HALF_PI*0.5-time)` (L43), a
slow turntable rotation, under `ortho()` with a fixed ~35° `rotateX` tilt (L40-43)
that gives the isometric look.

Inside `generate()`: background is one random colour from `backs[]` (L269, L33).
A quadtree subdivision starts from one square of side `ss = width*0.6` (L48) and runs
`sub = int(random(4, random(80)))` iterations (L52): pick a random remaining square,
and if it is bigger than `minS = ss/128` (L49) replace it with its four half-size
children (L54-64). Then each surviving square is kept only where a 2-D Perlin sample
`noise(des + r.x*det, des + r.y*det)` exceeds `amp = random(0.3, 0.5)` (L67-73) —
with `det = random(0.1)` and a huge random offset `des`, this masks roughly half the
tiles with a blobby noise pattern. Each kept tile becomes a flat box
`boxColors(s, s, minS, true)` (L83): six faces via `beginShape`/`vertex`, each face
independently filled with `rcol(colors)` (L271-273, palette at L270). With 1/8
probability a decoration is added (L85-135): `rnd==0` a shrinking stack of rounded
slabs `boxRound` (tower), `rnd==1` a small sphere, `rnd==2` a stack of small cubes,
`rnd==3` a `cw x ch` grid (up to 10x10) of thin bars. Lighting is a bright ambient
plus two dim directional lights (L35-37). Randomness enters via the seed, the
subdivision choices, the noise offset, per-face colours, and the decoration type/size.
`result.json` reports `deterministic: false`, so small differences between renders
are expected even at the same seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_25 | `int sub = int(random(4, random(80)));` -> `int sub = int(random(4, random(25)));` | moderate | coarser quadtree: large flat tiles, only a few decorations (one rounded tower, two small spheres, a small bar stack) | variants/sub_25/frame_00001.png |
| ss_085 | `float ss = width*0.6;` -> `float ss = width*0.85;` | moderate | only the flat peach background — no tiles or objects visible at all (the enlarged scene apparently left the ortho viewport; cannot tell from the image alone) | variants/ss_085/frame_00001.png |
| det_001 | `float det = random(0.1);` -> `float det = random(0.01);` | moderate | lower noise scale: kept tiles cluster into bigger contiguous regions, taller rounded tower, sphere and bar-grid in new positions | variants/det_001/frame_00001.png |
| amp_07 | `float amp = random(0.3, 0.5);` -> `float amp = random(0.65, 0.8);` | moderate | higher threshold keeps fewer tiles: sparse checkerboard of large slabs with visible gaps, fewer decorations | variants/amp_07/frame_00001.png |
| minS_32 | `float minS = ss/128.;` -> `float minS = ss/32.;` | subtle | no visible change in overall density: coarser tiles and larger decorations (big two-tone box, big sphere) but the scene fills the same area | variants/minS_32/frame_00001.png |

## Modularisation notes
Generic, library-worthy: the quadtree subdivision (iterate: pick random cell, split
into 4 if above a minimum size) is a clean `quadtreeSubdivide(size, iterations,
minSize)`; `boxColors` (per-face-coloured axis-aligned box) and `boxRound` (rounded
prism) are self-contained 3D primitives; `rcol` is trivially reusable.
One-off art decisions: the isometric camera setup (`ortho` + fixed 35° tilt +
turntable), the Perlin threshold mask that deletes ~half the tiles, the 4-way
decoration lottery (tower / sphere / cube-stack / bar-grid), and the two specific
palettes. A clean parameter object would be: `{size (ss), iterations (sub), minSize
(minS), noiseScale (det), noiseThreshold (amp), tileSize (minS), palette,
decorationWeights [0,1,2,3]}`.
