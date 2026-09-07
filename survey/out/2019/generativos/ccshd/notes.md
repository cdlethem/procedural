---
sketch: 2019/generativos/ccshd
year: 2019
renderer: P2D
size: [3250, 3250]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 2829
animated: false
techniques: [voronoi-delaunay, grid, shader]
primitives: [rect, line, ellipse, shape]
palette:
  colors: ["#320399", "#E07AFF", "#EA1026", "#FFD70F", "#E5E5E5", "#F0F0F0"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: rectCount, default: 80, tried: [160], change: large, effect: "twice as many squares/boxes/coins; much denser, background gaps nearly vanish"}
  - {name: pointCount, default: 140, tried: [280], change: large, effect: "twice as many small squares; the white triangulation web is denser and more visible"}
  - {name: rectSizeMax, default: 30, tried: [10], change: moderate, effect: "boxes and coins become small and uniform; the soft background triangles dominate"}
  - {name: palette, default: "320399,E07AFF,EA1026,FFD70F,E5E5E5", tried: ["025DC4,02201A,489B4D,F5CE4B,F5FFFF"], change: large, effect: "same layout, entirely different colours (blue/green/teal/yellow/white)"}
  - {name: coinProb, default: 0.5, tried: [1.0], change: large, effect: "coins (circle + ring on a trapezoid) appear on nearly every box; busier, more ringed circles"}
reusable_candidates:
  - {name: delaunayWeb, signature: "delaunayWeb(List<PVector> pts, style) -> void", note: "Triangulate.triangulate points, draw triangles with per-vertex fill + faint stroke; one of N fill styles"}
  - {name: gridSnappedPoints, signature: "gridSnappedPoints(n, w, h, margin, cell) -> List<PVector>", note: "random positions snapped to a fixed pixel grid (x -= x%cell)"}
  - {name: grainShader, signature: "noiseFrag.glsl(displace) -> PShader", note: "fragment shader that multiplies alpha by a hashed per-pixel noise for a speckled grain"}
---

## What it draws
A busy, full-bleed collage on a pale gray background: many overlapping translucent
squares in indigo, magenta, red and yellow, some rendered as pseudo-3D boxes with a
dark trapezoid "drop shadow" and a flat top face. Behind the squares, a large soft
triangulation of pastel, grainy triangles fills the canvas, and over everything a
finer web of faint white lines with small white dots at the vertices. Scattered
"coin" shapes — small circles, often with a second concentric ring, sitting on a
trapezoid body — punctuate the composition. The whole image has a fine speckled,
grainy texture.

## How the code works
- `settings()` (ccshd.pde:17-22): canvas is `swidth*scale` with `scale = nwidth/swidth = 3250/960`,
  so a 3250×3250 P2D buffer; `smooth(2)`.
- `generate()` (ccshd.pde:47-230) is called once in `setup()` (export=true saves and exits;
  draw() is empty, so the piece is static).
- 80 seed rectangles (ccshd.pde:60-69): random centers in `[-200, w+200]²`, snapped to a 20 px
  grid (`x -= x%20`), side `s = 20+int(random(30)*random(0.4,1))*10` → 20…320 px.
- Background (240) then a Delaunay triangulation of those 80 centers
  (`Triangulate.triangulate(rects)`, ccshd.pde:74); each triangle is drawn with
  `noiseFrag.glsl` and a random palette colour per vertex (`rcol()`, ccshd.pde:244-246 — uniform
  random pick from the 5-colour list at ccshd.pde:243) at alpha `random(random(200,220),255)`
  (ccshd.pde:80-85). The shader (data/noiseFrag.glsl:18-24) multiplies the vertex alpha by a
  per-pixel hashed noise `pow(1-pow(rand(...),0.2),0.6)` with a random `displace` offset per
  triangle, producing the speckled grain on the pastel triangles.
- 140 small squares (ccshd.pde:95-116): grid-snapped positions, side 10-40 px, random palette
  colour alpha 200-255. Their centers are also collected (the `dist < 1` duplicate check at
  ccshd.pde:108-114 is effectively a no-op since positions are snapped to 20 px) and
  Delaunay-triangulated (ccshd.pde:122): drawn as a line web with `stroke(240,70)` (white) and,
  depending on `sel = int(random(3))` (ccshd.pde:119), 0/1/2 of the three vertices get a
  translucent white fill — so the web is sometimes plain lines, sometimes half-filled.
  White 4 px dots mark the vertices (ccshd.pde:139-144).
- For each of the 80 seed rectangles (ccshd.pde:146-229): a pseudo-3D box — top and front quads in
  random palette colours (alpha 240-250, ccshd.pde:153-169), then two shader-displaced
  trapezoids: a dark fading one below the box (`fill(0,120)` → transparent, ccshd.pde:173-179,
  the "shadow") and a side gradient face (ccshd.pde:181-189). With 50 % probability
  (ccshd.pde:193) a "coin" is added on top: a trapezoid body plus a palette ellipse at its
  center, and with 50 % probability a smaller concentric ellipse (the ringed coins,
  ccshd.pde:198-225).
- `getColor()` (ccshd.pde:247-256, palette lerp) is defined but never called in `generate()`;
  only `rcol()` (random pick) is used. `toxi.math.noise.SimplexNoise` is imported but unused.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| rects_160 | `for (int i = 0; i < 80; i++) {` -> `for (int i = 0; i < 160; i++) {` | large | much denser collage: roughly twice as many squares, boxes and coins; pale background gaps nearly disappear. Changing the loop count also shifts the shared random stream, so downstream layers (triangles, web, coins) differ from the baseline, not just doubled | variants/rects_160/frame_00001.png |
| points_280 | `for (int i = 0; i < 140; i++) {` -> `for (int i = 0; i < 280; i++) {` | large | twice as many small scattered squares; the white triangulation web is visibly denser (more vertices, finer mesh) | variants/points_280/frame_00001.png |
| rectSize_10 | `float s = 20+int(random(30)*random(0.4, 1))*10;` -> `...random(10)...` | moderate | boxes and coins are much smaller (side ≤ ~120 px instead of ~320) and more uniform in size; the soft pastel background triangles dominate since they are triangulated from the same 80 centres regardless of `s` | variants/rectSize_10/frame_00001.png |
| palette_blue | `int colors[] = {#320399, #E07AFF, #EA1026, #FFD70F, #E5E5E5};` -> `{#025DC4, #02201A, #489B4D, #F5CE4B, #F5FFFF};` | large | identical layout and density, entirely different colour set: blues, greens, dark teal, yellow, white (a commented-out alternate palette from the source) | variants/palette_blue/frame_00001.png |
| coinProb_1.0 | `    if (random(1) < 0.5) {` -> `    if (random(1) < 1.0) {` | large | a coin (circle on a trapezoid body, often with a concentric ring) now sits on nearly every box; the motif is far more prominent and the image reads busier | variants/coinProb_1.0/frame_00001.png |

## Modularisation notes
- Generic: `gridSnappedPoints` (random + grid snap), `delaunayWeb` (triangulate a point list and
  draw the mesh in a few fill styles — the `sel` switch is a good "style" parameter), and the
  `noiseFrag.glsl` grain shader (parameter: `displace`).
- One-off art decisions: the pseudo-3D box/coin construction (fixed 0.03 base height, trapezoid
  proportions, 50 % coin probability), the specific 5-colour palette and its commented-out
  alternates (ccshd.pde:238-242), the two-layer composition (large square layer + fine web
  layer) and the 20 px grid cell.
- A clean parameter object would contain: rectCount (80), pointCount (140), gridCell (20),
  rectSizeRange (20…320), webStrokeAlpha (70), webFillStyle (0-2), palette (list),
  coinProbability (0.5), grain strength/displace from the shader.
