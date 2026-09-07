---
sketch: 2019/generativos/dondon
year: 2019
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2247
animated: false
techniques: [noise-field, grid, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#043387", "#0199DC", "#BAD474", "#FBE710", "#FFE032", "#EB8066", "#E7748C", "#DF438A", "#D9007E", "#6A0E80", "#242527", "#FCFCFA"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: 500, tried: [200], change: large, effect: "coarser voxel grid; individual boxes visible, background shows through gaps/corners"}
  - {name: sizeMul, default: 1.4, tried: [1.0], change: moderate, effect: "field = width (not 1.4x); finer grain, colour pattern zoomed in"}
  - {name: strokeAlpha, default: 40, tried: [140], change: moderate, effect: "grid lines become a heavy dark mesh; colours look muted"}
  - {name: tiltX, default: "HALF_PI*0.2", tried: [0], change: moderate, effect: "flatter face-on view; less depth, bottom shadow wedge largely gone"}
  - {name: detSize, default: "*0.4", tried: ["*2.0"], change: subtle, effect: "no visible change at this grid scale"}
  - {name: paletteCycles, default: 16, tried: [8], change: moderate, effect: "fewer, bolder, larger colour bands"}
reusable_candidates:
  - {name: getColor, signature: "getColor(v) -> int", note: "lerps across a fixed palette by a float v, wrapping and blending adjacent entries"}
  - {name: noiseVoxelField, signature: "noiseVoxelField(cc, sizeMul, sizeDetail, sizeRange) -> field", note: "grid of box() primitives sized and coloured by independent 2-D noise fields, tilted and lit in 3D"}
---

## What it draws
A full-bleed, slightly tilted 3D field of thousands of tiny boxes (a 500×500 grid of voxels)
seen at an angle, lit by a single directional light. The boxes are tinted by a smooth noise
gradient that cycles a 12-colour palette, producing broad diagonal bands of deep magenta/purple,
olive-yellow and pink, with a dark shadowed wedge at the bottom edge. Box sizes vary by noise,
giving a grainy, bumpy texture, and faint dark grid lines between the boxes read as fine grain.
The image is static (frames 10/60 identical to frame 1).

## How the code works
- `settings()` (line 12-17): 960×960, `P3D`, `smooth(8)`.
- `generate()` (line 50): seeds `random`/`noise` with `seed`; `background(3)` near-black.
- View (line 57-68): translate to centre at `z=200`, then `rotateX(HALF_PI*0.2)` (~18°) and
  `rotateZ(HALF_PI*0.5)` (90°) tilt the grid into a slanted plane. A directional light from a
  random x/y with z=-1 (line 61-64) shades the box tops.
- Grid (line 73-75): `cc=500` cells; cell size `ss = size/cc` with `size = width*1.4`.
- Weight field (line 88-92): `values[][]` is filled by 2.2M random samples adding
  `pow(noise,1.3)*0.5`. But the draw caps the per-cell stack at `min(values,1)` (line 101), so
  in practice **every cell draws a single box**; this field does not visibly affect output.
- Box grid loop (line 95-108): per cell the colour is `col = noise(...)*16` (line 97) mapped
  through `getColor()` (line 127-133), which lerps adjacent palette entries and wraps; then
  lightened toward white by 0.2 (line 98). Box size = `ss*1.01*random(0.9,1)*noi` (line 103)
  with `noi = 0.6 + pow(noise,0.8)*0.4` (line 102) driven by `detSize` — this is the bumpiness.
- Colour bands come from the `*16` multiplier cycling the 12-colour palette across the colour
  noise; `detCol` (line 82) sets the spatial frequency of that noise.
- `stroke(0, 40)` (line 70): alpha-40 strokes of weight 0.5 make the fine dark grid lines/grain.
- Static: `draw()` is empty, so the sketch renders once in `setup()` and never changes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `int cc = 500;` -> `int cc = 200;` | large | coarser voxel grid: individual square boxes now clearly visible, black background shows through gaps and the top corners | variants/cc_200/frame_00001.png |
| size_1.0 | `float size = width*1.4;` -> `width*1.0;` | moderate | field scaled to width: finer grain, colour bands look zoomed in (larger regions), dark corners at top | variants/size_1.0/frame_00001.png |
| stroke_140 | `stroke(0, 40);` -> `stroke(0, 140);` | moderate | fine grid lines become a heavy dark lattice/mesh; colours muted, strong woven cross-hatch texture | variants/stroke_140/frame_00001.png |
| tiltX_0 | `rotateX(HALF_PI*0.2);` -> `rotateX(0);` | moderate | removing the 18° X-tilt: flatter, more face-on view; reduced depth, dark bottom shadow wedge largely gone | variants/tiltX_0/frame_00001.png |
| detSize_2.0 | `...*0.4;` -> `...*2.0;` | subtle | no visible change: size-variation noise is finer but boxes are already sub-3px so the grain looks the same | variants/detSize_2.0/frame_00001.png |
| cycles_8 | `...*40)*16;` -> `...*40)*8;` | moderate | palette cycles halved (16->8): fewer, bolder, larger colour bands (bigger smooth magenta/yellow regions) | variants/cycles_8/frame_00001.png |

## Modularisation notes
- `getColor()` (line 127-133) is a clean, reusable palette-lerp: given a float, wrap it across a
  fixed colour list and blend the two neighbouring entries with a power curve.
- The box grid (line 95-108) is a generic "noise voxel field" primitive: a `cc`×`cc` grid of
  `box()` sized and coloured by independent 2-D Perlin fields, tilted and lit in 3D.
- The 2.2M-sample `values` field (line 88-92) is dead weight — it is capped at 1 per cell and
  therefore never changes what is drawn; a clean version would drop it entirely.
- A clean parameter object would be: `{resolution cc, sizeMultiplier (width*X), colorNoiseDetail
  detCol, paletteCycles (the *16), sizeNoiseDetail detSize, sizeRange (0.6..1.0), strokeAlpha,
  tiltX, tiltZ}`.
