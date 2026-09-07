---
sketch: 2014/Generativos/curdiculasdecuadrados
year: 2014
renderer: JAVA2D
size: [600, 600]
libraries: []
deterministic: true
ms_first_frame: 161
animated: true
techniques: [subdivision, lines-hatching, grid]
primitives: [rect, line]
palette:
  colors: ["#000000", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: depth, default: 5, tried: [7], change: large, effect: "deeper quadtree -> many more small cells; canvas fills into a dense diagonal-hatched black field with sparse white blocks"}
  - {name: max_esp, default: 60, tried: [40], change: moderate, effect: "smaller max spacing -> denser/finer hatch lines in the open white regions; layout unchanged"}
  - {name: min_esp, default: 20, tried: [8], change: moderate, effect: "smaller min spacing -> slightly denser lines in the tightest cells; layout unchanged"}
  - {name: vel, default: 0.4, tried: [0.08], change: none, effect: "only sets how fast line spacing drifts across frames; no visible change in a single frame"}
  - {name: fillBias, default: 5, tried: [8], change: subtle, effect: "raises share of white-fill cells; a few cells flip between white and black fill, layout unchanged"}
  - {name: phaseStep, default: 0.01, tried: [0.05], change: subtle, effect: "faster phase creep; at frame 1 the hatch is shifted slightly further, layout and density unchanged"}
reusable_candidates:
  - {name: quadtree, signature: "quadtree(x, y, w, h, depth, keepProb) -> Cubito[]", note: "recursive quadrant split that recurses into each of the 4 children with probability random(5)<depth"}
  - {name: rectLine, signature: "rectLine(x, y, w, h, spacing, phase, dir) -> void", note: "parallel hatch lines in one of 4 directions (H, diag-, V, diag+), offset by phase*spacing"}
  - {name: hatchCell, signature: "hatchCell(x, y, w, h, fill, stroke, spacing, dir) -> void", note: "solid-fill rect + single-direction hatch overlay, the per-cell look"}
---

## What it draws
A 600x600 square tiled as a quadtree of nested squares: each cell is split into four quadrants, and some of those sub-cells are split again, down to a random depth. Every cell is painted solid black or solid white and overlaid with thin parallel lines (hatching) all running in one of four fixed orientations — horizontal, vertical, or one of the two diagonals. The result is a mosaic of black-and-white patches, each cross-hatched in a single direction, reading as a technical blueprint texture. Frame 60 vs frame 1 keeps the same cell layout but the hatch lines have shifted phase and the line spacing has changed, so the texture shimmers/creeps.

## How the code works
- `setup()` (lines 2-7): `size(600,600)`, `smooth(8)`, then `generar(0,0,width,height,5)` builds the whole structure once. The quadtree layout is fixed after this.
- `generar(x,y,w,h,n)` (lines 27-36): recursive quadtree. Adds a `Cubito` for the current rect, `n--`, and if `n>0` recurses into each of the 4 quadrants with probability `random(5) < n`. So deep levels are filled sparsely — most cells stop being subdivided, leaving a mix of large and small squares.
- `Cubito` constructor (lines 44-62): stores the rect; `min_esp=random(1,20)`, `max_esp=random(20,60)`, `esp` in between; `vel=random(0.1,0.4)`; `dir=random(4)` = hatch orientation; a coin flip `random(10)<5` picks the colour pair — either (stroke black, fill white) or (stroke white, fill black). So each cell is either dark-with-light-lines or light-with-dark-lines.
- `draw()` (lines 9-15): `background(255)` each frame, then calls `act()` on every cell.
- `act()` (lines 63-69): `des += 0.01` (line phase, wraps to 0 past 1); `esp += vel` (spacing walks upward, resets to `min_esp` when it exceeds `max_esp`); then `dibujar()`.
- `dibujar()` (lines 70-76): `noStroke()` + `fill(f)` + `rect` paints the cell solid; then `stroke(s)` + `rectLine(...)` draws the hatch.
- `rectLine(x,y,w,h,esp,des,dir)` (lines 80-115): `strokeCap(SQUARE)`; `dir 0` = horizontal lines, `dir 1` = diagonal `\`, `dir 2` = vertical, `dir 3` = diagonal `/`. Lines start at `i = int(esp*des)`, so the phase `des` slides the whole hatch by up to one spacing each frame (the creep); the changing `esp` makes the density breathe.
- Randomness enters at: `random(5)<n` (subdivision), `min_esp`/`max_esp`/`vel` (spacing), `dir` (orientation), and the colour coin flip. No `noise()` is used.
- Animation: the fixed quadtree is redrawn every frame, but `esp` (spacing) oscillates and `des` (phase) creeps, so the hatch lines move while the cell layout stays put.

## Experiments
| variant | substitution | change score | observation | image |
| depth_7 | `generar(0, 0, width, height, 5);` -> `...7);` | large | very different: far more small cells, canvas fills into a dense diagonal-hatched black field with only scattered white blocks | variants/depth_7/frame_00001.png |
| max_esp_40 | `max_esp = int(random(20, 60));` -> `...40));` | moderate | denser, finer hatch lines in the white regions (closer spacing); same cell layout | variants/max_esp_40/frame_00001.png |
| min_esp_8 | `min_esp = int(random(1, 20));` -> `...8));` | moderate | slightly denser lines in the tightest cells; same layout | variants/min_esp_8/frame_00001.png |
| vel_0.02 | `vel = random(0.1, 0.4);` -> `random(0.02, 0.08);` | none | no visible change at frame 1 (vel only sets spacing-drift speed over frames) | variants/vel_0.02/frame_00001.png |
| fill_bias_8 | `if (random(10) < 5) {` -> `if (random(10) < 8) {` | subtle | a few cells flipped to white fill; overall layout unchanged | variants/fill_bias_8/frame_00001.png |
| des_0.05 | `des += 0.01;` -> `des += 0.05;` | subtle | hatch lines shifted a bit further from their start phase; layout and density unchanged | variants/des_0.05/frame_00001.png |

## Modularisation notes
Two blocks are generic and worth lifting into the library:
- **Quadtree subdivision** (`generar`): a pure recursive split with a per-child keep-probability. Parameterise as `quadtree(x, y, w, h, depth, keepProb)` returning a list of leaf rects. The one-off art decision is the `keepProb` being depth-dependent (`random(5) < n`) and the fixed depth of 5.
- **Hatch renderer** (`rectLine`): a self-contained 4-direction parallel-line hatch with a `phase` (0..1, offsets by up to one spacing) and a `spacing`. Parameterise as `rectLine(x, y, w, h, spacing, phase, dir)`. The per-cell colour pair (solid fill + contrasting stroke) is an art decision that can be a `hatchCell` wrapper.

A clean parameter object for the sketch would contain: `depth` (5), `keepBase` (5, the divisor in `random(5)`), `espMin`/`espMax` (1..20 / 20..60), `velRange` (0.1..0.4), `phaseStep` (0.01), `fillBias` (0.5, the coin flip), `size` (600). The quadtree layout and per-cell orientation/colour are sampled once per `Cubito` at construction; only `esp` and `des` animate.
