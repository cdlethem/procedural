---
sketch: 2020/generative/01_04/damino
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1558
animated: false
techniques: [noise-field, lines-hatching, distortion]
primitives: [shape]
palette:
  colors: ["#354998", "#D0302B", "#F76684", "#FCFAEF", "#FDC400", "#E6E6E6"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(12,45)*random(0.2,4)*0.6)", tried: [30], change: large, effect: "more, thinner lines; cell size dd shrinks so line width shrinks too; busier coverage, same circles"}
  - {name: alp1, default: "random(140,255)", tried: ["random(40,90)"], change: subtle, effect: "line ribbons slightly fainter; circles dominate so overall look barely moves"}
  - {name: circleCount, default: 10, tried: [25], change: moderate, effect: "25 translucent blobs instead of 10; much of the canvas is covered by overlapping circles, lines recede"}
  - {name: circleMaxDiameter, default: "random(360)*random(0.8,1.8)", tried: ["random(160)*random(0.8,1.8)"], change: moderate, effect: "circles up to ~160 instead of ~360; smaller, more numerous-looking blobs, line layer shows through more"}
  - {name: lineNoiseDetail, default: 0.002, tried: [0.01], change: moderate, effect: "ribbon width modulated at 5x frequency: jagged, spiky, busier strokes with thin pinches"}
  - {name: holeChance, default: 0.1, tried: [0.4], change: subtle, effect: "circle rims more notched/angular (40% of ring vertices dropped vs 10%); overall change small because blobs are large and translucent"}
reusable_candidates:
  - {name: noisyLine, signature: "noisyLine(x1, y1, x2, y2, w1, w2, c1, c2, a1, a2, noiseScale, res) -> void", note: "full line subdivided into quads whose width is lerp'd and multiplied by SimplexNoise"}
  - {name: holeyCircle, signature: "holeyCircle(x, y, diameter, holeChance) -> void", note: "closed polygon circle whose ring vertices are randomly skipped, leaving gaps"}
---

## What it draws
A light warm-gray field covered with many semi-transparent, wavy horizontal and vertical
ribbons in indigo, red, pink, cream and yellow that overlap into soft pink and mauve patches.
On top sit about ten large semi-transparent blob-like circles of the same palette (cream,
red, indigo, orange), some with irregular gaps or notches in their edges.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the piece is static (damino.pde:23-36).
`generate()` (lines 46-89) seeds `randomSeed`/`noiseSeed` with the harness seed, paints
`background(230)`, then picks `cc` random full-width lines (line 56). Each line gets a grid-snapped
anchor `dx`/`dy` (lines 63-64); four `noise()` samples at different detail seeds give target stroke
widths `str1..4` scaled by `dd*5.2` (lines 65-68). Two colors per line are drawn from the 5-color
`colors[]` list via `rcol()` (lines 148, 151-153) with random alpha 140-255 (lines 72-73).
One vertical and one horizontal line are emitted per `cc` iteration (lines 74-75).
`line1()` (lines 106-128) subdivides a line into ~d/2 segments and calls `line2()` per segment;
`line2()` (lines 130-140) emits a 4-vertex quad perpendicular to the line whose end widths are the
noise-modulated `str` values, with per-vertex `lerpColor`/alpha — that is what makes the ribbons
taper and waver. A second loop (lines 78-88) draws 10 circles snapped to the `dd` grid:
`cir()` (lines 91-104) builds a closed polygon of `int(r*PI*0.5)` ring vertices but only keeps a
vertex with probability 0.9 (line 98), so the rim develops random notches; fill is a random palette
color with double-randomized alpha (line 86).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_30 | `int cc = int(random(12, 45)*random(0.2, 4)*0.6);` -> `int cc = 30;` | large | 30 lines instead of ~11; thinner ribbons on a finer grid, canvas densely and busily covered; circle layer unchanged | variants/cc_30/frame_00001.png |
| alp1_40_90 | `float alp1 = random(140, 255);` -> `float alp1 = random(40, 90);` | subtle | line ribbons a touch more transparent; background shows through slightly more, overall look close to baseline | variants/alp1_40_90/frame_00001.png |
| circles_25 | `for (int i = 0; i < 10; i++) {` -> `for (int i = 0; i < 25; i++) {` | moderate | 25 translucent circles; most of the canvas is covered by overlapping blobs, the line layer mostly hidden | variants/circles_25/frame_00001.png |
| circsize_160 | `float s = random(360)*random(0.8, 1.8);` -> `float s = random(160)*random(0.8, 1.8);` | moderate | circles max ~160 diameter instead of ~360; smaller blobs, line layer visible between them | variants/circsize_160/frame_00001.png |
| det_0.01 | `float det = 0.002;` -> `float det = 0.01;` | moderate | ribbons modulated at 5x noise frequency: jagged spiky strokes with frequent thin pinches, much busier | variants/det_0.01/frame_00001.png |
| holes_0.4 | `if (random(1) < 0.1) {` -> `if (random(1) < 0.4) {` | subtle | circle rims visibly more notched and polygonal (more dropped vertices); overall small change since blobs stay large and translucent | variants/holes_0.4/frame_00001.png |

## Modularisation notes
`line1`/`line2` are generic: a noise-width-modulated gradient stroke between two endpoints; the
noise scale (0.002), width lerp, and per-vertex color/alpha lerp are the tunable core. `cir` is
generic too (radius, vertex count formula, hole chance). The art-specific decisions are: the
cc-count formula, the 5-color list, alpha ranges (140-255 for lines, double-random for circles),
grid snapping (`xx -= xx%dd`), and the bb=-40 full-bleed margin. A clean parameter object:
`{lineCount, cell (dd), lineWidthScale (5.2), lineNoiseDetail (0.1), lineDetail (0.002),
lineAlpha: [140,255], circleCount, circleMaxDiameter (360), circleSizeJitter (0.8-1.8),
holeChance (0.1), circleAlpha, palette, margin}`.
