---
sketch: 2019/generativos/zozo
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1559
animated: false
techniques: [grid, noise-field, flow-field]
primitives: [line, shape]
palette:
  colors: ["#D4C8B8", "#E3DEDA", "#CAB18A", "#C99A4E", "#2D2A10"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(20,50)", tried: [20], change: subtle, effect: "sparser grid; strokes longer and wider bands (more segments per stroke, ss*5 grows)"}
  - {name: alp1, default: 8, tried: [60], change: subtle, effect: "cell washes become visible as soft two-tone gradient patches over many cells"}
  - {name: det1, default: "random(0.01)", tried: [0.02], change: subtle, effect: "higher noise detail: strokes thinner, more curled and jagged"}
  - {name: vel, default: "random(0.5,3)", tried: [1.0], change: subtle, effect: "slower endpoint drift: strokes wider, smoother, stay closer to the original straight line"}
  - {name: "colors[1]", default: "#C99A4E", tried: ["#4E6AC9"], change: none, effect: "no visible change; palette walk keeps strokes in the tan/gold family, blue never perceptible"}
  - {name: "grid stroke alpha", default: "random(20,40)*0.9", tried: [100], change: subtle, effect: "grid lines clearly visible as solid dark lines"}
reusable_candidates:
  - {name: noiseDriftStroke, signature: "noiseDriftStroke(p1, p2, detail, vel, steps, colorFn) -> void", note: "two endpoints wandering on a 2-D noise field, drawing line() each step; yields tapered brush-like bands"}
  - {name: lerpPaletteColor, signature: "lerpPaletteColor(colors[], t) -> color", note: "lerp between adjacent palette entries with pow(t%1, 0.8) easing (getColor, lines 129-135)"}
---

## What it draws
A warm beige canvas with a faint square grid of thin dark lines and barely-visible lighter washes over some grid cells. Four long, diagonal, tapered brush-stroke bands in gold, amber and tan cross the canvas; each is straight at first and then curves, narrows to a point at one end, with a soft dry-brush texture along its length.

## How the code works
- `settings()` (lines 14-19) opens a 960x960 P2D window; `setup()` calls `generate()` once, `draw()` is empty, so the piece is static.
- `generate()` line 36: background `#D4C8B8` (the beige ground).
- Grid, lines 38-47: `cc = int(random(20, 50))` cells, `ss = width/cc`. The loop draws one vertical (line 45) and one horizontal (line 46) line per cell with black stroke at alpha `random(20,40)*0.9` (line 44) -> the faint dark grid.
- Cell washes, lines 49-81: 100 iterations pick two random grid intersections, build the bounding quad, and fill it with `#E3DEDA` at alpha 8 on one half and alpha 0 on the other (half swapped 50/50, lines 65-70) -> the almost-invisible tonal patches that give some cells a soft gradient.
- Brush strokes, lines 83-106: 4 strokes, each starting from two random grid points (lines 88-91). A loop of `ss*5` short `line()` segments (line 98) whose two endpoints each drift by `vel` (random 0.5-3, line 86) along angles from independent 2-D noise fields (lines 96-97, detail `det1`/`det2` = random 0.01). Where the two drifting endpoints stay apart the band is wide; where their noise paths converge it tapers to a point.
- Colour, line 99: `stroke(getColor(ic + dc), 100)` where `ic = random(1)` and `dc = 0.02` per step, so the colour walks along the 3-colour palette `{#CAB18A, #C99A4E, #2D2A10}` (line 122) with lerp easing (lines 129-135) -> each stroke shifts from tan through gold toward dark olive along its length.
- Randomness: the `seed` field (line 4) is set by the harness (42) and drives every `random()` call; the `noise()` fields are deterministic in coordinates, so the piece is deterministic. `SimplexNoise` is imported (line 1) but never used; the built-in `noise()` is what the strokes follow.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20 | `int cc = int(random(20, 50));` -> `int cc = 20;` | subtle (mean 0.0292, 4.1%) | sparser grid (20 cells vs ~30); the four strokes become longer, wider, flatter bands in the same tan/gold colours | variants/cc_20/frame_00001.png |
| alp1_60 | `float alp1 = 8;` -> `float alp1 = 60;` | subtle (mean 0.0361, 0.2%) | the near-invisible cell washes are now clearly visible as large soft two-tone gradient patches (top-centre, left, bottom-right); grid and strokes unchanged | variants/alp1_60/frame_00001.png |
| det1_0.02 | `float det1 = random(0.01);` -> `float det1 = 0.02;` | subtle (mean 0.0158, 2.0%) | strokes get thinner, more curled and jagged; endpoints wander at higher noise frequency so bands twist and partly fade | variants/det1_0.02/frame_00001.png |
| vel_1.0 | `float vel = random(0.5, 3);` -> `float vel = 1.0;` | subtle (mean 0.0174, 1.6%) | strokes become wide, smooth, gently waving ribbons that stay close to their original diagonal (less drift per step, less tapering) | variants/vel_1.0/frame_00001.png |
| palette_blue | `int colors[] = {#CAB18A, #C99A4E, #2D2A10};` -> `... {#CAB18A, #4E6AC9, #2D2A10};` | none (mean 0.0091, 3.8%) | no visible change: ribbons remain tan/gold/cream, no blue perceptible (pow-eased lerp keeps colour near the tan palette entries) | variants/palette_blue/frame_00001.png |
| gridAlpha_100 | `stroke(0, random(20, 40)*0.9);` -> `stroke(0, 100);` | subtle (mean 0.0295, 7.8%) | grid lines now clearly visible as solid dark lines across the canvas; strokes and washes unchanged | variants/gridAlpha_100/frame_00001.png |

## Modularisation notes
- Generic: `noiseDriftStroke` (the lines 87-106 pattern: N line segments, endpoints advected by a noise field with tunable detail, speed and step count) is a reusable "flow-stroke" primitive; `lerpPaletteColor` (lines 129-135) is a clean palette-walk helper; the cell-wash loop (lines 49-81) is a generic "faint gradient rects on a grid" filler.
- One-off art decisions: the 3-colour palette and beige background, the stroke count of 4, alpha 8 for the washes, and the `dc = 0.02` colour-walk rate.
- A clean parameter object: `{cells (cc), gridAlpha, washCount, washAlpha, strokeCount, strokeDetail (det), strokeSpeed (vel), stepsPerStroke (ss*k), palette[], paletteWalk (dc)}`.
- Unused helpers (`random2`, `noise2`, `fbm`, `arc2`, `rcol`) are dead code and could be dropped; `noise2`/`fbm` are a hand-rolled value-noise + fBm worth keeping as standalone library utilities.
