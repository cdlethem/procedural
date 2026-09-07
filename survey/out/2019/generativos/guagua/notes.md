---
sketch: 2019/generativos/guagua
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1543
animated: false
techniques: [grid, agents, particles]
primitives: [rect, line]
palette:
  colors: ["#F76FC1", "#FF7028", "#AFE36B", "#29a8cc", "#100082"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: gridCells, signature: "gridCells(count, gap, corner) -> void", note: "rounded-square grid on dark background"}
  - {name: gridRandomWalks, signature: "gridRandomWalks(cellSize, walkCount, steps, strokeW, palette, shadow) -> void", note: "orthogonal random walks on a cell grid with offset shadow stroke"}
---

## What it draws
A black canvas covered by a grid of white rounded squares separated by thin black gaps.
Over it run many thick, orthogonal (axis-aligned) polylines that zigzag like random
walks, in five bright colours (pink, orange, green, cyan) plus dark navy. Each coloured
line has a dark offset copy shifted a few pixels down-right, giving a drop-shadow /
two-layer effect. Density and line weight vary; the composition is full-bleed and
scattered.

## How the code works
- `generate()` (line 49) runs once in `setup()`; `draw()` is empty (lines 31-39),
  so the piece is static; key press regenerates with a new seed (lines 41-47).
- Grid: `cc = int(random(12, 36))` (line 57) sets the number of cells per side;
  `ss = width/cc` (line 58). Nested loops (lines 59-64) draw a white rounded
  `rect` per cell with a 1-2 px gap, over `background(0)` (line 54).
- Walks: 60 iterations (line 68). Each picks a random start cell (lines 70-71),
  then walks 20 steps (line 72); each step chooses an axis with 50% probability
  (line 74) and a sign, so paths are strictly orthogonal on the cell lattice.
- Each walk is stroked twice (lines 82-98): first a shadow pass `stroke(0, 20)`
  (dark, 20/255 alpha) with square caps, weight `ss*0.5`, offset +4/+3 px
  (line 89); then a coloured pass `stroke(rcol())` offset (0, -1) (line 96).
- Colour: `rcol()` (lines 120-122) picks a random entry from `colors[]`
  (line 113); a `getColor()` lerp helper (lines 126-131) exists but is unused.
- Randomness: `randomSeed(seed)`/`noiseSeed(seed)` (lines 52-53); all structure
  comes from `random()`, no noise is sampled (SimplexNoise imported but unused).
- No blend modes, no transforms, P2D renderer with `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `gridCells` is generic: count, gap, corner radius are already parameterised.
- `gridRandomWalks` is the reusable core: walk count, steps per walk, stroke
  weight relative to cell size, palette, shadow offset/alpha.
- One-off art decisions: the specific 5-colour palette, the two-pass shadow
  trick with hard-coded pixel offsets (+4/+3 and 0/-1), the 50/50 axis choice.
- A clean parameter object: {gridCount, walkCount, stepsPerWalk,
  strokeWeightFactor, shadowOffset, shadowAlpha, palette}.
