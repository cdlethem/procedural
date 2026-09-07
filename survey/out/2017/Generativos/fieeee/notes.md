---
sketch: 2017/Generativos/fieeee
year: 2017
renderer: P3D
size: [1280, 720]
libraries: []
deterministic: true
ms_first_frame: 3377
animated: false
techniques: [grid, polar, 3d-mesh, symmetry]
primitives: [rect, ellipse, shape, image, pgraphics]
palette:
  colors: ["#F05638", "#F5C748", "#3FD189", "#FFB9DB", "#AF8AB4", "#6FC4EA", "#FFFFFF", "#412A50"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: size, default: 2048, tried: [512], change: large, effect: "coarser blocky texture; central tunnel becomes a large smooth wavy sheet"}
  - {name: sub, default: "random(8,20)", tried: [16], change: large, effect: "wider cells; corridor structure preserved, stripes slightly coarser"}
  - {name: h, default: "random(80,300)", tried: [300], change: large, effect: "closer view: undulating striped surface fills frame, tunnel whorls large, no longer reads as corridor"}
  - {name: res, default: 80, tried: [24], change: large, effect: "tube rings become coarse polygonal facets; floor turns to large flat color facets"}
  - {name: s2, default: "s1*random(0.04,0.3)", tried: ["s1*0.5"], change: large, effect: "wider waist: fine stripes become smooth wide radial bands"}
reusable_candidates:
  - {name: getColor, signature: "getColor(v) -> Color", note: "lerp between adjacent entries of a fixed palette array by fractional part of v"}
  - {name: colum, signature: "colum(s1, s2, h, res)", note: "cosine-profiled 3D tube: rings of quads from radius s1 (waist s2) over height 2h"}
---

## What it draws

A full-bleed, one-point-perspective corridor seen from slightly above: a wide floor of
broad radial stripes in orange, green, sky-blue, mauve and cream, converging to a small
vanishing region, with a wavy striped "tunnel" (a series of nested undulating rings)
running down the middle. The stripes are not straight; they ripple and twist as they
approach the center, producing a psychedelic, folded-hallway look. The whole image is
built from the same 2D texture mirrored onto two perpendicular planes.

## How the code works

`setup()` (line 4) calls `generate()` once; `draw()` is empty, so the sketch is static
(only the seed-42 baseline frame exists). `generate()` (line 26) picks a fresh random
seed and calls `render()`.

`render()` (line 32):
- Seeds noise and random (lines 35-36), fills the background with one palette color
  (line 38), sets a perspective camera with random FOV `PI/random(1.1, 3)` (line 40),
  centers the origin and applies a random `rotateZ` (lines 43-44) — this random yaw
  is why the stripe orientation varies.
- Builds an offscreen `PGraphics` texture of `size` x `size` (default 2048, line 50)
  divided into a `sub` x `sub` grid (`sub` = random 8..20, line 47). First pass paints
  every cell a random lerped palette color (`getColor`, line 107: lerp between adjacent
  palette entries, so every color is a blend from the 8-color list at line 104).
- Second pass (line 65) places `sub^1.8` "columns": each calls `colum()` (line 120)
  with 3D vertices, but inside `texture.beginDraw()/endDraw()` (lines 53-88) on a 2D
  PGraphics, so the z coordinate is ignored and the tube is flattened. Its cosine-
  profiled rings (`abs(cos(...))` between max radius `s1` and thin waist `s2`) become
  nested wavy horizontal bands with a random per-quad palette fill — this flattened
  tube pattern is the "tunnel" motif visible in the texture.
- In the same loop each column's cell also gets a red ellipse (line 80) and a stack of
  `sb` concentric ellipses in shrinking random palette colors (lines 82-86) — these
  are the small radial "eye" targets visible in the image.
- Finally the texture is blitted twice: once rotated `HALF_PI` around X and moved up
  (`translate(0,-h,0)`, lines 92-94) and once down (lines 97-101). The two perpendicular
  planes form the floor and back-wall of the corridor; perspective + the random yaw
  turn the flat grid of cells into converging rippled stripe bands, and the flattened
  tube/ellipse motifs warp into the central tunnel.

Randomness enters at: seed (line 27), background color (38), FOV (40), yaw (44),
`sub` (47), `h` (48), per-cell texture colors (58), column count (65), per-column size
(68-72), per-quad tube color (130), ellipse ring colors (84).

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| size_512 | `int size = 2048;` -> `int size = 512;` | large (0.392, 94%) | coarser, blockier texture: stripes are wider and blurrier, cell edges visible, central tunnel reads as one large smooth wavy sheet of broad color bands | variants/size_512/frame_00001.png |
| sub_16 | `int sub = int(random(8, 20));` -> `int sub = 16;` | large (0.237, 90%) | same corridor composition as baseline (striped floor + central rippled tunnel, orange/green/blue); cells and stripe bands a bit wider, tunnel whorls fewer and larger | variants/sub_16/frame_00001.png |
| h_300 | `float h = random(80, 300);` -> `float h = 300;` | large (0.232, 84%) | much closer viewpoint: a close-up of the undulating striped surface filling the whole frame, two tunnel whorls (top-center and center) with dense radial stripes, large flat color patches at the edges; no longer reads as a corridor | variants/h_300/frame_00001.png |
| res_24 | `colum(s1, s2, h, 80);` -> `colum(s1, s2, h, 24);` | large (0.226, 81%) | tube rings flatten into coarse polygonal arcs: the floor becomes large flat polygonal color facets with hard edges, and the center becomes a thin, densely-striped vertical tube with small dark dots | variants/res_24/frame_00001.png |
| s2_0.5 | `float s2 = s1*random(0.04, 0.3);` -> `float s2 = s1*0.5;` | large (0.229, 87%) | tube waist widened (half the max radius instead of a thin line): the fine dense stripes become smooth, wide radial color bands; the image reads as a folded X of broad converging stripes | variants/s2_0.5/frame_00001.png |

## Modularisation notes

- `getColor` (line 107) is a clean, generic palette-lerp helper; keep as-is.
- `colum` (line 120) is a reusable "cosine-profile tube" mesh generator (parameters:
  waist radius, max radius, half-height, radial resolution); generic.
- The offscreen texture (grid of palette cells + per-cell decoration) is a reusable
  "cell texture with per-cell motif" block.
- One-off art decisions: the two mirrored-plane blit forming the corridor, the random
  FOV/yaw, the specific 8-color palette.
- A clean parameter object: `{seed, palette, texSize, sub, columnCount, columnH,
  tubeRes, waistFactor, fov, yaw}`.
