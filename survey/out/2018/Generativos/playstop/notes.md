---
sketch: 2018/Generativos/playstop
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1790
animated: false
techniques: [grid, dots-stippling, curves]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#FF55CF", "#D9E2FE", "#95A1C1", "#060917"]
  selection: random-from-list
composition: tiled
parameters:
  - {name: cc, default: "random(2,17) [drew 12]", tried: [6], change: large, effect: "coarser 6x6 grid of large cells; bigger, sparser dots, poster-like"}
  - {name: c, default: "random(1,13)", tried: [12], change: large, effect: "every cell gets the max 12x12 sub-grid; denser, more uniform stipple, no big single-dot cells"}
  - {name: amp, default: "random(0.5,1)", tried: [0.3], change: large, effect: "dots ~30% of sub-cell with clear gaps; airier perforation, same layout"}
  - {name: des, default: "random(1)<0.5", tried: [0.0], change: large, effect: "no corner-clipped quarter arcs; all dots full circles centred in sub-cells"}
  - {name: amp2, default: "amp*random(0.1,0.9)", tried: [0.95], change: large, effect: "inner disc nearly covers outer arc; two-tone rings collapse to solid dots (also shifts later random colours)"}
  - {name: colors, default: "4-col pink/periwinkle/gray/black", tried: ["#FFFFFF,#BBBBBB,#666666,#111111"], change: large, effect: "identical structure in monochrome gray; the palette drives all the colour"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "arc band discretized into quads with per-vertex alpha; faint gradient ring"}
  - {name: dotMosaic, signature: "dotMosaic(cells, subCells, amp, cornerClipped, palette)", note: "grid of cells, each a flat rect + sub-grid of clipped/centered arcs with inner ring"}
---

## What it draws
A full-bleed mosaic of ~13×13 square cells. Each cell is a flat colour drawn from a
four-colour palette (hot pink, pale periwinkle, slate gray, near-black). Inside each cell
sits a small square grid of dots: full circles or quarter-circles clipped at the cell
edges, many with a concentric inner disc of a different palette colour, so the dots read
as filled dots, rings, and quarter-moons. The overall effect is a dense, quilt-like
stipple in pink/gray/black/white.
| cc_6 | `int cc = int(random(2, 17));` -> `int cc = 6;` | large (mean 0.3694, 0.842) | coarser 6x6 grid: cells ~3x bigger, dots much larger, many cells hold only 1-4 big dots or rings, big quarter-moons at corners; sparse, poster-like | variants/cc_6/frame_00001.png |
| c_12 | `int c = int(random(1, 13));` -> `int c = 12;` | large (mean 0.3368, 0.825) | same 12x12 cell grid; every cell now has a dense 12x12 (13x13 when corner-clipped) dot grid of ~7px dots; busier, more uniform stipple, no large single-dot cells | variants/c_12/frame_00001.png |
| amp_0.3 | `float amp = random(0.5, 1);` -> `float amp = 0.3;` | large (mean 0.3581, 0.821) | same layout, dots shrunken to ~30% of sub-cell with visible gaps; airier, reads as regular perforation | variants/amp_0.3/frame_00001.png |
| des_0.0 | `boolean des = (random(1) < 0.5);` -> `boolean des = (random(1) < 0.0);` | large (mean 0.3573, 0.858) | quarter-circle/quarter-moon corner motifs gone; all dots are full circles centred in their sub-cells (c=1 cells show one big centred circle); two-tone rings still present | variants/des_0.0/frame_00001.png |
| amp2_0.95 | `float amp2 = amp*random(0.1, 0.9);` -> `float amp2 = amp*0.95;` | large (mean 0.3455, 0.831) | inner disc nearly the size of the outer arc, so most two-tone rings collapse to solid single-colour dots; corner-clipped motifs remain (removing the random draw also shifts all later colour picks) | variants/amp2_0.95/frame_00001.png |
| palette_gray | `int colors[] = {#FF55CF, #D9E2FE, #95A1C1, #060917};` -> `int colors[] = {#FFFFFF, #BBBBBB, #666666, #111111};` | large (mean 0.186, 0.707) | identical mosaic structure, no pink: white/light-gray/gray/black monochrome; confirms the 4-colour array is the sole colour driver | variants/palette_gray/frame_00001.png |
## How the code works
`setup()` (lines 3-8) sets 960×960 P2D, `pixelDensity(2)` (unavailable on this display,
warned in stderr), calls `generate()` once; `draw()` is empty so the sketch is static
(key presses regenerate with a new seed, line 13-19).

`generate()` (line 21): white background, `randomSeed(seed)` (line 25). `cc =
int(random(2,17))` (line 27) is the grid resolution; `ss = width/cc` (line 28). Double
loop (lines 31-100) over cells: each cell gets a flat `fill(rcol())` + `rect` (lines
35-36). `c = int(random(1,13))` (line 38) is the sub-grid count; `s = ss/c` (line 39).
`des` (line 41, 50% chance) chooses corner-anchored dots (offset 0) vs centred dots
(offset 0.5, line 47-48); with `des` true, arcs at i==0/j==0 are angle-clipped to
quarters/halfs (lines 53-64, repeated 80-92). `amp = random(0.5,1)` (line 44) scales dot
diameter. Per sub-cell: `arc2` (line 66) draws a black arc band with alpha 10→0 — a
faint dark rim (arc2, lines 109-127, discretizes the band into quads, one vertex-pair
per angle step, two alphas). Then `arc` fills the outer dot with a second random colour
`col2` (lines 70, 95) and a smaller inner arc with `amp2 = amp*random(0.1,0.9)`
(line 71) in yet another random colour (line 97) — producing rings when the inner colour
differs from the cell fill. `rcol()` (lines 170-172) picks uniformly from the 4-colour
`colors[]` array (line 169). `srect` (lines 129-167) and `getColor` (173-181) are
defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic: `dotMosaic` structure (cell grid → flat fill → sub-grid of dots with
corner-clipping toggle and two-ring fill) is a clean reusable function; `arc2`'s
alpha-banded arc discretization is a small standalone primitive; `rcol`/`getColor`
(random/lerp palette sampling) are trivially reusable. One-off art decisions: the
specific 4-colour pink/gray palette, the 50% `des` corner-clipping coin flip, the
faint black rim (alp1=10) and the amp2 inner-ring ratio. A clean parameter object:
`{cells, subCells, amp, amp2, cornerClipped, palette, rimAlpha}`.
