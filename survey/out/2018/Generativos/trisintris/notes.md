---
sketch: 2018/Generativos/trisintris
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1790
animated: false
techniques: [grid, noise-field, symmetry]
primitives: [ellipse, shape, line]
palette:
  colors: ["#FFFFFF", "#FFC7E3", "#FFCC01", "#48BD04", "#003398"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ss, default: "random(10, random(60, 240))", tried: [120], change: large, effect: "fixed larger cell size: hex coin grid becomes a dominant visible underlay of big halo+dot circles; fewer, larger rhombus fans on top (fewer cells)"}
  - {name: amp, default: "random(0.4, 0.9)", tried: [0.2], change: large, effect: "inner circle much smaller than halo: coin layer reads as rings/donuts with big translucent halos; fans unchanged"}
  - {name: ccc, default: "int(cc*cc*random(4)*0.1)", tried: ["int(cc*cc*0.4)"], change: large, effect: "far more rhombus fans: canvas almost fully covered by pinwheels, coin underlay barely visible"}
  - {name: sub, default: "int(random(20))", tried: [50], change: large, effect: "longer chains: fans more deeply nested with smaller concentric fans inside; overall look similar but denser/turbulent, line layer more visible"}
  - {name: colors, default: "5-colour list (white/pink/yellow/green/blue)", tried: ["5-step greyscale 000000..FFFFFF"], change: large, effect: "identical geometry in greyscale; luminance contrast makes the 3D-fold effect of the fans even more legible"}
reusable_candidates:
  - {name: hexGrid, signature: "hexGrid(cellSize) -> List<[x, y, dx, dy, row]>", note: "offset hexagonal lattice: row offset (j%2)*0.5, cell height sqrt(ss^2*0.75), covers full canvas"}
  - {name: arcRing, signature: "arcRing(x, y, r1, r2, a1, a2, col, alp1, alp2)", note: "tapered ring band built from quads between two radii, per-quad alpha gradient (this sketch's arc2, line 255)"}
  - {name: rhombusFan, signature: "rhombusFan(x1, y1, x2, y2, col, col2)", note: "4-triangle symmetric fan around a segment midpoint with two-tone fill and faint alpha-10 overlays (drawRhombus, line 148)"}
  - {name: segmentChord, signature: "segmentChord(x1, y1, x2, y2)", note: "perpendicular chord at segment midpoint with height sqrt(4/3)*h/2 (Line.getLine / getLength geometry, line 235)"}
---

## What it draws
A full-bleed, high-contrast collage in white, pink, yellow, green and deep blue. A hexagonal
grid of overlapping circles (opaque inner circle, translucent outer halo, a thin dark arc and a
tiny white dot) forms a dotted, coin-like underlay. On top, dozens of large symmetric
4-triangle "pinwheel" / rhombus shapes in flat colour are scattered, many nested into smaller
concentric copies, giving a kaleidoscopic, origami-folding look. Faint thin lines (segments with
perpendicular ticks) are barely visible over the dense fill.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (any key regenerates
with a new seed, line 13-18).

1. `generate()` (line 21) picks a random cell size `ss` in 10..240 (line 26) and derives the
   hex-lattice row height `hh = ss*sqrt(0.75)` and count `cc = height/hh` (line 27-28). After
   `translate(width*0.5, height*0.5)` (line 30) it fills the background with a random palette
   colour (line 24).
2. Circle layer (lines 35-61): double loop over the offset hex grid (row offset `(j%2)*0.5`,
   lines 36/38). Per cell: two random palette colours `col`/`col2` (line 42-44, `rcol()` from the
   5-colour list, line 275-278), a translucent halo circle `ss` (alpha 80, line 45-46), a smaller
   solid circle `ss*amp` with `amp` in 0.4..0.9 (line 48), a full `arc2` ring of width `ss` (line
   49), a short arc from angle `a1 = noise(...)*TAU` (Perlin-noise field, line 51) to `a1 +
   PI*random(0.05)` in `col2` at alpha 180 plus a black arc2 over it (lines 53-55), and a 2px
   white dot with black stroke at the centre (lines 57-59).
3. Rhombus layer (lines 63-98): `ccc = cc*cc*random(4)*0.1` random cells (line 63). Each picks a
   hex-direction angle (0/120/240 deg + 30, line 70) and a step length 1..cc/3 doubled (line 71),
   builds a `Line` and chains it up to `sub = random(20)` times via `getLine()` (line 77-81) which
   replaces a segment by the perpendicular chord through its midpoint (line 235-242) — i.e. a
   recursive halving that keeps shrinking. Each line in the chain gets `drawRhombus()` (line 93):
   an 8-triangle construction around the segment — four faint alpha-10 overlays (lines 163-197)
   and four solid two-tone triangles `col`/`col2 = lerpColor(col2, col, 0.6)` (lines 199-232),
   producing the symmetric pinwheel/fan motifs. Colours are random-from-palette, forced
   different from the neighbour (line 89-90).
4. Line layer (lines 100-124): same placement (note: different random draws, so different
   positions), but with `sub = 0` (line 113) so it draws single `drawLine()` segments — the segment
   plus a perpendicular chord — in random colours at alpha 120 (line 121-122).
5. `arc2` (line 255-273) is a custom ring: quads between radii r1/r2 over the angle range, with
   alpha interpolating alp1->alp2 per quad.

Renderer P2D, no shaders, no libraries, no blend modes (alpha compositing only). Deterministic
under the harness seed (seed field `seed`, line 1/23).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_120 | `  float ss = random(10, random(60, 240));` -> `  float ss = 120;` | large (mean 0.3, 0.86) | big cells: coin grid visible as dominant underlay of large halo+dot circles on green ground; fewer, larger fans | variants/ss_120/frame_00001.png |
| amp_0.2 | `  float amp = random(0.4, 0.9);` -> `  float amp = 0.2;` | large (mean 0.2768, 0.8) | inner circles tiny vs halo: coin layer reads as rings/donuts; fans unchanged in size | variants/amp_0.2/frame_00001.png |
| ccc_frac0.4 | `  int ccc = int(cc*cc*random(4)*0.1);` -> `  int ccc = int(cc*cc*0.4);` | large (mean 0.2856, 0.833) | ~4x more fans: canvas nearly fully covered by pinwheels, coin underlay mostly hidden | variants/ccc_frac0.4/frame_00001.png |
| sub_50 | `    int sub = int(random(20));` -> `    int sub = int(random(50));` | large (mean 0.2723, 0.813) | deeper nested fans (small concentric fans inside large ones), denser/turbulent; thin line layer more visible | variants/sub_50/frame_00001.png |
| palette_greyscale | `int colors[] = {#FFFFFF, #FFC7E3, #FFCC01, #48BD04, #003398};` -> 5-step greyscale | large (mean 0.4713, 0.997) | same geometry in black/grey/white; folding/3D effect of fans clearer via luminance | variants/palette_greyscale/frame_00001.png |

## Modularisation notes
- Generic: hex-lattice generator (cell size + offset rows), `arc2` ring, `drawRhombus` two-tone
  symmetric fan, `Line.getLine` midpoint-chord subdivision, random-from-palette colour pick with
  "different from neighbour" guard, `rcol`/`getColor` palette helpers.
- One-off art decisions: the specific 5-colour palette; the exact alphas (80/180/120/10/50); the
  `amp` range; the 3 hex-direction angles; the double random placement of rhombi vs lines; the
  `sub` chain length.
- A clean parameter object: {seed, cellSize, amp (inner/outer circle ratio), noiseDetail,
  rhombusCount (fraction of cells), chainLength (sub), lineAlpha, palette}.
