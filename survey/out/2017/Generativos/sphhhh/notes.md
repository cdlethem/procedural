---
sketch: 2017/Generativos/sphhhh
year: 2017
renderer: P3D
size: [1280, 720]
libraries: []
deterministic: true
ms_first_frame: 1546
animated: false
techniques: [3d-mesh, grid, noise-field, distortion]
primitives: [shape]
palette:
  colors: ["#303841", "#2E4750", "#F6C90E", "#F7F7F7"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: res, default: "random(10, random(80, 800))", tried: ["random(10, random(20, 60))"], change: large, effect: "coarser grid: few large flat cells instead of a dense checker"}
  - {name: size, default: "random(600, 2400)", tried: ["random(300, 500)"], change: large, effect: "smaller sphere: whole rounded sphere visible, centred, black border around it"}
  - {name: paletteWrap, default: 9, tried: [3], change: large, effect: "fewer palette cycles: white/gray tones disappear, surface becomes a yellow/dark-teal duotone"}
  - {name: det, default: "random(1)*random(1)", tried: ["random(1)*random(1)*3"], change: large, effect: "finer noise: smaller colour patches, more white/gray mixed in, same overall look"}
  - {name: fov, default: "PI/random(1.1, 3)", tried: ["PI/random(1.1, 1.8)"], change: large, effect: "narrower fov range: strong head-on pinwheel view, cells converging to a central vortex"}
  - {name: meshSphere, signature: "meshSphere(M, N, size, det, des, colorFn) -> void", note: "spherical lat/lon grid of quads, per-quad fill from a 3-D noise lookup"}
  - {name: getColor, signature: "getColor(v, colors[]) -> color", note: "wrapping lerp between adjacent palette entries at noise value v"}
---

## What it draws
A tilted, strongly perspective-warped surface made of a dense grid of flat quadrilateral
cells, covering almost the entire 1280x720 frame. Each cell is filled with one flat colour
from a four-colour scheme: dark slate blue, dark teal, yellow, and off-white/gray, mixed in
a pixelated checker-like pattern with no visible strokes. The cells bulge and twist with the
perspective of a sphere, so the grid looks like a woven cloth seen at a grazing angle; the
near-black background (value 10) is only a thin border around the edges.

## How the code works
- `setup()` (L3-8): `size(1280,720,P3D)`, `smooth(8)`, `pixelDensity(2)` (unavailable on the
  headless display — warning in stderr), then `generate()`. `draw()` is empty, so the piece
  is static.
- `generate()` (L26-30) rolls a seed and calls `render()`; the harness forces the seed field
  to 42.
- `render()` (L32-59): `noiseSeed`/`randomSeed` (L34-35), `background(10)` (L37). A random
  perspective camera is built: `fov = PI/random(1.1,3)` (L39), camera distance from fov (L40-41).
  The scene is translated to centre (L42); a random sphere `size` in [600,2400] (L43) and a
  random offset translate (L44-47) push the sphere's centre off-axis; `rotateX(PI)` (L50) and
  a random `rotateZ` (L51) tilt it, so we look at the sphere from a grazing angle. Stroke is
  set (L53-54) but `noStroke()` at L56 is unconditional, so every cell is fill-only.
  `res = int(random(10, random(80,800)))` (L57) sets grid density; `meshSphere(res*2, res, size)` (L58).
- `meshSphere(M,N,s)` (L75-117): N latitude rows x M longitude columns. For each cell it
  computes the four sphere vertices (L87-101) scaled by `s`. The first `fill()` (L104, a
  noise-driven gray) is immediately overwritten by the second (L105):
  `fill(getColor(noise(...)*9))` — 3-D Perlin noise sampled at the cell's diagonal midpoint
  with a random `det` scale and `des` offset (L77-78), multiplied by 9 so the palette wraps
  several times. `getColor` (L64-72) lerps between adjacent entries of the 4-colour array
  `#303841 #2E4750 #F6C90E #F7F7F7` (L61). The x9 wrap is what produces the yellow/white/teal
  checker mixing.
- Randomness enters through: seed (harness-pinned), fov (L39), size (L43), offset (L44-47),
  rotateZ (L51), res (L57), det/des (L77-78).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| res_20_60 | `int res = int(random(10, random(80, 800)));` -> `int res = int(random(10, random(20, 60)));` | large (mean 0.2764, 0.727) | much coarser grid: a dozen or so large flat cells across the frame, same palette, clearly legible woven-cloth look | variants/res_20_60/frame_00001.png |
| size_300_500 | `float size = random(600, 2400);` -> `float size = random(300, 500);` | large (mean 0.286, 0.725) | whole sphere visible as a centred rounded disc with curved rim; black background fills the margins; grid cells smaller on screen but same density on the sphere | variants/size_300_500/frame_00001.png |
| palwrap_3 | `z1+z3)*det+des)*9));` -> `z1+z3)*det+des)*3));` | large (mean 0.2944, 0.869) | white and light-gray tones disappear; surface is a dense yellow / dark-teal duotone checker | variants/palwrap_3/frame_00001.png |
| det_3x | `float det = random(1)*random(1);` -> `float det = random(1)*random(1)*3;` | large (mean 0.2811, 0.743) | finer noise: smaller, more scattered colour patches with more white/gray mixed in; same overall character as baseline | variants/det_3x/frame_00001.png |
| fov_1.8 | `float fov = PI/random(1.1, 3);` -> `float fov = PI/random(1.1, 1.8);` | large (mean 0.2804, 0.741) | strong head-on pinwheel view: cells spiral into a dense central vortex, extreme perspective foreshortening | variants/fov_1.8/frame_00001.png |

## Modularisation notes
- `meshSphere` is a clean library candidate: parameterise M, N, size, noise scale/offset and
  the per-cell colour function (the dead first `fill` at L104 should be dropped).
- `getColor` (wrapping palette lerp) is a small generic helper worth extracting as-is.
- The camera block (random fov + off-centre translate + `rotateX(PI)` + random `rotateZ`)
  could become a `randomTiltedView()` helper.
- One-off art decisions: the 4-colour palette, the x9 noise multiplier, the res range, and
  the off-axis offset that crops the sphere.
