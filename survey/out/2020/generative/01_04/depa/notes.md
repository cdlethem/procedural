---
sketch: 2020/generative/01_04/depa
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1608
animated: false
techniques: [grid, 3d-mesh]
primitives: [rect, shape]
palette:
  colors: ["#F3B2DB", "#518DB2", "#02B59E", "#DCE404", "#82023B", "#FFFFFF", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: patches, default: 100, tried: [40], change: large, effect: "fewer scattered height patches: big flat planes, sparser city"}
  - {name: patchSize, default: "12-40", tried: ["30-60"], change: large, effect: "larger patches: coarser slabs, wider flat tops, fewer small clusters"}
  - {name: maxHeight, default: 50, tried: [15], change: large, effect: "shorter blocks: shallow slabs, much flatter city, grid texture more visible"}
  - {name: maxRot, default: 0.5, tried: [0.15], change: large, effect: "smaller random tilt: flatter, more edge-on view; orientation also shifts (random values differ)"}
  - {name: cw, default: 240, tried: [120], change: large, effect: "half the columns: cells 2x wider, taller-looking slabs, grid narrower than canvas so white background shows at edges"}
reusable_candidates:
  - {name: patchHeightfield, signature: "patchHeightfield(cols, rows, patches, minSize, maxSize, maxH) -> int[][]", note: "scatter random rectangles of constant height onto a 2-D height grid"}
  - {name: extrudeGrid, signature: "extrudeGrid(heights[], cellW, cellH, gapFrac, topColor, insetColor)", note: "draw an extruded height grid: side quads between neighbours + top rect + inset rect"}
---

## What it draws
A black-and-white 3D "voxel city" filling the whole frame: many rectangular
platforms of varying heights stacked in blocky clusters, seen from a tilted
perspective camera. Each block top is a white square with a smaller black
inset rectangle inside it, and the exposed sides are light-grey shaded
parallelograms. Flat zero-height areas read as a dense grid of tiny black
squares on white.

## How the code works
`setup()` -> `generate()` (depa.pde). A height grid `values[cw][ch]` with
`cw = 120*2 = 240`, `ch = 60*2 = 120` starts at 0 (L48-57). Then 100 random
patches (L59-70): each picks a width/height in 12-40 cells and a constant
height value 0-49, and overwrites that rectangle of the grid. Cell pixel size
is `ww = width*2/cw`, `hh = height*2/ch` (L72-73); gap `bb = min(ww,hh)*0.1`
(L75). Camera: `perspective()` with random fov `PI/random(2,3)`, then random
`rotateX/Y/Z` up to `maxRot = 0.5` rad (L80-91); `lights()` on. The main loop
(L94-129) per cell draws two side quads (`beginShape`/`vertex`, L103-118)
connecting its height to the right and lower neighbour (so block edges are
visible), then a top `rect` filled white (L122-123) and a slightly smaller
`rect` filled black raised by 0.001 (L124-126) — the black inset. Heights are
scaled by `*ww` when used as z. The `colors[]` palette (L142) and `rcol()`/
`getColor()` (L145-159) are defined but never called in `generate()` — the
render is strictly white/black; the grey sides come from P3D `lights()`
shading of the side quads.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| patches_40 | `for (int k = 0; k < 100; k++) {` -> `... k < 40 ...` | large (mean 0.389, 0.792) | sparser city: large flat white/grey planes and only a few raised block clusters where the 100-patch baseline had dense coverage | variants/patches_40/frame_00001.png |
| patchSize_30_60 | `int ww/hh = int(random(12, 40));` -> `random(30, 60)` (both lines) | large (mean 0.2717, 0.592) | coarser blocks: fewer, larger raised slabs with wide flat tops; per-cell black-inset grid texture clearly visible on each slab | variants/patchSize_30_60/frame_00001.png |
| maxHeight_15 | `int val = int(random(50));` -> `random(15)` | large (mean 0.3596, 0.765) | much flatter: shallow slabs instead of tall blocks; dense grid texture dominates, only slight relief | variants/maxHeight_15/frame_00001.png |
| maxRot_0.15 | `float maxRot = 0.5;` -> `float maxRot = 0.15;` | large (mean 0.3592, 0.753) | smaller tilt: flatter, more edge-on view of the city; white background visible in corners (camera also lands on a different orientation since the random draws change) | variants/maxRot_0.15/frame_00001.png |
| cw_120 | `int cw = 120*2;` -> `int cw = 60*2;` | large (mean 0.3365, 0.70) | half the columns: cells twice as wide, slabs read as coarse grid planes; grid no longer spans the canvas width so white shows at lower left | variants/cw_120/frame_00001.png |

## Modularisation notes
Generic, reusable blocks: the patch-scatter heightfield (L59-70) and the
extruded-grid renderer (L94-129) are both self-contained; the latter only
needs heights, cell size, inset fraction, and two colors. The perspective
camera block (L80-91) is a generic "random tilt" helper. One-off art
decisions: the 0.001 z-offset to beat z-fighting on the inset rect, the
`*ww` height scaling (heights measured in cell units), and the black-on-white
inset look. A clean parameter object would be: `{cols, rows, patches,
patchSizeMin, patchSizeMax, maxHeight, gapFrac, maxRot, fov, topColor,
insetColor}`.
