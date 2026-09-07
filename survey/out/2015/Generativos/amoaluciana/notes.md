---
sketch: 2015/Generativos/amoaluciana
year: 2015
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 385
animated: false
techniques: [polar, lines-hatching]
primitives: [line, ellipse, shape]
palette:
  colors: ["#ff5108", "#fffdf8", "#ff2321", "#000000", "#f7ff3f"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: discCount, default: 220, tried: [80], change: large, effect: "sparser clusters of eyes; rust stripes visible between them"}
  - {name: maxDiscD, default: 420, tried: [150], change: large, effect: "all medallions small and uniform; no giant discs"}
  - {name: ringSegments, default: "3-9", tried: ["2-5"], change: large, effect: "fewer, bolder ring arcs with wider gaps"}
  - {name: stripeSpacing, default: "8-30", tried: ["2-8"], change: none, effect: "no visible change - background hidden behind medallions"}
  - {name: crossCount, default: 100, tried: [300], change: subtle, effect: "slightly more small crosses in the gaps"}
  - {name: stripeAlpha, default: 80, tried: [200], change: subtle, effect: "background stripes slightly more visible in the gaps"}
reusable_candidates:
  - {name: ringMedallion, signature: "ringMedallion(x, y, d, segments, palette) -> void", note: "concentric arcs + pupil + highlight 'eye' built from ellipses and arcs"}
  - {name: crossShape, signature: "crossShape(x, y, d, angle, spread) -> void", note: "4-armed star polygon via beginShape/vertex"}
  - {name: hatchedBackground, signature: "hatchedBackground(spacing, weight, alpha) -> void", note: "parallel diagonal lines offset across the canvas"}
---

## What it draws
A dense, full-bleed scatter of "eye" medallions of very different sizes: off-white discs
ringed by bold colored arc segments (red-orange, yellow-green, black, olive, brown), a dark
pupil, and a small white glint, so the canvas reads as a swarm of cartoon eyes. Small
black-and-white cross/asterisk marks are sprinkled between the medallions, and in the gaps
a rust-brown diagonal stripe pattern (lighter hatching) shows through.

## How the code works
- `setup()` (line 9) calls `generate()` once; `draw()` is empty, so the image is static.
  random palette entries (`mcol()`, line 123), then a loop of parallel diagonal lines
  `line(-2, i, i, -2)` with spacing `sep = random(8, 30)` (line 24) and
  `stroke(255, 80)` (line 26) paints the rust hatching visible between medallions.
- Medallion loop (lines 30–75), 220 iterations: random position (31–32), diameter
  `d = random(10, random(80, 420))` (line 33) gives a heavy tail of large discs.
  For each disc, in order: (a) a dark 5-1 weight elliptical outline (36–39);
  (b) a light-gray fill disc (41–42); (c) two thin dark diagonal crosshairs (44–47);
  (d) two complementary arcs splitting the rim into a dark and a white arc
  (`a1 = random(TWO_PI)`, line 48, arcs at lines 50–54);
  (e) `cc = int(random(3, 9))` (line 55) equally spaced bold arc segments of random
  palette colors at radius `d*r1`, `r1 in [0.56, 0.72]` (60–66) — the colored rings;
  (f) a dark pupil disc and a palette-colored inner disc (68–71);
  (g) two small off-white glint dots (72–73).
- Cross loop (lines 77–92): 100 random 4-armed star shapes (`cross()`, line 95, a
  4-vertex-per-arm polygon closed with `endShape(CLOSE)`), first drawn as a 5-1
  dark outline, then filled with a random palette color (90–91).
- Color: `rcol()` (line 119) picks randomly from the 5-color `paleta` (orange, cream,
  red, black, yellow); `mcol()` (line 123) lerps two `rcol()` picks.
- Randomness: every position, size, angle, and color is `random()`; with seed 42 the
  baseline is deterministic.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| circles_80 | `for (int j = 0; j < 220; j++) {` -> `for (int j = 0; j < 80; j++) {` | large | sparse clusters of eyes; rust diagonal stripes visible between clusters | variants/circles_80/frame_00001.png |
| maxd_150 | `float d = random(10, random(80, 420)*random(1));` -> `float d = random(10, random(80, 150)*random(1));` | large | all medallions small and near-uniform in size; no giant discs, finer texture | variants/maxd_150/frame_00001.png |
| segments_2_5 | `int cc = int(random(3, 9));` -> `int cc = int(random(2, 5));` | large | each ring has fewer, bolder arc segments with wider gaps | variants/segments_2_5/frame_00001.png |
| stripes_2_8 | `int sep = int(random(8, 30));` -> `int sep = int(random(2, 8));` | none | no visible change - background mostly covered by medallions | variants/stripes_2_8/frame_00001.png |
| crosses_300 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 300; i++) {` | subtle | a bit more small crosses in the gaps between medallions | variants/crosses_300/frame_00001.png |
| stripeAlpha_200 | `stroke(255, 80);` -> `stroke(255, 200);` | subtle | background stripes slightly brighter/more visible in the gaps | variants/stripeAlpha_200/frame_00001.png |

## Modularisation notes
- Generic: the diagonal hatching loop (lines 23–29) is a reusable `hatchedBackground`;
  `cross()` (lines 95–112) is a clean reusable star/cross primitive; the medallion
  block (36–74) is self-contained per (x, y, d) and would make a good
  `ringMedallion(x, y, d, segments, palette)` with knobs for segment count, ring
  radius fraction, pupil ratio, and glint offset.
- One-off art decisions: the specific 5-color palette, the layering order
  (outline → disc → crosshairs → rim arcs → ring segments → pupil → glint), and the
  size distribution `random(10, random(80, 420))`.
- A clean parameter object: `{discCount, maxDiscD, segMin, segMax, ringRadiusFrac,
  pupilFrac, crossCount, stripeSpacing, stripeWeight, stripeAlpha, palette}`.
