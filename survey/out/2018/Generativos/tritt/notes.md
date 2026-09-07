---
sketch: 2018/Generativos/tritt
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2905
animated: false
techniques: [packing, symmetry, 3d-mesh]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#559BF7", "#173A7B", "#FF3A3D", "#FFB302"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: triCount, default: 1000, tried: [300], change: large, effect: "fewer frames -> sparse scatter, big dark gaps of the background colour show through"}
  - {name: sizeScale, default: 0.6, tried: [1.2], change: large, effect: "2x size scale -> a few huge frames dominate, much less fine detail"}
  - {name: wingAlpha, default: 30, tried: [120], change: moderate, effect: "darker translucent black outer wings (r1->2r1), overall image reads darker"}
  - {name: cc, default: "random(3,26)", tried: [40], change: none, effect: "no visible change; grid dots are 1-3 px at 3250 px canvas, below visibility"}
  - {name: colors, default: "5-colour bright set", tried: ["earth palette (black/green/olive/cream/brown)"], change: large, effect: "same structure recoloured; structure is palette-independent"}
reusable_candidates:
  - {name: triFrame, signature: "triFrame(x, y, angle, size, color, r1, r2, r3, wingAlpha) -> void", note: "3-fold-symmetric hollow triangular frame: two concentric ring segments plus 3 translucent outer wings"}
  - {name: tileWrap, signature: "tileWrap(drawFn, w, h) -> void", note: "draw every element in a 3x3 neighbourhood of canvas translations for seamless wrapping"}
---

## What it draws
A dense, full-bleed scatter of hollow triangular "frames" (each looks like a 3D triangular
picture frame: a thick outer ring segment plus a smaller inner ring, with a triangular hole
in the middle) in white, light blue, dark navy, red and yellow, over a dark navy background.
The frames overlap heavily in random rotations and sizes, giving a busy, almost collage-like
surface. A fine grid of tiny dots (two concentric squares per cell, one translucent) is
scattered across the whole canvas and is barely visible at this resolution.

## How the code works
`setup()` (lines 3-11) opens a 3250x3250 P2D canvas, calls `generate()` once, saves the
frame and exits — the sketch is static (the `draw()` body at lines 13-15 is empty;
`keyPressed` regenerates on any key, line 17-23).

`generate()` (lines 78-115):
- `background(rcol())` picks a random palette colour for the ground (line 80); with seed 42
  it lands on the dark navy `#173A7B`.
- 1000 `Triangle` objects are created at random positions with random rotations and sizes
  `width*random(0.6)*random(0.1, 1)` (line 86) — the double random makes sizes heavily
  skewed toward the small end (product of two uniforms).
- Each triangle is drawn 9 times, once per cell of a 3x3 grid of canvas-sized translations
  (lines 90-99), so shapes crossing an edge wrap to the opposite side: seamless tiling.
- A dot overlay: `cc = random(3,26)` cells across, and at every lattice point a
  translucent 3x square plus a solid 1x square of a random colour (lines 101-114). At the
  default 3250 px canvas the dot is `max(1, ss*0.02)` px, i.e. 1-3 px, so it is nearly
  invisible.

`Triangle.show()` (lines 37-75) builds one frame from 3-fold symmetry
(`da = TWO_PI/3`, 3 iterations at lines 43-74), with radii `r1 = s*0.5`, `r2 = s*0.35`,
`r3 = s*0.2` (lines 39-41). Per 120-degree sector it draws:
1. a translucent black trapezoid from r1 out to 2*r1 (`fill(0, 30)`, lines 47-54) — the
   "wing" that darkens the area behind each frame edge;
2. the outer ring segment r1->r2 in `col` with the inner edge darkened 20% toward black
   (`lerpColor(col, color(0), 0.2)`, lines 57-64) — the fake 3D bevel;
3. the inner ring segment r2->r3, same two-tone shading (lines 66-73).
The two ring segments leave a triangular hole inside r3, which reads as the frame's opening.

Colour: `rcol()` (lines 124-126) picks uniformly from the 5-colour array
(`{#FFFFFF, #559BF7, #173A7B, #FF3A3D, #FFB302}`, line 123). `getColor` (lines 127-137)
is an unused lerp-between helper. `amp = random(0.7, 0.9)` (line 33) is assigned but never
used. All randomness is seeded from `randomSeed(seed)` (line 81), so the render is
deterministic for a given seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | large | sparse scatter: ~70% fewer frames, large dark-navy background gaps, individual frames clearly readable | variants/count_300/frame_00001.png |
| size_1.2 | `width*random(0.6)*random(0.1, 1)` -> `width*random(1.2)*random(0.1, 1)` | large | 2x size scale: a few huge frames dominate the canvas, far less fine detail, same palette | variants/size_1.2/frame_00001.png |
| alpha_120 | `fill(0, 30);` -> `fill(0, 120);` | moderate | translucent black outer wings much darker: image reads overall darker/moodier, wing shadows visible as dark triangles | variants/alpha_120/frame_00001.png |
| cc_40 | `int cc = int(random(3, 26));` -> `int cc = 40;` | none | no visible change: dots are only 1-3 px at 3250 px canvas, below visibility | variants/cc_40/frame_00001.png |
| palette_earth | `int colors[] = {#FFFFFF, #559BF7, #173A7B, #FF3A3D, #FFB302};` -> `{#101010, #3A7D44, #9BC53D, #F5F5DC, #6B4226};` | large | identical structure recoloured to black/green/olive/cream/brown; composition and overlap unchanged | variants/palette_earth/frame_00001.png |

## Modularisation notes
- **Generic, reusable**: the `Triangle` frame primitive (3-fold-symmetric hollow triangle
  with two-tone bevel shading) is a clean standalone function:
  `triFrame(x, y, angle, size, color, r1, r2, r3, wingAlpha)`. The 3x3 tiling loop
  (lines 90-99) is a generic seamless-wrap helper. The dot lattice (lines 101-114) is a
  generic "lattice dots" overlay but only meaningful at low canvas resolution.
- **One-off art decisions**: the 5-colour palette, the 1000-element density, the
  `random(0.6)*random(0.1, 1)` double-random size distribution (skews small), the wing
  alpha 30, and the 20% bevel darkening.
- **Suggested parameter object**: `{count, sizeScale, sizeMin, wingAlpha, bevelDarken,
  palette[], dotGrid: cc|0, seed}`. Note `amp` is dead code (assigned, never used) and
  `getColor` is unused — drop both.
- The sketch is static and deterministic; no animation state to preserve.
