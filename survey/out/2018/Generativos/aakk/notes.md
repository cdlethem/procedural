---
sketch: 2018/Generativos/aakk
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1539
animated: false
techniques: [grid]
primitives: [rect, shape]
palette:
  colors: ["#5000C8", "#50C800", "#31A151", "#FFA71E", "#05084C", "#DE4638", "#3DBDB7"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(12, 21))", tried: [6], change: large, effect: "fewer, much larger tiles (6x6 grid instead of ~15x15)"}
  - {name: bb, default: "ss*0.18", tried: ["ss*0.05"], change: subtle, effect: "thinner bevels, flatter checker; bevels nearly disappear"}
  - {name: alp, default: 100, tried: [200], change: moderate, effect: "stronger, higher-contrast bevel edges (more sunken/glossy 3D)"}
  - {name: c1, default: "int(random(4))", tried: [0], change: moderate, effect: "bevel white/black orientation pattern shifts (now driven only by column)"}
  - {name: "checker green", default: "fill(80, 200, 0)", tried: ["fill(200, 80, 0)"], change: large, effect: "green tiles become orange"}
reusable_candidates:
  - {name: bevelCell, signature: "bevelCell(x, y, size, bevelFrac, angle, col, alpha)", note: "four corner bevel quads (two verts at full alpha, two at 0) that give a 3D inset/raised look to a grid cell"}
---

## What it draws
A full-bleed checkerboard of purple and green squares (about 15×15 cells). Every cell
corner carries a small bevel — a white- or black-tinted triangular gradient fading into the
cell — so the whole grid reads as glossy 3D tiles / embossed buttons. The background
colour (visible only as a thin border if any) is pulled from a fixed 5-colour palette.

## How the code works
`setup()` (aakk.pde:3) sizes 960×960 P2D and calls `generate()`. `draw()` is empty so the
image is static (keyPress regenerates).

`generate()` (aakk.pde:32):
- `background(rcol())` paints the backdrop with one colour picked at random from the
  `colors[]` palette (aakk.pde:141, `rcol()` at :142).
- `cc = int(random(12, 21))` (:35) sets cells per row/column; `ss = width/cc` is the cell
  size and `bb = ss*0.18` (:37) is the bevel depth. `alp = 100` (:39) is the bevel alpha.
- Double loop `j`,`i` over `cc×cc` cells (:46). Each cell is a `rect` (:55) coloured purple
  `fill(80,0,200)` on even `(i+j)` and green `fill(80,200,0)` on odd (:50-51) → the checker.
- `ind = j*c1*cc + i*c2` (:53) with `c1`,`c2` ∈ 0..3 (:44-45) drives `ang = ind*HALF_PI`
  (:59); the sign of `cos(ang)` decides whether a corner bevel is white (255) or black (0).
- Four `beginShape()` quads (:64-107) draw one bevel per corner: two vertices use
  `fill(col, alp)` and two use `fill(col, 0)`, so the corner fades from a white/black
  highlight to transparent — the 3D bevel. `bb` insets the inner two vertices.

Randomness enters only via `seed` → background colour, `cc`, `c1`, `c2`. `des`/`det`
(:42-43) feed a commented-out noise angle (:60) and are unused.

## Experiments
| variant | substitution | change score | observation | image |
| cc_6 | `int cc = int(random(12, 21));` -> `int cc = 6;` | large | 6x6 coarse grid of much larger beveled tiles; checker scale-up | variants/cc_6/frame_00001.png |
| bb_0.05 | `float bb = ss*0.18;` -> `float bb = ss*0.05;` | subtle | same ~15x15 grid but bevels much thinner -> flatter, closer to a plain checkerboard | variants/bb_0.05/frame_00001.png |
| alp_200 | `float alp = 100;` -> `float alp = 200;` | moderate | same grid, bevels stronger/wider darker edges, higher contrast 3D | variants/alp_200/frame_00001.png |
| c1_0 | `int c1 = int(random(4));` -> `int c1 = 0;` | moderate | same grid and colours; white/black bevel orientation pattern shifts across columns | variants/c1_0/frame_00001.png |
| checker_200_80_0 | `else fill(80, 200, 0);` -> `else fill(200, 80, 0);` | large | green cells replaced by orange; same bevel structure, overall palette shift | variants/checker_200_80_0/frame_00001.png |

## Modularisation notes
The generic, reusable block is the **beveled grid cell**: a function that takes a cell
origin/size, a bevel fraction, a per-corner orientation, and a highlight colour + alpha, and
draws the four fading corner quads. That is art-agnostic and could be a library primitive
(`bevelCell`). The checkerboard two-colour fill and the `ind = j*c1*cc + i*c2` angle
selector are one-off art decisions. A clean parameter object would be:
`{ cells, bevelFrac, bevelAlpha, palette[5], checkerA, checkerB, angleMode }`.
