---
sketch: 2018/Generativos/diags
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1489
animated: false
techniques: [grid]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#FED42E", "#FF84D4", "#FFAFDA", "#51B9FF", "#2BFF6A", "#BAB9B6"]
  selection: random-from-list
composition: margins
parameters:
  - {name: cc, default: 8, tried: [12], change: moderate, effect: "denser 12x12 grid; smaller cells, more decorations, busier overall"}
  - {name: bb, default: 50, tried: [150], change: moderate, effect: "larger margin shrinks the grid area; cells smaller, more of the gray background visible"}
  - {name: gutter, default: 4, tried: [20], change: subtle, effect: "thicker gray gaps between cells; cell count unchanged, cells slightly smaller"}
  - {name: gradProb, default: 0.4, tried: [1.0], change: moderate, effect: "every cell gets a top gradient wash; noticeably more pastel wash, no plain white cells"}
  - {name: solidSize, default: 0.5, tried: [0.8], change: subtle, effect: "centered squares/circles nearly fill the cell; more visual weight, same shapes"}
reusable_candidates:
  - {name: gradientQuad, signature: "gradientQuad(x, y, w, h, color, alphaTop) -> void", note: "2-triangle vertical gradient fill via per-vertex alpha"}
  - {name: cornerTriFill, signature: "cornerTriFill(x, y, w, h, corner, color, alpha) -> void", note: "fill a corner triangle of a cell, per-vertex alpha"}
  - {name: randomCellDeco, signature: "randomCellDeco(x, y, s, probs, palette) -> void", note: "stochastic decoration of one grid cell (grad / triangles / centered square or circle)"}
---

## What it draws
An 8x8 grid of near-white square cells on a warm gray background, with a uniform gray margin and thin gray gutters between cells. Each cell is independently decorated: a soft vertical color gradient, one or two half-tone triangles in a random palette color, and sometimes a centered solid square or circle. Palette as seen: yellow, hot pink, pale pink, sky blue, and bright green. The look is flat, pastel, Mondrian-lite; no strokes, everything flat or gradient-filled.

## How the code works
`setup()` calls `generate()` once (`draw()` is empty, so the piece is static); `keyPressed` regenerates with a new seed (diags.pde:11-20).
- `generate()` (diags.pde:22-52): sets `background(#BAB9B6)`, seeds noise/random from `seed`, then lays an `cc`x`cc` grid (default `cc=8`) inside a `bb`-pixel margin (default 50). Cell size `ss = (width - 2*bb)/cc`; a 4px gutter between cells comes from drawing each cell rect at `ss-4` (line 42).
- Per cell, in order (diags.pde:40-49), all independent `random(1)` rolls:
  1. always: near-white `fill(240)` rect (the cell base).
  2. with p=0.4: `grad()` — a `beginShape` quad whose top two vertices use `fill(col,160)` and bottom two `fill(col,0)`, i.e. a vertical fade from color to transparent over a random height `ss*random(0.4,1)` (diags.pde:54-63).
  3. with p=0.4 (twice, two separate rolls): `tris()` — a quad that omits one of its four vertices chosen by `int(random(4))`, producing a corner triangle; each vertex gets its own random alpha `random(256)` (diags.pde:65-76).
  4. with p=0.3: centered solid square at `ss*0.5`; with p=0.3: centered solid circle at `ss*0.5` (diags.pde:47-49).
- Colors come from `rcol()` — uniform random pick from the 5-color array (diags.pde:83-86); `getColor()` (lerp version, diags.pde:88-94) is defined but never called.
- No blend modes, no transforms; P3D is only needed so per-vertex alpha works in `beginShape`. Determinism: seed 42 is fixed by the harness (`seed_fields: ["seed"]`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_12 | `int cc = 8;` -> `int cc = 12;` | moderate | 12x12 grid, smaller cells, denser decoration, same palette | variants/cc_12/frame_00001.png |
| bb_150 | `float bb = 50;` -> `float bb = 150;` | moderate | wide gray border, smaller cells, same layout logic | variants/bb_150/frame_00001.png |
| gutter_20 | `...ss-4, ss-4);` -> `...ss-20, ss-20);` | subtle | wider gray gutters, cells a touch smaller, same decorations | variants/gutter_20/frame_00001.png |
| gradProb_1.0 | `if(random(1) < 0.4) grad(...)` -> `< 1.0) grad(...)` | moderate | every cell has a vertical color wash; no plain cells left | variants/gradProb_1.0/frame_00001.png |
| solid_0.8 | `...ss*0.5, ss*0.5);` (rect) -> `ss*0.8, ss*0.8` | subtle | centered squares/circles fill most of the cell; bolder dots/squares | variants/solid_0.8/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the grid-with-margin loop (parameterized by `cc`, `bb`, gutter), `grad` (vertical per-vertex-alpha quad), `tris` (corner-triangle fill with per-vertex alpha), and the stochastic cell decorator (probability vector + shape set + palette).
- One-off art decisions: the exact 5-color pastel palette, the 0.4/0.4/0.3/0.3 probabilities, `ss-4` gutter, `ss*0.5` solid size, warm gray background.
- A clean parameter object: `{cols, rows, margin, gutter, cellBaseColor, probs: {grad, tri1, tri2, square, circle}, solidFrac, gradHeightRange, gradAlpha, triAlpha, palette}`.
