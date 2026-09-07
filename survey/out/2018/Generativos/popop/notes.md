---
sketch: 2018/Generativos/popop
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1479
animated: false
techniques: [grid, dots-stippling, symmetry, distortion]
primitives: [rect, ellipse, shape, point]
palette:
  colors: ["#FFF9EF", "#FCADE0", "#927EE8", "#511E42"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: "random(2,33)", tried: [6], change: none, effect: ""}
  - {name: colors, default: "FFF9EF/FCADE0/927EE8/511E42", tried: ["EAF4FF/7FB2E5/0169B3/024E2C"], change: none, effect: ""}
  - {name: srect_alpha, default: 20, tried: [200], change: none, effect: ""}
  - {name: diag_prob, default: 0.6, tried: [1.0], change: none, effect: ""}
  - {name: amp, default: 5, tried: [20], change: none, effect: ""}
  - {name: center_r, default: "ss*0.12", tried: ["ss*0.3"], change: none, effect: ""}
reusable_candidates:
  - {name: srect, signature: "srect(x, y, w, h, bevel, col, a1, a2)", note: "4-sided bevelled/offset drop-shadow quad around a centre rect"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "ring of small trapezoid wedges forming a soft annular arc between two radii"}
  - {name: rcol, signature: "rcol() -> int", note: "pick one colour at random from a fixed list"}
---

## What it draws
A 3x3 grid of large soft pastel tiles filling the frame. Each tile is a flat colour
(cream, pink, or purple) with a faint diagonal light-to-dark sweep, a thin white cross
through the centre, a small white circle with a dark dot at the middle, tiny white
corner triangles, and (on some tiles) a thin white circle outline. The tiles read as a
tiled mosaic of muted, low-contrast squares with small white mechanical motifs.

## How the code works
`setup()` calls `generate()` once (empty `draw()`, so the sketch is static).
- Grid: `cc = int(random(2, 33*random(0.2, 1)))` (popop.pde:27) sets the number of
  tiles per row; `ss = width/cc` (line 28) is the tile size. Baseline seed 42 gives a
  3x3 grid.
- Double loop `j`/`i` (lines 35-36) places each tile centre at `(i+0.5)*ss` (line 37-38).
- Base colour: a full-tile rect `fill(rcol())` (line 39-42) from the 4-colour list
  `colors` (line 178) via `rcol()` (line 179-181, `random` index).
- Shadow: `srect(...)` (line 44, defined 137-175) draws 4 offset bevelled quads (alpha
  `20`->`0`) around the tile, giving the soft drop-shadow / bevel look.
- White cross: two thin `rect`s (lines 46-49) split each tile into quadrants.
- Diagonal sweep: `if random(1)<0.6` (line 51) draws a 3-vertex `beginShape` triangle
  (lines 52-87) with per-vertex `fill(255, random(256))`, i.e. a translucent white
  right-triangle that fades across the tile — the diagonal light sweep.
- Circle outlines: two optional `ellipse` (noFill, stroke 255) at `ss` and `ss*0.5`
  (lines 91-93, each `<0.2` chance).
- Centre: white filled circle `ss*0.12` (line 96) plus `arc2` (line 98, defined 117-135)
  drawing a faint annulus, and a tiny `ss*0.02` dot in `rcol()` (line 100).
- Corner ticks: four small white `triangle`s, size `bb*amp` with `amp=5` (lines 104-107).
Randomness enters via `randomSeed(seed)` (line 25) and every `random()` call; colour is
always `random`-from-list, no noise. Renderer is P2D; no blend modes used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic / library candidates: `srect` (bevelled drop-shadow rect) and `arc2` (soft
annular arc) are self-contained geometric primitives with a (x, y, size, colour,
alpha) interface and no other dependencies — strong library candidates. The
`rcol()`/`getColor()` palette helpers are generic. The rest is a one-off art decision:
the specific grid density, the 4-colour pastel list, the per-cell motif mix (cross,
diagonal triangle, corner ticks, centre dot), and the random probabilities. A clean
parameter object would hold: `cc` (grid density), `colors[]` (palette), the per-motif
probabilities (diag, circle-outline, corner-tick), `amp` (corner-tick size), `bevel`
(`-ss*0.2`) and its alphas, and the centre-dot/arc scale (`ss*0.12`, `ss*0.4`,
`ss*0.02`).
