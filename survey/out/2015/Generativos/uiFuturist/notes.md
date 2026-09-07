---
sketch: 2015/Generativos/uiFuturist
year: 2015
renderer: P2D
size: [600, 600]
libraries: []
deterministic: false
ms_first_frame: 1556
animated: true
techniques: [grid, polar, dots-stippling, noise-field, lines-hatching, typography]
primitives: [rect, line, ellipse, text]
palette:
  colors: ["#4ECBFA", "#ED892B", "#121317", "#0D0F0C"]
  selection: fixed
composition: margins
parameters:
  - {name: radar radius, default: "width*0.48", tried: ["width*0.25"], change: subtle, effect: "smaller compact radar ring in the centre, more empty space around it"}
  - {name: grid spacing, default: 50, tried: [25], change: none, effect: "no visible change (grid strokes are too faint to distinguish at half the step)"}
  - {name: slide bar count, default: 20, tried: [40], change: none, effect: "no visible change (extra rows only add a few faint bars)"}
  - {name: radar circle count, default: "random(4,20)", tried: ["random(4,40)"], change: subtle, effect: "slightly busier radar: more concentric circles and tick rings"}
  - {name: left donut point count, default: 50, tried: [120], change: none, effect: "no visible change (ring stays a loose cluster of dots)"}
  - {name: orange donut threshold, default: 16, tried: [60], change: none, effect: "no visible change (constellation still a sparse orange ring)"}
reusable_candidates:
  - {name: slide, signature: "slide(x, y, w, h, level, color) -> void", note: "track + filled level bar (progress bar)"}
  - {name: gridLights, signature: "gridLights(x, y, cellW, cellH, cols, rows, gapW, gapH) -> void", note: "grid of rects with noise-driven alpha (dot-matrix readout)"}
  - {name: radar, signature: "radar(x, y, radius) -> void", note: "concentric random circles, tick rings, dashed rings, dotted rings in polar"}
  - {name: donut, signature: "donut(x, y, minR, maxR, count, threshold, color) -> void", note: "random ring of points, lines between close neighbours (constellation)"}
  - {name: graph, signature: "graph(x, y, w, h, points) -> void", note: "noise-driven polyline chart in a framed box"}
  - {name: mapPoint, signature: "mapPoint(x, y, w, h, dot, gap) -> void", note: "dot grid whose alpha follows 2-D noise (heatmap)"}
---

## What it draws
A dark navy (near-black blue) futuristic dashboard / HUD filling a 600x600 canvas. Top-left: a stack of
horizontal cyan bars of varying length (progress bars). Top-right: a dot-matrix block of cyan squares in
rows, like a data readout. Centre: a large cyan radar — concentric circles, radial tick marks, a dashed
inner ring mixing cyan and orange, and an orange dotted ring. Right of centre: a column of small numeric
readouts in cyan with the top row in orange. Left side: two small clusters of cyan points forming loose
ring shapes. Bottom-left: a framed box containing a thin polyline chart with dots at its vertices.
Bottom-centre: a soft cyan dot-matrix blob (heatmap). Bottom-right: an orange ring of points with thin
connecting lines. Everything sits on a faint square grid. Between frames the numbers change, the bars
shift, and the radar ticks rotate: it is an animated HUD.

## How the code works
Single tab `uiFuturist.pde`. `setup()` (L10-17): 600x600 P2D, smooth(8), loads a vector font
(`micro12.vlw`) and a GLSL shader (`frag.glsl`). `draw()` (L19-94) runs every frame:

- `randomSeed(seed)` / `noiseSeed(seed)` (L25-26) reseed each frame, but `seed` itself is random at
  startup (L6) and the shader's `iGlobalTime` (L27) plus `frameCount` terms make the piece animate;
  the harness reports `deterministic: false` (millis-based shader time).
- Background is fixed `#121317` (L28, L38); the commented-out block (L29-36) would randomise it and the
  two colours.
- `blendMode(ADD)` (L41) is the key mix: all the faint white/cyan strokes accumulate additively over the
  dark background, giving the glow.
- `grid(50,50,width-100,height-100,50)` (L42, fn L101-110) draws the faint 50px square grid.
- `gridBall` (L48, fn L112-118) puts a 1px dot at every grid intersection.
- The top-left bars: loop of 20 `slide()` calls (L50-57, fn L233-239) — each draws a faint full-width
  track (alpha 30) and a solid level bar (alpha 220) whose length is `noise(i + frameCount*0.0008)`;
  colour `colors[0]` = `#4ECBFA` (cyan).
- The top-right dot matrix: `gridLights(200,50,8,18,35,5,2,2)` (L74, fn L120-132) — 35x5 grid of 8x18
  rects, alpha from `noise(frameCount*0.2 + x + j)`, drawn twice for double brightness (ADD).
- The numeric readouts: nested loop L61-72 — 16 rows x 2 columns of `text()` values built from
  `random(0.9,1)` plus noise (L63-64); first column cyan, rows where `i==0` orange (`colors[1]` =
  `#ED892B`, L68); alpha varies with `random(200-i*5,226)`.
- The centre radar: `radar(width/2, height/2, width*0.48)` (L78, fn L265-312) — random count of circles
  (L266); per circle a random type: (0) plain stroked circle with radius-dependent stroke weight, (2)
  dotted ring of 50-90 points whose radius is modulated by `noise(j*det)`, (3) ring of radial tick lines
  from `r` to `r*amp` (L292-310). Colours alternate cyan/orange.
- The left point rings: `donut(100,300, 30, 45, 50, 16, cyan)` and `donut(100,400, ...)` (L79-80,
  fn L241-263) — 50 random points at random radii between minSize/maxSize around a centre; lines between
  pairs closer than `sen` (threshold 16); then 2px dots. Cyan.
- The bottom-right orange cluster: `donut(475,475, 30, 60, 100, 16, orange)` (L83) — same idea with 100
  points and tight threshold, giving the constellation look.
- Bottom-left chart: `graph(50,450,200,100,10)` (L85, fn L177-198) — framed box (BLEND fill + ADD
  corner ticks), 10 vertices placed by `noise(xx*123 + frameCount*vel)`, polyline + 2px dots.
- Bottom-centre heatmap: `mapPoint(250,450,150,100,4,1)` (L86, fn L200-220) — 4px dots on a 5px lattice,
  alpha `max(2, noise(xx*z, yy*z)*512-256)`, each dot drawn twice.
- Finally `filter(shader)` (L87) applies the GLSL post pass (frag.glsl) to the whole frame.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| radarR_0.25 | `radar(width/2, height/2, width*0.48);` -> `radar(width/2, height/2, width*0.25);` | subtle | smaller compact radar ring in the centre, more empty space around it; rest of HUD unchanged | variants/radarR_0.25/frame_00001.png |
| gridStep_25 | `grid(50, 50, width-100, height-100, 50);` -> `grid(50, 50, width-100, height-100, 25);` | none | no visible change (grid strokes are alpha-10 white, too faint to distinguish at half the step) | variants/gridStep_25/frame_00001.png |
| bars_40 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 40; i++) {` | none | no visible change (the extra 20 thin bars only extend the top-left stack slightly further down) | variants/bars_40/frame_00001.png |
| radarRings_40 | `int cc = int(random(4, 20));` -> `int cc = int(random(4, 40));` | subtle | busier radar: more concentric circles and a denser outer tick ring | variants/radarRings_40/frame_00001.png |
| donutPts_120 | `donut(100, 300, 30, 45, 50, 16, colors[0]);` -> `donut(100, 300, 30, 45, 120, 16, colors[0]);` | none | no visible change (the top-left ring gets slightly denser dots but stays a loose sparse ring) | variants/donutPts_120/frame_00001.png |
| donutSen_60 | `donut(475, 475, width*0.05, width*0.1, 100, 16, colors[1]);` -> `donut(475, 475, width*0.05, width*0.1, 100, 60, colors[1]);` | none | no visible change (the bottom-right orange constellation still reads as a sparse ring, connecting lines barely increase) | variants/donutSen_60/frame_00001.png |

## Modularisation notes
The HUD widgets are cleanly factored already — `grid`, `gridBall`, `gridLights`, `slide`, `radar`,
`donut`, `graph`, `mapPoint`, `corners` are each self-contained drawing functions with an (x, y, w, h,
style-params) signature and a colour argument; they are the natural reusable candidates for the library
(see frontmatter). The one-off art decisions: the fixed layout coordinates in `draw()` (L42-86), the
two-colour cyan/orange palette, the `blendMode(ADD)` + dark background combo, and the per-frame
re-seeding of random/noise (which is what makes each frame a fresh "state" of the HUD). A clean
parameter object for the sketch would hold: palette [cyan, orange, bg], layout rects for each widget,
animation speed (`frameCount` multipliers), and the GLSL filter as an optional post step. The `donut`
point-constellation and `radar` polar widgets are the most generic and worth extracting first.
