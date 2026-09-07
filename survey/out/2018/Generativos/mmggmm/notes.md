---
sketch: 2018/Generativos/mmggmm
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1472
animated: false
techniques: [grid]
primitives: [rect, ellipse, line, shape]
palette:
  colors: ["#F5F5F5", "#21A44B", "#1A1917", "#E999A6"]
  selection: random-from-list
composition: margins
parameters:
  - {name: cc, default: "random(4,13)", tried: [6], change: large, effect: "baseline (seed 42) drew cc=4; forcing cc=6 gives a denser 6x6 grid of smaller cells — busier composition"}
  - {name: strokeWeight, default: 2, tried: [6], change: subtle, effect: "crosshair/arc/diamond strokes 3x thicker, but lines are a small pixel fraction so overall look barely changes"}
  - {name: arcP, default: 0.6, tried: [1.0], change: moderate, effect: "every grid point now gets an axis-aligned quarter/half arc — circular line fragments everywhere, busier"}
  - {name: sqP, default: 0.2, tried: [1.0], change: subtle, effect: "full-cell square (L74) at every point; near-black fills read as thin frames around points, light fills as solid squares"}
  - {name: dotSize, default: 0.05, tried: [0.15], change: none, effect: "no visible change; center dot 3x diameter but too small to register"}
reusable_candidates:
  - {name: cellLattice, signature: "cellLattice(n, cellSize) -> float[][]", note: "n x n lattice of points at (i+1)*cellSize, leaving a one-cell border"}
  - {name: bauhausTile, signature: "bauhausTile(x, y, size, rng, palette) -> void", note: "one cell's random ornament: circle/arc/diamond + crosshair lines + small rects + center dot"}
---

## What it draws
A Bauhaus-style geometric composition on a near-black field. On a grid of points, cells are filled
with large solid circles and squares in off-white, green, and pink; over them sit thin-line quarter
arcs, diamond outlines, and crosshair lines radiating from each grid point, plus small solid squares
and a tiny dot at each point. The shapes tile a central region with a one-cell empty margin around
the border, giving a poster-like, balanced but irregular collage.

## How the code works
`setup()` calls `generate()` once (L7); `draw()` never regenerates (L13-15), so the piece is static.
- Grid: `cc = int(random(4,13))` cells, cell size `ss = width/(cc+1)` (L28-30); points sit at
  `(i+1)*ss, (j+1)*ss` (L36-37, L49-50), leaving a one-cell margin.
- Background layer (L34-43): over a `(cc-1)x(cc-1)` inner grid, each cell is filled with a solid
  square or a centered circle, each in a random palette colour (`rcol()`, L102-104 picks randomly
  from the 4-colour array at L101).
- Ornament layer (L47-92): per grid point, a random solid circle (rnd==0, L54-57), a quarter/half
  arc when `random(1) < 0.6` with axis-aligned start/end angles (L58-63), a diamond (4-vertex
  closed shape) when rnd==2 (L64-71), a full-cell square centred on the point at 20% with its own
  random stroke+fill (L73-75), up to four half-cell
  and a tiny `ss*0.05` dot at every point (L90-91). Stroke is 2 px, square caps (L45-46).
- Colour: `rcol()` samples the palette uniformly at random; `getColor()` (L105-114) does
  lerp-between sampling but is never called in `generate()`.
- Renderer is P3D but only 2D primitives are used; no shaders, transforms, or blend modes.
- All randomness enters through `random()`, seeded by the harness via the `seed` field (L1).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_6 | `int cc = int(random(4, 13));` -> `int cc = 6;` | large | denser 6x6 grid of smaller cells than the sparse 4x4 baseline — more, smaller motifs, busier overall | variants/cc_6/frame_00001.png |
| strokeWeight_6 | `strokeWeight(2);` -> `strokeWeight(6);` | subtle | crosshair, arc and diamond strokes slightly thicker; overall impression nearly unchanged | variants/strokeWeight_6/frame_00001.png |
| arcP_1.0 | `if (random(1) < 0.6) {` -> `if (random(1) < 1.0) {` | moderate | a quarter/half arc at every grid point — circular line fragments added around the top-right square, mid-canvas and bottom-right | variants/arcP_1.0/frame_00001.png |
| sqP_1.0 | `if (random(1) < 0.2) {` -> `if (random(1) < 1.0) {` | subtle | full-cell square at every point: thin frames (white top row, green bottom-right) where the fill is the near-black palette colour, solid squares (green left-middle) where it is light | variants/sqP_1.0/frame_00001.png |
| dotSize_0.15 | `ellipse(xx, yy, ss*0.05, ss*0.05);` -> `ellipse(xx, yy, ss*0.15, ss*0.15);` | none | no visible change (center dots slightly larger, imperceptible overall) | variants/dotSize_0.15/frame_00001.png |

## Modularisation notes
- Generic: the cell lattice (L28-30, L47-50) and the per-point ornament function (L47-92) are both
  cleanly parameterisable — `cellLattice(n, cellSize)` and `bauhausTile(x, y, size, rng, palette)`.
  The ornament's sub-element probabilities (arc 0.6, square 0.2, crosshair 0.9/0.6, small square
  0.4) form a natural parameter object.
- One-off art decisions: the fixed 4-colour palette (L101), the 0.5-cell margin, the specific
  shape set (circle/arc/diamond), and the tiny center dot as a "pin" marker.
- `getColor()` (L105-114) is dead code in this sketch but is itself a reusable
  lerp-between-palette helper.
- A clean parameter object: `{n, cellSize, marginCells, palette, probs: {arc, square, crosshair,
  smallSquare, dot}, strokeWidth}`.
