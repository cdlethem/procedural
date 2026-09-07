---
sketch: 2017/Generativos/subBox
year: 2017
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1571
animated: false
techniques: [subdivision, recursion, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#ECEAA4", "#6D1E0A", "#EF402C", "#004500", "#C7E969", "#000000"]
  selection: lerp-between
composition: radial
parameters:
  - {name: sub, default: "random(2000, 6000)", tried: ["random(12000, 15000)"], change: large, effect: "more iterations = far denser tunnel; tiny boxes and wireframes fill almost every region"}
  - {name: wireframeProb, default: 0.4, tried: [0.8], change: large, effect: "mostly wireframe boxes; thin red/green/cream outlines replace solid faces, lattice look"}
  - {name: startZ, default: "width*4", tried: ["width*8"], change: large, effect: "same fractal shifted one subdivision level: different large planes frame the view, mid-size boxes look a size category larger"}
  - {name: pickBias, default: "random(0.5, 1)", tried: ["random(0.8, 1)"], change: large, effect: "biasing picks toward smaller boxes leaves big boxes unsplit: lopsided composition with a dense mass in one corner and large flat dark planes elsewhere"}
  - {name: strokeWeight, default: "random(1, 3)", tried: ["random(4, 10)"], change: subtle, effect: "no visible change beyond slightly thicker wireframe lines"}
  - {name: palette, default: "6 earthy colors", tried: ["6 cool blue/slate colors"], change: moderate, effect: "identical geometry recoloured blue/slate/teal/white/black; structure unchanged, only hue family"}
reusable_candidates:
  - {name: quadSubdivide, signature: "quadSubdivide(startZ, iterations, indexBias) -> PVector[]", note: "replace one box with 4 half-size quadrant boxes, biased pick of parent index"}
  - {name: lerpPalette, signature: "getColor(float v, int[] colors) -> int", note: "sample palette as continuous lerp between adjacent entries"}
---

## What it draws
A first-person view from inside a fractal tunnel of boxes (seed 42). Huge flat
coloured planes (the inner faces of the largest boxes) frame the image in reds,
dark green, olive, tan and cream; toward the centre the boxes shrink in nested
quadrant rings, converging into a dense pixel-level cluster of tiny red, green,
black and cream squares. Roughly a third of the boxes are drawn as thin
wireframe outlines only (red, green, cream lines), the rest as flat filled
faces. The overall palette is earthy: bright red, maroon, olive/dark green,
pale lime-yellow, tan, black.

## How the code works
Single tab `subBox.pde`. `setup()` (l.3-8) opens a 960x960 P3D window and calls
`generate()` once; `draw()` is empty, so the piece is static.

- `generate()` (l.24-91) calls `lights()`, re-rolls the seed (l.27), and picks
  the background from the same lerped palette with double the index range
  (l.28). The camera is translated to the centre with z offset `width*0.75`
  (l.29) and a wide perspective (`fov = PI/1.25`, l.31-34).
- Subdivision (l.36-49): starts with one "quad" at (0,0,width*4). Each of
  `sub = random(2000,6000)` iterations (l.39) picks a parent index biased
  toward the start of the list — `int(random(quads.size())*random(0.5,1))`
  (l.41) — i.e. older, larger boxes, splits it into 4 children placed at the
  four quadrants of its footprint (±q.z/4 in x and y) each with half the z
  extent (l.43-47), and removes the parent (l.48). So the structure is a
  recursive quadrant subdivision; every box's near face sits at local
  z = -width/2 while its far face is at z = q.z - width/2 (l.56, l.66-67), so
  boxes with q.z > width/2 engulf the camera (only their inner face is
  visible) and smaller boxes appear as complete cubes receding into the
  centre.
- Drawing (l.53-69): for each remaining box, with 40% probability (l.58) draw
  it as a stroked wireframe (`strokeWeight(random(1,3))`, l.60) and with 60%
  probability as a flat filled cube (`box(q.z)`, l.67). Colour comes from
  `getColor(random(colors.length))` (l.61, l.64), which lerps between two
  adjacent entries of the 6-colour palette (l.94, l.98-103) — so colours are
  not just the 6 base values but continuous blends along the palette.
- The 2D rect version (l.72-90) is commented out.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_12000 | `int sub = int(random(2000, 6000));` -> `int sub = int(random(12000, 15000));` | large | far denser, busier tunnel: tiny boxes and wireframes fill nearly every region, central cluster packed, large framing planes still visible | variants/sub_12000/frame_00001.png |
| wireProb_0.8 | `if (random(1) < 0.4) {` -> `if (random(1) < 0.8) {` | large | mostly wireframe boxes: thin red/green/cream outlines dominate, sparse solid faces, lattice-like look | variants/wireProb_0.8/frame_00001.png |
| startZ_w8 | `quads.add(new PVector(0, 0, width*4));` -> `width*8` | large | same fractal shifted one subdivision level: different large planes frame the view (big tan plane centre-right, green left), mid-size boxes a size category larger | variants/startZ_w8/frame_00001.png |
| pickBias_0.8 | `int ind = int(random(quads.size())*random(0.5, 1));` -> `...random(0.8, 1));` | large | lopsided composition: dense fractal mass in upper-left, large flat black/olive planes in lower-right — big boxes left unsplit | variants/pickBias_0.8/frame_00001.png |
| strokeWeight_4 | `strokeWeight(random(1, 3));` -> `strokeWeight(random(4, 10));` | subtle | no visible change beyond slightly thicker wireframe lines | variants/strokeWeight_4/frame_00001.png |
| palette_cool | `int colors[] = {#ECEAA4, ...}` -> cool blue/slate set | moderate | identical geometry recoloured blue/slate/teal/white/black; structure unchanged, only hue family | variants/palette_cool/frame_00001.png |

## Modularisation notes
The generic core is the quadrant-subdivision loop (l.36-49): a list of cubes
where each step replaces one cube by 4 half-size cubes at its quadrant corners;
the parent-pick bias (`*random(0.5,1)`, l.41) controls depth distribution and
is a good library knob. The perspective "view from inside" transform
(l.29-34, l.56-67) is a reusable camera setup: place camera inside the
top-level box so only inner faces of large boxes and whole small boxes are
seen. The fill/wireframe mix (40%, l.58) and the continuous-lerp palette
(`getColor`, l.98-103) are small standalone utilities. One-off art decisions:
the fixed 6-colour palette and its order, the 40% wireframe probability, the
background colour draw with doubled index range, the z offset `width*0.75`,
and the `width*4` starting size. A clean parameter object: `{startZ,
iterations, pickBias, wireframeProb, strokeWeightRange, fov, palette}`.
