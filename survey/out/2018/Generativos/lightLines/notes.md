---
sketch: 2018/Generativos/lightLines
year: 2018
renderer: P3D
size: [960, 960]
libraries: [peasy]
deterministic: false
ms_first_frame: 1676
animated: false
techniques: [subdivision, 3d-mesh, noise-field, grid]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#016EFF", "#FACD3B", "#FF26DA", "#14164C"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: fgSub, default: 150, tried: [50], change: large, effect: "lower = much coarser, larger flat mosaic tiles (big solid blocks)"}
  - {name: bb, default: 1, tried: [12], change: moderate, effect: "higher = wider dark gaps/seams between foreground tiles"}
  - {name: sphereScale, default: 0.5, tried: [1.2], change: moderate, effect: "higher = larger glowing spheres (dots)"}
  - {name: rings, default: 3, tried: [8], change: large, effect: "higher = more concentric ring outlines per sphere"}
  - {name: bgSub, default: 12, tried: [30], change: large, effect: "higher = finer, denser mosaic tiling on the 3D cylinders"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(x, y, w, h, splits, maxCols, maxRows) -> Rect[]", note: "recursive random mosaic subdivision; one split per iteration, 2-3 cols x 2-7 rows each time"}
  - {name: mosaicCylinder, signature: "mosaicCylinder(x, y, w, h, sub, div) -> void", note: "tiles a vertical cylinder surface with small quads, noise-jittered ring angles"}
  - {name: glowDot, signature: "glowDot(x, y, s, rings) -> void", note: "small lit sphere + concentric stroked ellipse rings, 3D"}
  - {name: paletteLerp, signature: "getColor(float v) -> color", note: "float index -> lerp between adjacent palette entries (wrapping)"}
---

## What it draws
Full-bleed neon mosaic on near-black. Left and lower areas are flat, tightly packed subdivided
rectangles in magenta, gold/yellow, blue and teal, each with a dark side face that reads as a
slightly extruded tile. The right side holds two to three vertical 3D cylinder columns wrapped in
small mosaic tiles (purple/blue/teal top-right, gold/orange lower-middle). Scattered over the scene
are glowing spheres — bright yellow, magenta, blue, and dark — each surrounded by a few thin
concentric ring outlines. A post-shader adds a soft glow/bloom on top.

## How the code works
- `setup()` (L8-18): 960x960 P3D, PeasyCam, loads `post.glsl`, calls `generate()` once; `draw()`
  is empty, so the image is static (regenerates only on key press).
- `generate()` (L42-142): `randomSeed(seed)` at L49, then `background(4,6,9)` (L50) — near-black.
  `time = millis()*random(0.01)` (L44) is computed *before* the seed and drives all colour
  selection, which is why renders are not deterministic.
- `back()` (L144-174): recursively subdivides a 1.8x-canvas rect 12 times (L149); each leaf rect
  becomes a cylinder (L171). `cylinder()` (L181-218) tiles the cylinder surface with a grid of
  small quads (`div` around x `sub` up/down, L201-216), each filled with
  `getColor(time*rand)`, alpha `pow(noise(tt)*220, 1.2)` (L210) plus a small `rcol()` cap quad.
  Noise jitter warps the ring angle (L195-199). This produces the mosaic cylinder columns.
- Foreground (L63-138): recursively subdivides a 1-2x-canvas rect 150 times (L66), 2-3 cols x
  2-7 rows per split (L70-71). For each leaf rect: a flat quad filled with
  `getColor(time*rand)` at alpha `pow(noise(tt)*220, 1.2)` (L97) — the noise field drives
  brightness; a 50/50 random dark side quad (`fill(0,80)`, L101-120) fakes the extruded edge;
  a small 3D sphere in `rcol()` placed at a random polar offset inside the rect (L122-129) —
  the glowing dots; 3 stroked ellipses in `rcol()` with random alpha around it (L130-135) —
  the concentric rings.
- Colour: palette L267 `#016EFF #FACD3B #FF26DA #14164C`. `getColor(float)` (L274-279) maps a
  float to a lerp between adjacent palette entries (wrapping); `rcol()` (L268-270) picks
  randomly. So every surface colour is a blend of the four palette colours.
- `filter(post)` (L140-141) applies `post.glsl` (bloom/glow) to the whole canvas.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_50 | `int sub = int (random(150));` -> `int sub = int (random(50));` | large | much coarser foreground mosaic; huge flat solid tiles (big pink block top-left, large yellow square), fewer subdivisions | variants/sub_50/frame_00001.png |
| bb_12 | `float bb = 1;` -> `float bb = 12;` | moderate | noticeably wider dark seams/gaps between the flat foreground tiles; tile colours and spheres unchanged | variants/bb_12/frame_00001.png |
| sphere_1.2 | `sphere(ss*0.5);` -> `sphere(ss*1.2);` | moderate | glowing spheres/dots are visibly larger, some now big enough to overlap neighbours | variants/sphere_1.2/frame_00001.png |
| rings_8 | `for(int j = 0; j < 3; j++){` -> `for(int j = 0; j < 8; j++){` | large | many more concentric ring outlines around each sphere; rings read as dense halos | variants/rings_8/frame_00001.png |
| backsub_30 | `int sub = int (random(12));` -> `int sub = int (random(30));` | large | cylinder columns tiled with much finer, smaller mosaic quads; denser, more granular texture | variants/backsub_30/frame_00001.png |

## Modularisation notes
- `subdivideRects` (L63-83 / L145-165, duplicated) is a clean generic: recursive random mosaic
  subdivision, parameterised by split count and per-split column/row ranges. The two copies
  (foreground vs background) differ only in split count and canvas scale.
- `cylinder()` is a self-contained tiling primitive: polar grid of quads on a cylinder with
  noise-warped rings and per-quad palette colour — reusable as a "mosaic surface" generator.
- `glowDot` (sphere + rings, L122-135) is a small reusable 3D accent primitive.
- `getColor`/`rcol` are a standard palette-lerp pair.
- One-off art decisions: the 50/50 fake extrusion side quad, the 1.8x/1-2x oversize canvas
  (rects spill off-canvas for full-bleed), the `millis()`-driven colour time, and the
  `post.glsl` bloom. A parameter object would need: seed, split counts (fg/bg), per-split
  col/row ranges, border gap `bb`, sphere scale, ring count, palette, and bloom strength.
