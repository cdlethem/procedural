---
sketch: 2015/Generativos/naves/naves00
year: 2015
renderer: P3D
size: [800, 600]
libraries: []
deterministic: true
ms_first_frame: 1443
animated: true
techniques: [grid, curves, 3d-mesh]
primitives: [line, ellipse]
palette:
  colors: ["#FCD224", "#D85AD7", "#FA3055", "#FFF5F7", "#141414", "#282828"]
  selection: random-from-list
composition: centered
parameters: []
reusable_candidates:
  - {name: groundGrid, signature: "groundGrid(cells, spacing) -> void", note: "wireframe ground plane in 3D: two families of parallel lines on the rotated XY plane"}
  - {name: arcScatter, signature: "arcScatter(count, sizeRange, palette, area) -> void", note: "scattered upright semicircle arcs with random rotation, colour and weight"}
---

## What it draws
A dark (near-black) 3D scene viewed from above and tilted: a thin grey perspective
wireframe grid lies flat on the ground, centred in the canvas. Scattered across the
grid are 3-4 upright semicircle arches (dome outlines) in yellow, magenta/purple,
red and off-white, some with a faint translucent fill of the same colour. The arches
have different sizes and stroke weights; a few small thin slivers stand on the right.
The whole scene rotates slowly around the vertical axis (frames 1/10/60 differ).

## How the code works
`setup()` sizes the window 800x600 P3D (naves00.pde:10) and picks a random `seed`
(:47). `draw()` re-seeds (`randomSeed(seed)`, :15), fills with dark grey
`background(20)`, then tilts the camera with `translate(width/2,height/2,-200)` and
`rotateX(-PI*0.16)` (:17-18) and adds the animation: `rotateY(frameCount*0.008)` (:19).
The ground is a `grid(20,20)` (:22, defined :50-57) drawn in grey `stroke(40)`: after
`rotateX(PI/2)` the XY plane is horizontal, and 21 lines each way at 20 px spacing
span ±200 px. The arches (:25-39): `cc = int(random(3,30))` per frame, each on a random
palette colour from the 4-colour list (:2-7), random stroke weight 1-3 px (:30) and
fill of the same colour at alpha 20 (:31). Size `s = int(random(1, random(1,10)))`
(:32) gives a skewed small-biased size; position is a random grid cell within
±(10-s) (:33-34) scaled by 20 px, so arches sit on grid intersections. Each arch is
`arc(0,0,s*40,s*40,PI,TWO_PI)` — the upper half of a circle (:37) — rotated 0 or 90°
about Y (:36), so it stands upright facing along one axis. Randomness enters through
the seeded `random()` calls in draw; since `cc` and all positions are redrawn every
frame from the same seed sequence, the scene is static apart from the rotation.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Two generic blocks: the `groundGrid(cc, sep)` wireframe (already a function; could be
`groundGrid(cells, spacing, colour, weight)` for the library) and the arch scatter
loop (count, size distribution, palette, area, orientation quantisation, fill alpha).
One-off art decisions: the fixed 4-colour palette, the `PI`-to-`TWO_PI` upper-half
arc, the 0/90° orientation quantisation, the small-biased size distribution
`random(1, random(1,10))`, the camera tilt `-PI*0.16` and rotation speed `0.008`.
A clean parameter object: `{cells, spacing, count, sizeMin, sizeMax, palette,
strokeWeights, fillAlpha, tilt, rotSpeed, area}`.
