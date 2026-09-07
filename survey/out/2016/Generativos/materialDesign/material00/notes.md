---
sketch: 2016/Generativos/materialDesign/material00
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 605
animated: false
techniques: [packing, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#F44336", "#E91E63", "#9C27B0", "#2196F3", "#4CAF50", "#FFEB3B", "#FF9800", "#000000", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 1000, tried: [300], change: large, effect: "300 circles still ~86% canvas coverage; sparser stacking, grey background patches appear, same red/lime mix"}
  - {name: sizeExp, default: "pow(2, random(4))", tried: ["pow(2, random(8))"], change: large, effect: "max size 320 -> 5120 px; a giant circle drawn near the end of the loop flattens the whole canvas to one light-red shade, only a few later circles remain visible"}
  - {name: palettes, default: "random p1,p2 in 0..14", tried: ["p1=5, p2=6"], change: large, effect: "fixed Blue + Light Blue palettes: same scatter, entirely blue/cyan monochrome"}
  - {name: outlineAlpha, default: 2, tried: [40], change: subtle, effect: "dark rims become clearly visible around most circles (thin black outlines), fills unchanged"}
  - {name: background, default: 234, tried: [0], change: none, effect: "no visible change: circles cover ~95% of the canvas, only tiny gaps turn black instead of grey"}
reusable_candidates:
  - {name: materialPalettes, signature: "MaterialColors.getColor(p, c) -> color", note: "embedded Material Design 2014 palette tables (20 palettes x up to 15 shades)"}
  - {name: scatteredCircles, signature: "scatteredCircles(n, sizeFn, colorFn) -> void", note: "n random overlapping filled circles with optional layered outline rings"}
---

## What it draws
A full-bleed dense scatter of overlapping filled circles of very different sizes (from
tiny dots up to ~300 px) on a light grey background. With seed 42 the two randomly
chosen palettes are Material Red and Material Lime, so the canvas is a busy mix of
reds/pinks and lime/yellow-greens with a few near-white and olive tones. Each circle
carries a faint dark halo (thin black outline at 2/255 alpha, drawn in 5 shrinking
rings) that reads as a subtle dark rim around the flat fills.

## How the code works
- `setup()` (material00.pde:3) calls `generate()` once; `draw()` is empty, so the
  sketch is static. `keyPressed()` regenerates with a new random seed (line 12).
- `generate()` (lines 20-49): `randomSeed(seed)` (line 21), then
  `background(234)` (line 22, light grey).
- Two palettes are picked: `p1`/`p2` uniform over palettes 0..14 (line 24-25;
  `getNumPalettes()-5` excludes Grey, Blue Grey, Black, White and the last one).
- Main loop (lines 28-43): 1000 circles. Position uniform random in canvas
  (lines 29-30). Size `s = random(20)*pow(2, random(4))` (line 31): base 0-20 px
  scaled by a power of 2 in [1,16), so sizes range ~0-320 px, geometrically
  distributed (many small, few large).
- Outline first (lines 33-38): `noFill()`, `stroke(0, 2)` (near-invisible black),
  then 5 rings with `strokeWeight(j)` for j=5..1 — concentric ellipses of the same
  size, which produces the soft dark rim.
- Fill (lines 39-42): palette chosen 50/50 between p1 and p2, then a uniform
  random colour index within that palette; flat opaque fill, `noStroke()`.
- Dead code: `cc = int(random(-2, 5))` and an empty loop (lines 45-48) do nothing.
- `MaterialColors` (lines 59-168) is a static class holding the palette tables and
  lookup helpers.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | large (0.2668, 0.809) | sparser stacking: same reds and limes, grey background now visible in patches, fewer overlap layers | variants/count_300/frame_00001.png |
| sizeExp_8 | `float s = random(20)*pow(2, random(4));` -> `float s = random(20)*pow(2, random(8));` | large (0.2308, 0.803) | one giant circle (up to 5120 px) drawn near the end flattens the canvas to a single salmon-pink fill; only 4 small circles drawn afterwards remain visible | variants/sizeExp_8/frame_00001.png |
| palette_5_6 | `int p1 = int(random(MaterialColors.getNumPalettes()-5));` -> `int p1 = 5;` and p2 -> `int p2 = 6;` | large (0.399, 0.984) | identical scatter structure, but entirely blue/cyan (Blue + Light Blue palettes) | variants/palette_5_6/frame_00001.png |
| outline_40 | `stroke(0, 2);` -> `stroke(0, 40);` | subtle (0.025, 0.098) | dark rims now clearly visible around the circles; fills and layout unchanged | variants/outline_40/frame_00001.png |
| bg_0 | `background(234);` -> `background(0);` | none (0.0065, 0.008) | no visible change: circles cover almost everything, only tiny inter-circle gaps are black instead of light grey | variants/bg_0/frame_00001.png |

## Modularisation notes
- The `MaterialColors` class is a self-contained data table + lookup: a ready-made
  library asset (`palette: "material"`, `color(palette, shade)`).
- The draw loop is a generic "scattered filled circles" primitive: count, size
  distribution (`random(base)*pow(2, random(exp))`), colour sampler, and an
  optional layered-outline effect (N shrinking rings at low alpha) are all
  separable parameters.
- One-off art decisions: the specific 2014 Material palette set, the 50/50
  two-palette mixing, and the outline-ring trick.
- A clean parameter object: `{ count, sizeMin, sizeExp, palettes: [p1, p2],
  outlineAlpha, outlineRings, background }`.
