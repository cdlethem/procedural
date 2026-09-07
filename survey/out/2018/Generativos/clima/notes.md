---
sketch: 2018/Generativos/clima
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1700
animated: false
techniques: [subdivision, grid, noise-field, lines-hatching, dots-stippling]
primitives: [rect, line, ellipse, arc, shape]
palette:
  colors: ["#19143C", "#F67379", "#F6C7C2", "#C3C5A1", "#7DA89B"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sep, default: 120, tried: [240], change: large, effect: "larger minimum cell size; coarser tiling with fewer, bigger cells, bigger bubble clusters and mountains"}
  - {name: sub, default: "int(random(500)*random(1)) = 0-499", tried: ["int(random(2000)*random(1))"], change: large, effect: "more subdivision iterations; finer, busier tiling with many smaller cells"}
  - {name: gri, default: 15, tried: [30], change: large, effect: "coarser per-cell texture: sparser dot grid, larger mini-squares/ellipses, coarser flow hatch; same cell layout"}
  - {name: det1, default: "random(0.01)", tried: ["random(0.001)"], change: none, effect: "no visible change (seed-42 draw of random(0.01) is already tiny, so flow angles are near-constant either way)"}
  - {name: cc, default: "int(random(1, 4)) = 1-3", tried: ["int(random(1, 8))"], change: large, effect: "up to 7 mountain layers per cell; denser, more jagged bottom silhouettes"}
  - {name: div, default: "int(random(20)) = 0-19", tried: ["int(random(5))"], change: moderate, effect: "shallower bubble-cluster recursion; fewer, smaller circles per cell"}
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(rects, maxIters, minSep, sep) -> Rect[]", note: "randomly split cells into 4 grid-aligned children until maxIters or min size"}
  - {name: flowFieldHatch, signature: "flowFieldHatch(x, y, w, h, step, detail, maxLen) -> void", note: "dense short lines, angle/length from 2-D noise, constrained to the cell"}
  - {name: bubbleCluster, signature: "bubbleCluster(cx, cy, r, div) -> PVector[]", note: "recursively split a circle into 2 children; render each with ring arcs + filled disc"}
  - {name: mountainLayer, signature: "mountainLayer(x, y, w, h, points, c1, c2) -> void", note: "triangular silhouette along the bottom of a rect from random x breakpoints"}
  - {name: speckleArcs, signature: "speckleArcs(n, maxD, alpha) -> void", note: "scattered partial-circle fragments over the whole canvas"}
---

## What it draws
A full-bleed tiling of irregular rectangular cells (quadtree layout) in a muted palette of
dusty pink, sage green, pale cream and dark navy. Each cell has a soft flat colour, a faint
grid of small squares/dots, a fine "brushed" line texture, a cluster of overlapping circular
bubbles with concentric rings (some read as eyes), and stacked triangular mountain silhouettes
along the cell's bottom edge. A light speckle of tiny arc fragments is scattered over the
whole image.

## How the code works
Static sketch: `setup()` (clima.pde:3-8) calls `generate()` once; `draw()` (10-12) is empty,
so frames 1/10/60 are identical. `keyPressed` (14-20) regenerates with a new random seed.

- Subdivision (32-53): start with the full-canvas rect; `sub = int(random(500)*random(1))`
  iterations pick a random rect and split it into four children at offsets that are multiples
  of `sep = 120` (46-51); rects smaller than 2*sep on a side are skipped (45). This produces
  the irregular cell tiling.
- Per-cell loop (57-193), each cell gets, in order:
  - flat fill from `rcol()` (60-61);
  - vertical + horizontal grid lines every `gri = 15` px in a random palette colour at low
    alpha (63-71) — the faint square grid;
  - a flow-field hatch: grid at `gri*0.25` spacing, angle = `noise(...)*TAU*2`, length =
    `noise(...)*gri`, endpoints constrained inside the cell, random palette colour at
    low alpha (73-90) — the brushed texture;
  - small scattered dots (94-101), grid-aligned mini-rects (103-109) and grid-aligned
    mini-ellipses (111-118);
  - two translucent full-cell shape overlays to muddy the colour (122-129, 164-171);
  - a bubble cluster: a circle of radius `min(w,h)*random(0.2,0.9)` is split into two
    children `div = int(random(20))` times (131-153); each leaf is drawn as two ring arcs
    (`arc2`, 210-228) + a filled disc + a small inner ring (154-162);
  - 1-3 mountain layers via `montains()` (173-176, 230-255): 10 random x-breakpoints,
    triangle peaks alternating between two random palette colours, closing along the
    rect's bottom edge.
- Final pass (195-207): 1000 partial-circle fragments of diameter ~`width*0.012` scattered
  over the canvas, dark under-stroke + palette over-stroke — the speckle.
- Colour: `rcol()` (266-268) picks uniformly from the 5-colour palette (265); all colours
  are flat palette picks, transparency comes from alpha, not blending.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sep_240 | `int sep = 120;` -> `int sep = 240;` | large | coarser tiling: fewer, much larger cells; bubble clusters and mountain peaks scale up with them | variants/sep_240/frame_00001.png |
| sub_2000 | `int sub = int(random(500)*random(1));` -> `int sub = int(random(2000)*random(1));` | large | finer tiling: many more, smaller cells (mosaic-like edges), decorations shrink accordingly | variants/sub_2000/frame_00001.png |
| gri_30 | `int gri = 15;` -> `int gri = 30;` | large | same cell layout, but coarser texture: sparser dot grid, larger mini-squares/ellipses, chunkier flow lines | variants/gri_30/frame_00001.png |
| det1_0.001 | `float det1 = random(0.01);` -> `float det1 = random(0.001);` | none | no visible change (expected smoother flow field; seed-42 detail value is already so small the hatch looks identical) | variants/det1_0.001/frame_00001.png |
| cc_8 | `int cc = int(random(1, 4));` -> `int cc = int(random(1, 8));` | large | up to 7 mountain layers per cell: bottom silhouettes are denser, taller and more jagged | variants/cc_8/frame_00001.png |
| div_5 | `int div = int(random(20));` -> `int div = int(random(5));` | moderate | smaller bubble clusters: 1-3 circles instead of deeply nested clusters in most cells | variants/div_5/frame_00001.png |

## Modularisation notes
- Generic: `quadtreeSplit` (pure geometry, parameterised by min cell size and grid
  alignment), `flowFieldHatch` (noise detail + length scale + step), `bubbleCluster`
  (split count + aspect), `mountainLayer` (breakpoint count + colour pair), `speckleArcs`
  (count + max diameter + alpha).
- One-off art decisions: the fixed 5-colour palette and per-feature alpha ranges
  (80/120/200/250), the layered per-cell decoration order, the ring-arc rendering of
  bubbles (`arc2` with two alpha stops), the double translucent cell overlays.
- A clean parameter object would carry: `{subdivisions, minSep, sep, gri, flowDetail,
  flowLen, dotDensity, clusterDivisions, mountainLayers, speckleCount, palette}`.
