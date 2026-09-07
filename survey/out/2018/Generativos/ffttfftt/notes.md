---
sketch: 2018/Generativos/ffttfftt
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1538
animated: false
techniques: [grid, noise-field, packing, polar]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#DEEDFE", "#E0D6CC", "#F0B0BA", "#E46B74", "#B00018", "#3E97E8", "#50B1FB", "#90D0C2", "#E2D874", "#DEC93E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: width/40, tried: [width/20], change: large, effect: "finer cells: busier, more saturated; finer dot grids, smaller noise squares, bigger solid color blocks"}
  - {name: div, default: random(180), tried: [random(90)], change: moderate, effect: "fewer subdivision steps: fewer, larger dot-textured blocks; halos stand out over wide fields"}
  - {name: scatterCount, default: 1000, tried: [300], change: large, effect: "fewer pastel confetti squares; cleaner ground, halos and color blocks more visible"}
  - {name: arcCount, default: 40, tried: [15], change: none, effect: "no visible change; halos are so faint (alpha 50->0) that removing two thirds of them does not register"}
  - {name: det, default: random(0.1)*random(1), tried: [random(0.5)*random(1)], change: none, effect: "no visible change; first noise grid only varies gray level 240-255 and is nearly covered by later layers"}
  - {name: arcAlpha, default: 50, tried: [150], change: subtle, effect: "halos slightly more visible; colored ring edges (pink/blue) around each halo a bit stronger"}
reusable_candidates:
  - {name: quadtreeSplit, signature: "quadtreeSplit(cellSize, iterations) -> Rect[]", note: "recursive random quad-tree subdivision aligned to a grid"}
  - {name: gridRect, signature: "gridRect(x, y, w, h, step, dotSize, color) -> void", note: "fill a rect with a regular grid of small squares"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, color, alpha1, alpha2) -> void", note: "annulus arc built from polar trapezoid segments with two alpha bands"}
  - {name: noiseCell, signature: "noiseCell(cellSize, detail, offset) -> float[]", note: "2-D noise sampled once per grid cell"}
---

## What it draws
A light, airy full-bleed composition on a near-white (light gray/cream) ground. A faint
checkerboard of soft blue-gray squares sits underneath; on top are scattered translucent
squares in pastel blue, pink/red, yellow and green of varying sizes, a few large very
faint circular halos each marked by a small solid dot at the center (white ring + colored
core), and many tiny saturated dots (deep red, yellow, blue, green) sprinkled across the
canvas. Some large blocks show an internal fine dot-grid texture.

## How the code works
`setup()` sizes 960×960 P2D and calls `generate()` once; `draw()` is empty, so the piece is
static (ffttfftt.pde:3-17). `generate()` (ffttfftt.pde:37-136) layers, in order:
1. Background `fill(240)` (line 40), then a full-canvas grid of `cc = width/40` cells (line 45):
   each cell filled with gray level `240` and a `noise(des + x*det, des + y*det)*50`
   brightness (line 53) — the faint checkerboard; a 1px center dot per cell (line 56).
2. 1000 random translucent squares (lines 61-68): random position, size up to one cell `ss`,
   color `lerpColor(white, rcol(), 1-pow(random(1),0.1)*0.8)` with random alpha — the pastel
   scattered squares; a smaller inner square at 0.2× (line 67).
3. Recursive quad-tree subdivision (lines 70-89): start with the full canvas rect, `div =
   random(180)` iterations each split a random rect into four grid-aligned quadrants.
4. A second noise grid (lines 92-102): per cell a small square of side
   `pow(noise(...),2)*ss*0.2` in a random palette color — adds faint colored cells.
5. For 60% of the subdivision rects (lines 104-123): a two-tone filled `rectRound` (lines
   173-184, split horizontally between two lerped palette colors), then `gridRect` (lines
   138-146) fills the inset with a 20px dot-grid in the rect's color, plus four 2px corner
   dots — the blocks with internal dot texture.
6. 40 large faint circles (lines 125-135): `arc2` (lines 153-171) draws a full annulus as
   polar trapezoids with inner alpha 50, outer 0 (a soft radial falloff); a white ellipse
   ring and a small palette-colored ellipse core mark each center — the halo + dot motifs.
Randomness enters via `randomSeed(seed)` (line 39) and every `random(...)` call; palette is
a fixed 10-color list picked by `rcol()` (lines 186-190). P2D is required for `smooth`
antialiasing; no shaders, no blend modes (default).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20 | `int cc = int(width/40);` -> `int cc = int(width/20);` | large | much busier and more saturated: dot grids finer and denser, quad-tree/noise squares smaller, large solid deep-red/teal/yellow blocks, circles overlapping them | variants/cc_20/frame_00001.png |
| div_90 | `int div = int(random(180));` -> `int div = int(random(90));` | moderate | fewer, larger dot-textured blocks (yellow, red, teal); big soft circle halos over wide color fields | variants/div_90/frame_00001.png |
| scatterCount_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | large | far fewer pastel confetti squares; ground reads cleaner, circle halos and color blocks stand out | variants/scatterCount_300/frame_00001.png |
| arcCount_15 | `for(int i = 0; i < 40; i++){` -> `for(int i = 0; i < 15; i++){` | none | no visible change; remaining halos as faint as baseline | variants/arcCount_15/frame_00001.png |
| det_0.5 | `float det = random(0.1)*random(1);` -> `float det = random(0.5)*random(1);` | none | no visible change | variants/det_0.5/frame_00001.png |
| arcAlpha_150 | `arc2(x, y, s*0.6, s, 0, TAU, rcol(), 50, 0);` -> `arc2(x, y, s*0.6, s, 0, TAU, rcol(), 150, 0);` | subtle | halos slightly more visible: colored ring edges around each halo a bit stronger | variants/arcAlpha_150/frame_00001.png |

## Modularisation notes
- Generic, library-ready: `quadtreeSplit` (grid-aligned recursive subdivision returning a
  rect list), `gridRect` (dot-grid fill of a rect), `arc2` (polar annulus with two alpha
  bands — a soft-glow ring primitive), `noiseCell` (per-cell 2-D noise sampling).
- One-off art decisions: the specific 10-color pastel palette, the 60% probability of
  decorating a subdivision rect, the 0.1 exponent in the square-color lerp (biases toward
  saturated colors with thin alpha), the 20px dot-grid step, and the layered draw order.
- A clean parameter object: `{ cellSize (40), subdivisions (180), scatterCount (1000),
  arcCount (40), noiseScale (0.1), arcAlpha (50), gridStep (20), palette, paletteAlpha,
  seed }`.
