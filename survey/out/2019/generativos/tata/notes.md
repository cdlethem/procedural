---
sketch: 2019/generativos/tata
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1674
animated: false
techniques: [grid, agents, dots-stippling]
primitives: [rect, line, ellipse]
palette:
  colors: ["#000000", "#FFFFFF", "#FF0000"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: cc, default: "random(18,26)", tried: [12], change: large, effect: "coarser 12x12 grid; thick paths fill cells into large blocky maze regions; dots and rings scale up"}
  - {name: walks, default: 90, tried: [30], change: large, effect: "one third of the walks; much sparser canvas, more white grid showing, fewer red markers"}
  - {name: walkMaxSteps, default: 60, tried: [20], change: large, effect: "many short segments; red endpoint dots and rings become numerous and dominant; less total black (dark frac 0.616->0.425)"}
  - {name: strokeWeight, default: "0.2-0.9 of cell", tried: ["0.6-0.9 of cell"], change: moderate, effect: "thicker lines (dark frac 0.616->0.683); white centreline and vertex dots more visible"}
  - {name: cellDiscProb, default: 0.1, tried: [0.4], change: none, effect: "no visible change; new black discs land mostly on cells already covered by black walk lines"}
  - {name: stippleSize, default: "0.08 of cell", tried: [0.2], change: subtle, effect: "slightly larger cell-centre dots; some white dots now cover parts of black lines (dark frac 0.616->0.609)"}
reusable_candidates:
  - {name: gridRandomWalk, signature: "gridRandomWalk(cols, rows, maxSteps, avoidUsed: boolean[][]) -> PVector[]", note: "random walk over a cell grid that never revisits a used cell; returns the path of cell coords"}
  - {name: tripleStrokePath, signature: "tripleStrokePath(pts, weight, shadowOffset, highlight: float, endColor) -> void", note: "draw one polyline 3x: translucent offset shadow, main thick stroke, thin centre highlight with coloured endpoints"}
---

## What it draws
A dense full-bleed white grid of square cells separated by thin black lines, covering the
whole 960x960 canvas. Over the grid run many thick black zigzag polylines (random walks)
that turn at right angles, each with a faint grey offset shadow and a hairline white
centre. Red dots mark the start and end of most walks, and a few walks are ringed by a
large thin red circle. Scattered cell centres carry small black dots (stippling), and a
few cells hold a larger solid black disc.

## How the code works
`generate()` (tata.pde:49) is called once from `setup()` (L23); `draw()` is empty, so the
sketch is static. Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` (L52-53) on a
black background (L54).

1. **Grid** (L57-68): `cc = int(random(18,26))` cells per side (L57); each cell is a white
   rounded rect with a 1px gap (L62), so the black background shows as a thin grid line.
   With probability 0.1 a cell gets a solid black disc of `ss*0.25` (L63-66).
2. **Walks** (L72-145): 90 independent walks. Each starts at a random cell (L74-75), takes
   `lar = int(random(60)*random(1))` steps (L76); per step it tries up to 4 random
   4-neighbour moves and keeps the first that is in-bounds and unvisited, marking the cell
   in `used[][]` (L77-96). Path length is therefore 0-59 and bounded by visited cells.
3. **Stroke** (L98-127): weight `ns = ss*random(random(random(0.2,0.5),0.9),0.9)` (L98).
   The polyline is drawn three times: offset by (4,3) px in translucent black `stroke(0,20)`
   with square caps (L100-109), then the main black stroke (L110-116), then a hairline
   white stroke `ns*0.05` whose first/last vertices are red (L117-127).
4. **Endpoints** (L129-144): red filled dot `ns*0.5` at start and end; with probability 0.1
   a large red ring `ss*2` around the endpoint.
5. **Stipple** (L147-153): every cell centre gets a dot of `ss*0.08` coloured black or
   white (L150) — white dots are invisible on white cells, leaving the scattered black dots.

The `colors[]` palette (L167) and helpers `rcol()`/`getColor()` (L174-186) are never called;
the piece is strictly black/white/red. Imports of triangulate and toxi noise (L1-2) are also
unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_12 | `int cc = int(random(18, 26));` -> `int cc = 12;` | large (mean 0.4439, 64.5% of px) | coarse 12x12 grid; cells ~80px; thick walks fill cells so black merges into big blocky maze regions; red endpoint dots and red rings proportionally much larger | variants/cc_12/frame_00001.png |
| walks_30 | `for (int j = 0; j < 90; j++) {` -> `for (int j = 0; j < 30; j++) {` | large (mean 0.2039, 24.9% of px) | far fewer walks; mostly white grid with scattered black paths; fewer red dots/rings; overall dark fraction drops to 0.413 | variants/walks_30/frame_00001.png |
| walklen_20 | `int lar = int(random(60)*random(1));` -> `int lar = int(random(20)*random(1));` | large (mean 0.4266, 57.6% of px) | many short black segments instead of long meanders; red endpoint dots and rings far more numerous and visually dominant; less total black coverage | variants/walklen_20/frame_00001.png |
| lineweight_0.6 | `float ns = ss*random(random(random(0.2, 0.5), 0.9), 0.9);` -> `float ns = ss*random(random(random(0.6, 0.9), 0.9), 0.9);` | moderate (mean 0.0721, 14.6% of px) | same structure with visibly thicker black lines (dark fraction 0.616 -> 0.683); white centreline and small white vertex dots stand out more | variants/lineweight_0.6/frame_00001.png |
| celldisc_0.4 | `if (random(1) < 0.1) {` -> `if (random(1) < 0.4) {` (L63; first attempt failed bad_sub on wrong indentation) | none (mean 0.0021, 0.3% of px) | no visible change despite 4x more black cell discs (dark fraction 0.6159 -> 0.6179): most new discs fall on cells already covered by the thick black walk lines | variants/celldisc_0.4/frame_00001.png |
| stipple_0.2 | `ellipse((i+0.5)*ss, (j+0.5)*ss-1, ss*0.08, ss*0.08);` -> `ss*0.2` | subtle (mean 0.0125, 2.9% of px) | cell-centre dots slightly larger; some enlarged white dots erase bits of black line, so net dark fraction dips a little (0.616 -> 0.609) | variants/stipple_0.2/frame_00001.png |

Dark-fraction figures measured on the 960x960 frame-1 PNGs (threshold <100) to resolve the
lineweight and celldisc cases where the pixel-diff score alone was ambiguous.

## Modularisation notes
- **Generic**: `gridRandomWalk` (L72-96) is a reusable self-avoiding grid walker — the
  `used[][]` avoidance and 4-try rejection loop are the only art-specific parts.
  `tripleStrokePath` (L100-127) is a reusable "shadowed line with highlight and endpoint
  markers" primitive. The white-cell grid (L59-68) is a trivial reusable `cellGrid(cc, gap,
  cornerRadius)`.
- **One-off art decisions**: the 0.1 black-disc probability, the 0.1 red-ring probability,
  the specific (4,3) shadow offset, red as the marker colour, the `ss*0.08` stipple size.
- **Parameter object**: `{gridCount: 18-26, walkCount: 90, walkMaxSteps: 60,
  strokeWeightRange: [0.2,0.5] of cell, shadowOffset: (4,3), endpointDot: 0.5 of weight,
  ringProb: 0.1, cellDiscProb: 0.1, stipple: 0.08 of cell, palette: B/W/red}`.
  `noiseSeed` is set but no noise is ever sampled, so no noise parameters are needed.
