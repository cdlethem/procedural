---
sketch: 2015/Generativos/arcosCampestres
year: 2015
renderer: JAVA2D
size: [800, 400]
libraries: []
deterministic: false
ms_first_frame: 186
animated: false
techniques: [grid, polar]
primitives: [ellipse]
palette:
  colors: ["#F0F0F0"]
  selection: random-from-list
composition: margins
parameters:
  - {name: mc, default: 8, tried: [3], change: subtle, effect: "max wedge count: 3 gives ~3/4-filled circles (1-3 wedges, 90-deg gap); small in pixel metric because circles cover ~6% of canvas"}
  - {name: ss, default: "height*random(0.1,0.2)", tried: ["height*random(0.4,0.5)"], change: subtle, effect: "wider gap -> fewer circles per row (3x1 in this run, confounded with the run's random small tt)"}
  - {name: tt, default: "height*random(0.8)*random(0.1,1)", tried: ["height*random(0.8)*random(0.5,1)"], change: moderate, effect: "larger circles: 4x2 grid of big pies, fewer and larger wedges"}
  - {name: fill, default: "random(255), random(100,255), random(100)", tried: ["random(100), random(100,255), random(255)"], change: none, effect: "wedges shift orange/brown -> cyan/blue/teal (no more orange); scored none because circles cover little of the canvas"}
  - {name: background, default: 240, tried: [30], change: large, effect: "dark-gray ground instead of light-gray; wedges unchanged in style"}
reusable_candidates:
  - {name: pieGrid, signature: "pieGrid(cols, rows, diameter, gap, sectors) -> void", note: "grid of circles, each divided into random pie wedges via arc() in CHORD mode"}
  - {name: randomPieWedges, signature: "randomPieWedges(x, y, d, maxSectors, colorFn) -> void", note: "split a circle into 1..maxSectors consecutive wedges with per-wedge random colour"}
---

## What it draws
A light-gray canvas with a centered grid of small circles (7 columns x 3 rows for this
seed) spaced on a regular pitch. Each circle is a pie chart: divided into 2-8 wedge
slices of uneven angular size. Colours are dominated by greens (lime, forest, olive)
with orange/brown and occasional teal slices. Flat vector look, no strokes, no
animation (frames 10/60 identical to frame 1).

## How the code works
`setup()` (line 6) sets size(800,400) and calls `generar()`; `draw()` is empty so the
sketch is static. `generar()` (lines 20-54):
- `background(240)` -> the light-gray ground (line 22).
- Circle diameter `tt = height*random(0.8)*random(0.1,1)` (line 24) and gap
  `ss = height*random(0.1,0.2)` (line 25) are rolled once per run, so circle size and
  pitch are random per run.
- Grid counts `cw = width/(tt+ss)`, `ch = height/(tt+ss)` (lines 27-28); offsets
  `sw`,`sh` (lines 30-31) centre the grid with margins.
- Nested loop over the grid (lines 33-50) places circle centres on the pitch.
- Per circle: `mc = 8` (line 38) is the max number of sectors; `a = random(mc)` (line
  39) picks a random start angle (quarter turns). The while-loop (lines 42-47)
  repeatedly draws an arc wedge: `nc = random(1..mc-c)` consecutive quarters,
  `arc(x, y, tt, tt, (a+c)*PI/4, (a+c+nc)*PI/4)` in the default CHORD mode, so each
  arc() is a filled pie wedge; `noStroke()` (line 41) keeps edges clean.
- Colour: `fill(random(255), random(100,255), random(100))` (line 44) -> green channel
  biased high (100-255), blue low (0-100), red free: yields greens/olives, with
  oranges/browns when green is low. This is the only randomness in colour.
- `beginRecord(PDF, ...)` (lines 21,53) also writes a PDF of each generation (the
  `self_1.pdf` frame); `keyPressed` regenerates on any key, saves on 's'.
- The sketch never calls `randomSeed()`, so `--seed` has no effect: every run (including
  the baseline vs variants) has a different layout. Change scores below therefore
  include random layout noise; only large changes are meaningful.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| mc_3 | `int mc = 8;` -> `int mc = 3;` | subtle | each circle now covers only ~3/4 (1-3 wedges in 90-degree steps, 90-degree empty gap); rest of canvas unchanged | variants/mc_3/frame_00001.png |
| ss_wide | `float ss = height*random(0.1, 0.2);` -> `float ss = height*random(0.4, 0.5);` | subtle | only 3 small pies in one row (wider gap plus this run's random small tt); pies themselves unchanged | variants/ss_wide/frame_00001.png |
| tt_big | `float tt = height*random(0.8)*random(0.1, 1);` -> `float tt = height*random(0.8)*random(0.5, 1);` | moderate | 4x2 grid of large circles; fewer, larger wedges, same green/orange palette | variants/tt_big/frame_00001.png |
| fill_blue | `fill(random(255), random(100, 255), random(100));` -> `fill(random(100), random(100, 255), random(255));` | none | wedge colours shift from orange/brown to cyan/blue/teal (no orange left); scored none because circles cover only ~4% of the canvas | variants/fill_blue/frame_00001.png |
| bg_dark | `background(240);` -> `background(30);` | large | dark-gray ground instead of light-gray; same green/orange pies on top | variants/bg_dark/frame_00001.png |

Note: the sketch never calls `randomSeed()`, so every run rolls a fresh circle size/pitch and
layout (the ss_wide run's 3x1 grid partly reflects its random small `tt`, not just the wider gap).
Scores include that layout noise; per AGENTS.md only the large change (bg_dark) is treated as
unambiguous.

## Modularisation notes
- Generic: the pie-wedge splitter (lines 38-47) is a clean reusable function:
  `randomPieWedges(x, y, d, maxSectors, colorFn)` - split a disc into consecutive
  random wedges in quarter-turn units. The grid placement (lines 24-36) is generic
  too: `gridCentres(width, height, cellSize, gap) -> centres[]`.
- One-off art decisions: the specific colour bias `fill(random(255), random(100,255),
  random(100))` (green-dominant), the single `tt`/`ss` roll per run, PDF auto-numbering
  (`calculateNumber`, lines 65-73).
- Clean parameter object: {diameter, gap, sectors (max), startAngleJitter, colorFn,
  background}. Making `randomSeed` honoured (or passing an RNG) is the main fix needed
  before the sketch is survey-friendly.
