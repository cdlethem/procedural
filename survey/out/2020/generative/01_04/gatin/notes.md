---
sketch: 2020/generative/01_04/gatin
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1531
animated: false
techniques: [noise-field, grid, symmetry]
primitives: [shape, ellipse]
palette:
  colors: ["#284E34", "#BCA978", "#896F3D", "#38271D", "#BF0624"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: gridMult, default: 22, tried: [30], change: moderate, effect: "multiplier on random grid count; higher = denser, finer diamonds (same checkerboard)"}
  - {name: detCol, default: "random(0.001)", tried: ["random(0.0004)"], change: subtle, effect: "noise detail of the colour field; lower = slightly larger, smoother colour regions"}
  - {name: noiseColorMult, default: 4, tried: [16], change: moderate, effect: "multiplier on noise term in palette index; higher = index wanders further across palette, red end (#BF0624) appears"}
  - {name: desCol, default: "(i+j)%2", tried: ["(i+j+1)%2"], change: none, effect: "no visible change: desCol is dead code — line 71 uses (i+j)%2 directly, not desCol"}
  - {name: dotSize, default: 0.1, tried: [0.5], change: subtle, effect: "intersection ellipse size (fraction of cell); larger = prominent grid of cream ovals over the diamonds"}
reusable_candidates:
  - {name: diamondGrid, signature: "diamondGrid(cols, rows, size) -> void", note: "tessellated rotated squares (diamonds) filling the canvas, one shape per cell"}
  - {name: noiseColorLerp, signature: "noiseColorLerp(palette, noiseValue, detail, offset) -> color", note: "index = base + noise * multiplier, lerp between adjacent palette entries"}
---

## What it draws
A dense, full-bleed tessellation of small diamonds (squares rotated 45°) covering the whole canvas in roughly a 20×20 grid. The colours alternate in a regular checkerboard of sage green and tan/ochre diamonds over a dark brown ground, so the whole field reads as a fine herringbone-like moiré; the green/tan rhythm repeats in larger ~5-cell blocks. A few slightly brighter green dots (small ellipses) sit at some grid intersections.

## How the code works
`settings()` (gatin.pde:14-19) opens a 960×960 P3D window. `setup()` calls `generate()` (gatin.pde:21-29); `draw()` is empty so the piece is static.

`generate()` (gatin.pde:42-148):
1. Seeds `randomSeed`/`noiseSeed`, fills the background with one random palette colour (`rcol()`, line 47).
2. Grid count: `cw = int(random(12,18)*0.3)*22` (line 49) — a random integer in {4,5,6,7} (since `random(12,18)*0.3` ∈ [3.6,5.4)) times 22 → 88..154 columns; `sw = width/cw` (line 50) is the cell width.
3. For each cell (i,j) (lines 58-78): centre at `xx = i*sw, yy = j*sh`; a triangle-wave phase `triw = abs((i/cw*4)%2-1)*0.5` (line 66) is computed but unused in the live code. Colour: `noi = noise(200+xx*detCol, 100+yy*detCol, seed*detCol)` with `detCol = random(0.001)` (lines 54, 70), then `fill(getColor((i+j)%2 + noi*colors.length*4))` (line 71). `(i+j)%2` gives the checkerboard; the noise term, scaled by 4× the palette length, drifts the index across the 5-colour list; `getColor(float)` (lines 163-169) lerps between two adjacent palette colours, producing the muted green/tan mix.
4. Shape (lines 73-78): `beginShape()` with four vertices at the cell's mid-edges — a diamond of width `sw`, height `sh`, tessellating edge-to-edge. `noStroke()` (line 56).
5. Second loop (lines 140-147): draws an `ellipse(xx, yy, cw*0.1, ch*0.1)` at every grid intersection — very small (≈7-10 px), faintly visible as the brighter dots.

A large commented-out block (lines 80-136) with arcs/ellipses is inactive. Randomness enters via the grid counts, background colour, noise detail `detCol`, and the seed offsets.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| grid_30 | `int cw = int(random(12, 18)*0.3)*22;` -> `... *30;` | moderate | clearly smaller, denser diamonds (finer grid), same green/tan checkerboard rhythm | variants/grid_30/frame_00001.png |
| detCol_0.0004 | `float detCol = random(0.001);` -> `random(0.0004);` | subtle | same tessellation; colour regions slightly larger and softer, less fine moiré | variants/detCol_0.0004/frame_00001.png |
| noisemult_16 | `fill(getColor((i+j)%2 +(noi)*colors.length*4));` -> `...*16);` | moderate | large area of red / dark red diamonds on the right side (noise index now reaches the red end of the palette); tan/green on the left | variants/noisemult_16/frame_00001.png |
| parity_1 | `float desCol = (i+j)%2;` -> `(i+j+1)%2;` | none | no visible change (pixel-identical): `desCol` is computed but never used — line 71 uses `(i+j)%2` directly | variants/parity_1/frame_00001.png |
| dot_0.5 | `ellipse(xx, yy, cw*0.1, ch*0.1);` -> `cw*0.5, ch*0.5;` | subtle | intersection dots become large, prominent cream ovals on a regular grid over the diamonds (low pixel fraction, hence subtle score) | variants/dot_0.5/frame_00001.png |

## Modularisation notes
Generic blocks: (a) the diamond tessellation — a plain `diamondGrid(cols, rows, cell)` that fills the canvas with rotated squares, independent of colour; (b) `noiseColorLerp` — the palette-indexing trick (base checker parity + noise × scale, lerp between adjacent palette entries) is reusable for any grid of shapes; (c) the small intersection-dot overlay loop.

One-off art decisions: the specific 5-colour muted earth palette, the `*4` noise multiplier (how far the colour index wanders), the 22× multiplier on the random grid count, and the commented-out arc decoration.

A clean parameter object: `{ cols, rows, palette, noiseDetail, noiseScale (colour index multiplier), checkerParity (bool), dotScale (ellipse size fraction of cell), dotOn (bool), background: 'random-palette' | 'color' }`.
