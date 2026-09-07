---
sketch: 2020/generative/05_08/aca
year: 2020
renderer: P3D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1835
animated: false
techniques: [noise-field, lines-hatching, dots-stippling, distortion]
primitives: [line, ellipse]
palette:
  colors: ["#00A878", "#D8F1A0", "#F3C178", "#FE5E41", "#0B0500"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: count, default: 300000, tried: [60000], change: moderate, effect: "sparser, darker hatching; more black background shows through, same colour layout"}
  - {name: detCol2, default: 0.02, tried: [0.08], change: none, effect: "no visible change"}
  - {name: detAmp, default: "random(0.005,0.003)*0.7", tried: ["*3.0"], change: subtle, effect: "slightly darker, marginally more varied stroke lengths; layout unchanged"}
  - {name: palette, default: "5 warm/teal colours", tried: ["blue/red/cream set"], change: moderate, effect: "same noise layout recoloured: blue left field, deep red right, pale cream top-right"}
  - {name: alphaShort, default: 260, tried: [80], change: moderate, effect: "hairier, more translucent texture; more black background visible, colours duller"}
  - {name: strokeWeight, default: 1.4, tried: [4], change: moderate, effect: "thick chunky strokes; denser, more opaque painterly texture, colours bolder"}
reusable_candidates:
  - {name: noiseLerpColor, signature: "noiseLerpColor(palette[], noiseScale, x, y) -> color", note: "map 2-D noise to a palette index, lerp between adjacent swatches (getColor, lines 110-116)"}
  - {name: hatchedField, signature: "hatchedField(count, lenMax, alphaMax, weightMax, wobbleDetail) -> void", note: "draw many short random strokes displaced/rotated by noise (first loop, lines 57-76)"}
---

## What it draws
A full-bleed, dark near-black field densely packed with thousands of very fine, mostly vertical
strokes, like felted hatching. Colour sits in soft blotches: teal-green dominates the left half,
warm orange-red the right half, with pale cream-green patches near the top and large dark voids
where the strokes fade out. The overall texture is a soft, painterly mesh of short hairs with no
clear figure — colour drifts smoothly across the canvas in noise-shaped clouds.

## How the code works
`settings()` (lines 13-18) opens a 960x960 P3D window (`pixelDensity(2)`, warned unavailable in the
headless run). `setup()` calls `generate()` once; `draw()` is empty, so the piece is static.

`generate()` (lines 43-91) seeds random+noise (lines 45-46), fills the background near-black
(47), then draws two passes:

1. **Main hatching** (lines 57-76, 300 000 iterations): each iteration picks a random point, a
   stroke length `w` up to ~20 px modulated by noise `detAmp` (line 60), a weight up to 1.4 (61),
   a noise-driven colour value (line 62) resolved through `getColor(float)` which lerps between
   adjacent palette entries (lines 110-116, palette line 101). The point is rotated by a random
   angle scaled by `w/20` (65) and displaced by two noise channels `detDes` into `dx`, `dy`
   (66-67). Two strokes are drawn: a short rotated line of length `w` at alpha up to 260 (68-70)
   and a long near-vertical line up to ~300 px at alpha up to 110 (72-74). The long low-alpha
   verticals are what produce the vertical streaky character.
2. **Dots + extra verticals** (lines 79-90, 10 000 iterations): more vertical lines (up to 300 px)
   plus tiny ellipses up to 3 px filled with a raw random palette colour (`rcol()`, lines 102-104).

Randomness enters through `random()` for positions/lengths/weights/alpha and `noise()` for the
length modulation, displacement, and colour field. No blend modes (line 54 is commented out); the
soft colour clouds come purely from the noise-driven `lerpColor` across the 5-colour palette.
`triangulate`/`toxi` are imported but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_60000 | `for (int i = 0; i < 300000; i++) {` -> `... i < 60000 ...` | moderate | sparser hatching, darker overall; more black background visible in the centre and bottom, same teal/orange layout | variants/count_60000/frame_00001.png |
| detCol2_0.08 | `float detCol2 = random(0.02);` -> `random(0.08)` | none | no visible change | variants/detCol2_0.08/frame_00001.png |
| detAmp_x3 | `float detAmp = random(0.005, 0.003)*0.7;` -> `*3.0` | subtle | slightly darker field, marginally more varied stroke lengths; composition identical | variants/detAmp_x3/frame_00001.png |
| palette_cool | `int colors[] = {#00A878, ...};` -> `{#2B50AA, #7EA0EE, #F6D89C, #B22222, #050510}` | moderate | identical noise layout recoloured: blue dominates the left, deep red the right, pale cream top-right | variants/palette_cool/frame_00001.png |
| alpha_80 | `stroke(getColor(col), random(260)*random(1));` -> `random(80)` | moderate | thinner, more translucent strokes; black background shows through, texture reads hairier and duller | variants/alpha_80/frame_00001.png |
| weight_4 | `strokeWeight(random(1.4));` -> `random(4)` | moderate | thick chunky brush-like strokes; denser, more opaque painterly texture, colours bolder | variants/weight_4/frame_00001.png |

## Modularisation notes
- **Generic / library-worthy**: `getColor(float)` (noise → palette lerp, lines 110-116) and the
  first loop's "many noise-wobbled short strokes" pattern (lines 57-76). A `noiseLerpColor`
  helper and a `hatchedField(count, len, alpha, weight, wobble)` drawer are the two reusable pieces.
- **One-off art decisions**: the specific 5-colour palette (line 101, with three commented-out
  alternatives above it), the exact noise scales (`detDes`/`detAmp`/`detCol`/`detCol2`, lines 49-52),
  the second vertical-line pass, and the dot pass with its different noise channel order (83-84).
- **Parameter object**: `{ seed, palette[], countMain, countDots, lenMax, alphaShortMax, alphaLongMax, weightMax, noiseScaleLen, noiseScaleDisplace, noiseScaleColor, noiseScaleColor2, dotSizeMax }`.
  The four noise scales are the most expressive knobs; counts trade speed for density.
