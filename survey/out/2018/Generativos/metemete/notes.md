---
sketch: 2018/Generativos/metemete
year: 2018
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 747
animated: false
techniques: [noise-field, grid, lines-hatching]
primitives: [rect, line, shape]
palette:
  colors: ["#E80707", "#FAD647", "#2F8145", "#182395", "#000000", "#FFFFFF", "#F0F0F0"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(6, random(12,40)*random(0.5,1)))", tried: [10], change: moderate, effect: "denser grid: more, smaller squares and black corner notches; substitution re-rolls the downstream random sequence"}
  - {name: pwr, default: "random(1,5)", tried: [1], change: large, effect: "notch no longer attenuated -> big dark corners; whole composition re-rolled (more saturated hairier background, finer grid)"}
  - {name: hairAlpha, default: 60, tried: [150], change: moderate, effect: "hair strokes more opaque; background colour more continuous, less white showing"}
  - {name: hairCount, default: 300000, tried: [100000], change: large, effect: "hair sparser; more white shows through, background lighter and patchier"}
  - {name: ccc, default: "int(cc*random(0.2,2))", tried: [0], change: subtle, effect: "cross-hatch overlay rectangles mostly gone; a few faint hatched patches remain; rest looks the same"}
reusable_candidates:
  - {name: noiseHatch, signature: "noiseHatch(w, h, lineCount, alpha) -> void", note: "300k short lines whose angle/length/colour come from 4 independent noise fields (pelos)"}
  - {name: notchedSquare, signature: "notchedSquare(x, y, s, dd) -> shape", note: "5-vertex polygon: square with one corner cut by dd, drawn as a black corner shadow"}
  - {name: rectLines, signature: "rectLines(x, y, w, h, spacing, dir, offset) -> void", note: "diagonal hatching of a rectangle in two directions, already self-contained"}
  - {name: lerpPalette, signature: "lerpPalette(colors, t) -> color", note: "getColor: wraps a palette index and lerps between adjacent entries"}
---

## What it draws
A full-bleed field of fine, hair-like directional strokes in red, yellow, green and blue
(with white gaps where the strokes are sparse) forming soft mottled colour regions. Over it
sits a loose grid of small squares: some are solid in the same four colours, many have a black
corner cut out of one side (like a folded corner), most are framed by a thin light-grey
outline box, and a few larger translucent rectangles are cross-hatched with diagonal lines in
one or both directions.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty (static, confirmed by frames 10/60 being
identical to frame 1). `randomSeed(seed)` is set at the top of `generate()` (metemete.pde:35).

1. **Hair background** — `pelos()` (lines 129–149): 300,000 iterations draw a `line` at a
   random point (−20..w+20, line 140). Its angle is `noise(...)*TAU*2` (line 145), its stroke
   weight is another noise value `anc` (lines 142–143), its length is `noise(...)*anc*40`
   (line 146), and its colour is `getColor(noise(...)*colors.length*3)` with alpha 60 (line
   144) — a noise-driven lerp across the 4-colour palette (lines 194–199). This produces the
   mottled red/yellow/green/blue streaky ground.
2. **Grid of squares** (lines 63–102): `cc` is a random cell count ~6–20 (line 40),
   `ss = width/cc` (line 41). For every cell (padded −2..cc+1 so edges are covered) the size
   `s` comes from noise (lines 71–73) and a corner notch `dd = pow(noise, pwr)*ss*3` (line 74).
   Per cell it draws: a near-invisible `fill(0,8)` shadow rect (line 79), a light-grey
   noFill `stroke(240)` outline rect at 1.8× size (lines 83–84); if a third noise field is
   above 0.2 (line 86) a black 5-vertex `beginShape` polygon — a square with one corner cut by
   `dd` (lines 90–96) — and a solid square in `rcol()`, a random pick from the 4-colour list
   (lines 98–100, palette line 187).
3. **Cross-hatch overlays** (lines 105–126): `ccc = cc*random(0.2,2)` rectangles snapped to
   the grid (lines 112–113), each filled at alpha 8 and hatched via `rectLines` (lines
   151–178), which emits parallel diagonal lines across the rect; a second pass at 90° happens
   with 50% probability (line 125). Hatch colour is `rcol()` at alpha 80.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_10 | `int cc = int(random(6, random(12, 40)*random(0.5, 1)));` -> `int cc = 10;` | moderate | denser, finer grid of squares with black corner notches covering more of the canvas; hair background re-rolled (substitution shifts the random sequence) | variants/cc_10/frame_00001.png |
| pwr_1 | `float pwr = random(1, 5);` -> `float pwr = 1;` | large | big dark corner notches; whole composition re-rolled: far more saturated, hairier background with a finer, denser square grid | variants/pwr_1/frame_00001.png |
| hairalpha_150 | `stroke(getColor(...), 60);` -> `stroke(getColor(...), 150);` | moderate | hair strokes more opaque; mottled colour regions read as more continuous, less white showing between strokes | variants/hairalpha_150/frame_00001.png |
| haircount_100000 | `for (int i = 0; i < 300000; i++) {` -> `for (int i = 0; i < 100000; i++) {` | large | hair sparser: more white shows through, background lighter and more patchy; squares unchanged | variants/haircount_100000/frame_00001.png |
| ccc_0 | `int ccc = int(cc*random(0.2, 2));` -> `int ccc = 0;` | subtle | cross-hatched overlay rectangles mostly gone; a few faint hatched patches remain, rest looks the same | variants/ccc_0/frame_00001.png |

## Modularisation notes
- **Generic / reusable**: `rectLines` (diagonal hatch of a rect, direction + offset) is
  already self-contained; `pelos` becomes a `noiseHatch(w, h, lineCount, alpha)` with
  palette, angle scale and line-length scale as parameters; `notchedSquare(x, y, s, dd)`
  is the black corner polygon; `getColor`/`lerpPalette` is a standard palette-lerp helper.
- **One-off art decisions**: the three-layer stacking order (hair, then squares, then
  hatched overlays), the `stroke(240)` outline box at 1.8× cell size, the specific 4-colour
  palette, the 0.2 noise threshold that drops some squares, and the random `pwr` exponent
  that shapes the corner notch.
- **Clean parameter object**: `{ seed, hairCount, hairAlpha, hairAngleScale, hairLenScale,
  palette[], cellCount (cc), squareSizeRange, notchPower (pwr), notchScale, dropThreshold,
  outlineAlpha, overlayCount (ccc), hatchSpacingRange, hatchAlpha }`.
