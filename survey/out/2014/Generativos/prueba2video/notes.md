---
sketch: 2014/Generativos/prueba2video
year: 2014
renderer: JAVA2D
size: [800, 600]
libraries: []
deterministic: true
ms_first_frame: 151
animated: true
techniques: [grid, curves, agents]
primitives: [shape]
palette:
  colors: ["#171535"]
  selection: lerp-between
composition: tiled
parameters: []
reusable_candidates:
  - {name: arcBlinker, signature: "arcBlinker(x, y, maxSize, holdFrames, lerpRate) -> arc", note: "arc that holds a random radius/angle-pair/color, then lerps to a new random one"}
  - {name: growingArcGrid, signature: "growingArcGrid(cols, rows, spacing, arcsPerCell, dim, dimGrowth) -> void", note: "grid of arc blinkers whose size budget grows every frame"}
---

## What it draws
Frame 1 is an almost empty dark navy (#171535) canvas with only a few 1-2 px colored specks.
By frame 60, small crescent/arc shapes in bright saturated rainbow colors (green, blue, pink,
orange, yellow) are scattered across a regular 6-row x 8-column grid; most cells still show only a
tiny dot or nothing, a few show a visible crescent up to ~10 px.

## How the code works
- `setup()` (prueba2video.pde:3-14): 800x600, `colorMode(HSB, 256)`, no stroke. Builds 48
  `Circulo` objects in a 6x8 grid at `(62+i*95, 65+j*95)`, each with `cant=10` arcs and
  initial size budget `dim=10`.
- `draw()` (16-32): repaints the dark navy background each frame, then for every `Circulo` calls
  `act()` on its arcs and grows its `dim` by `random(0.01, 0.05)` — a slow global size growth
  (the sketch runs 60*120 frames as a video and calls `saveFrame` every frame, exiting at 7200).
- `Circulo.act()` (49-55): activates each arc and re-syncs `arc.dim` to the growing circle budget.
- `Arco` constructor (64-74): random radius `tam` in `[dim*0.08, dim]`, random angles
  `ang1, ang2` in `[0, 2π)`, color = HSB(hue random 0-255, saturation 180-255, brightness
  240-255, alpha `256 - random(1)*random(256)` — product of two uniforms, biased low, so many
  arcs start nearly transparent), and a random hold time `tiempo = int(random(400))`.
- `Arco.act()` (75-86): decrements the hold; at 0, `cambiar()` (101-111) picks a new random target
  radius/angles (with angle wrap so the arc is well-defined) and color, sets `objetivo = 1`;
  `objetivo` decays by `random(0.01, 0.05)` per frame and at ≤0 the arc snaps to its target.
- `dibujar()` (87-100): draws `arc()` centered on the grid point; while transitioning it fills with
  `lerpColor(ocol, col, objetivo)` and maps radius and both angles between old and new values, so
  each arc eases into its new shape.
- Randomness drives radius, angles, color, hold times, growth increments and lerp rates; the grid
  layout and background are fixed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic: the `Arco` class is a self-contained "blink-lerp" agent — hold a random state, then ease
to a new random state — usable as a library primitive with (maxSize, holdRange, lerpRate, colorRange)
parameters. The `Circulo`/grid wrapper (count, spacing, per-frame `dim` growth) is also generic.
One-off art decisions: dark navy background, the HSB ranges (high saturation/brightness, skewed
low alpha), 10 arcs per cell, 6x8 grid geometry, the 120 s video exit and `saveFrame` loop.
A clean parameter object: `{cols, rows, spacing, arcsPerCell, baseDim, dimGrowth, holdRange,
lerpRange, hsbRange, background}`.
