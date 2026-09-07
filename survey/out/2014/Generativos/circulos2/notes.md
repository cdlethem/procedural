---
sketch: 2014/Generativos/circulos2
year: 2014
renderer: P3D
size: [640, 360]
libraries: []
deterministic: true
ms_first_frame: 1940
animated: false
techniques: [3d-mesh, dots-stippling, curves]
primitives: [shape, ellipse, pixels]
palette:
  colors: ["#F73F09", "#004D51", "#008280", "#00B9B5", "#F2F2EB"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cubeCount, default: 40, tried: [12], change: large, effect: "much sparser scene: mostly teal background, only a few large white slabs with sparse circles"}
  - {name: scale, default: 90, tried: [40], change: moderate, effect: "smaller cubes; positions also compress toward the cluster (translate divides by hardcoded 90) so plates read bolder and more crowded on the right"}
  - {name: nDots, default: 22, tried: [60], change: moderate, effect: "each plate is visibly more covered in fine stipple speckles"}
  - {name: nCircles, default: 8, tried: [3], change: moderate, effect: "fewer, more separated open circles per face; plates look cleaner and less busy"}
  - {name: ringStrokeWeight, default: "3-8", tried: ["3-16"], change: subtle, effect: "no visible change; circle strokes look the same weight as baseline"}
reusable_candidates:
  - {name: stickerTexture, signature: "stickerTexture(w, h, baseColor, palette, nDots, nCircles) -> PGraphics", note: "grained off-white plate with random palette dots + overlapping stroked circles; per-face texture generator"}
  - {name: texturedCube, signature: "texturedCube(x, y, z, faceTexture) -> void", note: "six textured unit quads in a pushMatrix scope, positioned in pixel units under a scaled global transform"}
---

## What it draws
A teal (#008280) background with a dense cluster of off-white cubes floating in 3D,
rotated ~45° on both X and Y so corners and two or three faces of each are visible.
Every cube face carries the same kind of hand-printed pattern: a speckled off-white
plate scattered with tiny dots and several overlapping open circles stroked in
orange-red, dark teal, and bright teal. The cubes overlap into one mass filling the
centre and right of the frame; the teal background shows only in the gaps.

## How the code works
- `setup()` (L7-21): 640x360 P3D window; 4-colour palette (L11-14: #F73F09, #004D51,
  #008280, #00B9B5); creates 40 `Cubo` objects at random positions x∈[0,640],
  y∈[0,360], z∈[0,1000] (L18-20).
- `draw()` (L23-36): background #008280 (L24); global transform
  `translate(w/2, h/2, -100); rotateX(PI/4); rotateY(PI/4); scale(90)` (L27-30);
  each cube drawn inside its own `pushMatrix/popMatrix`.
- `Cubo.dibujar()` (L53-97): translates to `(x/90, y/90, z/90)` — dividing by the
  global scale factor 90 so positions stay in pixel units — then emits six
  textured unit quads (±1), giving ~180 px cubes.
- Face texture, `crearCuadrito()` (L117-141): each face is a fresh 200x200
  `PGraphics`. Base plate from `crearTexturilla()` (L106-114): #F2F2EB per-pixel
  lerped 3% toward a random grey (subtle grain, `pixels[]` ops). Then 22 small
  filled dots, diameter 0.5-2, at random positions in a random palette colour
  (L125-129). Then 8 open circles, diameter 30-160, centred at a random angle and
  distance 30-120 from (80,80), stroke weight 3-8, random palette colour
  (L131-138).
- Randomness enters at: cube positions (L19), texture grain (L110), dot
  position/size/colour (L126-128), circle parameters (L132-136). Seeded, so the
  scene is deterministic.
- `mouseDragged()` (L100-104) would rotate the view interactively; not exercised
  in the headless render.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cubes_12 | `for (int i = 0; i < 40; i++) {` -> `i < 12` | large | much sparser: mostly teal background with a few large white slabs carrying sparse circles | variants/cubes_12/frame_00001.png |
| scale_40 | `scale(90);` -> `scale(40);` | moderate | smaller cubes; positions also compress (translate /90 unchanged) so the cluster crowds to the right and plates read bolder | variants/scale_40/frame_00001.png |
| dots_60 | `for (int i = 0; i < 22; i++) {` -> `i < 60` | moderate | plates visibly more covered in fine stipple speckles | variants/dots_60/frame_00001.png |
| circles_3 | `for (int i = 0; i < 8; i++) {` -> `i < 3` | moderate | fewer, more separated open circles per face; plates look cleaner | variants/circles_3/frame_00001.png |
| stroke_16 | `aux.strokeWeight(random(3, 8));` -> `random(3, 16)` | subtle | no visible change; circle strokes look the same weight as baseline | variants/stroke_16/frame_00001.png |

## Modularisation notes
- `crearCuadrito`/`crearTexturilla` are the generic core: a "sticker plate" texture
  generator (grained base + stippled dots + random stroked circles over a palette).
  Clean signature: `stickerTexture(w, h, baseColor, palette, nDots, nCircles) -> PGraphics`.
  Counts (22 dots, 8 circles), dot/circle size ranges and stroke weight range are
  the knobs; all experiments above map directly onto it.
- The cube assembly (six textured unit quads) is a small generic helper:
  `texturedCube(x, y, z, faceTexture)` under a pushMatrix scope.
- One-off art decisions: the 4-colour palette, the /90 position compensation tied
  to `scale(90)` (changing scale also moves positions — a coupling worth fixing in
  a library version by passing size explicitly), the (80,80) circle anchor offset,
  PI/4 initial rotation, 40-cube count, z spread 0-1000.
- A clean parameter object: `{ cubeCount, scale, rotationX, rotationY, zSpread,
  plate: { baseColor, grain, nDots, dotSize, nCircles, ringRadius, ringWeight, palette } }`.
