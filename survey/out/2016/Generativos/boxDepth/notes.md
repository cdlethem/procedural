---
sketch: 2016/Generativos/boxDepth
year: 2016
renderer: P3D
size: [640, 640]
libraries: []
deterministic: false
ms_first_frame: 1503
animated: true
techniques: [grid, noise-field, 3d-mesh, shader]
primitives: [shape, pgraphics]
palette:
  colors: ["#222831", "#393E46", "#FF5722", "#EEEEEE"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: colorRamp, signature: "colorRamp(colors, stops) -> getColor(p) -> color", note: "sorted lerp-between colour ramp (ColorRamp class, lines 132-172)"}
  - {name: noiseBoxGrid, signature: "noiseBoxGrid(count, cellSize, detail, exp, seed) -> box heights", note: "2-D noise sampled per grid cell, sharpened with pow, each cell a 3-D box (lines 92-106)"}
  - {name: postBlurVignette, signature: "postShader(radius, grainAmt, vignetteAmt)", note: "post shader: fixed-radius weighted blur + time-anim grain + radial vignette (data/post.glsl)"}
---

## What it draws
A tilted, perspective view looking down a field of square 3D boxes laid out on a dense
grid, like a voxel terrain from above at an angle. Most boxes are warm orange,
terracotta, peach and cream; a scattering of dark blue-grey and slate tiles breaks the
warmth up. A few boxes rise tall (columns) while most are low; the whole scene fades to
dark at the corners (vignette) and has a soft, slightly grainy, low-contrast finish.
The scene animates slowly: the field rotates a little and box heights drift, so
frame 60 shows a similar but shifted field.

## How the code works
`setup()` (boxDepth.pde:13-34) builds a local `ColorRamp` from the 4-colour `paleta`
(dark navy #222831 at 0.0, slate #393E46 at 0.2, orange #FF5722 at 0.5, off-white
#EEEEEE at 1.0), loads two shaders, and creates a P3D `depth` PGraphics used for a
depth pass.

`draw()` (36-53) regenerates the seed every 120 frames; each frame it renders the
scene twice (once into the depth PGraphics, once to the main canvas with lights),
then applies the `post` shader. `drawScene()` (71-107) is the core:
- Camera: translate to (width/2, 2*height/3, -200), then `rotateX` by a slowly
  oscillating value around PI*0.2 (line 83) and `rotateZ` by `random(TWO_PI)` plus a
  slow drift (line 85) — this is the tilted top-down angle.
- Two orbiting point lights, warm from one side, cool blue from the other
  (lines 74-75), which is why box faces read in two temperature groups.
- Grid: `cc=20` x `cc=20` cells of `tt=80` world units each (lines 88-90); the grid is
  centred by translating -cc/2*tt.
- Heights: per cell, 2-D Perlin noise sampled at (x*det, y*det) with `det=0.008` plus a
  slow time offset (lines 96-97); `h = pow(0.8+noi, 13.8)*1.2` (line 98) sharply
  compresses most heights to ~0 and lets only high-noise cells become tall columns.
- Colour: each box is filled with `cr.getColor(noi)` (line 100) — the same noise value
  drives height and colour, so tall peaks tend to be cream/orange and low areas
  blue-grey.
- Randomness: `randomSeed(seed)`/`noiseSeed(seed)` at the top of every frame (78-79)
  make the per-frame `random(TWO_PI)` rotation reproducible per seed, but the seed
  itself is re-randomised every 120 frames by `generate()` (114-116), which is why
  `deterministic` is false and the field re-rolls.
- Post shader (data/post.glsl): a fixed 7x7 weighted blur (the depth-driven radius is
  computed then overridden by `cc = 3`, line 38), 3% time-animated black grain, and a
  radial vignette darkening the corners (lines 54-55). The `mouse` and `tDepth`
  uniforms are set from Java but effectively unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Reusable**: the `ColorRamp` class is a clean, self-contained lerp-between ramp
  (generic, no Processing-specifics beyond `lerpColor`). `noiseBoxGrid` — count, cell
  size, noise detail, sharpening exponent, ramp — is a strong library candidate: a
  "noise-displaced box field". The post shader is a generic blur+grain+vignette pass.
- **One-off art decisions**: the specific 4-colour palette and stops; the
  `pow(0.8+noi, 13.8)` sharpening constant; the exact camera angle/oscillation
  constants; the two orbiting light colours/paths.
- **Clean parameter object**: `{count, cellSize, noiseDetail, heightExp, heightScale,
  palette (stops+colours), cameraAngle, rotationSpeed, lights, postBlurRadius,
  grain, vignette, seed, regenerateEvery}`.
