---
sketch: 2018/Generativos/carto001
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1504
animated: false
techniques: [grid, noise-field, dots-stippling]
primitives: [rect, line]
palette:
  colors: ["#DCDCDC", "#505050", "#E6E6E6", "#000000", "#FF0000", "#FFFFFF"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(8, 33)) (~16 cells at seed 42)", tried: [32], change: moderate, effect: "finer grid: smaller cells, thinner walks, denser overall pattern; stippled patches shrink to near-invisibility"}
  - {name: sub, default: 5, tried: [10], change: none, effect: "no visible change - halving the sub-cell size leaves patch coverage looking the same"}
  - {name: det, default: "random(0.01)", tried: ["random(0.002)"], change: none, effect: "no visible change at seed 42 despite 5x smaller noise scale"}
  - {name: noiseMaxFraction, default: 0.5, tried: [1.5], change: subtle, effect: "noise-sized squares ~3x larger, stippled patches read denser and coarser; dot lattice and walks unchanged"}
  - {name: walkStepsFactor, default: 0.04, tried: [0.15], change: subtle, effect: "walks ~4x longer, more connected, denser diagonal crosshatch coverage; other layers unchanged"}
reusable_candidates:
  - {name: noiseDots, signature: "noiseDots(cellSize, subdivision, noiseScale, maxFraction) -> void", note: "subdivide each grid cell and draw squares sized by 2-D Perlin noise; produces stippled density patches"}
  - {name: gridWalk, signature: "gridWalk(cellSize, walkCount, stepsPerWalk) -> void", note: "random ±1-cell walks snapped to the grid, drawn as round-capped line segments; produces staircase/zigzag strokes"}
---

## What it draws
Light gray full-bleed canvas with a faint grid. A fine dot lattice of tiny white dots marks most grid intersections, and soft patches of small dark dots cluster irregularly across the surface. Short dark gray line segments form angular staircase and zigzag walks of varying lengths, plus a few small translucent white squares scattered on the grid.

## How the code works
`setup()` opens a 960×960 P2D window and calls `generate()` once; `draw()` is empty, so the piece is static (carto001.pde:3-12). `generate()` first reseeds with a fixed `seed` (line 25) and fills with light gray `background(220)` (line 27).

1. Grid pass (lines 30-39): `cc = int(random(8, 33))` picks 8-32 cells per side, `ss = width/cc`. For every cell it draws a near-transparent black rect `ss*1.02` (`fill(0, 20)`, line 34-35) — the overlapping overhangs read as the faint grid lines — then a small `fill(230)` square of `ss*0.1` at the cell center (line 36-37), the white dot lattice.
2. Noise pass (lines 41-55): each cell is subdivided `sub = 5` times; at every sub-cell a square of `fill(0, 40)` (line 51) is drawn with side `int(ns*0.5*noise(des+det*i, des+det*j))` (line 52). 2-D Perlin noise over the sub-grid (`des = random(1)` offset, `det = random(0.01)` scale) sizes the squares, so low-noise areas go blank and high-noise areas fill with small dark squares — the stippled patches. The `fill(255, 0, 0)` on line 50 is immediately overwritten by line 51 and never renders.
3. `rects(ss/sub, ss/sub*0.1, 100)` (line 58, fn 84-92): 100 small translucent white squares (`fill(255, 40)`, line 57) snapped to the sub-grid.
4. Walks (lines 60-80): 100 walks, each starting at a random grid-snapped point; each walks `(cc*cc)*0.04` steps, and on 50% of steps moves ±1 cell in x and y independently (lines 73-76), drawing a segment with `stroke(80)`, `strokeWeight(ss*0.04)`, round caps (lines 67-78). These produce the angular staircase/zigzag line clusters.

Randomness enters via `cc`, `des`, `det`, the walk starts/steps, and the `rects()` positions — all under the fixed `randomSeed(seed)`, so renders are deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_32 | `int cc = int(random(8, 33));` -> `int cc = 32;` | moderate | much finer grid: smaller dot lattice, smaller stippled patches, thinner and relatively longer diagonal zigzag walks covering the whole canvas | variants/cc_32/frame_00001.png |
| sub_10 | `float sub = 5;` -> `float sub = 10;` | none | no visible change | variants/sub_10/frame_00001.png |
| det_0.002 | `float det = random(0.01);` -> `float det = random(0.002);` | none | no visible change | variants/det_0.002/frame_00001.png |
| noisemax_1.5 | `float s2 = int(ns*0.5*noise(...));` -> `ns*1.5*noise(...)` | subtle | noise-sized squares ~3x larger: stippled dark patches read denser and coarser; dot lattice and line walks unchanged | variants/noisemax_1.5/frame_00001.png |
| walksteps_0.15 | `for (int i = 0; i < (cc*cc)*0.04; i++)` -> `(cc*cc)*0.15` | subtle | walks ~4x longer: longer connected diagonal zigzags, denser crosshatch-like coverage across the canvas | variants/walksteps_0.15/frame_00001.png |

## Modularisation notes
- The grid pass (lines 32-39) is a generic "dot lattice + faint grid" primitive parameterized by cell count and dot fraction (`ss*0.1`).
- The noise pass (lines 44-55) is the core reusable block: a subdivided grid where cell occupancy/size is driven by 2-D noise. Clean signature: `noiseDots(cellSize, subdivision, noiseScale, maxFraction, fill)`.
- The walks (lines 60-80) are a generic grid random walk: `gridWalk(cellSize, walks, stepsPerWalk, stepProbability)`.
- `rects()` (lines 84-92) is a trivial scattered-snap helper; the `arc2`/`rcol`/`getColor` helpers (lines 99-132) are dead code, unused by `generate()`.
- A parameter object would contain: `cellCount`, `dotFraction`, `subdivision`, `noiseScale`, `noiseMaxFraction`, `walkCount`, `stepsPerWalk`, `strokeWeight`, and the two fill colors (dot color, walk stroke color).
