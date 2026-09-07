---
sketch: 2019/generativos/caritas
year: 2019
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3402
animated: false
techniques: [subdivision, grid, flow-field, dots-stippling]
primitives: [rect, ellipse, point, shape]
palette:
  colors: ["#0E304E", "#EDE6E3", "#EFC3C3", "#EF512F", "#F3AB39"]
  selection: lerp-between
composition: tiled
parameters: []
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(canvas, iterations, minSide, childScale) -> Rect[]", note: "repeatedly split one random rect into 4 quadrant children; produces a non-uniform tile layout"}
  - {name: checkerboard, signature: "checkerboard(x, y, w, h, cols, colA, colB) -> void", note: "alternating-cell fill used as cell background pattern"}
  - {name: hairStrands, signature: "hairStrands(cx, cy, w, h, count, len, wind, gravity, paletteFn) -> void", note: "random-walk polylines: angle lerped toward per-strand turn, wind, and down-gravity; colour sampled from palette via noise offset"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], v) -> Color", note: "lerpColor between adjacent palette entries at a random float position, giving smooth off-palette tones"}
  - {name: face, signature: "face(w, h, skin, hair, palette) -> void", note: "layered ellipse/arc face: eyes (white + iris + pupil + highlight + hair-coloured brow arc), nostril dots, smile arcs, body arc, stipple texture"}
---

## What it draws
A 960×960 canvas tiled with rectangular cells of very different sizes (a few large, many small).
Each cell holds a flat, retro-styled face portrait: a checkered or solid two-tone background,
a round head (cream, pink, grey, olive or tan skin) with two large white eyes (coloured iris,
black pupil, tiny white highlight), a hair-coloured arc brow, two small nostril dots and a pale
smiling mouth. Hair is drawn as dozens of short squiggly strands radiating from the crown in
orange, pink, grey, navy or amber, with a semicircular body/shoulder below and fine speckle
grain over everything. The overall palette is warm — orange, pink, cream — against deep teal-navy
and amber, with orange border strips between cells.

## How the code works
- `generate()` (caritas.pde:50) reseeds (`randomSeed`/`noiseSeed` from `seed`, :52-53), paints a
  black background and translates to canvas centre (:55-56).
- **Tiling**: starts with one full-canvas `Rect` (:58-59). The loop at :61-70 runs 20 times:
  picks a random rect (index biased toward smaller indices via `random(size*random(1))`, :62),
  skips if under 4 px, replaces it with 4 quadrant children each half-size (:65-69). Result: a
  non-uniform tiled layout of up to ~61 rects — the cell grid seen in the image.
- Per rect (:74-309):
  - Background: full-cell rect in a random palette colour (:76-79), a faint inner shade
    (`fill(0,20)`, :81-82), then an inner rect in another palette colour (:83-85) — the
    two-tone cell background and orange border strip.
  - White speckle: `r.w*r.h*0.2` low-alpha white points (:87-92).
  - Checkerboard: 50% of cells (`rnd==0`, :96-98) get an alternating grid of up to 21×21 squares
    in two random palette colours (:108-115) — the dominant cell background pattern.
  - Decoration: a 50% chance of a big flat ellipse behind the face (:122-126), 5 small random
    ellipses (:128-134), and `r.w*r.h*0.4` low-alpha palette-coloured points (:137-145).
  - **Face** (inside `pushMatrix`, scaled 0.7–0.9 about a point 45% down the cell, :150-154):
    - Back hair (95% chance): `cc = int(pw*ph*PI*random(0.06,0.4))` strands (:171). Each strand
      starts on an ellipse around the crown (:177-179) and random-walks: per step the angle is
      lerped toward a random turn, a per-face wind angle (`viento`, :164) and downward gravity
      (`HALF_PI`, :190-194); stroke colour is `getColor(ic + noise(...)*ac)` — palette position
      modulated by 1-D noise, with random alpha (:188). Strands stop below the body line (:196).
    - Body: half-arc at the bottom of the cell (:205), soft shade ellipse (:207-208), then the
      face ellipse `ww × r.h*0.6` in a lerped palette colour (:209-211), textured with
      `ep()` — `int(r.w*r.h*0.8)` low-alpha points inside the ellipse (:217, :312-320).
    - Nostrils: two tiny black ellipses (:226-229). Eyes via `eye()` (:244-245, :332-364):
      white ellipse, faint stipple, hair-coloured arc brow, coloured iris, black pupil, small
      white highlight; mirrored and slightly rotated per eye.
    - Mouth: pale `fill(255, random(120,240))` arcs forming a small smile (:247-255).
    - Front hair (80% chance, :261-305): a second, denser strand layer
      (`cc = int(pw*ph*PI*random(1.1,1.4)*2)`, :275) over the crown, same walk rules.
- Colour: 5-colour palette at :375; `rcol()` picks a random entry (:376-378); `getColor()`
  lerps between adjacent entries at a random float (:379-388), so most fills are off-palette
  blends of neighbours.
- `draw()` is empty (:29-30) and the harness renders 3 identical frames — the sketch is static.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic / library-ready**: `subdivideRects` (the 20-iteration quarter-split, :58-70) is a
  clean layout primitive parameterised by iterations, min side and child scale. `paletteLerp`
  (:379-388) is a small, self-contained colour utility. `checkerboard` (:108-115) and the
  stipple helpers `ep`/`ep2` (:312-330) are trivially extractable. The hair-strand random walk
  (:174-199 / :278-304) is a reusable "strand" generator: start ellipse, count, length, wind,
  gravity, and a colour function.
- **One-off art decisions**: the exact face construction (eye/iris/pupil proportions, nostril
  offset, smile arcs, body arc, scale-about-0.45h) is hand-tuned layering and not worth
  generalising beyond a single `face()` function; the 50%/80%/95% probabilities and the specific
  palette are style choices.
- **Parameter object**: `{iterations, minSide, palette, cellStyle: {checkerboardChance,
  cols, speckleDensity}, face: {scale, width, eyeSize, iris, smile}, hair: {backCount,
  frontCount, length, wind, gravity, colorSpread}}`.
