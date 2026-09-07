---
sketch: 2016/Generativos/rosita
year: 2016
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1225
animated: false
techniques: [particles, lines-hatching]
primitives: [pgraphics, image, ellipse]
palette:
  colors: ["#F0F0F0"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: rows, default: 32, tried: [16], change: moderate, effect: "halving stroke count (512 vs 1024) -> sparse, white background visible, strokes distinct"}
  - {name: vstepMax, default: 20, tried: [40], change: moderate, effect: "longer segments -> longer, more elongated streaks"}
  - {name: brushSizeMax, default: 80, tried: [160], change: large, effect: "much wider, softer blob-like strokes, denser coverage"}
  - {name: angleJitter, default: 0.4, tried: [1.2], change: moderate, effect: "strokes bend into hooks and S-curves"}
  - {name: strokeAlpha, default: 120, tried: [255], change: subtle, effect: "opaque dabs fill the white gaps; no visible texture/shape change"}
  - {name: hueRange, default: "random(30)+355 wrapped", tried: ["random(360)"], change: large, effect: "full rainbow palette (green/blue/purple added) instead of warm-only"}
reusable_candidates:
  - {name: Brush, signature: "Brush(); drawLine(PGraphics, x1, y1, x2, y2)", note: "stamped soft-brush stroke: offscreen dappled dab (random size 38-80px) tinted at alpha 120, stamped every 0.5px along the segment"}
  - {name: rcol, signature: "rcol() -> color", note: "warm HSB color: hue = (random(30)+355)%360 wraps to reds/oranges/yellows, s 100-256, b 200-256, 10% lerp to any hue"}
---

## What it draws
A 960x960 near-white canvas densely covered with soft, semi-transparent brushstrokes.
Each stroke is a short (roughly 40-80 px) slightly bent, thick (38-80 px wide) dab with a
mottled, grainy texture; hundreds overlap in every direction, leaving small white gaps.
Colors are dominated by warm tones: orange, red, magenta-pink and olive-yellow, with
occasional tan/brown and a few off-palette accents.

## How the code works
- `setup()` (L1-4) calls `generate()` once; `draw()` (L6-7) is empty, so the image is static.
- `generate()` (L19-60): `background(240)` (L20). L22-25 set `bb/sep/cw/ch` but they are only
  used by the commented-out rect-grid block (L27-39) - dead code.
- The real loop (L41-59) is a 32x32 nested loop = 1024 strokes. For each: `new Brush()` (L43)
  builds a random dappled dab and a random warm fill color (L84, `rcol()`). Start angle
  `a = random(TWO_PI)` (L44); grid coordinates are computed at L45-46 but immediately
  overwritten by `x = random(width); y = random(height)` (L47-48), so positions are fully
  random. Step length `v = random(1, 20)` (L49). A 4-segment walk (L50-57): each segment
  jitters the angle by `random(-0.4, 0.4)` (L51), advances by `v` (L54-55) and draws via
  `b.drawLine(g, ...)` (L56) - `g` is the inherited `PApplet.g` main graphics surface.
- `Brush.drawLine` (L87-104): computes segment angle/length (L94-95), tints the brush image
  with `colorFill` at alpha 120 (L96), then stamps the full-size brush image every 0.5 px
  along the segment (L97-102) - this produces the thick, soft, textured stroke.
- `createBrush()` (L106-127): offscreen `ss = random(38, 80)` PGraphics; near-transparent
  base ellipse `fill(255, 1)` (L112-113); `cc = max(20, ss*3)` speckle ellipses with
  whitish `fill(random(220, 255))`, size tapering with distance and random sign (L115-123);
  `filter(BLUR, 0.5)` (L124). Result: a soft mottled white texture that becomes a colored
  semi-transparent dab when tinted.
- `rcol()` (L62-72): HSB 360/256/256; hue `(random(30)+355)%360` wraps into [355,360) U [0,30)
  = reds through oranges to yellows; `s = random(100, 256)`, `b = random(200, 256)`; then a
  10% lerp toward a fully random hue (L69) which yields the occasional magenta/olive/brown
  accent seen in the image.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_16 | `for (int j = 0; j < 32; j++) {` -> `for (int j = 0; j < 16; j++) {` | moderate | sparse: white background shows through in large areas, individual strokes clearly separated | variants/count_16/frame_00001.png |
| vstep_40 | `float v = random(1, 20);` -> `float v = random(1, 40);` | moderate | strokes are longer and more elongated, same density and palette | variants/vstep_40/frame_00001.png |
| brush_160 | `int ss = int(random(38, 80));` -> `int ss = int(random(80, 160));` | large | strokes much wider and softer, blob-like; coverage denser, texture finer relative to size | variants/brush_160/frame_00001.png |
| jitter_1.2 | `a += random(-0.4, 0.4);` -> `a += random(-1.2, 1.2);` | moderate | strokes bend strongly into hooks and S-curves | variants/jitter_1.2/frame_00001.png |
| alpha_255 | `gra.tint(colorFill, 120);` -> `gra.tint(colorFill, 255);` | subtle | no visible change in texture or shape; opaque dabs simply fill in the white gaps | variants/alpha_255/frame_00001.png |
| hue_360 | `float h = (random(30)+355)%360;` -> `float h = random(360);` | large | full rainbow palette (greens, blues, purples added); warm-only character gone | variants/hue_360/frame_00001.png |

## Modularisation notes
- `Brush` class is the generic core: a stamped-texture stroke painter. Clean signature:
  `Brush(sizeMin, sizeMax, color, alpha)` + `drawLine(gra, x1, y1, x2, y2)`. The dab
  generator (dappled ellipse + blur) is separable from the stamping logic.
- `rcol()` is a parameterizable warm palette: `(hueBase, hueSpan, sMin, sMax, bMin, bMax,
  offPaletteChance)` -> color.
- The 1024-stroke scatter with 4-segment jittered walks is a "scattered tick strokes"
  pattern; a parameter object would be `{count, stepMin, stepMax, segments, angleJitter,
  brushSizeRange, strokeAlpha}`.
- One-off art decisions: the specific warm hue wrap, alpha 120, background 240.
- Dead code to drop: `bb/sep/cw/ch`, the commented rect-grid block, and the grid-position
  lines L45-46 (immediately overwritten).
