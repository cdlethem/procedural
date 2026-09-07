---
sketch: 2019/generativos/buiiin
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1886
animated: false
techniques: [3d-mesh, grid]
primitives: [shape]
palette:
  colors: ["#F20707", "#FCCE4A", "#D0DFE8", "#F49FAE", "#342EE8"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 1000, tried: [300], change: subtle, effect: "same seed redraws the random stream so the layout differs, but density looks comparable — the scale dice already shrinks most boxes to tiny"}
  - {name: subdiv, default: "random(1,10) per axis", tried: ["random(1,4) per axis"], change: subtle, effect: "lattice cells slightly coarser (fewer bars per grid panel); overall style unchanged"}
  - {name: gap, default: "random(2,5)", tried: ["random(0.5,1.5)"], change: subtle, effect: "slats a bit thicker, grid panels slightly more filled in"}
  - {name: palette, default: "#F20707,#FCCE4A,#D0DFE8,#F49FAE,#342EE8", tried: ["#ED61DA,#200C2B,#0029BF,#FFE760,#DBD1CB"], change: subtle, effect: "coloured pixels clearly shift to magenta/navy/yellow/pink; score stays subtle because ~85% of the canvas is black"}
  - {name: boxWidth, default: 300, tried: [150], change: moderate, effect: "boxes visibly smaller: finer, more numerous small grids, fewer big panels"}
reusable_candidates:
  - {name: boxes, signature: "boxes(x, y, z, w, h, d, cw, ch, cd, gap) -> void", note: "splits a box into a cw x ch x cd grid of small cubes, each shrunk by a uniform gap; reads as a lattice of slats"}
  - {name: cube, signature: "cube(x, y, z, w, h, d, c1, c2, c3) -> void", note: "one cube as 6 flat-filled quads inside beginShape(QUADS); c1/c2/c3 per axis pair"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform pick from a fixed palette array"}
---

## What it draws
A dense scatter of small brightly coloured cube-clusters floating in 3D over a black
background. Each cluster is a thin lattice of slats — mostly thin rectangular grid-panels
and stacks of bars in red, yellow, blue, pink and pale blue-grey. The composition is densest
around the centre (where the camera sits) and thins out toward the edges; some clusters read
as flat window-grid panels, others as combs or slats. It looks like deconstructed architecture
built from solid bars instead of lines.

## How the code works
- `setup()` calls `generate()` once (line 23); `draw()` is empty, so the image is static
  (frames 1/10/60 identical; `static_mode: false` but no visible change).
- `generate()` (line 52): seeds `randomSeed`/`noiseSeed`, black background (line 58).
- Three `directionalLight`s with random palette colours from +x, -x, -y (lines 60-65):
  with P3D flat shading, this is what makes face colour depend on orientation, so whole
  faces appear in saturated palette tones.
- Main loop (lines 69-86): 1000 iterations; each picks `x,y` in the 960x960 canvas,
  `z` in [-960, 0], `w,h` in [0, 300), `d` in [0, 90) (depth always smaller than
  width/height, so boxes are slab-like).
- Scale dice (lines 77-82): 50% chance to halve the size, then 50% of that to shrink by
  another 10x — so most boxes end up small and thin, a few stay large.
- `boxes()` (line 90) subdivides the box into a `cw x ch x cd` grid with each dimension
  `int(random(1,10))` (1-9), and subtracts a random gap `bb = random(2,5)` (line 99) from
  every sub-cube — the gap is what turns solid blocks into lattices of slats.
- `cube()` (line 114) emits 6 quads (4 vertices each) into the single
  `beginShape(QUADS)` opened at line 68 and closed at line 87: front/back faces get `c1`,
  left/right `c2`, top/bottom `c3`, three random palette colours per box.
- Colour: `rcol()` (line 160) picks uniformly from the 5-colour array at line 159.
  `getColor()`/lerp (lines 163-172) is defined but never used. The `triangulate` and
  `SimplexNoise` imports (lines 1-2) are also unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int i = 0; i < 1000; i++)` -> `for (int i = 0; i < 300; i++)` | subtle | different scatter (same seed, redrawn stream) but density looks comparable — the scale dice already shrinks most boxes to tiny, so 1000 was not visibly denser than 300 | variants/count_300/frame_00001.png |
| subdiv_4 | `boxes(..., int(random(1, 10)), int(random(1, 10)), int(random(1, 10)))` -> `int(random(1, 4))` x3 | subtle | grid panels have coarser cells (fewer bars); overall style and density unchanged | variants/subdiv_4/frame_00001.png |
| gap_1 | `float bb = random(2, 5);//min(4, max(ww, hh, dd)*0.1);` -> `float bb = random(0.5, 1.5);` | subtle | slats slightly thicker, some panels look a little more solid; still reads as lattices | variants/gap_1/frame_00001.png |
| palette_alt | `int colors[] = {#F20707, #FCCE4A, #D0DFE8, #F49FAE, #342EE8};` -> `{#ED61DA, #200C2B, #0029BF, #FFE760, #DBD1CB}` | subtle | every coloured pixel clearly re-tinted (magenta, navy, yellow, pale pink); score is subtle only because most of the canvas is black | variants/palette_alt/frame_00001.png |
| size_150 | `float ww = random(300);` -> `float ww = random(150);` | moderate | boxes visibly smaller: finer, more numerous little grids, big flat panels mostly gone | variants/size_150/frame_00001.png |

## Modularisation notes
- `boxes()` + `cube()` are the reusable core: a "lattice box" primitive — a box of
  sub-cubes with a uniform gap, three per-axis face colours. Generalise by taking the
  gap as a parameter (currently a random constant inside) and by accepting a
  per-face colour callback.
- The 1000-box scatter loop with the two-stage scale dice is the art decision: random
  position/size/scale distribution. A clean parameter object would be
  `{count, zRange, wRange, hRange, dRange, scaleDice: [p, factor, ...], subdiv: [min, max],
  gap: [min, max], palette}`.
- The three fixed directional lights (+x, -x, -y) with palette colours are a cheap
  "face orientation = colour" trick worth keeping as an option flag.
- The single `beginShape(QUADS)` for the whole scene is a performance detail that should
  be part of any library wrapper (one draw call for all cubes).
