---
sketch: 2014/Generativos/prueba2b
year: 2014
renderer: JAVA2D
size: [800, 600]
libraries: []
deterministic: true
ms_first_frame: 198
animated: true
techniques: [grid, polar, curves]
primitives: [ellipse]
palette:
  colors: ["#171535"]
  selection: random-hsb
composition: grid
parameters: []
reusable_candidates:
  - {name: bloomingArc, signature: "bloomingArc(x, y, maxDim, bloomTime, holdTime) -> arc", note: "arc that rests at zero size and lerps between two random (size, startAngle, endAngle, color) states on a random timer"}
  - {name: arcCluster, signature: "arcCluster(cx, cy, count, maxDim) -> list", note: "N overlapping random arcs sharing one center, forming a pie-slice cluster"}
---

## What it draws
Baseline frame 1 (seed 42) is an almost empty dark navy-purple canvas (#171535) with just two small
cyan/blue arc fragments (upper-middle and lower-right). By frame 60 the canvas holds a sparse field of
colorful pie-slice / arc shapes — greens, pinks, oranges, blues, purples, yellows — each a few to ~80 px
across, positioned on a loose 8×6 grid; most grid cells are empty at any given moment.

## How the code works
- `setup()` (L9-13): places 8 columns × 6 rows of `Circulo` hubs at `62+i*95, 65+j*95`; each hub holds
  `cant=10` `Arco` objects centered at the same point with `dim=80` (L37-46).
- Each `Arco` (L62-72) is born with a random diameter `random(dim*0.08, dim)`, two random angles
  `ang1/ang2` in `[0, TWO_PI)`, and a random HSB color: hue 0-255, sat 180-255, bright 240-255,
  alpha `256-(random(1)*random(256))` (mostly near-opaque, skewed high). `tiempo = int(random(400))`.
- `draw()` (L16-30) repaints `background(#171535)` each frame and calls `act()` on every arc.
- The trick (L73-84): every frame `objetivo` (init 0) is decremented by `random(0.01, 0.05)`; the moment
  it is ≤ 0 the arc snaps `tam/ang1/ang2/col` to the "old" values `otam/oang1/oang2/ocol`, which start
  at 0 — so a resting arc is a zero-size, invisible point. When `tiempo` hits 0, `cambiar()` (L99-109)
  picks a brand-new random target (`otam`, angles, color) and sets `objetivo = 1`; while `objetivo > 0`
  the arc is drawn (L91-97) as a `lerpColor` + interpolated size/angles `arc()` between old and new
  states — a short bloom of a few dozen frames (0.01-0.05 decay → 20-100 frames).
- Hence frame 1 is nearly empty: only arcs whose initial `tiempo` was exactly 0 (1 in 400; ~1-2 of 480
  with seed 42) have already bloomed. Over time each arc spends most of its 60-600 frame cycle invisible
  and briefly visible, giving the sparse, breathing field of frame 60. Angles: `arc()` auto-wraps
  `start>stop` by +TWO_PI, so each arc spans a random 0..360° wedge; 10 wedges per hub overlap into
  multi-colored pie clusters.
- `colorMode(HSB, 256)` (L5), `noStroke()` (L6); no blend modes, no noise, plain JAVA2D.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the `Arco` bloom state machine (rest at zero → lerp between two random (diameter, start, end,
  color) states on a random hold timer) is a reusable "blooming arc" primitive; the 10-arc shared-center
  cluster is a second reusable unit; the 8×6 grid with 95 px pitch is plain layout.
- One-off art decisions: HSB saturation/brightness bands (180-255 / 240-255) and the skewed alpha
  expression, the #171535 background, and the 60-600 frame cadence.
- Clean parameter object: `{cols, rows, x0, y0, pitch, arcsPerHub, dim, minFrac, holdRange, bloomDecay,
  hsb: {hRange, sRange, bRange}, alpha, background}`.
