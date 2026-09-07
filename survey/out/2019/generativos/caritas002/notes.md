---
sketch: 2019/generativos/caritas002
year: 2019
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3598
animated: false
techniques: [grid, recursion, dots-stippling, lines-hatching]
primitives: [rect, point, ellipse, shape]
palette:
  colors: ["#616AAB", "#F094BB", "#FFC632", "#F08C17", "#E9431E", "#522B0F", "#197F81"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: 22, tried: [], change: null, effect: ""}
reusable_candidates:
  - {name: subdivide4, signature: "subdivide4(rects, iterations, minSize) -> Rect[]", note: "pick a random rect, replace it by 4 half-size quadrants; repeat N times"}
  - {name: checkerTile, signature: "checkerTile(x, y, w, h, cols, rows, c1, c2) -> void", note: "checkerboard fill of a rect from two palette colours"}
  - {name: stipple, signature: "stipple(x, y, w, h, count, colour, alphaRange) -> void", note: "random points inside a rect, count proportional to area, alpha jitter for grain"}
  - {name: hairStrokes, signature: "hairStrokes(cx, cy, w, h, count, strokeLen, windAngle, gravity) -> void", note: "random-walk polylines biased by lerp towards wind/gravity angles; used as hair"}
  - {name: cartoonEye, signature: "cartoonEye(x, y, w, h, irisColour, rot, browColour, ...) -> void", note: "sclera ellipse + stipple + iris + pupil + highlight + brow arc"}
---

## What it draws
A 960x960 canvas fully tiled by a mosaic of rectangular tiles of very different sizes,
each one a little portrait ("carita"): a flat cartoon face (round head, two eyes with
irises and highlights, two dot nostrils, a small mouth, a rounded body/shoulders shape
below) wearing hair made of many short scribbly strokes. Every tile sits on a two-colour
checkerboard background. The overall palette is warm: orange, yellow, red-brown and
dark blue with pink/teal accents. Large tiles hold one big face; tiles subdivided further
hold 4 or more tiny faces. The composition reads like a grid of character cards.

## How the code works
- `settings()` (L12-17): P2D, 960x960, `smooth(8)`, `pixelDensity(2)` (warned unavailable
  on the headless display, so actual density 1).
- `generate()` (L50): seeds `random`/`noise` with `seed` (L52-53), black background,
  translate to canvas centre (L56).
- **Subdivision** (L58-71): starts with the full canvas as one `Rect`; 22 iterations
  (`sub = 22`, L61) pick a random rect (index biased by `random(rects.size()*random(1))`,
  so smaller/lower-index rects get picked less often), skip if w or h < 4 (L65), replace
  it with its four half-size quadrants (L66-70). Result: a mosaic of rects of wildly
  different sizes — the tile layout in the image.
- **Tile layer** (L76-168, `back = true`), per rect, in `rectMode(CENTER)`:
  - with ~50% chance (`rnd == 0`, L100-102) a checkerboard: `cw`/`ch` cells between 2
    and 21 (L103-104), two random palette colours `col1`/`col2`, one cell of every
    other parity (L113), sometimes alternating to `col2` (L117) — the two-colour
    checker backgrounds.
  - grain: `r.w*r.h*0.2` white points with alpha < 50 (L91-96) plus a second pass of
    `r.w*r.h*0.4` points in a single palette colour, alpha < 60 (L151-156) — the fine
    speckle over every tile.
  - up to 3 large soft ellipses (`rcol()`) and 20 small speckle ellipses (L131-146),
    plus a dark translucent square overlay (L160-167).
- **Face layer** (`tipitos`, L171-353), per rect: translate to rect centre, slight
  vertical squash (`sca = random(0.84, 0.92)`, L177-180).
  - hair cap (95% chance, L191-226): `cc` polylines (L197, count ~ area * 0.06-0.4),
    each a random walk of `lar` steps (L198); direction is lerped each step towards a
    random `rot`, a per-face wind `viento`, and straight-down `HALF_PI` with strength
    `grav` (L216-218) — that produces the droopy scribble hair; colour is
    `getColor(ic + noise(...))`, a noise-driven walk over the palette (L214).
  - body: upper-half arc (`PI..TAU`) in a palette colour (L234); head: ellipse
    (L241) with a stipple pass `ep()` of `r.w*r.h*0.8` low-alpha points (L247,
    L356-364 — points clustered near centre via 4-fold `random()*random()` radius).
  - face: two nostril dots (L264-265), two `eye()` calls (L280-281): white ellipse,
    stipple, iris + pupil + white highlight (L387-406), brow arc in hair colour
    (L394-396).
  - mouth: a white-ish arc plus two small chin arcs (L283-291).
  - second hair pass (92% chance, L297-348): bangs strokes around the forehead, same
    random-walk mechanism, `cc` from L308, lengths L309-310.
- Colour: 7-colour list (L421); `rcol()`/`getColor()` pick a random entry (L422-427);
  `getColor(float)` (L428-434) lerps between adjacent palette entries — used for hair
  so it drifts hue by noise. No blend modes; layering is alpha compositing on P2D.
- Static: `draw()` is empty; `generate()` runs once in `setup()` (L21). Deterministic
  under the harness seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic / reusable**: `subdivide4` (the recursive 4-way subdivision with a min-size
  guard) is a standalone layout generator; `stipple`/`ep` (area-proportional point
  grain) and `hairStrokes` (direction-lerped random walks) are self-contained;
  `checkerTile` is trivially reusable. `cartoonEye` is reusable if the brow arc and
  highlight are made parameters.
- **One-off art decisions**: the per-rect stacking order (checker -> grain ->
  ellipses -> dark overlay -> face), the exact lerp weights toward `viento`/`grav`,
  the 0.84-0.92 vertical squash, the mouth's three arcs, and the palette itself.
- **Clean parameter object**: `{iterations, minRectSize, checkerChance, checkerCells
  [min,max], grainDensity, grainAlpha, faceSquash, hairDensity, hairLength, wind,
  gravity, eyeScale, palette}`. Everything else (positions, angles, per-face colour
  index) is seed-driven noise, not a parameter.
