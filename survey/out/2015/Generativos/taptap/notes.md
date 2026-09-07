---
sketch: 2015/Generativos/taptap
year: 2015
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 539
animated: false
techniques: [packing, curves]
primitives: [ellipse, line]
palette:
  colors: ["#FCFCFF", "#E2E2E2", "#373846", "#FF655F", "#3CDEB4", "#2ED148"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 1000, tried: [300], change: large, effect: "sparser field, more background visible, individual discs and bars read separately"}
  - {name: sizeMax, default: 380, tried: [100], change: large, effect: "no giant discs; uniform texture of small/medium spinners, much more background visible"}
  - {name: loaderProbability, default: 80, tried: [30], change: large, effect: "composition dominated by horizontal bars instead of discs"}
  - {name: coreScale, default: 0.6, tried: [0.3], change: moderate, effect: "small dark core; wide light-grey ring band becomes the dominant feature of each disc"}
  - {name: arcSweep, default: 2.0, tried: [1.0], change: subtle, effect: "no visible change overall; coloured arcs are somewhat shorter with more grey rim showing"}
reusable_candidates:
  - {name: loader, signature: "loader(x, y, size, fraction) -> void", note: "donut spinner: grey base disc, colored arc from PI*1.5 sweeping fraction*2PI, translucent shadow ring, dark inner disc"}
  - {name: bar, signature: "bar(x1, y1, x2, y2, weight, fraction) -> void", note: "full horizontal line plus a shorter partial overlay line at fraction length"}
---

## What it draws
A dense full-bleed scatter of "loading spinner" circles: light-grey discs with a thick
coloured arc (coral red, teal, or green) around part of the rim, a translucent dark shadow
ring, and a solid dark-navy inner disc of slightly smaller radius. Sizes range from small
dots to very large discs that overlap heavily, and the large ones dominate the composition.
A few thin horizontal grey lines (progress-bar fragments) are interspersed, some with a
shorter coloured overlay segment. Background is near-white.

## How the code works
`setup()` (taptap.pde:17-21) calls `generar()` once; `draw()` is empty, so the piece is
static (frames 10/60 identical to frame 1). `generar()` (lines 37-50) paints a light
background (252) then loops 1000 times (line 39): each iteration picks a random position
(`random(width)`, `random(height)`, lines 40-41), a size `s = random(10, 380)*random(1)`
still leaves many large discs — and a fill from palette indices 3-5 only (line 43:
`paleta[3+int(random(3))]`, i.e. coral/teal/green; the white and light-grey palette
entries are used elsewhere). With 80% probability (line 44, `random(100) < 80`) it draws a
`loader(xx, yy, s, random(1))`; otherwise a `bar` spanning `s` wide centred on the point
(line 47) with stroke weight `s*random(0.04, 0.12)` and a random overlay fraction.

`loader` (lines 70-83): `noStroke()`; a light-grey (226) full disc; then an arc in the
chosen palette colour from angle PI*1.5 sweeping `c*2` radians (c random in [0,1], so
between a quarter and a full circle, always starting at the top); a translucent black
(`fill(0,18)`) disc at 0.69*s creating the soft inner shadow ring; and a solid dark-navy
(`#373846`) disc at 0.6*s forming the core. `bar` (lines 57-68) draws the full line in
light grey (`paleta[1]`) and re-draws a partial overlay from the start point at fraction
c of the span, so bars look like progress bars at random completion. All randomness enters
through `random()` calls, seeded by the harness; no noise, no blend modes, plain JAVA2D
painting.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for(int i = 0; i < 1000; i++){` -> `for(int i = 0; i < 300; i++){` | large | much sparser field: white background shows through everywhere, large dark discs read as separate objects, a few bars stand out | variants/count_300/frame_00001.png |
| size_100 | `float s = random(10, 380)*random(1);` -> `float s = random(10, 100)*random(1);` | large | no giant discs; the field becomes a uniform texture of small/medium spinner dots, far more background visible | variants/size_100/frame_00001.png |
| loaderRatio_30 | `if(random(100) < 80){` -> `if(random(100) < 30){` | large | composition dominated by horizontal bars (thick grey and coral/green/teal lines) with far fewer discs | variants/loaderRatio_30/frame_00001.png |
| core_0.3 | `ellipse(x, y, s*0.6, s*0.6);` -> `ellipse(x, y, s*0.3, s*0.3);` | moderate | dark cores shrink to small dots; the wide light-grey ring band becomes the dominant feature of each disc, so the image reads as rings/donuts | variants/core_0.3/frame_00001.png |
| arc_1 | `arc(x, y, s, s, PI*1.5, PI*(1.5+c*2));` -> `arc(x, y, s, s, PI*1.5, PI*(1.5+c));` | subtle | subtle: coloured arcs are somewhat shorter on average, so more grey rim shows on some discs; overall composition looks much the same | variants/arc_1/frame_00001.png |

## Modularisation notes
- `loader(x, y, s, c)` is a clean generic primitive: a "spinner/donut" with parameters for
  base colour, arc colour, arc start angle (fixed at PI*1.5 here), sweep fraction c,
  shadow opacity and inner-core scale (0.69/0.6 here). Worth extracting as-is with those
  as arguments.
- `bar(x1, y1, x2, y2, w, c)` is a generic "partial line" primitive (full line + overlay
  at fraction c).
- The scatter loop in `generar()` is the one-off art decision: count (1000), size
  distribution `random(10,380)*random(1)`, the 80/20 loader-vs-bar split, and the palette
  restricted to indices 3-5. A parameter object would contain: count, sizeMin, sizeMax,
  sizeBias (the extra *random(1)), loaderProbability, and the arc/core/shadow scales.
- Colour selection `paleta[3+int(random(3))]` is a "random-from-list over a sub-range"
  pattern; generalise to a palette list plus an index range.
