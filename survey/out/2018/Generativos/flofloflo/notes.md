---
sketch: 2018/Generativos/flofloflo
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1607
animated: false
techniques: [subdivision, polar, grid, curves]
primitives: [rect, shape, ellipse]
palette:
  colors: ["#FFDA05", "#E01C54", "#E92B1E", "#E94F17", "#125FA4", "#6F84C5", "#54A18C", "#F9AB9D", "#FFEA9F", "#131423"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: sub, default: "random(10,300)", tried: [20], change: large, effect: "coarser mosaic: fewer, larger squares; flowers scale up with the cells"}
  - {name: cc (petals per flower), default: "random(3,20)", tried: [6], change: large, effect: "all flowers become 6-petal; dense many-petal pinwheels disappear, composition looks calmer and more uniform"}
  - {name: pwr1 (petal exponent), default: "random(0.5,1.9)", tried: ["random(2.5,3.0)"], change: subtle, effect: "subtle: petals slightly thinner/flatter, overall layout and colour distribution nearly identical"}
  - {name: s1 (petal size), default: "s*random(0.3,0.45)", tried: ["s*random(0.6,0.8)"], change: large, effect: "petals grow to overlap neighbouring cells; square backgrounds mostly hidden, image becomes a dense mass of overlapping pinwheels"}
  - {name: tilt (rotateX), default: 0.3, tried: [0.9], change: subtle, effect: "subtle: slightly stronger 3D twist in the pinwheels, but minor at this resolution"}
  - {name: "colors[] (palette)", default: "10-colour warm/cool set", tried: ["6-colour set (yellow/orange/pink/purple/teal/green)"], change: large, effect: "whole recolour: pinks/purples/teals dominate, no near-black or cream; structure unchanged"}
reusable_candidates:
  - {name: quadtreeMosaic, signature: "quadtreeMosaic(size, splits) -> Rect[]", note: "randomly split a rect into 4 quadrants N times; returns the leaf rects tiling the canvas"}
  - {name: petalo, signature: "petalo(r1, r2, pwr1, pwr2) -> shape", note: "superellipse-ish petal blob from pow-shaped cos/sin vertices"}
  - {name: pinwheel, signature: "pinwheel(cx, cy, size, petals, tilt) -> void", note: "radial array of petalo shapes around a centre with a contrasting dot"}
---

## What it draws
A full-bleed mosaic of flat squares in assorted sizes, tiled edge to edge. Each square carries a
"flower" or pinwheel: a ring of 3–19 curved petals in one colour fanned out from the square's
centre, with a solid contrasting dot on top. Square background, petal and dot colours are all
drawn independently from a 10-colour palette (yellows, reds, pinks, blues, a teal, a cream, a
near-black), so most cells have three strongly contrasting colours. Because subdivision stops at a
random time, some cells are huge (a 960 px square is split repeatedly but not uniformly) and some
are tiny, giving a patchwork of flower sizes.

## How the code works
- `setup()` (lines 3–8): 960×960 P3D, one shot — `draw()` is empty (line 10–11), everything is
  drawn once in `generate()`. `seed` is a global randomised at load (line 1).
- `generate()` (line 21): background is one random palette colour via `rcol()` (line 23,
  defined line 137). The tiling starts as a single `PVector(0, 0, width)` (line 27) meaning
  (x, y, size). `sub = int(random(10, 300))` (line 29) iterations of: pick a random existing rect
  (line 31), remove it, and add its four quadrants at half size (lines 34–37). After `sub` splits
  there are `sub+1` leaf rects that tile the canvas — a random, inhomogeneous quadtree (lines
  30–40).
- The second loop (lines 42–100) draws one flower per leaf rect:
  - `back = rcol()` fills the square (lines 45, 62–63).
  - `c1` and `c2` are random palette colours, re-rolled while they equal `back` or each other
    (lines 65–68), so petal and dot always contrast the square.
  - `cc = int(random(3, 20))` petals (line 70), angular step `da = TWO_PI/cc`, a random start
    angle `ang` (line 72) and a random clockwise/counter-clockwise direction `dir` (line 73) give
    the pinwheels their varied rotation.
  - Each petal (lines 83–94): `pushMatrix`, rotate by `ang+da*j*dir`, small random jitter
    (line 87), `translate(s1*0.5, 0, s*0.5)` and `rotateX(0.3)` (lines 86–88) tilt the petal into
    the P3D z-axis so the ring reads as a 3D pinwheel; `petalo(s1, s2, pwr1, pwr2, ...)` (line 92)
    draws it. `s1 = s*random(0.3, 0.45)`, `s2 = s1*random(0.4, 0.8)` (lines 77–78) size the
    petals; `pwr1/pwr2 = random(0.5, 1.9)` (lines 79–80) shape them.
  - `petalo` (lines 103–120): a closed `beginShape` of `cc ≈ TWO_PI*sqrt((r1²+r2²)/2)` vertices
    where each unit circle point has its cos/sin components raised to `pwr1`/`pwr2`
    (sign-preserving, `sign()` at line 122). Exponents > 1 flatten the lobe into a petal; < 1
    round it into a square-ish blob.
  - Finally a centre dot: `fill(c2)`, `translate(0, 0, s)`, `ellipse` of diameter
    `s3 = s*random(0.18, 0.3)` (lines 95–98), drawn in front of the petals in z.
- `rcol()` (lines 137–139) picks uniformly from the 10-colour `colors[]` array (line 135); three
  alternative palettes are commented out (lines 133–134, 136). `getColor` (lines 140–149) is an
  unused lerp-between-neighbours palette sampler.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_20 | `int sub = int(random(10, 300));` -> `int sub = 20;` | large (0.345, 88% px) | coarser mosaic: fewer, much larger squares; flowers scale up with the cells, big-cell look | variants/sub_20/frame_00001.png |
| cc_6 | `int cc = int(random(3, 20));` -> `int cc = 6;` | large (0.297, 84% px) | every flower is exactly 6 petals; dense many-petal pinwheels gone, calmer and more uniform | variants/cc_6/frame_00001.png |
| pwr1_3 | `float pwr1 = random(0.5, 1.9);` -> `float pwr1 = random(2.5, 3.0);` | subtle (0.037, 13% px) | subtle: petals slightly thinner/flatter, layout and colours nearly identical | variants/pwr1_3/frame_00001.png |
| s1_big | `float s1 = s*random(0.3, 0.45);` -> `float s1 = s*random(0.6, 0.8);` | large (0.251, 67% px) | petals grow to overlap neighbouring cells; square backgrounds mostly hidden, dense mass of overlapping pinwheels | variants/s1_big/frame_00001.png |
| tilt_0.9 | `rotateX(0.3);` -> `rotateX(0.9);` | subtle (0.044, 15% px) | subtle: slightly stronger 3D twist in the pinwheels, minor at this resolution | variants/tilt_0.9/frame_00001.png |
| palette_warm | `int colors[] = {#FFDA05, ... #131423};` -> `int colors[] = {#FACD00, #FB4F00, #F277C5, #7D57C6, #00B187, #3DC1CD};` | large (0.314, 93% px) | whole recolour: pinks/purples/teals/yellows dominate, no near-black or cream; structure unchanged | variants/palette_warm/frame_00001.png |

## Modularisation notes
- `quadtreeMosaic` (lines 26–40) is fully generic: start rect + N random quartering splits; the
  leaf list is a reusable "random inhomogeneous grid" primitive.
- `petalo` (lines 103–120) is a clean shape function `petalo(r1, r2, pwr1, pwr2)` — a
  two-exponent superellipse lobe; pairs of exponents give petal/leaf/blob variations.
- The per-rect flower (lines 42–100) is the art decision: palette-contrast re-roll, petal count
  3–19, spin direction, `rotateX(0.3)` tilt, centre dot. A `pinwheel(cx, cy, size, petals, tilt,
  colorA, colorB, pwr)` wrapper would capture it.
- A parameter object for this sketch: `{splits, petalCountMin, petalCountMax, petalSizeRange,
  petalShapeRange (pwr1, pwr2), tilt, dotSizeRange, palette, bgContrast: bool}`.
- One-off: the fixed 10-colour palette and the "re-roll while equals" contrast rule (lines 65–68)
  are taste choices, not structure.
