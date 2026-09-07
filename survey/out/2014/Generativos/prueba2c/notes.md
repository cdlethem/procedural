---
sketch: 2014/Generativos/prueba2c
year: 2014
renderer: JAVA2D
size: [800, 600]
libraries: []
deterministic: true
ms_first_frame: 1169
animated: false
techniques: [polar]
primitives: [shape]
palette:
  colors: ["#171535"]
  selection: random-from-list
composition: centered
parameters: []
reusable_candidates:
  - {name: morphingArc, signature: "morphingArc(cx, cy, maxDim, minRatio, palette, retargetEvery) -> void", note: "arc that re-rolls size/angles/colour and lerps toward the new state over a decaying t"}
---

## What it draws
One large magenta/pink circular blob near the centre of a dark navy field, shaped like a pac-man: a
near-complete disc with a wedge-shaped notch cut out of the top. The single colour reads as a flat
magenta with slightly darker purple fringes where arcs overlap. Nothing else is drawn; the rest of
the canvas is empty background.

## How the code works
`setup()` (prueba2c.pde:5) creates one `Circulo` at a random point in the central region
(`width*random(0.2,0.8), height*random(0.2,0.8)`, line 10) with `cant = 10` arcs and `dim = 420`
(max arc diameter). `draw()` (line 13) repaints `background(#171535)` each frame and calls
`act()` on every arc, so the piece is an animation; the saved snapshot is frame 60.

Each `Arco` (line 49) stores a size `tam` in `[dim*0.08, dim]` and two random angles (lines 61-63)
and draws a filled `arc(c.x, c.y, tam, tam, ang1, ang2)` (line 82) — a wedge of a circle centred on
the `Circulo`. Every 60-600 frames (`cambiar()`, line 92) it re-rolls a new size, a new angle pair
(offset by `TWO_PI` so the new arc always spans forward, lines 94-98) and a new colour, then lerps
from the old values to the new ones over ~20-100 frames while a decaying `objetivo` runs from 1 to 0
(lines 66-90): size, both angles and colour are interpolated each frame (`map`/`lerpColor`,
lines 85-89).

Colour is HSB with `colorMode(HSB, 256)` (line 7): hue `random(255)` is irrelevant because saturation
is `random(180,255)` (high) and brightness `random(240,255)` (near max) — but the hue itself is
fully random 0-255; the baseline snapshot happens to show one dominant magenta because the 10
overlapping opaque wedges visually merge (alpha `256 - random(1)*random(200)` is usually near-opaque,
lines 64/99). The pac-man notch is simply the angular region not covered by any wedge at this
instant. Overlapping semi-opaque arcs of similar bright hue produce the flat blob with faint
darker seams.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic block: the `Arco` class is a self-contained "retargeting wedge" — a state object that holds
old/new (size, startAngle, endAngle, colour), a countdown timer, and a decaying interpolation
parameter, drawn as a filled arc around a shared centre. That maps cleanly to a library function
like `morphingArc(cx, cy, maxDim, minRatio, paletteFn, retargetEvery)` or a small class
`MorphingArc` with `retarget(rng)` / `tick(dt)` / `draw()`. One-off art decisions: the single
`Circulo` at a random central position, the HSB ranges (high sat/bright), the `+TWO_PI` angle
convention, and the dark navy background. A clean parameter object: `{center: [x,y], arcCount,
maxDim, minRatio, hueRange, satRange, briRange, alpha, retargetMin, retargetMax, decay: [0.01,0.05]}`.
