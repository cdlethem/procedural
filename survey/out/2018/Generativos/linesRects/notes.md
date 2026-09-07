---
sketch: 2018/Generativos/linesRects
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1622
animated: false
techniques: [grid, lines-hatching]
primitives: [rect, line]
palette:
  colors: ["#18204a", "#1aade2", "#53a965", "#FFD362", "#ff752f", "#ff5d64"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: ss, default: 5, tried: [10], change: subtle, effect: "background grid squares double in size; composition geometry (which uses its own randomised ss per iteration) looks largely unchanged"}
  - {name: anc, default: 8, tried: [16], change: subtle, effect: "no visible change in this seed: snake path shadow offset and step lengths unchanged; only the large ring composition at bottom-right differs (random draw order)"}
  - {name: iterations, default: 8, tried: [16], change: large, effect: "far more rings, pixel-rects and snakes; canvas becomes crowded and the empty left half fills in"}
  - {name: cc, default: "random(-5,4)", tried: [12], change: large, effect: "each iteration places many more small shadowed squares; small squares dominate, big rings barely visible"}
  - {name: shw_alpha, default: 12, tried: [48], change: moderate, effect: "drop shadows on rects and snakes much darker and harder-edged; flatter, higher-contrast sticker look"}
  - {name: colors, default: "6-colour list", tried: "navy + light-blue only", change: moderate, effect: "everything recoloured to blue monochrome; composition unchanged"}
reusable_candidates:
  - {name: arcRing, signature: "arcRing(cx, cy, r1, r2, a1, a2, col, shd1, shd2)", note: "annular band tessellated into shaded quad segments (arc2, lines 239-275)"}
  - {name: rectShadow, signature: "rectShadow(x, y, w, h, s, alpha)", note: "rect with 4 gradient drop-shadow edges (rectShw, lines 200-237)"}
  - {name: gridSnake, signature: "gridSnake(cell, anc, start, maxSteps) -> PVector[]", note: "orthogonal random walk on a cell grid, each step rendered as a shaded quad strip with corner shadow (lines 104-196)"}
---

## What it draws
Light blue-grey paper (#D5DEE3) with a faint 5-px square grid covering the whole canvas. On top, 8 scattered
compositions of flat geometric shapes in a 6-colour palette (navy, light blue, green, yellow, orange, coral):
segmented donut rings made of thick annular arcs, blocky rectangles filled with a small grid of random colour
cells, a few lone small coloured squares, and thick angular "snake" paths that turn right-angle corners, each
step a flat quad with a slightly darker shade. Almost every shape carries a soft black drop shadow that fades to
transparent, giving a paper-cut / sticker look. Density is uneven — the right and lower parts of the canvas are
crowded, the left half mostly empty.

## How the code works
`setup()` (lines 3-9) sizes 960x960 P2D and calls `generate()` once; `draw()` is empty, so the image is static
and deterministic given the seed.

- `generate()` (lines 22-197): fills background #D5DEE3 (line 23), then draws the base grid: nested loops at
  `ss=5` px step stroking 5x5 no-fill squares with alpha-2 black stroke (lines 27-36) — the faint paper grid.
- The main loop runs 8 times (line 39). Each iteration picks a cell size `ss = 5*2^random(0..2)` -> 5, 10 or 20
  (line 41), derives grid dimensions `cw`/`ch` (lines 43-44), then draws one composition:
  - a big ring: random centre (lines 50-51), outer radius `s2` up to the canvas width (line 52); the while loop
    (lines 54-68) sweeps TWO_PI in random arc chunks, drawing each chunk with `arc2` — first two calls with the
    7-arg overload (lines 60-61, 63-64) lay thin alpha-10/18 black shadow bands slightly outside/inside, and the
    final 5-arg `arc2` (line 67) fills the band with `rcol()`. `arc2` (lines 239-275) tessellates the annular
    band into small quads, two per segment with different fill alphas to fake a shadow gradient.
  - one large shadowed rect (`rectShw`, line 75) whose cells are filled with per-cell `rcol()` squares
    (lines 76-81) — the multi-colour pixel blocks.
  - `cc` small shadowed squares (lines 84-92, `cc` in -5..4) — the lone small squares.
  - a snake: orthogonal random walk starting at a random edge or centre (lines 94-118), step length
    `anc/2 + random(1, random(4,18))` cells (line 112); each step is drawn as a flat quad strip of width
    `ss*anc*0.5` (lines 140-163) with the far half lerped 10% toward black (line 160), plus a soft corner shadow
    quad where the path turns (lines 165-194).
- Colour always comes from `rcol()` (lines 292-294), a uniform pick from the 6-colour array (line 291).
  Shadows are pure black with low alpha (10/18 in `arc2`, 12 in `rectShw`, 30 in snake corners) fading to 0 —
  no blend modes, no noise.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_10 | `int ss = 5; ` -> `int ss = 10;` | (running) | | variants/ss_10/frame_00001.png |
| anc_16 | `int anc = 8; ` -> `int anc = 16;` | (running) | | variants/anc_16/frame_00001.png |
| iterations_16 | `for (int c = 0; c < 8; c++) {` -> `... c < 16; ...` | (running) | | variants/iterations_16/frame_00001.png |
| cc_12 | `int cc = int(random(-5, 4));` -> `int cc = int(random(0, 12));` | (running) | | variants/cc_12/frame_00001.png |
| shw_alpha_48 | `, min(ccx*ss, ccy*ss)*0.2, 12);` -> `..., 48);` | (running) | | variants/shw_alpha_48/frame_00001.png |
| colors_navyblue | 6-colour `int colors[] = {...}` -> navy + light-blue only | (running) | | variants/colors_navyblue/frame_00001.png |

## Modularisation notes
- Generic, reusable: `arc2` (shaded annular band, 2 overloads), `rectShw` (gradient-edge drop shadow), and the
  snake step renderer (quad strip + corner shadow) are all self-contained with clear signatures (see
  `reusable_candidates`). The 6-colour `rcol()` picker is a trivial random-from-list palette function.
- One-off art decisions: the 8-iteration composition recipe (ring + pixel-rect + small squares + snake per
  iteration), the `5*2^k` cell-size quantisation, the shadow alpha ladder (10/18/12/30), and the
  `lerpColor(col, color(0), 0.1)` half-darkening of snake strips.
- A clean parameter object: `{iterations, baseCell, cellSteps: [5,10,20], ringSizeRange: [0.1,1.0]*width,
  smallSquareCount: [0,4], snakeMaxSteps, shadowAlphas: {arcOuter:10, arcInner:18, rect:12, corner:30},
  palette: [6 hex]}`. Note the walk is unbounded until it exits the grid, so `snakeMaxSteps` would be a new
  safety parameter rather than an existing one.
