---
sketch: 2014/Generativos/esferitas
year: 2014
renderer: JAVA2D
size: [600, 800]
libraries: []
deterministic: true
ms_first_frame: 461
animated: false
techniques: [dots-stippling, lines-hatching]
primitives: [ellipse, line]
palette:
  colors: ["#058789", "#503D2E", "#D54B1A", "#E3A72F", "#F0ECC9"]
  selection: random-from-list
composition: radial
parameters:
  - {name: count, default: 500, tried: [150], change: moderate, effect: "fewer spheres; central cluster sparser, much more background visible"}
  - {name: sizeBias, default: "random(20,100)*random(1)*random(1)", tried: ["random(20,100)"], change: large, effect: "removing the size bias makes spheres much larger on average; cluster becomes a near full-bleed mass of big overlapping circles"}
  - {name: des, default: "random(2,8)", tried: [2], change: subtle, effect: "diagonal wash becomes a visible fine 2-px texture across the background"}
  - {name: lineAlpha, default: 16, tried: [80], change: subtle, effect: "diagonal lines become clearly visible white hatching over the whole canvas"}
  - {name: crossCount, default: "random(-4,6)", tried: ["random(0,12)"], change: none, effect: "no visible change at whole-image level; only small extra x-ticks (tiny pixel area)"}
  - {name: crossScale, default: "t*0.10", tried: ["t*0.30"], change: subtle, effect: "x-ticks ~3x larger and bolder, trails longer and more prominent"}
reusable_candidates:
  - {name: twoToneSphere, signature: "twoToneSphere(x, y, d, angle, c1, c2, outlineWeight) -> void", note: "circle split into two flat colours along a chord (rotated), with a concentric outline ring for a fake 3D ball"}
  - {name: crossTicks, signature: "crossTicks(x, y, d, n, step) -> void", note: "row of small x-marks trailing from a point"}
---

## What it draws
A mustard-gold poster field with a dense central cluster of flat "spheres" in teal,
dark brown, orange-red, mustard and cream: each sphere is a circle cut into two
contrasting colours by a horizontal-ish chord, ringed by a thin dark outline, so it
reads as a simple 3D ball. Small dark x-marks trail off the upper-right of many
spheres, and the whole composition thins out radially from a busy centre to sparse
satellites near the edges. Faint 45° diagonal lines cross the entire background.

## How the code works
`setup()` (esferitas.pde:9) sizes 600×800 and calls `generar()` once; `draw()` is
empty, so the piece is static (regenerated only on key press). `generar()`
(esferitas.pde:22):
- Background is one random palette colour (here mustard, `rcol()`, line 23, 64-66).
- Lines 24-28: a full-bleed field of 45° diagonal lines, spacing `des` a random
  2-7 px, white at alpha 16 — barely visible texture.
- Lines 29-56: 500 iterations. Position (30-31): centre + half-size ×
  `random(-1,1)*random(1)`, whose product gives a triangular distribution peaked at
  the canvas centre — that is the radial density falloff seen in the image.
- Diameter (32): `random(20,100)*random(1)*random(1)`, the two extra `random(1)`
  factors bias sizes toward the small end.
- Each sphere: two distinct random palette colours (34-36). Lines 39-42 draw five
  concentric no-fill ellipses with decreasing `strokeWeight` (5→1) at alpha 4
  black, building the faint dark outline ring. Lines 44-47 fill two complementary
  arcs (`PI*1.5±a` / `PI*3.5-a`) of the same circle, splitting it into two solid
  colours along a chord at angle `a`. Lines 49-55: a row of `cc` (random −4..6)
  small `cruz()` x-marks (68-72) stepping outward at the upper right, in a random
  palette colour.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_150 | `for (int i = 0; i < 500; i++) {` -> `for (int i = 0; i < 150; i++) {` | moderate | ~3x fewer spheres; same central cluster shape but sparser, background much more visible | variants/count_150/frame_00001.png |
| size_full | `float t = random(20, 100)*random(1)*random(1);` -> `float t = random(20, 100);` | large | spheres much larger on average; cluster becomes a dense mass of big overlapping two-tone circles covering nearly the whole canvas, edge sparseness gone | variants/size_full/frame_00001.png |
| des_2 | `int des = int(random(2, 8));` -> `int des = 2;` | subtle | diagonal wash becomes a visible fine 2-px diagonal texture across the whole background; spheres unchanged | variants/des_2/frame_00001.png |
| lineAlpha_80 | `stroke(255, 16);` -> `stroke(255, 80);` | subtle | diagonal lines now clearly visible as white hatching across the entire canvas | variants/lineAlpha_80/frame_00001.png |
| cross_0_12 | `int cc = int(random(-4, 6));` -> `int cc = int(random(0, 12));` | none | no visible change at whole-image level; only small added x-tick rows (tiny pixel area) | variants/cross_0_12/frame_00001.png |
| crossScale_0.30 | `float tt = t*0.10;` -> `float tt = t*0.30;` | subtle | x-ticks ~3x larger and bolder, trails longer and more prominent | variants/crossScale_0.30/frame_00001.png |

## Modularisation notes
- Generic: the two-tone sphere (arc split + outline ring) and the `cruz()` tick
  row are self-contained and parameterisable; both are reusable candidates.
- One-off art decisions: the 5-colour palette, the triangular centre-biased
  placement, the `random(1)*random(1)` size bias, the alpha-16 diagonal wash, and
  the count/spacing values.
- A clean parameter object: `{count, sizeRange, sizeBias, spacing(des), lineAlpha,
  palette, crossRange, crossScale, background}`.
