---
sketch: 2018/Generativos/forest
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 1754
animated: true
techniques: [grid, noise-field, subdivision]
primitives: [rect, shape, ellipse, line]
palette:
  colors: ["#34302E", "#72574C", "#9A4F7D", "#488753", "#D9BE3A", "#D9CF7C", "#E2DFDA", "#CF4F5C", "#368886", "#DEE1DA"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: ch, default: 20, tried: [10], change: large, effect: "fewer, larger depth rows; canopies bigger, mosaic sparser"}
  - {name: sub, default: "random(0,1000)", tried: [100], change: moderate, effect: "coarser mosaic, fewer and larger cells"}
  - {name: innerRatio, default: 0.2, tried: [0.5], change: moderate, effect: "inner rect ~half the cell; trapezoid faces wide and short, boxes flatter"}
  - {name: baseSize, default: 1.2, tried: [2.4], change: large, effect: "canopies 2x; blob layer dominates and nearly buries the cell grid"}
  - {name: arcCount, default: 14, tried: [0], change: subtle, effect: "radial glows removed; overall look stays close to baseline"}
  - {name: palette, default: "warm 9-colour set", tried: ["cool 9-colour blue set"], change: moderate, effect: "same composition, whole image in blues and whites"}
reusable_candidates:
  - {name: noiseBlob, signature: "noiseBlob(x, y, r, detail, offset, t) -> void", note: "closed polygon whose radius is modulated by 2-D noise (organic canopy)"}
  - {name: subdivideRects, signature: "subdivideRects(rect, iterations, minSize) -> Rect[]", note: "random iterative binary splitting of one canvas rect into a mosaic"}
  - {name: perspectiveCell, signature: "perspectiveCell(rect, innerRatio, t) -> void", note: "outlined outer rect + noise-wobbled inner rect + connecting trapezoid faces (3D box look)"}
  - {name: arcGlow, signature: "arcGlow(x, y, r1, r2, col, a1, a2) -> void", note: "annulus of quads with alpha fading from a1 to a2 (soft radial glow)"}
  - {name: constellation, signature: "constellation(area, count, maxDist) -> void", note: "noise-masked dots with proximity lines, alpha fading with distance"}
---

## What it draws
Seed 42, frame 1: a pale grey sky at the top with a scatter of faint white dots and
near-invisible connecting lines (constellations). Below that, a dense horizontal band of
soft, overlapping organic blobs — greens, purples, reds, teals, olive-yellows and dark
browns — that grow progressively larger toward the bottom, where they merge into big dark
masses. Overlaid on the whole canvas is a mosaic of rectangular "boxes": black-outlined
rounded rectangles, each containing a small offset colored rectangle, with translucent
trapezoid faces between them that read as 3D perspective. A few large soft radial glows
(brown, yellow, teal) sit in the corners and edges.

## How the code works
- `setup()` (forest.pde:4-10): 960x960 P2D, `smooth(8)`, `pixelDensity(2)` (not available on
  this display, see result.json warning), calls `generate()`.
- `draw()` (forest.pde:12-17) calls `generate()` every frame; `time = millis()*0.001`
  feeds noise calls, so the inner rectangles and blob outlines wobble slowly — the sketch
  is animated and `deterministic: false` (frames 1/10/60 differ; also the initial
  `int seed = int(random(999999))` at forest.pde:1 is reseeded to 42 by the harness).
- `generate()` (forest.pde:27): `randomSeed(seed)`, then `sky()`, forest rows, rect
  mosaic, arcs.
- Sky (sky.pde:1-54): background `#DEE1DA`; a full-screen 4-vertex shape with two random
  palette fills gives the subtle two-tone ground. 1000 candidate points in the top ~60%
  are kept where 2-D noise < a random limit (sky.pde:21-26), drawn as ~2 px white dots at
  random alpha (sky.pde:30-32) with white proximity lines below `maxDist =
  width*random(0.04)` whose alpha fades with distance (sky.pde:33-40) — the faint
  constellations. A black alpha 30->0 gradient over the top 40% darkens the top edge
  (sky.pde:43-51).
- Forest rows (forest.pde:35-46): 21 rows (`j = -1..20`); per-row size `ss =
  width*1.2/(ch+2-j)` makes front rows bigger, row spacing `dy = pow(map(j,0,20,0.1,0.6),3)`
  widens toward the front, rows start at `height*0.4`. Each cell calls `plant()`
  (forest.pde:151-169): a closed polygon of `PI*r` vertices whose radius is scaled by
  `noise(des+dx*det, des+dy*det, time*0.3)` — the soft canopies. Front-row blobs are huge,
  hence the dark mass at the bottom.
- Rect mosaic (forest.pde:48-66): one CENTER-mode rect covering the canvas minus 20 px;
  1000 iterations randomly split one rect into two (width or height fraction 0.4-0.6),
  skipping splits under 40 px — a full-bleed mosaic.
- Cell drawing (forest.pde:89-129): 20% of cells skipped (line 93); outer rect
  (`w-20, h-20`) in a random palette colour at alpha up to 255, black stroke, corner
  radius 2; inner rect at 20% of the size, position jittered by
  `noise(x1, y1, time*random(2))` (the slow wobble); two quads joining outer and inner
  corners, filled black alpha 0->40 (top) and 0->80 (bottom) (lines 112-128) — the 3D
  box/envelope faces.
- Arcs (forest.pde:132-138): 14 random large `arc2()` calls (forest.pde:176-194): annulus
  of quads from `r1` to `3*r1` with alpha fading 80 -> 0 — the soft radial glows.
- Palette (forest.pde:197): 9 colours; `rcol()` picks uniformly at random.
- Cross-run non-determinism: `result.json` says `deterministic: false`. Even with seed 42
  every render is a fresh composition — the noise-dependent sky point count (sky.pde:24)
  shifts how many `random()` calls are consumed before the forest and mosaic sections, so
  downstream random state differs per run. Only large changes are meaningful here.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ch_10 | `int ch = 20;` -> `int ch = 10;` | large | fewer, larger depth rows; canopies bigger, mosaic sparser; strong red radial glow at the right edge | variants/ch_10/frame_00001.png |
| sub_100 | `int sub = int(random(1000));` -> `int sub = 100;` | moderate | coarser mosaic — fewer, larger cells, most visible in the bottom half | variants/sub_100/frame_00001.png |
| inner_0.5 | `float w2 = r.w*0.2;` -> `r.w*0.5`, `float h2 = r.h*0.2;` -> `r.h*0.5` | moderate | inner rects ~half the cell; trapezoid faces wide and short, boxes read flatter | variants/inner_0.5/frame_00001.png |
| ss_2.4 | `float ss = width*1.2/(ch+2-j);` -> `width*2.4/(ch+2-j);` | large | canopies doubled; blob layer dominates and nearly buries the cell grid | variants/ss_2.4/frame_00001.png |
| arcs_0 | `for(int i = 0; i < 14; i++){` -> `for(int i = 0; i < 0; i++){` | subtle | no clear structural change; glows not clearly distinguishable because per-run randomness relocates/recolours them | variants/arcs_0/frame_00001.png |
| palette_cool | `int colors[] = {…warm 9…};` -> cool 9-colour blue set | moderate | same composition, all fills now blues and whites | variants/palette_cool/frame_00001.png |

## Modularisation notes
- Generic: `noiseBlob` (noise-deformed closed shape, used for canopies), `subdivideRects`
  (random binary rect splitting), `perspectiveCell` (outer rect + wobbled inner rect +
  trapezoid faces — the signature look of this sketch), `arcGlow` (fading-alpha annulus),
  `constellation` (noise-masked dots + proximity lines).
- One-off art decisions: the 9-colour palette; the row-depth formula
  (`width*1.2/(ch+2-j)` and the cubed `map` spacing); the 20% cell skip rate; the sky
  gradient band at `height*0.4`; the two-tone background shape.
- Clean parameter object: `{rows, baseSize, depthCurve, subdivisions, minSplit, cellSkip,
  innerRatio, wobbleSpeed, arcCount, arcAlpha, palette, skyDensity, constellationDist}`.
