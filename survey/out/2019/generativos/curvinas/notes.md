---
sketch: 2019/generativos/curvinas
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1452
animated: false
techniques: [noise-field, particles]
primitives: [ellipse, line]
palette:
  colors: ["#F20707", "#FCCE4A", "#D0DFE8", "#F49FAE", "#342EE8"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: pointCount, default: 90, tried: [180], change: moderate, effect: "double the circles; large disks overlap into dense clusters, white background mostly covered"}
  - {name: lineCount, default: 20, tried: [40], change: none, effect: "no visible change; added lines are thin and sparse on a 960px canvas (1-2% of pixels)"}
  - {name: lineDetail, default: 0.01, tried: [0.03], change: subtle, effect: "higher noise frequency: lines wobble at a smaller scale, same overall layout"}
  - {name: sizeStep, default: 10, tried: [20], change: moderate, effect: "double the circle sizes; big disks dominate and merge into large colour patches, centre dots also double"}
  - {name: margin, default: "random(20,50)", tried: ["random(250,350)"], change: moderate, effect: "circles confined to the central ~400px: one dense cluster, canvas edges empty, lines short"}
  - {name: strokeWeight, default: "random(1,1,6)", tried: ["random(1,1,14)"], change: none, effect: "no visible change overall; a few wavy lines read slightly thicker, only ~1% of pixels differ"}
reusable_candidates:
  - {name: lineNoise, signature: "lineNoise(x1, y1, x2, y2, detail, amplitude) -> wavy dotted curve", note: "noise-steered random walk reoriented/rescaled to span p1->p2, drawn as LINES (dashed look)"}
  - {name: dotCluster, signature: "dotCluster(x, y, size, palette, seed) -> concentric ellipse stack", note: "one big ellipse + 20% chance mid ellipse + pale ring + two tiny center dots"}
---

## What it draws
Off-white (near-white gray) 960x960 canvas scattered with ~90 flat circles in five
colours: bright red, golden yellow, pale blue-gray, dusty pink, and saturated
indigo. Circle sizes vary from tiny dots to very large disks (~300 px); every
circle carries small concentric center dots (a pale ring, a small colored dot,
and a tiny dot). Overlaid are ~20 wavy, dashed-looking lines in the same five
colours, each snaking between two of the circles, thin (1-6 px), some curling
into loops.

## How the code works
`settings()` (L14-19): P3D renderer, `smooth(8)`, `pixelDensity(2)` (warns
"not available for this display" under the harness). `setup()` (L21-29) just
calls `generate()`; `draw()` (L31-32) is empty, so the piece is static.

`generate()` (L52-94) reseeds (`randomSeed`/`noiseSeed`, L54-55), fills
`background(250)`, and picks a margin `bb = random(20, 50)` (L59).

First loop (L66-85), 90 iterations: a size `ss` in 100..500 stepped by 10
(L67), a position snapped to the 10 px grid (L68-71), then a stack of
concentric ellipses: a 20% chance of a mid-size ellipse at half size
(L76, `fill(col, 250)`), a pale `fill(255, 180)` ellipse at 11% size (L77-78),
a random-color dot at 10% size (L79-80), and a random-color micro-dot at 2%
size (L81-82). The L73 semi-transparent fill (alpha 40-50) is dead code —
overwritten at L75 before any ellipse is drawn. Positions are stored in
`points` (L84).

Second loop (L87-93): 20 times, two random stored points are picked and
`lineNoise()` draws between them.

`lineNoise()` (L96-132): walks `lar` unit steps (L107-112), each step's angle
taken from `SimplexNoise.noise(des + x*det, des + y*det)` scaled to `PI*3.8`
— this is the wobble; `det ~ random(0.01)` is the noise frequency. The
resulting cloud is rotated so its start-end axis matches p1->p2 and scaled so
its endpoint lands exactly on p2 (L119-123). It is drawn with
`beginShape(LINES)` (L126-131), which renders every vertex as a separate
point — that is why the lines look dashed/dotted. `strokeWeight` is random
1..6 (L125).

Colour: `rcol()` (L142-144) picks uniformly at random from the 5-colour array
(L141: `#F20707 #FCCE4A #D0DFE8 #F49FAE #342EE8`). The `getColor()`
lerp-based variant (L145-154) is never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| pointCount_180 | `for (int i = 0; i < 90; i++) {` -> `for (int i = 0; i < 180; i++) {` | moderate (mean 0.1033, 26% of px) | double the circles; the big disks now overlap into dense clusters (center and corners), white background mostly covered, more center-dot targets; line layer unchanged | variants/pointCount_180/frame_00001.png |
| lineCount_40 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 40; i++) {` | none (mean 0.007, 2% of px) | no visible change; a few extra thin dashed curves, but the added lines are too sparse to shift the overall look | variants/lineCount_40/frame_00001.png |
| lineDetail_0.03 | `float det = random(0.01);` -> `float det = random(0.03);` | subtle (mean 0.0352, 11% of px) | same layout, but the wavy lines wiggle at a smaller, tighter scale; dashed curves read as finer squiggles | variants/lineDetail_0.03/frame_00001.png |
| sizeStep_20 | `float ss = int(random(10, random(20, 50)))*10;` -> `...*20;` | moderate (mean 0.119, 33% of px) | all circles doubled: huge disks dominate and merge into big solid colour patches, canvas nearly filled, center dots double too | variants/sizeStep_20/frame_00001.png |
| margin_300 | `float bb = random(20, 50);` -> `float bb = random(250, 350);` | moderate (mean 0.06, 18% of px) | all circles confined to the central ~400px: one tight cluster (a big red disk on top), canvas edges empty, connector lines short | variants/margin_300/frame_00001.png |
| strokeWeight_14 | `strokeWeight(random(1, random(1, 6)));` -> `strokeWeight(random(1, random(1, 14)));` | none (mean 0.0041, 1% of px) | no visible change overall; a few wavy lines (yellow, blue) read slightly thicker but only ~1% of pixels differ | variants/strokeWeight_14/frame_00001.png |

## Modularisation notes
Two clean, reusable blocks:

- `dotCluster(x, y, size, palette)` — the concentric-ellipse motif (L72-82)
  is self-contained: one random-coloured disk with a probability-based mid
  ellipse, a pale 180-alpha ring at ~11% size, and two micro-dots at 10% and
  2%. Generic apart from the size ratios (0.5 / 0.11 / 0.1 / 0.02) and the
  0.2 probability, which are art decisions worth keeping as parameters.
- `lineNoise(x1, y1, x2, y2, detail)` — the noise-steered walk with
  reorientation/rescaling to exact endpoints (L96-132) is a good library
  primitive: "wavy dotted connector between two points". Parameters: noise
  frequency (`det`), amplitude multiplier (`PI*3.8`), stroke weight, and the
  LINES-vs-OPEN polyline rendering (LINES gives the dashed character).

One-off art decisions: the 10 px grid snapping (L70-71), the 5-colour palette
itself, the 90/20 counts, and the margin `bb`. A clean parameter object:
`{pointCount, lineCount, sizeRange, sizeStep, margin, centerDotRatios,
midEllipseProb, lineDetail, lineAmplitude, strokeWeightRange, palette}`.
