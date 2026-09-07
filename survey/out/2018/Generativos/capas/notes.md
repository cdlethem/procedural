---
sketch: 2018/Generativos/capas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1636
animated: false
techniques: [noise-field, particles, grid, polar, curves, blend-modes, dots-stippling]
primitives: [ellipse, line, rect, pgraphics, shape]
palette:
  colors: ["#FE603C", "#242D3B", "#027ECB", "#E5B270", "#FD9EC8", "#FDD3C7"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: noiseRibbon, signature: "noiseRibbon(x, y, size, lifeFrac, colors) -> shape", note: "fish: noise-steered trail, width envelope, two-sided fill lerp"}
  - {name: gridNoiseCells, signature: "gridNoiseCells(cc, des/det triples, sizeFn, shapeFn)", note: "snapped-to-grid cells sized/angled by three independent 2-D noise fields"}
  - {name: lensCircle, signature: "lensCircle(x, y, size, angle, amp, colors) -> layered", note: "bezier 'circle' with one vertex scaled by amp, plus concentric arc2 rings and pupil"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2) -> ring", note: "tapered alpha ring built from many small quadrilaterals"}
---

## What it draws
A dark near-black canvas overlaid with a dense field of small, tapered comet/teardrop shapes in
pastel blues, pinks, lavenders and creams, mostly oriented along a shared diagonal flow. Four
large "eye" motifs sit at the corners: big white discs ringed in saturated blue, pink, navy and
orange, each with a black pupil. A large translucent blue-purple lens/leaf shape dominates the
center, with faint square grid seams visible inside it.

## How the code works
`generate()` (capas.pde:24) is called from `setup()` and `draw()`; the harness seeds the `seed`
field, so `randomSeed(seed)` at line 29 makes every draw deterministic, and each frame fully
re-draws the same scene (static image; frames 10/60 dropped as identical).

1. Background is near-black (`background(10)`, line 30).
2. Fish layer (lines 35-40): 100 `Fish` objects of size up to 200 are created at random canvas
   positions, each advanced one step (`f.time = f.timeLife/2` then `update()`) and drawn once.
   `update()` (179-218) steers a 10-segment trail backwards along a 2-D Perlin direction field
   (`noise(des+x*det, des+y*det)*TAU`, lines 206-210); `show()` (220-248) closes that trail into
   a tapered ribbon: two mirrored vertex walks offset perpendicular to the local angle, width
   envelope `pow(val, 0.7)*ss*0.5` (233, 241), fill lerped between two random palette colors
   (`lerpColor(col1, col2, val)`). This produces the small comet shapes and their shared
   diagonal orientation.
3. Grid of arcs (lines 42-50): `cc = int(max(1, random(50)*random(1)))` (line 32) cells of
   `ss = width/cc`; per cell a random 1- or 2-cell square `s` and an `arc2` ring in a random
   palette color at alpha 120. `arc2` (133-151) renders a ring as many tiny quadrilaterals with
   a per-vertex alpha gradient — the faint square seams.
4. Grid of dots (lines 53-61): one small (`s*0.08`) random-color ellipse per grid cell.
5. Noise-cell "eyes" (lines 70-107): `cc*3` random points snapped to grid cells. Per point:
   `s2 = ss*(0.5+noise(...)*0.4)` (92), `ang = noise(...)*TWO_PI` (93), `amp = 0.5+noise(...)*2`
   (94) from three independent noise fields; then `circle()` (112-126) — a 4-bezier "circle"
   with one anchor scaled by `amp`, so it becomes a lens/leaf (the big central shape); a full
   ellipse, a white `s2*0.8` disc (98-99), two dark `arc2` rings (100-101), a 240-alpha color
   ring (104), and a black `s2*0.15` pupil (106). When the snapped point lands near a canvas
   corner these layered discs become the large eye motifs.
6. Palette (251-263): fixed 6-color list; `rcol()` picks a random entry per element;
   `getColor(v)` interpolates between adjacent entries.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic, library-worthy: `arc2` (tapered alpha ring, pure geometry), `circle` (amp-deformed
bezier circle), the noise-field trail/ribbon in `Fish` (steering + width envelope + two-sided
fill lerp), the grid-snapped noise-cell loop (3 independent noise fields driving size/angle/
amp of a layered disc), and the 6-color palette with random-pick plus adjacent-lerp accessors.
One-off art decisions: the specific layering order (fish under grid arcs under noise discs),
the "eye" layering (white disc, dark rings, color ring, black pupil), the fixed `background(10)`,
the `time = timeLife/2` mid-life snapshot trick for the fish, and the exact palette hex values.
A clean parameter object: `{seed, fish_count=100, fish_max_size=200, grid_cc, noise_des/det
triples (6 fields), palette: color[], fish_trail_steps=10, cell_layer_scales}`.
