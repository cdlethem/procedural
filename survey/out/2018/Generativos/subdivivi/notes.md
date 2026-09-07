---
sketch: 2018/Generativos/subdivivi
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1978
animated: false
techniques: [subdivision, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(20, 1000))", tried: [100, 600], change: large, effect: "fewer splits = few larger boxes with open white space; more splits = uniform field of small boxes"}
  - {name: size, default: 5, tried: [10], change: large, effect: "bigger scene fills the frame with more boxes at similar apparent scale, less open space"}
  - {name: divDivisor, default: 8, tried: [16], change: large, effect: "halved line density: sparser radial lines, smaller dark cores, airier image"}
  - {name: ma, default: "PI*0.1", tried: ["PI*0.4"], change: large, effect: "stronger tilt: a few huge boxes dominate, big black masses, dramatic vanishing point"}
  - {name: fov, default: "PI/random(1.1, 3)", tried: ["PI/1.2"], change: large, effect: "wide-angle lens: heavy edge distortion, enlarged boxes near frame edges, thick dark bands"}
reusable_candidates:
  - {name: stochasticQuadtree, signature: "stochasticQuadtree(bounds, splits) -> rect[]", note: "replace a random rect with 4 half-size children, repeated N times"}
  - {name: segmentedBox, signature: "segmentedBox(x, y, size, height, segs) -> mesh", note: "pyramid roof from face center + segmented side quads for one square footprint"}
---

## What it draws
A full-bleed, dense black-and-white 3D line drawing. A scene of many small boxes sits on an
invisible ground plane, viewed in perspective at a slight tilt: each box reads as a tight
radial starburst of fine black lines (its pyramid roof seen through dense side-wall segments),
and where several boxes line up the overlapping strokes merge into wide dark diagonal bands
and near-black clumps. White background, no colour anywhere.

## How the code works
`setup()` (subdivivi.pde:3-8) sizes the P3D canvas 960x960 with `smooth(32)` and calls
`generate()` once; `draw()` (10-13) is empty, so the sketch is static (regeneration only via
keypress).

`generate()` (23-91):
- White background, `randomSeed(seed)` (24-25).
- Camera: random `fov = PI/random(1.1, 3)` (27), `perspective(...)` (29), translate to canvas
  center at `z=-400` (31), small random rotations `±PI*0.1` on all three axes (32-35). This
  tilt is why boxes form diagonal dark bands instead of a flat grid.
- Subdivision (37-50): start with one rect spanning a `size = 5` scene (4800x4800 units, depth
  4800). Repeat `sub = int(random(20, 1000))` times: pick a random rect from the list, remove
  it, add 4 children of half size and half depth (44-49) — a stochastic quadtree of squares
  carrying a depth value `z`.
- Rendering (53-90): for each surviving rect, `hh = r.z` is the box height and
  `div = int(r.z/8)` (58) the number of edge segments. The box is built from two primitives
  per segment per side: a triangle from the face center `(cx, cy, hh*0.5)` to a top-edge pair
  (the pyramid roof, 76-80) and a quad from the ground to the top edge (side wall, 82-87).
  `fill(255)`, `stroke(0)` (63-64) — the dense per-box triangles are what produce the
  starburst look.
- Randomness enters only through `randomSeed(seed)`: fov, the three rotations, and every
  subdivision pick. The 12-colour `colors[]` array and `getColor()`/`lerpColor` (98-111) are
  defined but never called — the piece is monochrome.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_100 | `int sub = int(random(20, 1000));` -> `int sub = 100;` | large | coarse: few big boxes, large starburst cores, lots of open white space with sparse straight hatching | variants/sub_100/frame_00001.png |
| sub_600 | `int sub = int(random(20, 1000));` -> `int sub = 600;` | large | fine: many small boxes in a uniform dense field, thinner dark bands | variants/sub_600/frame_00001.png |
| size_10 | `float size = 5;` -> `float size = 10;` | large | 2x scene: frame filled with more boxes at similar apparent scale, less open white space | variants/size_10/frame_00001.png |
| div_16 | `int div = int(r.z/8);//int(random(2, 12));` -> `int div = int(r.z/16);` | large | halved line density: individual radial lines visible, smaller dark cores, airier overall | variants/div_16/frame_00001.png |
| ma_0.4PI | `float ma = PI*0.1;` -> `float ma = PI*0.4;` | large | strong tilt: a few huge boxes dominate the frame, large solid black masses, strong perspective convergence | variants/ma_0.4PI/frame_00001.png |
| fov_1.2 | `float fov = PI/random(1.1, 3);` -> `float fov = PI/1.2;` | large | wide-angle lens: heavy edge distortion, boxes near frame edges greatly enlarged, thick dark diagonal bands | variants/fov_1.2/frame_00001.png |

## Modularisation notes
Generic and reusable: (1) the stochastic quadtree — "N times: take a random leaf square,
replace it by 4 children of half size/depth" — is a clean library function
`stochasticQuadtree(bounds, splits)` returning leaves with a size/depth attribute; (2)
`segmentedBox(footprint, height, segs)` — pyramid roof + segmented side walls for a square
footprint — is a standalone mesh generator. One-off art decisions: the random perspective
(fov range, `z=-400`, `±PI*0.1` tilt), the `size = 5` scene scale, and the `div = r.z/8`
line-density rule (denser lines for taller boxes). The unused 12-colour palette is a dead
art decision. A clean parameter object: `{splits, sceneScale, maxTilt, segDivisor,
fovRange: [lo, hi], cameraZ}`.
