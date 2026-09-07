---
sketch: 2018/Generativos/rositas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2335
animated: false
techniques: [grid, polar, curves]
primitives: [shape]
palette:
  colors: ["#F00050", "#FF4E02", "#F9E702", "#028DF9", "#1629C6"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: c, default: 5400, tried: [2700], change: moderate, effect: "halving the count leaves fewer small circles per cluster; dark halos and background show through more, 4x4 structure unchanged"}
  - {name: innerRadius, default: "ss*0.4", tried: ["ss*0.8"], change: moderate, effect: "doubling the inner radius makes the inner circles large, paler discs that dominate each cluster"}
  - {name: innerAlpha, default: 20, tried: [80], change: moderate, effect: "inner circles far more opaque; saturated reds/oranges/yellows pop, gaps between clusters read darker"}
  - {name: outerAlpha, default: 10, tried: [40], change: moderate, effect: "dark outer discs dominate; whole image darker and muddier, inter-cluster gaps nearly black"}
  - {name: palette, default: "warm 5-colour set (line 76)", tried: ["cool 5-colour set (commented line 78)"], change: moderate, effect: "blue/purple dominated with pale pink/white circles and few warm orange accents"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "fills an annular band (two radii, alpha gradient) as many small quadrilateral arc segments; generic ring/annulus painter"}
  - {name: snapToPowerGrid, signature: "snapToPowerGrid(width, height, maxLevel) -> (x, y, size)", note: "snaps a random point to the centre of the largest power-of-two cell containing it (modulo + half-cell offset); produces the visible 4x4 tiling"}
---

## What it draws
A full-bleed 960x960 field of overlapping translucent circles on a multicoloured quadrilateral background. The circles snap to a geometric grid, so the composition reads as a 4x4 arrangement of large rounded "rosita" (little rose) clusters: each cluster is a big dark translucent disc containing many smaller, brighter, more saturated translucent circles in reds, oranges, yellows, blues and purples, whose low alpha makes everything blend into pinkish, mauve and olive tones.

## How the code works
`setup()` (lines 3-8) sizes the canvas 960x960 in P2D and calls `generate()` once; `draw()` (line 10) is empty, so the image is static. `generate()` (lines 21-49) first seeds the PRNG with `seed` (line 23), then paints a full-canvas four-vertex shape (`beginShape`/`endShape`, lines 24-31) whose two triangles each get a random palette colour, making the mottled background. A loop of `c = 5400` iterations (line 34) then scatters circles: each gets a random position (lines 36-37) and a size `ss = width / 2^level` where level is a random integer 1-8 (line 38); the position is snapped to the centre of the cell of that size via modulo minus plus half-size (lines 40-44), which is what creates the aligned 4x4 tiling. Each circle is drawn twice with `arc2()` (lines 46-47): an outer disc of radius `ss*0.5` in near-black `color(0)` at alpha 10 (dark halo), and an inner disc of radius `ss*0.2` in a random palette colour at alpha 20. `arc2()` (lines 56-74) is a hand-rolled annulus: it subdivides the full angle (TAU) into `cc` segments and fills each as a small closed quadrilateral between radii r1 and r2, so circles are really polygons approximating rings; with `a1=0, a2=TAU` and the two radii it becomes a filled disc with an alpha gradient between the outer (alp1) and inner (alp2) vertex ring. Colour choice is `rcol()` (lines 79-81): uniform random from the 5-colour array on line 76 (two alternative palettes are commented out on lines 77-78). Randomness enters only through `random()` calls after `randomSeed(seed)`, so the render is deterministic for a given seed.

## Experiments
| variant | substitution | change score | observation | image |
| c_2700 | `int c = 5400;` -> `int c = 2700;` | moderate | fewer small circles per cluster; dark halos and background visible between them; overall 4x4 structure unchanged | variants/c_2700/frame_00001.png |
| innerRadius_0.8 | `arc2(xx, yy, ss, ss*0.4, 0, TAU, rcol(), 20, 0);` -> `... ss*0.8 ...` | moderate | inner circles doubled in size; clusters look like larger, paler overlapping discs | variants/innerRadius_0.8/frame_00001.png |
| innerAlpha_80 | `... rcol(), 20, 0);` -> `... rcol(), 80, 0);` | moderate | inner circles much more opaque and saturated; strong reds/oranges/yellows, gaps between clusters darker | variants/innerAlpha_80/frame_00001.png |
| outerAlpha_40 | `... color(0), 10, 0);` -> `... color(0), 40, 0);` | moderate | dark outer discs far stronger; whole image darker, colours muted, gaps between clusters nearly black | variants/outerAlpha_40/frame_00001.png |
| palette_alt | `int colors[] = {#F00050, #FF4E02, #F9E702, #028DF9, #1629C6};` -> `int colors[] = {#010187, #0A49FF, #FF854E, #FFCAE3, #FFFFFF};` | moderate | blue/purple dominated with pale pink and white circles, a few warm orange accents | variants/palette_alt/frame_00001.png |

## Modularisation notes
`arc2()` is fully generic: it paints an annular band between two radii over an angle range with an alpha ramp, and degenerates to a filled disc when the radii are set as here — a ready-made library primitive ("ring/annulus fill" or "disc with radial alpha"). The power-of-two cell snapping (lines 38-44) is a small, reusable placement function: "snap a random point to the centre of the largest 2^n cell containing it", which turns pure scattering into the grid-tilled look; a clean parameter object for the sketch would be `{count, levelRange: [minLevel, maxLevel], innerRadiusFrac, outerRadiusFrac, outerColour, outerAlpha, innerAlpha, palette}`. The rest (background quad, specific palettes, 960x960 P2D canvas, keypress regeneration) is one-off art plumbing.
