---
sketch: 2018/Generativos/citys
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1531
animated: false
techniques: [grid, subdivision, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#D81D03", "#101A9D", "#1C7E4E", "#F6A402", "#EFD4BF", "#E2E0EF", "#050400", "#000000", "#828282"]
  selection: random-from-list
composition: scattered
parameters: []
reusable_candidates:
  - {name: quadrantSubdivide, signature: "quadrantSubdivide(w, h, iters, minRatio, maxRatio) -> Rect[]", note: "recursive 4-way quadrant subdivision of a rectangle with random split ratios"}
  - {name: buildingMesh, signature: "buildingMesh(w, h, floors, floorsCount) -> Box[]", note: "stacked thin floor slabs + outer box + cross grid of thin boxes forming a wireframe building"}
---

## What it draws
A monochrome 3D city in thin light-gray wireframe on a black background. Dozens of boxy
buildings of varying footprints and heights form a dense lattice: each building shows
horizontal dark bands (floor slabs) and a fine cross-hatch of vertical/horizontal grid
lines. The city cluster sits left-of-centre, seen from a steep oblique perspective
looking down at the blocks; the right half of the frame is empty black. No colour is
visible anywhere despite a 7-colour palette defined in the code.

## How the code works
- `setup()` (citys.pde:2-8): 960x960 P3D, `smooth(8)`, `pixelDensity(2)` (unavailable on
  the harness display, falls back with a warning). Calls `generate()` once; `draw()` is
  empty, so the image is static (frames 10/60 identical to frame 1).
- `generate()` (line 22): `background(0)`, `randomSeed(seed)` (harness sets seed=42).
- Camera (lines 33-41): `fov = PI/random(1.01, 1.8)`, `perspective(...)` with
  `cameraZ = (height/2)/tan(fov/2)`, then `translate(width/2, height/2, random(300,800))`
  plus random `rotateX`/`rotateY` in ±0.4·HALF_PI. The random camera distance vs. the
  random cameraZ is why the city occupies an off-centre portion of the frame.
- City layout (lines 46-68): `size = 2000`; a flat `box(2000, 2000, 5)` base plate with
  `fill(80)`, `stroke(130)` (the dark solid slabs visible between buildings); `sub = 8`
  gives an 8x8 grid of blocks, each drawn as a flat `box(ss*0.95, ss*0.95, 1)` slab plus
  `manzana(ss*0.9)`.
- `manzana` (lines 81-114): starts from the full block square and performs
  `int(random(1, 8))` recursive 4-way quadrant subdivisions at random ratios
  (`mw`, `mh` in 0.3-0.7), yielding up to 22 leaf rectangles = building footprints.
  Per-rectangle building height `d = s*random(pp*0.1, pp*0.12)` with
  `pp = int(random(1, random(1, random(10, 50))))` (line 82), so heights vary widely.
- `edi` (lines 116-148): per building, `pis = pp` thin `fill(0)` slabs stacked with
  `translate(0,0,dd)` (the dark horizontal floor bands), one outer box of height `d`
  (stroke only, fill 0 → wireframe shell), then `cw = int(random(2,10))` thin vertical
  boxes across the width and `ch = int(random(2,10))` thin horizontal boxes across the
  height (the cross-hatch grid lines).
- Colour: only grays are ever applied — `background(0)`, `fill(0)`, `fill(80)`,
  `stroke(130)`. The 7-colour `colors[]` array and `rcol()`/`getColor()` (lines 155-167)
  exist but every `fill(rcol())` call is commented out (lines 121, 125), so the render is
  monochrome.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `quadrantSubdivide` (from `manzana`, lines 81-105) is fully generic: given a rectangle,
  iteration count, and ratio range, it returns leaf rectangles. Direct library candidate;
  the sketch-specific part is only the random parameter choices.
- `buildingMesh` (from `edi`, lines 116-147) is generic if parameterised as
  (w, h, height, floorCount, vDivisions, hDivisions): stacked floor slabs + outer shell +
  cross grid. The floor-slab + grid-box trick (many thin boxes instead of lines) is the
  reusable idea; it gives a solid-slab + wireframe hybrid in P3D.
- One-off art decisions: the 8x8 block grid with 5% gaps, the camera randomisation
  (fov + distance + two-axis tilt), the black/gray monochrome scheme, and the disabled
  colour system.
- Clean parameter object: `{seed, gridSub, blockSize, manzanaIters, heightScale,
  cameraZRange, fovRange, tiltRange, strokeGray}`.
