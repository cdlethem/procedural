---
sketch: 2015/Generativos/uiFuturistGrid
year: 2015
renderer: P2D
size: [640, 640]
libraries: []
deterministic: false
ms_first_frame: 1570
animated: true
techniques: [grid, polar, particles, noise-field, dots-stippling, lines-hatching, blend-modes, shader]
primitives: [line, ellipse, rect]
palette:
  colors: ["#121317", "#4ECBFA", "#ED892B", "#0D0F0C"]
  selection: random-from-list
composition: full-bleed
parameters:
reusable_candidates:
  - {name: packRects, signature: "packRects(gridW, gridH, cellSize, rand) -> Rect[]", note: "random non-overlapping square blocks packed into an occupancy grid (Grid.pde newForms)"}
  - {name: hudDonut, signature: "hudDonut(x, y, minR, maxR, count, sense, col)", note: "point cloud in an annulus with proximity links (donut, lines 283-305)"}
  - {name: hudGraph, signature: "hudGraph(x, y, w, h, vertices, vel)", note: "noisy polyline with dots in a dark panel (graph, lines 215-239)"}
  - {name: hudSliders, signature: "hudSliders(x, y, w, h, bars)", note: "stacked horizontal bars filled by 1-D noise (listSlider+slide, lines 160-169, 274-281)"}
  - {name: flickerTiles, signature: "flickerTiles(x, y, w, h, tileW, tileH)", note: "rect grid with noise-driven alpha flicker (gridLights, lines 140-158)"}
  - {name: vignetteScanlines, signature: "shader: gaussian + time scanlines + radial blue/black vignette", note: "frag.glsl post pass, lines 42-54"}
---

## What it draws
A dark, futuristic HUD dashboard on a near-black blue-green ground: a faint white line grid with
corner brackets frames the canvas, and the surface is tiled with glowing widget blocks. A large
ring of small yellow-green dots (with a few blue/purple accents) sits in the upper left; rows of
horizontal green slider bars stack in the lower left; the right side is a mosaic of bright and
dim green square tiles, small sparkline graphs in bordered boxes, and radar-like circles with
tick marks and dotted rings; a large line graph with dots fills the lower right. A strong radial
vignette fades the corners to black with a blue tint, and a faint horizontal scanline flicker
runs across the whole image. Between frames 1 and 60 the sliders, graphs, tile brightness and
dotted rings drift slowly.

## How the code works
- `setup()` (uiFuturistGrid.pde:15-25): 640x640 P2D, `smooth(8)`, `generate()`, loads the
  `.vlw` font (text block is commented out) and `frag.glsl`.
- `generate()` (96-105): with an **unseeded** RNG, picks `gridSize` from `{40, 80}` (98-101),
  builds the `Grid` and `newForms()`, then `randomColors()`. This is why runs are not
  deterministic: layout and palette differ between launches; the `seed` field only reseeds
  `draw()` per frame.
- `newForms()` (Grid.pde:1-31): packs random square blocks (`w = h = random(1, cw)`) into an
  occupancy grid with no overlaps; each block becomes a `Form` cell. `Form.show()` is commented
  out (main:51), so forms only provide positions/sizes for widgets.
- `randomColors()` (107-119): HSB mode; random base hue, dark background (value `random(16)`),
  `colors[0]` = hue offset by a value from the `com[]` list, `colors[1]` = base hue with high
  saturation. Explains the green/yellow-green dominance with blue/purple accents in the image.
- `draw()` (27-89): reseeds `random`/`noise` with `seed` each frame (layout stable between
  frames), sets shader time. Under `blendMode(ADD)`: faint white grid lines `stroke(255,6)`
  via `grid()` (39-41), corner brackets (44), dot grid `gridBall` `fill(255,40)` (47). Then per
  form, `t = int(random(6))` (52) picks one widget:
  - `t==0` `radar` (307-353): concentric rings of random weight, dotted rings, tick-mark circles.
  - `t==1` `donut` (283-305): `c` random points in an annulus, faint lines between close pairs,
    2px dots on top — the big dotted circle.
  - `t==2` `graph` (215-239): dark `#0D0F0C` panel, then a polyline of `noise(xx*123 +
    frameCount*vel)` samples with 2px dots — sparklines and the big lower-right graph.
  - `t==3` `mapPoint` (241-261): dot grid with alpha from drifting 2-D noise.
  - `t==4` `gridLights` (140-158): rect tiles, alpha `noise(frameCount*0.2+...)*512-256` —
    the flickering mosaic.
  - `t==5` `listSlider`/`slide` (160-169, 274-281): stacked bars, fill fraction from
    `noise(i + frameCount*...)` — the lower-left slider stack.
- `filter(shader)` (81): `frag.glsl` applies a 3x3 gaussian blur (42-46), a time-modulated
  scanline flicker (47), and mixes blue toward mid-edges and black toward the corners (51-54)
  — the vignette. Animation comes from `frameCount`-offset noise and `millis()` in the shader.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
The sketch is a "widget farm": a generic packing step (`newForms`) plus a family of small,
self-contained HUD widgets (`radar`, `donut`, `graph`, `mapPoint`, `gridLights`, `listSlider`),
each taking `(x, y, w, h, ...)` and drawing in an ADD blend on a dark panel. Each widget is
already close to a library function — the main coupling is the shared `colors[]` palette,
`frameCount`-based animation, and the `noise` alpha idiom `max(2, v*512-256)`. One-off art
decisions: the `tams[]` grid-size choice, the `com[]` hue-offset table, the specific widget
probabilities (uniform 1/6), and the vignette/scanline shader. A clean parameter object would
contain: cell size (gridSize), form seed, palette (base hue + offsets), per-widget density
scalers, animation speed, and vignette strength.
