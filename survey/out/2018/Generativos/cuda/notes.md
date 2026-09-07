---
sketch: 2018/Generativos/cuda
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 7879
animated: false
techniques: [packing, polar, symmetry]
primitives: [ellipse, shape]
palette:
  colors: ["#E70012", "#D3A100", "#017160", "#00A0E9", "#072B45"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: blobCount, default: 1000, tried: [300], change: moderate, effect: "sparser: first 300 blobs only (exact prefix of baseline), more white background showing, fewer small solid dots"}
  - {name: maxBlobSize (x width), default: 0.6, tried: [0.2], change: large, effect: "much sparser: smaller blobs, mostly white background, faint small marks"}
  - {name: baseEllipseAlphaMax, default: 80, tried: [200], change: subtle, effect: "subtle: same layout, slightly more saturated/opaque, less haze"}
  - {name: arcFanCount, default: 3, tried: [10], change: moderate, effect: "busier: more arc fans per blob; also reflows the RNG stream so blobs 1+ are re-laid-out"}
  - {name: arcSpanMax, default: HALF_PI, tried: [TWO_PI], change: subtle, effect: "subtle: thin slivers become large fan/wedge shapes; modest coverage gain (arcs are thin and translucent)"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2) -> void", note: "draws an annular arc as cc small trapezoid quads (one per angular step), each filled with two alpha values"}
  - {name: rcol, signature: "rcol(colors[]) -> int", note: "uniform random pick from a palette array"}
---

## What it draws
A full-bleed, dense collage of semi-transparent circles, pie-slice wedges and ring fragments
that covers the near-white background almost completely. Soft large blobs (teal-green, blue,
orange-red, gold) overlap into muddy green and yellow areas, with small solid discs and thin
wedge slivers on top. Dominant visible colours: teal/green, orange-red, blue, yellow accents.
Overall look is soft and low-contrast because all alphas are low (max 80-200).

## How the code works
`setup()` sizes the canvas 3250x3250 (P2D), calls `generate()` once and saves/exits, so the
output is a single static image (line 3-10; `draw()` is empty, line 12-14).

`generate()` (line 24-50) fills a near-white background (line 25), then loops `i = 0..999`
(line 28): each iteration picks a random position `xx,yy` (line 29-30) and a radius
`ss = width*random(0.6)*random(1)` (line 31) - the product of two uniforms biases ss toward
small values, so sizes span from tiny to up to 0.6*width. Per blob it draws:
- a big soft ellipse with alpha `random(80)*random(1)` (line 33-34),
- a smaller inner ellipse at 0.1-0.5x ss with alpha up to 180 (line 35-37),
- three full-circle (0..TAU) `arc2` rings with falling alpha (100/80/40) (line 38-40),
- then `j = 0..2` partial arcs (line 42-48): each picks a random start angle `a1` (line 43),
  a span up to HALF_PI (line 44), and draws three concentric annular arcs (radius ss..1.4*ss)
  at the same angle range, each with alpha up to 80.

`arc2` (line 52-70) is the key primitive: it subdivides the angular span into `cc` steps
proportional to the arc length (line 57) and draws one closed 4-vertex `beginShape` quad per
step between radii s1 and s2, filling the outer half with alpha `alp1` and the inner half with
`alp2` (line 59-68). With `alp2 = 0` (always here) each step is a single translucent trapezoid;
together they tile a wedge/ring.

Colour: `rcol()` (line 78-80) picks uniformly from a 5-colour palette (line 77): red #E70012,
gold #D3A100, teal #017160, blue #00A0E9, dark navy #072B45. No blend mode is set (default
BLEND), so the "muddy" middle tones come purely from alpha compositing of the palette colours.
Randomness enters only through `random()` (position, size, alpha, angles, colour); the seed
field (line 1) is set by the harness.

Note on randomness: all values come from one sequential `random()` stream, so changing a
`random(x)` argument (size, alpha, span) does NOT reflow subsequent draws, but changing a
loop count (i-loop, j-loop) does - experiments below mix the parameter effect with re-layout
in that case.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | moderate | sparser: exact prefix of the baseline (first 300 blobs), white background shows more, fewer small solid dots | variants/count_300/frame_00001.png |
| size_0p2 | `float ss = width*random(0.6)*random(1);` -> `float ss = width*random(0.2)*random(1);` | large | much sparser: small faint blobs on a mostly white background | variants/size_0p2/frame_00001.png |
| alpha_200 | `fill(rcol(), random(80)*random(1));` -> `fill(rcol(), random(200)*random(1));` | subtle | subtle: same layout, slightly more saturated and less hazy | variants/alpha_200/frame_00001.png |
| arcs_10 | `for (int j = 0; j < 3; j++) {` -> `for (int j = 0; j < 10; j++) {` | moderate | busier: more arc fans per blob; RNG reflow re-lays-out blobs 1+, so more rings/annuli are visible | variants/arcs_10/frame_00001.png |
| arcspan_pi | `float a2 = a1+random(HALF_PI)*random(1);` -> `float a2 = a1+random(TWO_PI)*random(1);` | subtle | subtle: same layout, thin slivers become large fan/wedge shapes | variants/arcspan_pi/frame_00001.png |

## Modularisation notes
- `arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)` is fully generic: an annular sector renderer
  with two alpha bands and automatic angular tessellation. Strong library candidate.
- The per-blob recipe (soft disc + inner disc + concentric ring trio + 3 angled arc trios) is
  the one-off art decision; a clean parameter object would be {count, sizeRange, innerDisc,
  rings[], arcCount, arcSpanMax, alphas, palette}.
- `rcol`/`getColor` (line 78-89) are trivial palette helpers; `getColor` (value-indexed
  lerp) is unused by `generate()` but is a nice generic palette-sampling function.
- The whole sketch is a "scattered translucent primitives" generator: one seed -> one static
  image; no animation, no noise, no interactivity needed beyond re-rolling the seed.
