---
sketch: 2020/generative/01_04/ruben
year: 2020
renderer: P2D
size: [640, 480]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1462
animated: false
techniques: [grid, lines-hatching, blend-modes, dots-stippling]
primitives: [line, ellipse, shape, pgraphics, image]
palette:
  colors: ["#251B19", "#7F2A17", "#995D38", "#FFD192", "#533632", "#2A201E", "#FFFFFF", "#FA5A00"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: gradColorCount, default: 50, tried: [150], change: "", effect: ""}
  - {name: gradSizeCount, default: 20, tried: [60], change: "", effect: ""}
  - {name: div, default: 4, tried: [6], change: "", effect: ""}
  - {name: colors, default: "warm brown 6-colour list", tried: ["cool blue 6-colour list"], change: "", effect: ""}
  - {name: thumbSize, default: 0.2, tried: [0.35], change: "", effect: ""}
  - {name: gridStrokeAlpha, default: 60, tried: [140], change: "", effect: ""}
reusable_candidates:
  - {name: anchorPoints, signature: "anchorPoints(w, h) -> Point[]", note: "fixed corner/edge-mid/1/4/1/3 subdivision anchor set used as triangle vertices (grid.pde:10)"}
  - {name: triGradTexture, signature: "triGradTexture(w, h, points, palette, n, addProb) -> PGraphics", note: "n random triangles over anchor points with lerp-palette fills, random alpha, occasional ADD blend (ruben.pde:102)"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], v) -> color", note: "lerp between adjacent palette entries with pow(v%1, 0.2) curve (ruben.pde:193)"}
  - {name: stippling, signature: "stippling(g, w, h, n, maxDot, palette)", note: "n random palette ellipses (ruben.pde:167, view 4 only)"}
---

## What it draws
A black full-bleed canvas (seed 42) dominated by a web of thin white lines: two full
diagonals crossing at the centre, a faint 4-way grid (straight plus skewed lines), and
four lines fanning from the corners to the bottom-centre. Small orange dots mark the
grid intersections and anchor points. In the top-left corner are two small square
thumbnails: a warm brown/orange cluster of overlapping translucent triangles (the colour
texture), and just below it a greyscale cluster of overlapping triangles (the
luminance/mask texture).

## How the code works
- `settings()` (ruben.pde:16): 1280x960 logical size scaled by 0.5 -> 640x480 P2D window, `smooth(8)`.
- `setup()` calls `generate()`; `draw()` only re-runs it when the `generated` flag is set by a key
  press, so the frame is static.
- `generate()` (ruben.pde:64): `randomSeed(seed)`/`noiseSeed(seed)`; `createPoints()`
  (grid.pde:10) builds ~30 fixed anchor points (corners, edge midpoints, 1/4 and 1/3 grid
  intersections, centre). `gradColor()` (ruben.pde:102) builds PGraphics `renderCol`: 50 random
  triangles whose 3 vertices are each a random anchor point, filled from the 6-colour warm-brown
  palette via `getColor()` (lerp between adjacent palette entries, `pow(v%1, 0.2)` curve,
  ruben.pde:193), random alpha, ADD blend on 10% of triangles. `gradSize()` (ruben.pde:132)
  builds PGraphics `renderSize` the same way (20 triangles) but filled only black or white
  (`255*int(random(2))`) — a luminance mask.
- `background(0)` then the view switch: default `view == 1` calls `grid()` (grid.pde:57),
  which with `noFill()` and white strokes at alpha 160/60/180 draws the two full diagonals, a
  4-division grid of straight and skewed lines, and four corner-to-bottom-centre lines; then
  `fill(250, 90, 0)` draws a 4px orange ellipse at every anchor point.
- `view` 2/3/4 would instead blit `renderCol` / `renderSize` / run `render()` (8000 random
  stippled palette ellipses, ruben.pde:167) — inactive by default.
- `debugTextures` (true) blits `renderCol` at top-left (20% of size) and `renderSize` below it
  (ruben.pde:94) — the two visible thumbnails.
- All randomness (triangle vertices, colours, alphas, 10% ADD probability) comes from the
  seeded PRNG; the anchor-point set is deterministic. `deterministic: true`, re-renders match.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic blocks: `createPoints()` (fixed subdivision anchor set — reusable for any
vertex-snapped composition); the `gradColor`/`gradSize` pattern (random-triangle PGraphics
texture from a point set + palette + blend probability — one function with a palette
argument covers both); `getColor()`/`paletteLerp()` (adjacent-palette lerp with an exponent
curve); the `render()` stippling loop. One-off art decisions: the specific anchor
subdivision fractions (1/2, 1/4, 1/3, 0.375/0.625/0.125/0.875), the 10% ADD probability,
the brown palette, the 20%-size debug thumbnails, and the `grid()` line web itself. A clean
parameter object: `{anchorDensity, triCount, triPalette, triAlphaRange, addProb,
luminanceMask(bool), thumbSize, gridDivisions, gridAlphas, stippleCount}`. The triangulate
and toxi imports are present but unused in the visible path (triangles are manual
`beginShape(TRIANGLE)`, no Delaunay or SimplexNoise calls).
