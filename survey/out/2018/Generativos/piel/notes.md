---
sketch: 2018/Generativos/piel
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1581
animated: false
techniques: [grid, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: boxGrid, signature: "boxGrid(count, boxSize, depthRatio, layerStep, tilt, camZ, palette) -> void", note: "3D grid of axis-aligned boxes, each cell offset, each face filled from a lerp palette"}
  - {name: box6, signature: "box6(w, h, d) -> void", note: "draw a centered box as 6 filled quads via beginShape/vertex"}
  - {name: lerpPalette, signature: "lerpPalette(int[] colors, float v) -> color", note: "lerp between adjacent palette entries by fractional part of v"}
---

## What it draws
Full-bleed monochrome pattern of stacked cubes seen at an oblique angle: near-white
faces separated by thin black hairlines that form a diagonal grid, with small solid
black squares at many of the intersections. Reads as a tessellation of 3D wireframe
blocks / a stylised skin texture (piel = skin).

## How the code works
`setup()` (piel.pde:3-8): `size(960, 960, P3D)`, `smooth(8)`, one `generate()` call;
`draw()` is empty, so the image is static (any key press regenerates with a new seed).

`generate()` (23-54):
- `background(0)` (24) — black background; this black is what shows through the
  hairlines.
- `randomSeed(seed)` (26), `ortho()` (28), scene translated to centre at `z = -1000`
  (30).
- One scene (32-54): fixed orientation `rotateY(HALF_PI)`, `rotateX(HALF_PI)`,
  `rotateZ(PI*0.25)` (34-36) plus a random extra tilt `rotateX(random(-2, 2))` (37).
- `cc = int(random(5, 300))` (39) sets grid density; box edge `ss = width*3/cc` (40);
  `dd = ss*cc*0.5` (41) recenters the grid; `amp = random(0.38, 0.44)` (43) is the
  box depth-to-width ratio.
- Double loop `j, i` over `cc*2` cells (45-52): each cell translated to
  `(ss*i-dd, ss*i-dd, j*ss*0.5-dd)` (48) — note the z position steps by half a cell
  per layer — and a `box(ss, ss, ss*amp)` (49) is drawn.
- `box(w, h, d)` (57-109) builds the box as 6 filled quads (`beginShape`/
  `vertex`/`endShape(CLOSE)`); every face is filled with
  `getColor(random(0.1)*frameCount)` (62 et seq.).
- `getColor(float v)` (142-148) lerps between `colors[int(v % 6)]` and the next
  palette entry by `v % 1`. At frame 1, `v < 0.1`, so every face sits between
  `#FFFFFF` and ~10% gray: near-white.
- The thin black lines and black corner dots are the black background (24) showing
  through sub-pixel gaps between adjacent projected quads (wider where several faces
  meet), softened by `smooth(8)`.

Dead code: `Rect` class (111-119), the 6-arg `box(x, y, z, w, h, d)` overload
(121-126), `rcol()` (136-138) are never used by `generate()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic / library-worthy:
  - `boxGrid`: a 3D grid of axis-aligned boxes with per-cell translation, a depth
    step per layer, and per-face lerp-palette fills. Parameter object:
    `{count, boxSize, depthRatio (amp), layerStep (j*ss*0.5), tilt (rotateX random),
    camZ (-1000), palette, colorScale (0.1*frameCount)}`.
  - `box6(w, h, d)`: centered box as 6 quads — reusable 3D primitive.
  - `lerpPalette(colors, v)`: palette sampler with fractional lerp.
- One-off art decisions: the fixed rotateY/X/Z sequence, the random tilt range
  (-2, 2), the half-cell z step, the white/black palette with a black background
  (the hairline look depends on background bleeding through gaps, not on strokes),
  and the `amp` range 0.38-0.44.
- Note the look is emergent: no strokes are drawn at all; the "wireframe" is
  background showing through floating-point gaps between faces.
