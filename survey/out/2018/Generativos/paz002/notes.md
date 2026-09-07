---
sketch: 2018/Generativos/paz002
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1648
animated: false
techniques: [shader, 3d-mesh, 3d-pointcloud]
primitives: [line, shape]
palette:
  colors: ["#000000", "#F0F0F0"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: "random(150,190)", tried: ["random(40,70)"], change: large, effect: "fewer large boxes: sparse black shapes on a mostly white ground instead of the dense black field"}
  - {name: boxSize, default: 80, tried: [240], change: large, effect: "3x box size: black coverage fills the canvas, image becomes almost entirely black"}
  - {name: spokeLen, default: 120, tried: [320], change: subtle, effect: "spoke lines reach a bit farther past the box faces; composition otherwise unchanged"}
  - {name: midCubeCount, default: 800, tried: [2400], change: subtle, effect: "slightly denser scatter of mid-size black/white cubes; composition otherwise unchanged"}
  - {name: smallCubeCount, default: 1200, tried: [4000], change: none, effect: "no visible change (size-2 boxes are near sub-pixel; grain is dominated by the shader)"}
reusable_candidates:
  - {name: scatterBoxes, signature: "scatterBoxes(count, boxSize, extent, colors) -> void", note: "place N boxes at random points in a cube with random XYZ rotation and a per-box fill colour"}
  - {name: axisSpikes, signature: "axisSpikes(len, step) -> void", note: "draw 3 full axis lines plus short offset stub lines along them through the origin (the 'sputnik' wire look)"}
  - {name: vignetteBlurGrain, signature: "PShader post.glsl (blurMix, vignettePow, grainAmount, gammaR/G/B)", note: "post filter: 3x3 blur mix + radial vignette with edge saturation + per-pixel grain + per-channel gamma (warm cast)"}
---

## What it draws
The canvas is dominated by black: the faces of the large rotated boxes merge into one dense dark
mass, pierced by patches of the near-white background, thin straight lines radiating from the boxes
like spokes, and a scatter of small solid black and white cubes in two sizes. Everything has
slightly soft edges and a fine grain, the corners fall off to pure black in a strong vignette, and
the white areas have a warm cream tint rather than pure white.

## How the code works
`setup()` loads `data/post.glsl` and calls `generate()` once; `draw()` is empty (a still image, regenerated on key
press, paz002.pde:15-29). `generate()` (paz002.pde:41-103):

- `randomSeed(seed)` then `background(240)` (near-white), and the origin is translated to a random point inside the
  central 60% of the canvas (line 47) — this is the only transform; there is no camera.
- Pass 1 (lines 52-75): `cc = random(150,190)` large boxes. Each is translated to a random point in a ±500 cube,
  rotated randomly about X/Y/Z, drawn as a `box(80)` with `fill(0)`. On top of each box, `len = 120`: for
  `k = -len..len step 10` four short `line()`s poke out from each axis with a tiny sinusoidal offset
  (`amp = 2*(1-cos(k)*0.1)`, lines 64-70), plus three full-length axis lines along x, y, z (lines 71-73) — the
  spoked/sputnik look.
- Pass 2 (lines 78-87): 800 boxes of size 10, each `fill(0)` or `fill(240)` with 50/50 `random(1) < 0.5`, same
  random placement/rotation → the medium specks (black dots and small white islands).
- Pass 3 (lines 89-98): 1200 boxes of size 2, same black/white 50/50 rule → the fine grain of tiny cubes.
- Post (lines 100-102): `filter(post)`. The shader (data/post.glsl) mixes the scene 80% with a 3x3 Gaussian-style
  blur (line 65), computes a radial falloff `dis = 1 - pow(dist(st, 0.5), 2.4)*0.5` (line 67) that it multiplies
  into the final colour (vignette) and feeds into a saturation boost that grows toward the edges
  (`csb(sum, 1.2, 1.1+(1-dis)*2.6, 1.0)*dis`, line 72), adds 2% per-pixel noise `rand(st*200)` (line 71), and
  applies per-channel gamma `g^1.2, b^1.4` (lines 74-76) which warms the white to cream.

Colours are only black (0) and near-white (240) chosen per box; the final palette comes from the shader.
`colors[]`, `rcol()`, `getColor()`, `arc2/arc3`, `lineDashed` and the `Rect` class are dead code, never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_50 | `int cc = int(random(150, 190));` -> `int cc = int(random(40, 70));` | large | sparse: ~50 black box masses with their spokes floating on a mostly white ground; the dense black field of the baseline is gone | variants/cc_50/frame_00001.png |
| box80_240 | `box(80);` -> `box(240);` | large | almost entirely black: the 3x boxes merge into one dark mass; only small white cube faces and thin lines remain visible | variants/box80_240/frame_00001.png |
| len_320 | `float len = 120;` -> `float len = 320;` | subtle | same composition; the thin spoke lines reach slightly farther past the box faces | variants/len_320/frame_00001.png |
| midCubes_2400 | `for (int i = 0; i < 800; i++) {` -> `for (int i = 0; i < 2400; i++) {` | subtle | same composition; slightly denser scatter of small black/white cubes | variants/midCubes_2400/frame_00001.png |
| smallCubes_4000 | `for (int i = 0; i < 1200; i++) {` -> `for (int i = 0; i < 4000; i++) {` | none | no visible change vs baseline | variants/smallCubes_4000/frame_00001.png |

## Modularisation notes
- Generic: `scatterBoxes` (both the large-box and speck passes are the same loop with different count/size),
  `axisSpikes` (the per-box spoke drawing, independent of box size), and the whole post shader as a
  `vignetteBlurGrain` parameter object (blur mix, vignette power, grain amount, per-channel gamma).
- One-off art decisions: the 50/50 black/white fill rule, the ±500 extent, the origin jitter (0.2–0.8 of canvas),
  the specific box sizes 80/10/2 and counts ~170/800/1200, and the warm gamma curve.
- Clean parameter object: `{boxCount, boxSize, extent, spokeLen, spokeStep, midCount, midSize, dustCount, dustSize,
  fillColors, blurMix, vignettePower, grain, gamma:[r,g,b]}`.
