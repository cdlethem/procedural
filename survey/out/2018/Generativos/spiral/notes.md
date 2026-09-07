---
sketch: 2018/Generativos/spiral
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1541
animated: false
techniques: [spiral]
primitives: [shape]
palette:
  colors: ["#EA554F", "#FAC745", "#2760AB", "#369952", "#1E2326", "#FFF7F3"]
  selection: random-from-list
composition: radial
parameters:
  - {name: res, default: "int(3+random(60)*random(1)*random(1)) (~12 at seed 42)", tried: [12], change: large, effect: "coarser, wider wedges per ring"}
  - {name: sub, default: "int(random(2, 200)) (~40 at seed 42)", tried: [40], change: large, effect: "fewer/thicker concentric rings"}
  - {name: max (twist), default: "da*int(random(-30, 30))", tried: ["da*15"], change: large, effect: "fixed modest twist; cleaner, more concentric spiral"}
  - {name: diag, default: "width*1.8", tried: ["width*1.2"], change: large, effect: "smaller radius; thinner, denser bands reaching the corners"}
  - {name: overlap (j+4), default: 4, tried: [8], change: subtle, effect: "no visible change (only 3% of pixels moved)"}
  - {name: colors[] (palette), default: "6-colour warm/cool set", tried: ["grayscale set"], change: large, effect: "same geometry rendered in grayscale"}
reusable_candidates:
  - {name: wedgeSpiral, signature: "wedgeSpiral(cx, cy, maxR, rings, wedgesPerRing, twist, palette) -> void", note: "concentric rings of quad wedges, each ring rotated by a twist angle, two random fills per wedge"}
---

## What it draws
A full-bleed pinwheel spiral centered in the canvas. Dozens of polygonal bands (rings) wind from a small dark
core out to the corners; each band is built from many quad wedges, each wedge painted with two independent
random colours from a six-colour palette (red, yellow, blue, green, near-black, off-white). The bands twist
monotonically, so the whole image reads as a multi-coloured spiral/vortex; the outermost wedges run off all
four edges.

## How the code works
`setup()` (spiral.pde:3) fixes the 960x960 P2D window and calls `generate()` once; `draw()` (line 11) is empty,
so the image is static (baseline frames 10/60 were dropped as identical).

`generate()` (line 22):
- `background(rcol())` fills the canvas with one random palette colour (line 23); it is only visible in the
  few gaps at the very center.
- `res = int(3+random(60)*random(1)*random(1))` (line 29) is the number of wedges per ring, biased low (3..62,
  usually a small number); `da = TWO_PI/res` (line 30) is the angular step.
- `sub = int(random(2, 200))` (line 31) is the number of rings.
- `max = da*int(random(-30, 30))` (line 33) is the total accumulated twist angle of the spiral (in multiples of
  `da`, from -30 to 30 steps).
- Outer loop over rings `j` (line 34): `r1 = map(j,0,sub,0,diag)` and `r2 = map(j+4,0,sub,0,diag)`
  (lines 35-36) make each ring a radial band from radius `r1` to the radius of ring `j+4`, so neighbouring
  bands overlap by 4 rings — this is why colours layer into the pinwheel. `diag = width*1.8` (line 28) pushes
  the last rings far past the canvas.
- Inner loop over wedges `i` (line 38): each wedge is a quad between angles `a1 = ang+da*i` and
  `a2 = a1+da` at radii `r1`/`r2` (lines 39-47), drawn with `beginShape()/vertex()/endShape(CLOSE)`. The wedge
  is filled with `rcol()` before the first two vertices and `rcol()` again before the last two, so each quad
  actually shows up to two colours (fill applies to the next vertex). `ang` advances by `max/(sub-1)` per ring
  (line 37), producing the twist.
- `rcol()` (line 99) picks uniformly from `colors[]` (line 98): `#EA554F, #FAC745, #2760AB, #369952, #1E2326,
  #FFF7F3`. All randomness is seeded (`seed` field, line 1), so a given seed reproduces the image.
- `rr()` (line 54) and `arc2()` (line 72) are dead code, never called from `generate()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| res_12 | `int res = int(3+random(60)*random(1)*random(1));` -> `int res = 12;` | large | much coarser spiral; ~12 wide wedges per ring, larger gaps, a dark background patch near the center | variants/res_12/frame_00001.png |
| sub_40 | `int sub = int(random(2, 200));` -> `int sub = 40;` | large | more concentric, regular rosette of thick radial bands with a small central polygon; softer two-tone shading per wedge | variants/sub_40/frame_00001.png |
| twist_15 | `float max = da*int(random(-30, 30));` -> `float max = da*15;` | large | clean, well-formed spiral with a dark centre; gentler, more even twist than the baseline | variants/twist_15/frame_00001.png |
| diag_1.2 | `float diag = width*1.8;` -> `float diag = width*1.2;` | large | spiral scaled down; thinner, denser bands, all reaching the corners, smaller outer reach | variants/diag_1.2/frame_00001.png |
| overlap_8 | `float r2 = map(j+4, 0, sub, 0, diag);` -> `... map(j+8, ...)` | subtle | no visible change (3% of pixels); only 3% of pixels shifted so the layout is effectively the same | variants/overlap_8/frame_00001.png |
| palette_bw | `int colors[] = {#EA554F, ...}` -> grayscale set | large | identical geometry rendered in greys (black-to-white) — confirms the colour is a pure palette swap | variants/palette_bw/frame_00001.png |

## Modularisation notes
The core is a small, self-contained generator: a ring/wedge loop with (a) radial banding with a fixed overlap
offset, (b) a per-ring angular twist, (c) independent per-vertex random fills. A clean parameter object would
be `{rings, wedgesPerRing, maxRadius, bandOverlap, twistSteps, palette, palettePick: random|index}`; the
two-colour-per-quad fill quirk (fill applied per vertex) is worth keeping as an option. The twist sign and
magnitude, the band overlap, and the palette are the art decisions; the wedge-quad construction itself is the
reusable piece (`wedgeSpiral` above). `rr()`/`arc2()` are unused leftovers and should be dropped.
