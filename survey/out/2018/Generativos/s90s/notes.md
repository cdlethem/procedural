---
sketch: 2018/Generativos/s90s
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1690
animated: false
techniques: [packing]
primitives: [ellipse, line, shape]
palette:
  colors: ["#FACD00", "#FB4F00", "#F277C5", "#7D57C6", "#00B187", "#3DC1CD", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 4000, tried: [1000], change: large, effect: "sparser scatter — shapes read individually, background green and shadows much more visible"}
  - {name: sizeRange, default: "0.02-0.1 (nested random)", tried: ["0.05-0.15"], change: large, effect: "small shapes eliminated — green background becomes the dominant field, remaining shapes mid-to-large"}
  - {name: shapeMix, default: "int(random(3))", tried: ["int(random(2))"], change: large, effect: "polygons (triangles/squares/pentagons) removed entirely; only circles and line segments remain"}
  - {name: circleShadowOffset, default: "s*0.2", tried: [0], change: moderate, effect: "circle shadows removed (poly/line shadows untouched); black mass reduced, circles flatter"}
  - {name: palette, default: "6 saturated colors", tried: ["6 grey tones"], change: large, effect: "identical structure in grayscale; black shadows still stand out"}
reusable_candidates:
  - {name: poly, signature: "poly(x, y, s, a, c)", note: "regular c-gon of radius s/2 rotated by a (lines 78-87)"}
  - {name: stickerShadow, signature: "stickerShadow(drawFn, offset, colFn)", note: "draw shape in black at (x+off, y+off), then in palette colour at (x, y) — the 2.5D sticker look"}
---

## What it draws
A dense full-bleed confetti of flat geometric shapes: circles, squares, triangles and
pentagons, plus short thick line segments. Every shape is one of six saturated colours
(yellow, orange-red, pink/magenta, purple, green, teal) and has a solid black copy offset
down-right behind it, giving a 2.5D "sticker" shadow. Shapes overlap heavily at all sizes;
the background is almost entirely covered.

## How the code works
- `setup()` (lines 3-9): `size(960,960,P2D)`, `smooth(8)`, `pixelDensity(2)` (warning: not
  available on headless display), then one call to `generate()`. `draw()` is empty, so the
  image is static; `keyPressed` regenerates with a new seed (line 17).
- `generate()` (lines 22-76): `background(rcol())`, then `randomSeed(seed)`. Loop runs
  4000 times (line 27): position uniform in canvas (lines 28-29); size
  `s = width*random(0.02, random(0.1))` (line 30) — the nested `random` call biases sizes
  toward the small end; `rnd = int(random(3))` (line 31) picks one of three families:
  - `rnd == 0` (lines 34-44): circle. Black ellipse offset by `(s*0.2, s*0.2)` as shadow
    (line 37), then a palette-coloured ellipse at `(x,y)` (line 43); 20% chance (line 39)
    of an extra coloured outline with weight up to `s*0.1`.
  - `rnd == 1` (lines 45-61): line segment. Length `ss*random(0.02,0.1)` along a random
    angle `a` (lines 46-49), stroke width `s = ss*random(0.05,0.1)` (line 50); a black
    copy offset by `dd = ss*0.04` (lines 52-54) sits behind the coloured line (line 56).
  - `rnd == 2` (lines 62-74): regular polygon with `c = int(random(3,6))` sides (line 64)
    — triangles, squares, pentagons — via `poly()`; same black-offset shadow + 20%
    outline treatment as circles.
- Colour: fixed 6-colour array (line 155), `rcol()` picks uniformly at random (lines
  156-158). Black (`#000000`) is used only for shadows/outlines.
- 4000 overlapping shapes on a 960×960 canvas is why the background and order-dependent
  overlaps dominate the look. `baston()` (lines 89-127) and `arc2()` (lines 129-147) are
  dead helpers, never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_1000 | `for (int i = 0; i < 4000; i++) {` -> `i < 1000` | large (0.351, 0.856) | sparse confetti: individual circles/polygons/lines clearly readable, green background and black shadows show through everywhere | variants/count_1000/frame_00001.png |
| size_0.05-0.15 | `float s = width*random(0.02, random(0.1));` -> `random(0.05, random(0.15))` | large (0.334, 0.791) | no small shapes left — teal-green background dominates, shapes are mid/large and sparsely scattered | variants/size_0.05-0.15/frame_00001.png |
| mix_2 | `int rnd = int(random(3));` -> `int(random(2))` | large (0.329, 0.807) | all triangles/squares/pentagons gone; image is pure circles + short line segments in the same palette | variants/mix_2/frame_00001.png |
| shadow_0 | `ellipse(x+s*0.2, y+s*0.2, s, s);` -> `ellipse(x, y, s, s);` | moderate (0.055, 0.124) | only the circle shadows vanished (polygon/line shadows use different code paths and remain); slightly flatter, less black mass | variants/shadow_0/frame_00001.png |
| palette_gray | `int colors[] = {#FACD00, ... #3DC1CD};` -> six grey values #333333-#DDDDDD | large (0.210, 0.735) | same dense confetti rendered monochrome; black shadows still distinct from mid-greys, structure unchanged | variants/palette_gray/frame_00001.png |

## Modularisation notes
- `poly(x,y,s,a,c)` is fully generic (regular n-gon, radius, rotation) — ready as a
  library primitive.
- The shadow pattern (black copy at `(x+s*0.2, y+s*0.2)` under the coloured shape,
  duplicated for lines with a smaller `ss*0.04` offset) is the sketch's signature move;
  a `stickerShadow(drawFn, offset, paletteFn)` wrapper captures it.
- The three-family dispatch (circle / line / polygon with 3-5 sides) and the size
  distribution `random(0.02, random(0.1))` are one-off art decisions.
- Clean parameter object: `{count: 4000, sizeMin: 0.02, sizeMax: 0.1, sizeCurve: "nested-random",
  mix: {circle: 1/3, line: 1/3, polygon: 1/3}, polySides: [3,6], shadowOffset: 0.2,
  outlineChance: 0.2, outlineWeight: 0.1, palette: [6 colours]}`.
