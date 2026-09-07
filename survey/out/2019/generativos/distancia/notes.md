---
sketch: 2019/generativos/distancia
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate, peasy]
deterministic: true
ms_first_frame: 1562
animated: false
techniques: [subdivision, grid, 3d-mesh]
primitives: [ellipse, rect, shape]
palette:
  colors: ["#C9AF9B", "#FFE632", "#0A1478", "#DCE6F0", "#FFFFFF", "#F20707", "#FCCE4A", "#D0DFE8", "#F49FAE", "#342EE8"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: sub, default: 2000, tried: [4000], change: moderate, effect: "finer, denser mosaic: the same large plates get subdivided further, smaller squares, denser grid"}
  - {name: dotCount, default: 1000, tried: [3000], change: moderate, effect: "extra random() draws shift the quadtree's random stream, so the whole layout re-randomises; the yellow dots themselves stay hidden under the rects"}
  - {name: dotSize, default: 4, tried: [12], change: none, effect: "no visible change: dots are covered by the leaf rects"}
  - {name: shadowAlpha, default: 90, tried: [200], change: moderate, effect: "the offset dark-blue shadow underlayer becomes much darker, grid reads as strong navy lines"}
  - {name: boxScale, default: 0.1, tried: [0.3], change: none, effect: "no visible change: boxes stay subpixel at leaf sizes (mean 0.0)"}
  - {name: fov, default: "PI/random(2,3)", tried: ["PI/random(1.2,1.6)"], change: large, effect: "wider FOV projects the whole plane smaller with stronger perspective; tan margin appears around the tilted mosaic"}
reusable_candidates:
  - {name: randomQuadtree, signature: "randomQuadtree(seed, splits, w, h) -> Rect[]", note: "repeatedly picks a random live rect and replaces it with its 4 quadrants; leaves form a multi-scale mosaic"}
  - {name: mosaicRects, signature: "mosaicRects(rects, fill, inset, dotSize) -> void", note: "draws each leaf rect with a tinted underlay, an inset top face, and a center dot"}
---

## What it draws
A full-bleed mosaic of light blue squares of wildly different sizes on a warm tan
background, slightly tilted in 3D (a few degrees of rotateX/rotateY, P3D perspective).
Each square has a dark blue-grey shadow edge, a faintly inset top face, and a small white
dot near its center; small 3D boxes pop up on some squares. In the gaps between square
clusters, hundreds of small yellow dots are visible on the tan ground.

## How the code works
`setup()` (line 23) creates a `PeasyCam` at distance 400 (unused for the camera — the
camera is set per-frame in `generate()`), then calls `generate()`. `draw()` also calls
`generate()` every frame, but `generate()` re-seeds with the fixed `seed` (lines 63-64),
so the image is static (baseline frames 10/60 are byte-identical to frame 1).

`generate()` (line 58):
1. Disables depth test/mask (lines 60-61) so everything draws in call order regardless of z.
2. Sets a random perspective FOV `PI/random(2,3)` (line 67) and tilts the whole plane by
   `rotateX/rotateY` of up to ±0.1·PI (lines 77-78) — the source of the slight 3D skew.
3. Background `#C9AF9B` (line 72).
4. Scatters 1000 random yellow ellipses (`fill(255,230,50)`, size `random(4)`) across the
   canvas (lines 80-86) — the yellow specks seen in the gaps.
5. Builds a random quadtree (lines 88-105): starts from one full-canvas `Rect`, then
   2000 times picks a pseudo-random index biased toward the middle of the list
   (`int(random(size*0.2, size*random(1))*0.1)`, line 92), splits that rect into 4
   quadrants, and removes it. Later picks tend to hit smaller rects, so subdivision
   fine grids.
6. First draw pass (lines 107-114): `fill(10,20,120,90)` — semi-transparent dark blue
   rects drawn at `r.x+10, r.y+10` with full size; the 10px offset + transparency makes
   the dark shadow edge visible on the right/bottom of each square.
7. Second pass (lines 116-129): for each leaf rect, draws the light blue top face
   `fill(220,230,240)` inset by 2px, pushes a matrix, moves 0.05·w in z and draws a
   `box(r.w*0.1)` (a small 3D cube on each square, mostly subpixel at small sizes),
   then a 4×4 white center dot.
The `colors[]` palette (line 140) and `rcol()`/`getColor()` are commented out of the
draw calls — the active fills are all fixed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_4000 | `int sub = 2000;` -> `int sub = 4000;` | moderate (0.0976, 32.7% px) | same layout, finer: more small squares, denser dark grid, large plates subdivided further | variants/sub_4000/frame_00001.png |
| dots_3000 | `for (int i = 0; i < 1000; i++) {` -> `... i < 3000 ...` | moderate (0.0945, 33.6% px) | entirely different mosaic layout (extra random() draws shift the quadtree's stream); yellow dots still only visible in the gaps | variants/dots_3000/frame_00001.png |
| dotsize_12 | `float s = random(4);` -> `float s = random(12);` | none (0.0022, 1.0% px) | no visible change | variants/dotsize_12/frame_00001.png |
| alpha_200 | `fill(10, 20, 120, 90);` -> `fill(10, 20, 120, 200);` | moderate (0.0633, 27.9% px) | identical layout; the offset shadow underlayer is much darker, so the mosaic reads as a strong navy grid | variants/alpha_200/frame_00001.png |
| box_0.3 | `box(r.w*0.1);` -> `box(r.w*0.3);` | none (0.0, 0.0% px) | no visible change; the 3D boxes are subpixel at these leaf sizes | variants/box_0.3/frame_00001.png |
| fov_wide | `float fov = PI/random(2, 3);` -> `PI/random(1.2, 1.6);` | large (0.1562, 71.1% px) | same layout projected smaller with stronger perspective; tan background visible around the tilted mosaic, which now looks like a small tilted card | variants/fov_wide/frame_00001.png |

## Modularisation notes
- **Generic**: the random-quadtree builder (lines 88-105) is a clean, parameterised
  algorithm — `randomQuadtree(seed, splits, w, h)` returning the leaf rects; the
  index-bias expression on line 92 is the interesting knob (controls the size
  distribution of leaves). The two-pass mosaic draw (shadow underlay + inset face +
  center dot, lines 107-129) is also reusable as `mosaicRects(rects, ...)`.
- **One-off art decisions**: the tan background, the yellow dot scatter, the specific
  blue fills, the 3D box on each leaf, the perspective tilt. The `colors[]`/`rcol()`/
  `getColor()` helpers (lines 138-153) are dead code here but a ready-made
  palette-sampling utility.
- **Parameter object**: `{seed, splits (2000), indexBias (the 0.2/0.1 constants),
  dotCount (1000), dotSize (4), shadowColor+alpha, faceColor, boxScale (0.1), tilt
  (0.1), fovRange (2,3)}`.
