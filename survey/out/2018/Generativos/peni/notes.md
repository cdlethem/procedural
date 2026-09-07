---
sketch: 2018/Generativos/peni
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1552
animated: false
techniques: [grid, dots-stippling, curves, subdivision, noise-field]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#E3DADB", "#00A75B", "#42B6F0", "#ECABB4", "#FEB63F", "#F29AAA", "#297CCA", "#003151", "#E1DBDB"]
  selection: random-from-list
composition: centered
parameters:
  - {name: cc, default: "int(random(2,8))", tried: [], change: "?", effect: "TBD"}
  - {name: gg, default: "int(random(40,100))", tried: [], change: "?", effect: "TBD"}
  - {name: bb, default: 9, tried: [], change: "?", effect: "TBD"}
  - {name: des, default: 2, tried: [], change: "?", effect: "TBD"}
  - {name: arcs, default: 1000, tried: [], change: "?", effect: "TBD"}
  - {name: arcR, default: "width*random(0.012)", tried: [], change: "?", effect: "TBD"}
reusable_candidates:
  - {name: pick, signature: "pick(arr) -> element", note: "uniform random choice from a palette list (rcol, L196-198)"}
  - {name: shadowedCell, signature: "shadowedCell(x, y, size, radius, bg, shadowOffset) -> void", note: "rounded rect with offset solid shadow + thin outline, one per grid cell (L60-67)"}
  - {name: subgridMotif, signature: "subgridMotif(x, y, size, div, fillFrac) -> void", note: "div x div rounded squares in random palette colours, div = 2^k (L95-105)"}
  - {name: dotGrid, signature: "dotGrid(cellSize, dotSize, colorA, colorB, offset) -> void", note: "two offset 4px rects per grid point for a faint halftone background (L28-38)"}
  - {name: arcSpeckles, signature: "arcSpeckles(count, maxRadius) -> void", note: "random small grey arcs (crescents) scattered over the canvas (L117-126)"}
---

## What it draws
On a warm off-white ground with a faint regular dot texture, a centred 2x2 grid of large
rounded squares with thin dark outlines and soft drop shadows; the cells are green, light
blue and pink, and each contains one motif: a grid of small colourful rounded tiles (two
cells), or a solid coloured square centred in the cell (two cells). Every cell also carries a
small central diamond and dot. Faint pastel dots are visible near the canvas edges and thin
pale arcs (crescents) are sprinkled across the whole surface.

## How the code works
`setup()` (L3-11) opens a 960x960 P3D window and calls `generate()` once; `draw()` (L13-15)
is empty so the image is static, and any key press regenerates with a new seed (L17-23).
The harness sets the `seed` field (L1), so the run is deterministic.

- `generate()` starts with a solid `#E3DADB` background (L26).
- **Dot texture** (L28-38): `gg = int(random(40,100))` (L28), `gs = width/gg` (L29); at each
  of the gg*gg grid points it draws a 4x4 black rect at alpha 5 offset by +1 (L33-34) and a
  4x4 white rect at alpha 50 (L35-36) — the faint regular dot grid visible on the ground.
- **Pastel dot lattice** (L45-53): `cc = int(random(2,8))` (L42, 2 for seed 42),
  `ss = width/(cc+1)` (L43), `ds = ss*0.25` (L45); (cc*4+2)^2 pairs of ellipses in random
  `colors` at alpha 8/12 (L48-51), spaced `ds` from the origin — soft pastel dots, most of
  which are covered by the cells, so they read as a fringe near the canvas edges.
- **Cell grid** (L55-115): `bb = 9` (L55), `des = 2` (L56), cell size `s = ss-bb`. Each of
  the cc*cc cells at `((i+0.5)*ss+bb*0.5)` (L60-61) gets a shadow rect in a `backs` colour
  at alpha 200 offset by `des` (L63-64) and a rounded main rect with near-black stroke at
  alpha 240 and near-transparent fill (L65-67). A motif `rnd = int(random(4))` (L69) is
  picked per cell: 0 = circle of `ss*0.5` with drop shadow (L74-78); 1 = diamond of
  `ss*0.8` with shadow (L80-84); 2 = centred square of `ss*0.4` with shadow (L87-92);
  3 = sub-grid of `div = 2^int(random(1,4))` small rounded squares in random `colors`
  (L95-105). Then a small centre dot `ss*0.1` at alpha 20 (L108-109) and two tiny
  diamonds `ss*0.08` / `ss*0.04` (L110-113).
- **Arc speckles** (L117-126): 1000 `noFill()` arcs with random grey stroke, radius up to
  `width*0.012` (~11.5 px) and span up to HALF_PI — the faint crescents scattered over
  everything.
- **Central blob** (L128-129 + L132-145): `circle()` is meant to draw a large noise-wobbled
  blob (radius 0.15-0.25*width) at the canvas centre, but its vertices are computed as
  `(x+cos(theta))*rr` with `x = width/2` (L139-142), which lands the shape ~10^5 px
  off-canvas — it is invisible in the render.
- `nodos()` (L147-176) is defined but never called (its call at L40 is commented out) —
  dead code.

Colour: `rcol()` (L196-198) picks uniformly at random from a list; `backs` (L193) for cell
backgrounds, `colors` (L194) for motifs and dots; drop shadows are fixed black at low
alpha. No blend modes; P3D is used but nothing 3-D is drawn.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `pick`/`rcol` palette picker; the shadowed rounded cell (background + offset
  shadow + thin outline + centred motif); the div^2 sub-grid motif; the faint two-layer
  dot grid background; the arc-speckle overlay.
- One-off art decisions: the two specific palettes (`backs`, `colors`), equal-weight motif
  choice `int(random(4))`, the `ds = ss*0.25` lattice spacing, shadow offset `des`.
- `circle()` (L132-145) has a coordinate bug — vertices must be `x + cos(theta)*rr`, not
  `(x+cos(theta))*rr`; if kept in a library, fix or drop it.
- Clean parameter object: `{seed, gg, cc, bb, des, motifWeights, arcCount, arcRadiusMax,
  backs, colors}`.
