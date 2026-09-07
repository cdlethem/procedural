---
sketch: 2018/Generativos/carto002
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1497
animated: false
techniques: [grid, noise-field, lines-hatching, symmetry]
primitives: [rect, line, ellipse, shape]
palette:
  colors: ["#FB5D40", "#D48300", "#E5964B", "#008172", "#165253", "#1C1C1A", "#D8D8B9"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 32, tried: [16], change: moderate, effect: "coarser grid; every layer (grid lines, diamonds, walk steps) scales up ~2x, reads as zoomed-in version"}
  - {name: sub, default: 5, tried: [10], change: none, effect: "no visible change; the noise-mottled subgrid is too faint to affect the overall look"}
  - {name: walkSteps (cc*cc*factor), default: 0.04, tried: [0.10], change: moderate, effect: "walks ~2.5x longer; denser, longer continuous zig-zag paths"}
  - {name: diamondCount, default: 40, tried: [80], change: subtle, effect: "twice as many scattered diamonds, more overlaps, same size distribution"}
  - {name: bgGridAlpha (fill(0,a)), default: 20, tried: [80], change: large, effect: "background grid rects much darker; overall canvas tone drops, grid and white squares clearly visible"}
  - {name: walkWeight (ss*factor), default: 0.04, tried: [0.10], change: subtle, effect: "walk lines ~2.5x thicker; same layout, bolder line network"}
reusable_candidates:
  - {name: gridRandomWalks, signature: "gridRandomWalks(cellSize, walks, steps, weight, color)", note: "random walks snapped to a grid, drawn as connected segments"}
  - {name: noiseSubgrid, signature: "noiseSubgrid(cellSize, sub, detail, alpha) -> void", note: "per-cell noise-sized rects on a subdivided grid"}
  - {name: diamond, signature: "diamond(x, y, size, color)", note: "rotated-square marker helper (diamont)"}
---

## What it draws
A light grey full-bleed field with a fine regular grid of small dark squares (with lighter dots at the cell corners). Over it, thin dark grey lines form many short zig-zag "random walk" paths that snap to the grid and turn at right angles. Scattered across the field are rotated squares (diamonds) in a small palette of teal, dark navy, orange, red-orange, cream, and near-black; several diamonds contain a small centered dot, and a few have a second smaller concentric diamond. A couple of faint circular ring clusters are visible near the bottom. Overall it reads as a map-like / cartographic scatter on graph paper.

## How the code works
Single `generate()` call from `setup()` (line 8); `draw()` is empty, so the piece is static (keyPress regenerates with a new seed, lines 14-20). Randomness: `randomSeed(seed)` (line 25) with `seed` set from `random(999999)` (line 1); the harness injects seed 42 into the `seed` field.

- Layer 1 (lines 30-39): a `cc=32` grid, cell `ss = width/cc`. Two nested full-canvas rects per cell: a big near-transparent black rect `fill(0,20)` at `ss*1.02` (overlapping edges create the faint dark grid lines) and a `fill(230,80)` light dot at `ss*0.3`. This is the graph-paper background.
- Layer 2 (lines 41-53): the same grid subdivided by `sub=5`; per sub-cell a noise-sized black rect `fill(0,40)` with size from `noise(des+det*i, des+det*j)` (`det = random(0.01)`, line 43) gives the fine mottled texture; plus a `fill(230)` dot at `ss*0.1` per main cell (light dot at each grid node).
- Layer 3 (lines 55-56): `rects()` helper (lines 127-135) places 100 translucent white `ss`-sized rects snapped to the 1/sub grid — faint white squares.
- Layer 4 (lines 58-78): 100 random walks. Each starts at a grid node; per step (up to `(cc*cc)*0.04` = 41 steps) it moves 1 cell left/right/up/down with 50% probability and draws a `stroke(80)` line of weight `ss*0.04` with round caps (lines 76-77). These are the thin zig-zag paths.
- Layer 5 (lines 80-88): 10 `arc2()` calls (lines 142-160) at grid nodes: full-circle ring wedges between radii `ss*0.1` and `ss*0.5`, fill `rcol()` with alpha 80 fading to 0 — the faint circular clusters.
- Layer 6 (lines 90-107): 40 diamonds via `diamont()` (lines 117-124, a 4-vertex closed shape), size `ss * random int 1..3`, color `rcol()` (random pick from the 7-colour `colors[]` array, line 162); 20% chance of a smaller concentric diamond and 20% chance of a small centered dot. These are the prominent coloured diamonds.
- Layer 7 (lines 109-114): a final pass of tiny `fill(230)` dots `ss*0.04` at every grid node, sharpening the grid intersections.

Colour is always a random pick from the fixed 7-colour list (line 163); the background greys come from alpha-blended black/white on the grey `background(220)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_16 | `int cc = 32;` -> `int cc = 16;` | moderate (mean 0.1358, 0.364) | coarser grid: larger cells, larger diamonds and thicker, more widely spaced grid lines; whole image looks zoomed in | variants/cc_16/frame_00001.png |
| sub_10 | `float sub = 5;` -> `float sub = 10;` | none (mean 0.0035, 0.0) | no visible change; the noise-mottled subgrid is too faint to register | variants/sub_10/frame_00001.png |
| walksteps_0.10 | `i < (cc*cc)*0.04; i++` -> `i < (cc*cc)*0.10; i++` | moderate (mean 0.0816, 0.231) | random walks ~2.5x longer: longer, denser zig-zag paths, more continuous line network; diamonds unchanged | variants/walksteps_0.10/frame_00001.png |
| diamonds_80 | `for (int i = 0; i < 40; i++)` -> `... i < 80 ...` | subtle (mean 0.031, 0.082) | twice as many diamonds, more overlaps and near-duplicates; same sizes and colours | variants/diamonds_80/frame_00001.png |
| gridalpha_80 | `fill(0, 20);` -> `fill(0, 80);` | large (mean 0.1723, 0.874) | background grid much darker: canvas tone drops across nearly the whole image, grid cells and the 100 white squares clearly visible | variants/gridalpha_80/frame_00001.png |
| walkweight_0.10 | `strokeWeight(ss*0.04);` -> `strokeWeight(ss*0.1);` | subtle (mean 0.0316, 0.159) | walk lines ~2.5x thicker, bolder line network; same layout and diamond placement | variants/walkweight_0.10/frame_00001.png |

## Modularisation notes
- Generic: `gridRandomWalks` (layer 4) is a self-contained grid-snapped walk generator; `noiseSubgrid` (layer 2) is a reusable noise-textured subgrid; `diamont` (diamond marker) and `arc2` (radial alpha-fade ring) are small reusable primitives. The two-pass grid background (layer 1 + final dots) is also generic "graph paper".
- One-off art decisions: the specific layering order, the 7-colour palette, the 20% probabilities for nested diamonds/dots, the walk step count as a fraction of cells, and the mix of mark types (walks + diamonds + rings + mottling) that gives the cartographic look.
- Clean parameter object: `{cellCount, sub, noiseDetail, noiseAlpha, bgDotSize, walks, walkSteps, walkWeight, rings, diamonds, nestedChance, palette}`.
