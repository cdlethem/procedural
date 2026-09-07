---
sketch: 2018/Generativos/rayos
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2234
animated: false
techniques: [grid, particles]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#559BF7", "#173A7B", "#FF3A3D", "#FFB302"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 1000, tried: [300, 3000], change: large, effect: "300 = sparse darts over red background; 3000 = denser, busier field"}
  - {name: sizeScale, default: 0.6, tried: [0.3], change: large, effect: "half the max dart size -> fine uniform confetti, background shows through"}
  - {name: squashRange, default: [0.7, 0.9], tried: [0.3, 0.5], change: large, effect: "lower squash -> thicker, more solid chunky triangles instead of thin darts"}
  - {name: strokeWeight, default: 3, tried: [12], change: none, effect: "no visible change: strokeWeight() is called after generate(), so it never affects the render"}
  - {name: palette, default: "[#FFFFFF, #559BF7, #173A7B, #FF3A3D, #FFB302]", tried: ["[#0F101E, #11142B, #28398B, #323E78, #4254A3]"], change: large, effect: "commented-out night palette -> flat monochrome dark-navy tangle"}
reusable_candidates:
  - {name: dartShape, signature: "dartShape(x, y, angle, size, squash) -> 6-vertex shape", note: "triangle with a mirrored inner ring (radius * squash) -> thin spiky darts"}
  - {name: tileRepeat, signature: "tileRepeat(drawFn, cols, rows)", note: "draws every element in a 3x3 translation grid for seamless tiling"}
---

## What it draws
A dense, full-bleed tangle of thin, spiky dart-like triangles scattered at random angles and
sizes. The shapes overlap so heavily that no background is visible; the dominant colours are
red, yellow/amber, and dark navy, with white and light blue breaking through. The overall
impression is a chaotic, all-over confetti of shards with no focal point.

## How the code works
- `setup()` (line 3): opens a 3250x3250 P2D canvas, `smooth(2)`, then calls `generate()` and
  exits. `draw()` is a no-op, so the sketch is static (only `frame_00001.png` exists).
- `generate()` (line 55): `randomSeed(seed)` (line 58) makes the run reproducible; the
  background is one random palette colour (line 57) but is immediately buried. Note the
  background colour is drawn *before* the reseed, so it depends on the initial random state.
- 1000 `Triangle` objects are created (line 62) at random `x, y` in the canvas, random angle
  in `TAU`, and size `width * random(0.6) * random(0.1, 1)` — a size distribution skewed hard
  toward small values, so most darts are thin slivers and a few are large.
- Each `Triangle` picks one random palette colour `col` (line 34) and a squash factor
  `amp = random(0.7, 0.9)` (line 33).
- `Triangle.show()` (line 37) draws a 6-vertex shape: three outer vertices at radius `s/2`
  spaced 120 deg, plus three inner vertices at the *mirrored* angles with radius `s/2 * amp`.
  The mirror + slight shrink turns a plain triangle into a thin two-lobed dart/arrow.
- The second loop (lines 67–76) draws every triangle nine times, translated by `xx*width,
  yy*height` for `xx, yy in -1..0..1` — a 3x3 tiling that makes the composition seamless
  (edges wrap). This is the "grid" technique.
- `strokeWeight(3)` on line 8 is called *after* `generate()` (line 7), so the rendered image
  uses the default stroke weight; the line is dead for the headless render (confirmed:
  stroke_12 variant = zero pixel difference). Each dart is filled with its colour.
- A second palette (dark blue/grey) is commented out at line 84 and never used.
- `getColor()` (line 89) is a lerp-between-palette helper but is never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int i = 0; i < 1000; i++) {` -> `i < 300` | large | sparse: red background clearly visible, individual large darts legible, far less overlap | variants/count_300/frame_00001.png |
| count_3000 | `for (int i = 0; i < 1000; i++) {` -> `i < 3000` | large | denser and busier: background almost gone, many more thin slivers, no legible individual shapes | variants/count_3000/frame_00001.png |
| size_0.3 | `width*random(0.6)*random(0.1, 1)` -> `width*random(0.3)*random(0.1, 1)` | large | all darts half size: fine, uniform red-dominant confetti; no large shapes, texture much finer | variants/size_0.3/frame_00001.png |
| amp_0.3_0.5 | `amp = random(0.7, 0.9);` -> `amp = random(0.3, 0.5);` | large | darts fatten into thick, more solid chunky triangles (inner ring collapses toward centre); composition reads as overlapping triangles, not thin shards | variants/amp_0.3_0.5/frame_00001.png |
| stroke_12 | `strokeWeight(3);` -> `strokeWeight(12);` | none | no visible change (parameter is dead: set after generate()) | variants/stroke_12/frame_00001.png |
| palette_night | `int colors[] = {#FFFFFF, #559BF7, #173A7B, #FF3A3D, #FFB302};` -> night palette from line 84 | large | flat monochrome: dark navy/black slivers over near-black background, low contrast, structure barely visible | variants/palette_night/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the dart shape (outer triangle + mirrored, squashed inner ring) is a
  clean parameterised primitive (`x, y, angle, size, squash`); the 3x3 `tileRepeat` wrapper is a
  generic seamless-tiling helper; the skewed size draw `width * k * random(0.1, 1)` is a
  reusable power-law-ish size distribution.
- One-off art decisions: the specific 5-colour palette and its random pick, the count (1000),
  the squash range (0.7–0.9), and choosing to bury the background under the scatter.
- A clean parameter object: `{ count, sizeScale, sizeExponent, squashRange, palette, tiles }`.
  `strokeWeight` does not belong: in this sketch it is dead code, and a real parameter object
  would only include values that actually reach the render.
