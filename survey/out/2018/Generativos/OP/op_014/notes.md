---
sketch: 2018/Generativos/OP/op_014
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1486
animated: false
techniques: [grid, agents]
primitives: [rect, shape]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: cc, default: "random 8-39 (9 for seed 42)", tried: [24], change: large, effect: "denser 24x24 mosaic of smaller gradient tiles"}
  - {name: walkCount, default: 100, tried: [30], change: large, effect: "fewer walks leaves more plain-black unvisited cells"}
  - {name: turnProb, default: 0.25, tried: [0.5], change: large, effect: "more turns: orientations more shuffled, more dark cells, less white"}
  - {name: background, default: 0, tried: [200], change: none, effect: "no visible change: canvas fully covered by opaque tiles, background never visible"}
  - {name: walkLen, default: 200, tried: [50], change: large, effect: "shorter walks: more plain-black unvisited cells, sparser mosaic"}
reusable_candidates:
  - {name: gridGradientTiles, signature: "gridGradientTiles(cellCount, walkCount, walkLen, turnProb) -> void", note: "random walks stamp one of 4 gradient-tile orientations into a grid; P2D vertex-colour interpolation makes each quad a smooth black-white gradient"}
---

## What it draws
A full-bleed square mosaic of ~9x9 cells, separated by barely visible grid lines. Every cell is
a smooth black-to-white gradient tile whose gradient direction (horizontal or vertical, either
polarity) varies from cell to cell; some tiles read as almost solid black because their white
half is small and neighbouring darkening bands stack on them. Adjacent cells often have
perpendicular gradients, giving an interlocking pinwheel impression. Static: frames 1, 10 and 60
are pixel-identical.

## How the code works
- `setup()` (L3-8): `size(960, 960, P2D)`, `pixelDensity(2)` (silently rejected by the headless
  display), one-shot `generate()`; `draw()` is empty so the piece is static.
- `generate()` L22: `background(0)`. Grid size `cc = int(random(8, random(20,40)))` (L25) — with
  seed 42 the baseline is a 9x9 grid, cell `ss = width/cc` (L26).
- L33-38: a `cc x cc` int grid `values` initialised to -1, and a faint `stroke(0,10)` rect grid
  (nearly invisible black-on-black lines, L31).
- L40-64: 100 random walks of 200 steps. Each walk starts at a random cell (L41-42), moves one
  cell per step in direction `dir` (L49-50), and with probability 0.25 turns by -2..+2, wrapped
  into 0..3 (L52-55). On each step it stamps `values[xx][yy] = dir*2` (L61, L58), so visited
  cells get one of {0,2,4,6}.
- L66-165: render pass. For each cell whose `val` is 0/4 it draws two quads spanning the cell
  and the ones above/below, top half transparent `fill(0,0)`, bottom half `fill(0,240)` — a
  translucent black band darkening the neighbour's edge (L74-92). Same for val 2/6 across the
  left/right neighbours (L94-112). Then, per val, one quad over the cell's lower/upper half with
  two white and two black vertices (L114-156). Under P2D, per-vertex colours are Gouraud
  interpolated, so each such quad renders as a smooth black-white gradient; which half is white
  depends on val, giving the 4 orientations. Cells left at -1 stay black (in the baseline all 81
  cells are visited, so the background never shows: the bg_200 variant is a pixel-identical no-op).
- The `colors[]` array and `rcol/getColor` (L172-185) are dead code, never called; the actual
  palette is fixed black/white.

## Experiments
| variant | substitution | change score | observation | image |
| cc_24 | `int cc = int(random(8, random(20, 40)));` -> `int cc = 24;` | large | much finer 24x24 mosaic of small gradient tiles, same style, busier | variants/cc_24/frame_00001.png |
| walks_30 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 30; i++) {` | large | 9x9 grid sparser: more plain-black unvisited cells, fewer gradient tiles | variants/walks_30/frame_00001.png |
| turnp_05 | `if (random(1) < 0.25) {` -> `if (random(1) < 0.5) {` | large | same coverage, orientations more shuffled, more dark cells and less white | variants/turnp_05/frame_00001.png |
| bg_200 | `background(0);` -> `background(200);` | none | no visible change: the canvas is fully covered by opaque tiles, background pixels never show | variants/bg_200/frame_00001.png |
| walklen_50 | `for (int j = 0; j < 200; j++) {` -> `for (int j = 0; j < 50; j++) {` | large | 9x9 grid sparser: more plain-black unvisited cells than baseline | variants/walklen_50/frame_00001.png |

## Modularisation notes
- Generic: the "stamped gradient grid" idea — a `cc x cc` direction grid filled by N random
  walks of M steps with turn probability p, then rendered as per-cell gradient quads. All of
  L25-165 is parameterisable (cc, walkCount, walkLen, turnProb, turnDelta, tile palette) with no
  other state; a clean parameter object would be `{cellCount, walks, walkLen, turnProb}`.
- One-off art decisions: the 4-way orientation encoding `ndir = dir*2` (L58), the translucent
  neighbour-darkening bands (L74-112), the commented-out line variants (L158-163), and the
  unused colour helpers (L172-185). The gradient effect itself depends on P2D vertex-colour
  interpolation; a JAVA2D port would need explicit gradients.
