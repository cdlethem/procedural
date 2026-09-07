---
sketch: 2019/generativos/lains
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1606
animated: false
techniques: [grid, polar, packing, voronoi-delaunay, dots-stippling]
primitives: [ellipse, rect, point, shape, line]
palette:
  colors: ["#333A95", "#F6C806", "#F789CA", "#188C61", "#1E9BF3"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: mul, default: "random(0.95,0.97)+0.025", tried: [0.85], change: moderate, effect: "wider, thicker, fewer rings on the central and scattered bullseyes"}
  - {name: ss, default: 80, tried: [140], change: moderate, effect: "colored dots substantially larger, covering much more of the canvas"}
  - {name: points, default: 28, tried: [10], change: subtle, effect: "fewer colored dots (sparser scatter); the ring field dominates so the diff stays small"}
  - {name: cc, default: 20, tried: [8], change: subtle, effect: "hatched blocks have fewer, wider vertical bars (small element, barely shifts the image)"}
  - {name: rsize, default: "width*random(0.2,0.4)", tried: [0.35], change: large, effect: "scattered bullseye rings much larger, overlapping heavily and filling most of the canvas"}
reusable_candidates:
  - {name: concentricRings, signature: "concentricRings(x, y, startR, mul) -> void", note: "alternating black/white shrinking ellipses -> bullseye"}
  - {name: packedDots, signature: "packedDots(p, radius, iterations) -> void", note: "circle-pack dots + radial hairlines inside a disc"}
  - {name: stripedBar, signature: "stripedBar(x, y, w, h, cc) -> void", note: "row of cc vertical bars -> hatched block"}
---

## What it draws
A dense full-bleed black-and-white field of concentric bullseye rings: one large one at the
center plus many medium and small ones scattered across the canvas, some snapped to a coarse
grid. Overlaid are scattered solid-color dots (blue, gold, pink, green, dark indigo) each filled
with fine white stippling and faint radial hairlines, plus a few white/black hatched rectangle
blocks (vertical bars), small solid rectangles, and a couple of thin wavy sine lines. The
triangulation layer is drawn at very low alpha and is barely visible.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty so the image is static. `randomSeed`/
`noiseSeed` are set from `seed` (lains.pde:54-55), then `background(3)` (near-black).

- **Concentric rings** (the dominant feature): three loops draw shrinking alternating
  `fill(0)`/`fill(255)` `ellipse`s while `s > 1`, multiplying `s *= mul` each pass:
  - one big centered at `width*0.5, height*0.5` (lines 61-74, `mul = random(0.95,0.97)+0.025`);
  - 20 scattered on a 120x60 grid (`x-=x%120; y-=y%60`, lines 76-92, `mul = random(0.91,0.97)`);
  - 30 smaller ones at quarter scale (lines 104-120).
  A smaller `mul` => fewer, thicker rings; larger => many thin rings.
- **Tiny specks**: 120 random 1-2px black/white dots (lines 95-102).
- **Small rects**: 20 grid-snapped rects, color `240*int(random(2))` (0 or 240) with an
  80-alpha underlay (lines 123-140).
- **Hatched blocks**: 20 grid-snapped rows; `cc=20` bars of width `ss*0.8` (ss=120/cc=6) drawn
  in a 120x60 cell, fill 240 or 0 (lines 143-156). This produces the white-on-black /
  black-on-white vertical stripe rectangles.
- **Sine lines**: 10 `lineSine()` wavy strokes, weight 2, white/black, oscillation
  `a2=a1+random(3,7)*TAU` (lines 158-167, 249-263).
- **Triangulation**: up to 28 grid-snapped points kept `minDis` apart,
  `Triangulate.triangulate(points)`, filled `random(255)` at alpha ~16 and stroked
  `240,20` (lines 170-199) — very faint.
- **Color dots + packing**: for each of the kept points, an outer `fill(250)` disc (r=`ss*1.06`)
  and inner `fill(rcol())` disc (r=`ss`) where `ss=80`; then a 3000-iteration circle-packing loop
  seeds small dots inside the disc (rejection on overlap), drawing each as a radial hairline
  (`stroke(col,60)` fading to 0 toward center) plus a `point` (lines 203-246). This is the
  stippled colored dots with the faint spoke pattern.
- **Color**: `rcol()` picks a random entry from `colors[]` (lines 272-276); the 5-color palette
  is indigo/gold/pink/green/blue.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| mul_0.85 | `float mul = random(0.95, 0.97)+0.025;` -> `float mul = random(0.85, 0.90)+0.025;` | moderate | rings are wider, thicker and fewer; the big central and scattered bullseyes look chunkier | variants/mul_0.85/frame_00001.png |
| ss_140 | `float ss = 80;` -> `float ss = 140;` | moderate | the colored dots (blue/gold/pink/green/indigo) are much bigger and cover a large share of the canvas | variants/ss_140/frame_00001.png |
| points_10 | `for (int i = 0; i < 28; i++) {` -> `for (int i = 0; i < 10; i++) {` | subtle | fewer colored dots scattered over the field; ring field dominates so only a small pixel change | variants/points_10/frame_00001.png |
| cc_8 | `int cc = 20;` -> `int cc = 8;` | subtle | the hatched blocks have fewer, wider vertical bars; small element, barely visible overall | variants/cc_8/frame_00001.png |
| rsize_0.35 | `float s = width*random(0.2, 0.4);` -> `float s = width*random(0.35, 0.55);` | large | the medium scattered bullseye rings grow much larger, overlapping heavily and filling most of the canvas | variants/rsize_0.35/frame_00001.png |

## Modularisation notes
- **concentricRings** (the while-loop at lines 67-73, repeated 3x with different `mul`/size):
  fully generic — `concentricRings(x, y, startR, mul, colorA, colorB)` is a clean library
  function; the three call sites differ only in start size and `mul`.
- **packedDots** (lines 212-245): generic radial dot-packing with hairlines —
  `packedDots(p, radius, iterations, density)`; the `ss` scale and the 10% colored-dot
  probability are art parameters.
- **stripedBar** (lines 153-155): generic hatched block — `stripedBar(x, y, w, h, cc, color)`.
- **Grid snapping** `x-=x%120; y-=y%60` is a one-off art decision (120x60 cell) but is
  trivially parameterizable as a cell size.
- One-off art decisions: the specific 5-color `colors[]`, the near-black `background(3)`, the
  low-alpha triangulation overlay, the sine-line count/length, and the quarter-scale small-ring
  loop.
- A clean parameter object for this sketch: `{ringMul, bigRingStart, scatterCount, ringStart,
  dotRadius, dotCount, dotPackingIter, barCount, cellSize, palette}`.
