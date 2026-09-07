---
sketch: 2018/Generativos/carto003
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1509
animated: false
techniques: [grid, noise-field, particles]
primitives: [rect, line, ellipse, shape]
palette:
  colors: ["#FB5D40", "#D48300", "#E5964B", "#008172", "#165253", "#1C1C1A", "#D8D8B9"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 32, tried: [16], change: moderate, effect: "coarser 16-cell grid: cells, diamonds and walk steps double, line web sparser"}
  - {name: sub, default: 5, tried: [10], change: none, effect: "no visible change; only sub-pixel noise-dot size varies"}
  - {name: det, default: 0.01, tried: [0.002], change: none, effect: "no visible change (score mean 0.0); noise dots stay <=2px"}
  - {name: walkCount, default: 100, tried: [25], change: moderate, effect: "sparser meandering line web, all else identical"}
  - {name: diamondCount, default: 40, tried: [10], change: subtle, effect: "fewer scattered diamonds; web and grid unchanged"}
reusable_candidates:
  - {name: randomWalk, signature: "randomWalk(origin, steps, cellSize, strokeWeight, color)", note: "grid-snapped drunkard's walk drawn as short rounded segments"}
  - {name: diamond, signature: "diamond(x, y, s)", note: "axis-aligned square rotated 45deg via beginShape vertices"}
  - {name: noiseDotGrid, signature: "noiseDotGrid(cell, sub, detail, offset, sizeScale, color, alpha)", note: "sub-grid of dots whose size follows 2-D noise"}
---

## What it draws
A full-bleed light gray field (seed 42) covered by a faint grid of tiny dots at cell
centers and a web of thin dark meandering lines that hop one grid cell at a time in
random directions. Scattered over the web are rotated squares (diamonds) in coral,
orange, dark teal, near-black and cream at several sizes; some diamonds carry a small
dot or second inner shape, and a few faint radial arc marks are visible. Small dark
squares sit at every major grid intersection.

## How the code works
`setup()` calls `generate()` once (line 8); `draw()` is empty (line 11-12), so the
piece is static. `generate()` (lines 23-115) with `randomSeed(seed)` (line 25):

1. Grid base (lines 30-39): `cc = 32` cells, cell size `ss = width/32 = 30px`.
   Every cell gets a near-full-cell `fill(0,20)` rect (barely visible darkening) and a
   small `fill(230,80)` center square, giving the faint dotted texture.
2. Noise layer (lines 41-53): with `sub = 5` the canvas is subdivided into
   160x160 micro-cells; each gets a `fill(0,40)` rect whose side is
   `ns*0.4*noise(des+det*i, des+det*j)` (`det = random(0.01)`, `des = random(1)`),
   producing the subtle mottled dot field. A `fill(230)` rect of `ss*0.1` is drawn at
   every major cell center (line 51), the visible grid of dots.
3. Ghost rects (lines 55-56): 100 random grid-snapped `fill(255,40)` squares of
   ~6x6px, almost invisible lightening.
4. Random walks (lines 58-78): 100 walks, each starting at a random grid-snapped
   point and taking `(cc*cc)*0.04` = 40 steps; per step, with probability 0.5 it moves
   one cell horizontally or vertically, drawing a rounded `stroke(80)` segment of
   weight `ss*0.04`. This is the thin line web.
5. Arcs (lines 80-88): 10 `arc2()` calls at grid-snapped points — segmented radial
   fan shapes with an inner radius `ss*0.2` and outer `ss`, colored `rcol()` with
   alpha 80, mostly faint.
6. Diamonds (lines 90-107): 40 random grid-snapped diamonds via `diamont()` (lines
   117-124), sizes `ss*int(random(1,4))` (30-90px), colored from the 7-color palette
   (line 162, `rcol()` lines 163-165); 20% chance of an inner diamond 8px smaller, 20%
   of a small `s3*0.2` ellipse in another palette color.
7. Grid markers (lines 109-114): `fill(230)` squares of `ss*0.04` (~1.2px) at every
   major intersection — the tiny dark dots.

Randomness enters only through the seeded `random()`/`noise()` calls; there is no
animation and no blend mode.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_16 | `int cc = 32;` -> `int cc = 16;` | moderate | coarser grid: 60px cells, much larger diamonds, sparser but longer-stepped line web | variants/cc_16/frame_00001.png |
| sub_10 | `float sub = 5;` -> `float sub = 10;` | none | no visible change | variants/sub_10/frame_00001.png |
| det_0.002 | `float det = random(0.01);` -> `float det = random(0.002);` | none | no visible change (score mean 0.0) | variants/det_0.002/frame_00001.png |
| walks_25 | `for (int j = 0; j < 100; j++) {` -> `for (int j = 0; j < 25; j++) {` | moderate | same style, but far fewer walk paths, line web clearly sparser | variants/walks_25/frame_00001.png |
| diamonds_10 | `for (int i = 0; i < 40; i++) {` -> `for (int i = 0; i < 10; i++) {` | subtle | about a quarter of the diamonds, rest of composition unchanged | variants/diamonds_10/frame_00001.png |

## Modularisation notes
- Generic: `randomWalk` (grid-snapped drunkard's walk), `diamont`, `arc2` (segmented
  radial fan), `noiseDotGrid` (noise-modulated dot sub-grid), `rcol`/`getColor`
  palette helpers, the grid-snapping idiom `x -= x%cell`.
- One-off art decisions: the specific 7-color palette, the layered alpha choices
  (0/20, 0/40, 230/80, 255/40), counts (100 walks, 10 arcs, 40 diamonds, 100 ghost
  rects), and the 32-cell base grid with 5x subdivision.
- A clean parameter object: `{cell: 32, sub: 5, noiseDetail: 0.01, walkCount: 100,
  walkSteps: 40, arcCount: 10, diamondCount: 40, palette: [...]}`.
