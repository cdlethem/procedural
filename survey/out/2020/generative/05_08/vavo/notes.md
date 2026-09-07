---
sketch: 2020/generative/05_08/vavo
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1482
animated: false
techniques: [grid, noise-field, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#FFB0D0", "#F7DE20", "#245C0E", "#EB6117", "#F72C11", "#C6356B", "#953DC4", "#003399", "#02060D"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: 16, tried: [8], change: large, effect: "8x8 grid instead of 16x16; crosses ~2x bigger, field reads as a coarse lattice"}
  - {name: da1, default: 0.001, tried: [0.01], change: moderate, effect: "10x finer X-axis rotation noise; orientations vary, overall look still similar 16x16 multicoloured field"}
  - {name: armWidth, default: 0.1, tried: [0.3], change: moderate, effect: "box arm width ss*0.1 -> ss*0.3; bars look chunkier/more 3D, same layout and colours"}
  - {name: colors, default: "10-colour rainbow list", tried: ["4-colour blue list"], change: moderate, effect: "geometry unchanged; whole field becomes monochrome blue/white instead of multicolour"}
  - {name: rotAmp, default: "TAU*2", tried: ["TAU*0.5"], change: moderate, effect: "halved X-axis rotation amplitude; crosses tilt less, field still looks like a similar multicoloured 16x16 grid"}
reusable_candidates:
  - {name: noiseCrossGrid, signature: "noiseCrossGrid(sub, noiseDetail, rotAmp, palette) -> void", note: "grid of 3D crosses, each rotated per-axis by simplex noise"}
  - {name: randomPaletteColor, signature: "randomPaletteColor(colors[]) -> color", note: "uniform random pick from a colour list"}
---

## What it draws
A full-bleed 16x16 grid on a black background. Each cell holds a small 3D cross made of three
thin orthogonal bars (a 3D asterisk), rotated in 3D so the whole field looks like multicoloured
asterisks tumbling in place. Colours are bright and scattered (white, pink, yellow, green, orange,
red, magenta, purple, blue, near-black), with no obvious pattern.

## How the code works
- `settings()` (vavo.pde:13-18) opens a 960x960 P3D window with `smooth(8)` and `lights()`.
- `setup()` (vavo.pde:20-28) calls `generate()` once; `draw()` is empty, so the piece is static
  (keyPress regenerates with a new seed, but the harness never presses keys).
- `generate()` (vavo.pde:54-85): `randomSeed`/`noiseSeed` from `seed`, black background, `lights()`,
  `noStroke()`. Picks three rotation noise details `da1..da3 = random(0.001)` (vavo.pde:60-62).
  Loops a `sub` x `sub` grid (sub = 16, cell `ss = width/sub`); per cell it translates to the cell
  centre and applies `rotateX/Y/Z` driven by `SimplexNoise.noise(...)` scaled by `TAU*2`
  (vavo.pde:75-77), mixing `seed` into the noise coordinates so each cell gets a fixed random-ish
  3D orientation. Then it draws three orthogonal thin boxes (`box(ss*1.1, ss*0.1, ss*0.1)` etc.,
  vavo.pde:79-81) to form the cross, each arm filled with `rcol()`.
- `rcol()` (vavo.pde:108-110) picks a uniform random colour from the 10-colour `colors[]` list
  (vavo.pde:107); `getColor()`/`getColor(v)` (vavo.pde:112-121) do a lerp between adjacent palette
  colours but are not used by `generate()`.
- `sky()` in sky.pde (a sky/ground gradient with random dots and rects) and `def()`
  (vavo.pde:87-92, a noise-displacement helper) are defined but never called; the triangulate
  import is also unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_8 | `int sub = 16;` -> `int sub = 8;` | large | 8x8 grid, crosses ~2x bigger with longer arms; reads as a coarse lattice, same palette | variants/sub_8/frame_00001.png |
| da1_0.01 | `float da1 = random(0.001);` -> `float da1 = random(0.01);` | moderate | same 16x16 multicoloured field; finer X-rotation noise shifts per-cross orientations, overall look similar | variants/da1_0.01/frame_00001.png |
| boxW_0.3 | `box(ss*0.1, ss*1.1, ss*0.1);` -> `box(ss*0.3, ss*1.1, ss*0.3);` | moderate | arm width tripled; bars look chunkier and more solidly 3D, layout and colours unchanged | variants/boxW_0.3/frame_00001.png |
| palette_blue | `int colors[] = {#FFFFFF, #FFB0D0, ...}` (10 colours) -> `{#0B1E4B, #1D4ED8, #60A5FA, #DBEAFE}` | moderate | geometry identical; whole field becomes monochrome blue/white instead of multicolour | variants/palette_blue/frame_00001.png |
| rotAmp_0.5 | `rotateX(...*TAU*2);` -> `rotateX(...*TAU*0.5);` | moderate | X-axis tilt halved; crosses lie a bit flatter, field still reads like the baseline multicolour grid | variants/rotAmp_0.5/frame_00001.png |

## Modularisation notes
- Generic: the per-cell "noise-rotated 3D cross" is the reusable core - a grid loop that translates
  to cell centres, applies three per-axis simplex-noise rotations (noise detail and amplitude as
  parameters), and draws three orthogonal boxes. `noiseCrossGrid(sub, noiseDetail, rotAmp, palette)`
  captures this.
- Generic: `rcol()` (vavo.pde:108-110) is a trivial random-pick palette sampler; `getColor(v)`
  (vavo.pde:116-121, lerp between adjacent palette entries) is a ready-made noise-driven variant
  that this sketch defines but never calls.
- One-off: the 10-colour rainbow list and black background are art decisions; `sky()` and `def()`
  are dead code in this sketch and should be dropped in a library version.
- A clean parameter object: `{sub, noiseDetail (per-axis or shared), rotAmp, armLengthFactor
  (default 1.1), armWidthFactor (default 0.1), palette, seed, background}`.