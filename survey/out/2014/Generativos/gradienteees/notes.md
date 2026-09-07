---
sketch: 2014/Generativos/gradienteees
year: 2014
renderer: JAVA2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 1017
animated: false
techniques: [lines-hatching, curves]
primitives: [ellipse, line]
palette:
  colors: ["#1C2130", "#028F76", "#B3E099", "#FFEAAD", "#D14334"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 80, tried: [200], change: large, effect: "more shapes; busier, more densely overlapping field, more small shapes visible"}
  - {name: shapeSize, default: "random(20,300)", tried: ["random(20,100)"], change: large, effect: "smaller max size; fine mosaic of small-to-mid shapes, no large dominant discs"}
  - {name: squareProb, default: 0.5, tried: [0.85], change: large, effect: "hatched squares/wedges dominate; far fewer smooth gradient discs"}
  - {name: seam, default: 0.01, tried: [0.05], change: none, effect: "no visible change (the seam is a thin line, mostly occluded by overlap)"}
  - {name: palette[1], default: "#028F76", tried: ["#1C5DAA"], change: subtle, effect: "teal discs read as blue where teal is a gradient endpoint; rest of palette unchanged"}
reusable_candidates:
  - {name: conicGradientCircle, signature: "conicGradientCircle(x, y, d, ang, c1, c2)", note: "circle built from ~d*2pi arc segments, each fill lerped c1->c2 around the ring; a 0.01 rad gap at one seam"}
  - {name: hatchedSquare, signature: "hatchedSquare(x, y, t, c1, c2, orientation)", note: "t x t square filled with parallel diagonal lines (4 orientations), each stroke lerped c1->c2 along the line"}
---

## What it draws
A full-bleed scatter of flat, overlapping geometric shapes on a light grey background. Two shape
types repeat: circles whose fill sweeps through a smooth gradient around the disc (so each looks
like a conic / pie gradient with a faint radial seam), and squares filled with fine parallel
diagonal lines whose colour also runs a gradient across them. Shapes overlap heavily, so the
silhouettes read as a collage of circles, wedges and triangles. The palette is dark navy,
teal-green, pale green, cream and red-orange; the overall feel is a dense, playful Bauhaus-style
composition of gradient discs and hatched blocks.

## How the code works
- `setup()` (L9-12) sets an 800x800 JAVA2D canvas and calls `generar()` once; `draw()` (L14-16)
  is empty, so the image is produced in a single pass (static).
- `generar()` (L18-32) loops `80` times (L19). Each iteration picks a random position
  (`random(width)`, `random(height)`, L20-21), a random diameter `d` in `random(20, 300)` (L22),
  a random quarter-turn angle `r = int(random(4))*PI*0.5` (L23), and two *distinct* palette colours
  `c1`/`c2` via `rcol()` (L24-28, 44-46) — it re-rolls `c2` until it differs from `c1` (L26-28).
  With probability `0.5` it draws a hatched square `cubito`, otherwise a gradient circle `pelotita`
  (L29-30).
- `pelotita` (L48-58) draws the circle as `cant = int(dim*TWO_PI)` thin arc segments (L49-50). Each
  segment is filled with `lerpColor(c1, c2, i/cant)` (L53) and spans one step around the ring
  (L54-56). The `a1 -= 0.01` nudge (L55) leaves a small gap at one seam, which is the visible radial
  line cutting most discs. `noStroke()` (L51) keeps the disc edges clean.
- `cubito` (L60-69) fills an `t x t` square (top-left at `x,y`) with `cant = int(dist(0,0,t,t))`
  parallel lines in 0.5-step increments (L61, 63). `tipo = int(random(4))` (L62) chooses one of four
  diagonal orientations (L65-68). Each line's stroke is `lerpColor(c1, c2, i/cant)` (L64), so the
  hatch runs a gradient along its length.
- Randomness enters at: position, size, angle, both colours, shape-type coin flip, and hatch
  orientation. No noise; no blend modes (default Opaque/blend). Colour is always a lerp between two
  distinct palette members, so every shape is a two-colour gradient.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_200 | `for(int i = 0; i < 80; i++){` -> `i < 200` | large (0.85) | much busier: ~2.5x more shapes, denser overlap, more small isolated discs/wedges visible between the big ones | variants/count_200/frame_00001.png |
| size_100 | `float d = random(20, 300);` -> `random(20, 100);` | large (0.66) | fine mosaic: no large dominant discs, field of small-to-mid shapes tiling the canvas | variants/size_100/frame_00001.png |
| squareRatio_0.85 | `if(random(1) < 0.5) cubito(...)` -> `< 0.85` | large (0.77) | hatched squares/wedges dominate; smooth gradient discs become rare | variants/squareRatio_0.85/frame_00001.png |
| seam_0.05 | `if(i < cant-1) a1-=0.01;` -> `a1-=0.05;` | none | no visible change — the seam is a hairline, mostly occluded by overlap, so widening it 5x is imperceptible | variants/seam_0.05/frame_00001.png |
| palette_blue | palette `#028F76` -> `#1C5DAA` | subtle (0.11) | subtle: discs using teal as a gradient endpoint now read as blue; navy/cream/red/green shapes unchanged | variants/palette_blue/frame_00001.png |

## Modularisation notes
- `pelotita` and `cubito` are the two reusable primitives. A library would expose:
  - `conicGradientCircle(x, y, d, startAngle, c1, c2, seam)` — a disc built from arc segments with a
    per-segment lerp; `seam` (default ~0.01 rad) controls the visible cut.
  - `hatchedSquare(x, y, t, c1, c2, orientation)` — a gradient-hatched square with 4 orientations.
- The one-off art decisions are the 5-colour palette, the 80-iteration count, the `random(20,300)`
  size range, the 0/50% circle-vs-square mix, and the quarter-turn snapping. A clean parameter
  object would be `{count, sizeRange:[lo,hi], circleProb, palette:[...], seam, hatchStep}`.
- The "pick two distinct colours then lerp" helper (`rcol` + the de-dupe while loop) is a small
  reusable utility: `twoDistinctColors(palette) -> [c1, c2]`.
