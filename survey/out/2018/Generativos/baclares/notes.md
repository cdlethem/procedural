---
sketch: 2018/Generativos/baclares
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1742
animated: false
techniques: [grid, polar, symmetry]
primitives: [ellipse, rect, line]
palette:
  colors: ["#EE9A02", "#EB526E", "#0169B3", "#024E2C", "#DDD3C9"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(8, random(30))", tried: [12], change: large, effect: "fewer, larger cells; node positions and colours differ (random stream shifts); composition still a scattered starburst mosaic"}
  - {name: wedgePairs, default: 3, tried: [6], change: large, effect: "double the wedge-sector pairs per node; denser busier starbursts; node positions also differ (random stream shifts)"}
  - {name: wedgeSize, default: "ss*10", tried: ["ss*20"], change: subtle, effect: "same nodes; wedges extend slightly further out, canvas edges gain a few longer slices"}
  - {name: haloAlpha, default: 20, tried: [60], change: subtle, effect: "same nodes; the big faint halo discs around each node are slightly more visible, tinting nearby background"}
  - {name: discScale, default: "ss*3", tried: ["ss*6"], change: moderate, effect: "same node positions; the outer disc ring of each target is twice as wide, making the targets read as bolder concentric rings"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "draws a tapered ring-sector band between two radii, alpha ramping along the band; generic sector/annulus painter"}
  - {name: rcol, signature: "rcol() -> int", note: "random pick from a fixed palette array"}
---

## What it draws
A cream/off-white field crossed by a faint grid of tiny dark dots. Scattered across it are
five or so "target" nodes: each is a concentric stack of three solid discs in different
palette colours (e.g. dark-green ring around a blue disc, olive ring around a pink disc).
From each node, dozens of long translucent wedge-shaped sectors fan out in every direction
like a mosaic of pie slices in pink, orange, blue and green, overlapping to build a
busy, semi-transparent starburst composition that fills the whole canvas.

## How the code works
`setup()` (lines 3-8) opens a 960x960 P2D window and calls `generate()` once; `draw()` is
empty so the piece is static. `generate()` (lines 21-61):

- Background is a fixed warm off-white `#DDD3C9` (line 23).
- `cc = int(random(8, random(30)))` (line 27) picks a cell count; `ss = width/cc` (line 28)
  is the cell size. The same `cc` both sets the dot-grid spacing and the number of nodes.
- A faint grid of 3x3 px dots at `fill(0, 20)` is drawn at every `(i,j)` grid intersection
  (lines 30-36) — the barely-visible dot lattice in the background.
- One node is created per `i` in `0..cc` (lines 38-60), placed at a random grid intersection
  (`int(random(cc))*ss`, lines 39-40), so nodes sit on the lattice and can overlap.
- Each node: two full-circle `arc2` rings (lines 44-45) drawn with very low alpha (20, 40)
  as huge soft halos; then 3 short arc-sector pairs (lines 47-52) at random start angles
  with high alpha (240/120) — these are the sharp coloured wedges; then three concentric
  solid discs `ss*3`, `ss`, `ss*0.5` in random palette colours (lines 54-59) — the "target"
  stacks.
- `arc2` (lines 68-86) subdivides an angular span into `cc` quads between outer radius `r1`
  and inner radius `r2`, filling each with two alphas (alp1/alp2) so the band fades across
  its width; a full-circle call (a1=0, a2=TAU, r2=0) degenerates to a filled disc.
- Colour: `rcol()` (lines 129-131) picks uniformly from
  `{#EE9A02, #EB526E, #0169B3, #024E2C}` (line 128). All layering is by low-alpha
  overlapping fills (default BLEND, P2D) — no blend modes, no noise.
- `srect` (lines 88-126) is dead code, never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_12 | `int cc = int(random(8, random(30)));` -> `int cc = 12;` | large | different composition: ~8 nodes of different colours/positions, bigger cells, denser wedge mosaic (position change partly from random-stream shift) | variants/cc_12/frame_00001.png |
| wedgePairs_6 | `for (int j = 0; j < 3; j++) {` -> `for (int j = 0; j < 6; j++) {` | large | twice as many wedge pairs per node: much denser, busier starbursts; node positions also differ (random-stream shift) | variants/wedgePairs_6/frame_00001.png |
| wedgeSize_20 | `arc2(xx, yy, ss*10, ss*6, 0, TAU, rcol(), 20, 0);` -> `arc2(xx, yy, ss*20, ss*6, ...)` | subtle | same nodes and colours; wedges extend slightly farther, a few longer slices reach the canvas edges | variants/wedgeSize_20/frame_00001.png |
| haloAlpha_60 | `arc2(xx, yy, ss*10, ss*6, 0, TAU, rcol(), 20, 0);` -> `arc2(xx, yy, ss*10, ss*6, 0, TAU, rcol(), 60, 0);` | subtle | same nodes; the faint full-circle halo around each node is slightly more visible, tinting the local background a touch more | variants/haloAlpha_60/frame_00001.png |
| disc_6 | `ellipse(xx, yy, ss*3, ss*3);` -> `ellipse(xx, yy, ss*6, ss*6);` | moderate | same node positions and colours; the outer ring of each target is twice as wide, targets read as bolder concentric rings | variants/disc_6/frame_00001.png |

## Modularisation notes
- `arc2` is the core reusable primitive: a tapered annular-sector band with per-side alpha.
  Clean signature: `arc2(x, y, rOuter, rInner, a1, a2, color, alphaOuter, alphaInner)`.
- The "node" (halo rings + wedge pairs + concentric target discs) is a self-contained
  art decision: a `drawNode(x, y, cellSize, palette, wedgeCount, rng)` function.
- A clean parameter object: `{cellCount, wedgePairsPerNode, wedgeAngleSpan, haloAlpha,
  wedgeAlpha, discScales: [3, 1, 0.5], palette, dotGridAlpha}`.
- `getColor`/`getColor(v)` (lines 132-141) is an unused continuous palette interpolator;
  could become a library `paletteAt(t)` helper.
