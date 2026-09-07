---
sketch: 2014/Generativos/prueba2
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 181
animated: true
techniques: [grid, polar]
primitives: [ellipse]
palette:
  colors: ["#171535"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: dim, default: 80, tried: [160], change: pending, effect: "max arc diameter per node"}
  - {name: cant, default: 10, tried: [40], change: pending, effect: "arcs stacked per node"}
  - {name: rows, default: 8, tried: [4], change: pending, effect: "grid rows (j loop)"}
  - {name: cols, default: 6, tried: [3], change: pending, effect: "grid columns (i loop)"}
  - {name: hue, default: "random(255)", tried: ["random(30,70)"], change: pending, effect: "hue band of generated colours"}
  - {name: alpha, default: "256-(random(1)*random(256))", tried: ["256"], change: pending, effect: "wedge opacity"}
reusable_candidates:
  - {name: arcGrid, signature: "arcGrid(cols, rows, ox, oy, spacing, arcsPerNode, dim) -> List<Arco>", note: "place arcsPerNode pie wedges at each node of a cols x rows grid"}
  - {name: lerpArc, signature: "lerpArc(x, y, from{size,ang1,ang2,color}, to{...}, t) -> arc", note: "draw an arc interpolated between two states, colour via lerpColor"}
---

## What it draws
A dark navy field (seed 42) of flat, multi-coloured pie-slice wedges sitting at the nodes of a
loose 8 x 6 grid. Each wedge is a filled arc sector of random size, rotation and hue; many are tiny
or semi-transparent, so the composition reads as scattered bright slivers over a dark ground. The
sketch is animated: at frame 1 only a couple of wedges are prominent, and by frame 60 the whole
grid has filled in with a dense, busy set of wedges.

## How the code works
`setup()` (lines 3-14) sets `size(600,800)`, `colorMode(HSB,256)`, `noStroke()`, then builds a grid
of `Circulo` objects: 8 rows (j) x 6 columns (i), each node at `(62+i*95, 65+j*95)` with
`cant=10` arcs and `dim=80` (max wedge size). Each `Circulo` owns `cant` `Arco` objects, all
centred on the node (480 arcs total).

Each `Arco` (class, lines 56-105) holds a *current* state (`tam`, `ang1`, `ang2`, `col`) and a
*target* state (`otam`, `oang1`, `oang2`, `ocol`), plus a transition progress `objetivo` and a
timer `tiempo`. On construction (lines 62-72) the current state is randomised: `tam =
random(dim*0.08, dim)`, `ang1`/`ang2 = random(TWO_PI)`, and a random HSB colour
`color(random(255), random(180,255), random(240,255), 256-(random(1)*random(256)))` — full hue
range, high saturation/brightness, variable alpha.

`draw()` (lines 16-31) repaints `background(#171535)` every frame (so it is a re-draw animation, not
accumulating) and calls `act()` on every arc. In `act()` (lines 73-84) `tiempo` counts down and on
zero triggers `cambiar()` (lines 98-105), which rolls a *new* random target and resets
`objetivo=1`; meanwhile `objetivo -= random(0.01,0.05)` eases the transition toward the target,
and once `objetivo<=0` the current state snaps to the target. `dibujar()` (lines 85-97) draws the
wedge with `arc(c.x, c.y, size, size, ang1, ang2)`: while transitioning it interpolates size/angles
with `map()` and the fill with `lerpColor(ocol, col, objetivo)`; after settling it fills with `col`.
Randomness enters at construction and at every `cambiar()`. No blend mode, no noise, no shaders —
the whole visual is random arc sectors + lerpColor over a fixed dark background.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The generic, reusable block is the *morphing arc field*: a grid of nodes, each carrying N pie wedges
that each independently lerp between random `(size, ang1, ang2, hsb-color)` states on a per-arc
timer. That is `arcGrid` (layout) + `lerpArc`/`Arco.act` (the transition). The one-off art
decisions are the specific grid metrics (`62/65` origin, `95` spacing, `10` arcs, `80` size), the
HSB ranges (full hue, sat 180-255, bright 240-255, random alpha), the background `#171535`, and the
easing `random(0.01,0.05)`. A clean parameter object for a library version would contain:
`cols, rows, origin, spacing, arcsPerNode, dim, hueRange, satRange, brightRange, alpha,
transitionStep, retimerRange, background`.
