---
sketch: 2017/Generativos/intersecCirclesGrid
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2450
animated: false
techniques: [grid]
primitives: [shape]
palette:
  colors: ["#DB7654", "#893D60", "#D6241E", "#F2AC2A", "#3D71B7", "#FFEEED", "#85749D", "#21232E", "#5FA25A", "#5D8EB4"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: shapeCount, default: 1000, tried: [300], change: large, effect: "airier collage: fewer layers, ground and large flat shapes show through gaps"}
  - {name: circleSegments, default: 32, tried: [8], change: subtle, effect: "no visible change at normal viewing; octagonal facetting only on exposed circle rims"}
  - {name: shapeWidthRange, default: "width*random(0.1,0.3)", tried: ["width*random(0.4,0.8)"], change: large, effect: "shapes 3-5x larger; a few dominate the frame, rest of canvas emptier"}
  - {name: gridColsRange, default: "int(random(10,100)*random(0.1,1)) = 1..100", tried: ["int(random(8,16)*random(0.5,1)) = 4..16"], change: large, effect: "mosaic coarsens into big checkerboard tiles instead of fine speckle"}
  - {name: paletteSize, default: 10, tried: [3], change: large, effect: "same layout; all fills restricted to red/blue/off-white"}
reusable_candidates:
  - {name: getIntersection, signature: "getIntersection(Poly p1, Poly p2) -> Poly", note: "boolean polygon intersection via vertex containment + edge crossings, then radial vertex sort"}
  - {name: pointIn, signature: "pointIn(Poly p, float x, float y) -> bool", note: "horizontal ray-casting point-in-polygon"}
  - {name: orderPoly, signature: "orderPoly(List<PVector> v) -> void", note: "sort vertices radially around centroid to make a simple polygon"}
---

## What it draws
A full-bleed collage of ~1000 overlapping flat shapes (circles and rotated rectangles) on a
randomly coloured ground. Each shape is cut into a dense grid of small tiles, and every tile is
filled with an independent random colour from a 10-colour palette, so the shapes read as busy
mosaic/checkerboard patches. Large plain single-colour shapes sit on top where they overlap,
giving the image its collage depth. Dominant colours: terracotta/orange, blue, purple, with
yellow, green, off-white and near-black accents.

## How the code works

`setup()` (line 3) calls `generate()` once; `draw()` is empty, so the piece is static
(frames 10/60 were dropped as identical). In `generate()` (line 18):

- Background filled with one random palette colour (`rcol()`, line 97) — line 19.
- Loop over 1000 shapes (line 21): random position (`xx,yy`, lines 22-23), random size —
  `ww = width*random(0.1,0.3)` (line 24), `hh = height*random(0.1,0.5)` (line 25).
- Shape type is a coin flip `ff` (line 26): 0 = circle, 1 = rectangle. The base polygon is
  built by `createCircle` (32-gon, `cc = 32` at line 72) or `createRectangle` (4 vertices,
  line 80), both centred on the origin.
- The shape is drawn once with a random solid fill (lines 36-46: `pushMatrix`, `translate`,
  `rotate(random(TWO_PI))`, `beginShape`/`vertex`/`endShape(CLOSE)`).
- Then a grid of `cw × ch` cells (each `int(random(10,100)*random(0.1,1))`, i.e. 1..100, lines 47-48) is laid over the shape's
  bounding diagonal (lines 49-51). For every cell, `getIntersection` (line 141) computes the
  polygon of (shape ∩ cell): vertices of each polygon inside the other (via `pointIn`, ray
  casting, line 191) plus all edge-edge crossings (`linesIntersection`, line 228); the result
  is made simple by radial vertex sorting (`orderPoly`, line 117). That tile is drawn with its
  own random palette fill (lines 55-62). Hence the mosaic look: every grid tile inside a shape
  gets an independent random colour.
- Colour: 10 fixed hex colours at line 95 (a coolors.co palette, comment at line 94); `rcol()`
  picks one uniformly. `getColor` (lerp between palette neighbours) is defined but unused.
- P2D renderer with `smooth(8)` (line 5); no shaders, no blend modes — plain `noStroke`
  opaque fills.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_300 | `for (int c = 0; c < 1000; c++) {` -> `for (int c = 0; c < 300; c++) {` | large (mean 0.2771, 0.883) | noticeably airier: fewer overlapping layers, large flat single-colour shapes and the dark ground read through the gaps | variants/count_300/frame_00001.png |
| cc_8 | `int cc = 32;//max(16, int(r*PI*0.5));` -> `int cc = 8;` | subtle (mean 0.0134, 0.046) | no visible change overall; exposed circle rims are slightly octagonal/faceted but the random-colour mosaic hides it | variants/cc_8/frame_00001.png |
| ww_0.4_0.8 | `float ww = width*random(0.1, 0.3)*random(1);` -> `float ww = width*random(0.4, 0.8)*random(1);` | large (mean 0.23, 0.749) | shapes much bigger (some fill a large fraction of the frame); a few huge mosaic circles/rectangles dominate, canvas otherwise sparser | variants/ww_0.4_0.8/frame_00001.png |
| grid_8_16 | `int cw = int(random(10, 100)*random(0.1, 1));` -> `int cw = int(random(8, 16)*random(0.5, 1));` | large (mean 0.2733, 0.889) | mosaic tiles coarsen into large checkerboard squares; shapes read as Mondrian-like checkers instead of fine speckle | variants/grid_8_16/frame_00001.png |
| palette_3 | `int colors[] = {#DB7654, ..., #5D8EB4};` (10 colours) -> `int colors[] = {#D6241E, #3D71B7, #FFEEED};` | large (mean 0.2897, 0.848) | layout identical to baseline; every fill restricted to red, blue and off-white | variants/palette_3/frame_00001.png |

## Modularisation notes
- `getIntersection` / `pointIn` / `linesIntersection` / `orderPoly` are generic computational
  geometry and are the main library candidates: a polygon-boolean (intersection) routine over
  simple polygons, with radial re-sorting to keep the result drawable. Note the current
  `orderPoly` bubble-sort assumes the input vertices are near-convex around the centroid;
  true concave intersections can self-intersect after sorting — worth flagging in the library.
- The drawing loop (shape + grid-tile mosaic) is the one-off art decision: pick a base shape,
  subdivide by a grid, fill each intersection tile with an independent random colour.
- A clean parameter object: `{shapeCount, shapeTypes[], sizeRange, gridRange (min,max),
  circleSegments, palette, backgroundFromPalette: bool}`.
