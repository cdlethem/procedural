---
sketch: 2019/generativos/paraisooscuro
year: 2019
renderer: P2D
size: [960, 960]
libraries: [triangulate, toxi]
deterministic: true
ms_first_frame: 1620
animated: true
techniques: [noise-field, flow-field, voronoi-delaunay, grid, distortion, blend-modes, dots-stippling]
primitives: [shape, point, line, ellipse]
palette:
  colors: ["#152425", "#1D3740", "#06263E", "#074B7D", "#094D88", "#1D6C9E", "#FF2000", "#FF2010", "#000204"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: pwr, default: 4.2, tried: [1.5], change: subtle, effect: "lower power flattens the band packing: horizontal colour bands spread more evenly through the lower half (wide red/pink bands at left and bottom) instead of piling at the bottom edge"}
  - {name: bandPasses, default: 4, tried: [16], change: moderate, effect: "more passes: the pink/red/blue horizontal bands become much more prominent across the lower area and along the mesh top edge"}
  - {name: hairCount, default: 10000, tried: [2500], change: large, effect: "quarter as many hairs: the swirling hair texture in the lower area is far sparser, background reads smoother/darker"}
  - {name: gridSub, default: "int(random(6,10))", tried: [40], change: large, effect: "dense 400x400 white dot lattice now covers the whole canvas, clearly brighter than the baseline's 60-90 dot grid"}
  - {name: meshPoints, default: 100, tried: [300], change: large, effect: "300 point pairs: denser, busier mesh with many larger triangles and much more red/coral; also shifts the downstream RNG so bokeh/hairs move too"}
  - {name: veilAlpha, default: 150, tried: [0], change: subtle, effect: "no visible change: the second veil quad (0..0.3h, alpha 130) still darkens the sky and the background is already near-black"}
reusable_candidates:
  - {name: desform, signature: "desform(x, y, offset, detail, amp) -> PVector", note: "noise-warps a point: angle = noise*TAU*2, radius = noise*amp (lines 251-255)"}
  - {name: bokehCircle, signature: "bokehCircle(x, y, r, colors) -> warped disk", note: "triangle-fan disk whose rim is desform()-warped (lines 257-284)"}
  - {name: flowHairs, signature: "flowHairs(count, detail, region, alpha) -> strokes", note: "20-step random walks through a noise angle field (lines 133-146)"}
  - {name: dotGrid, signature: "dotGrid(n, alpha) -> points", note: "even n x n point grid in ADD blend (lines 171-180)"}
  - {name: addTriMesh, signature: "addTriMesh(PVector[] pts, colors) -> triangles", note: "Delaunay mesh drawn with ADD blend, per-triangle random fills + gradient copies (lines 182-216)"}
  - {name: getColor, signature: "getColor(int[] colors, float v) -> color", note: "lerp between adjacent palette entries, pow(v%1, 10.8) bias (lines 327-333)"}
---

## What it draws
A near-black night scene over a faceted landscape. The top ~20% is dark, sprinkled with a few
small coloured dots (some with a short fading vertical line) and a couple of small blue circles.
Across the middle, a large faceted triangular mesh in blues, cyans, pinks and reds rises like a
crystal mountain range, brightest where its ridges meet the dark sky. Big translucent blue bokeh
circles, several with a small white dot near their centre, float over the whole canvas, denser in
the lower half. Fine hair-like swirling strokes fill the lower area, over a faint regular grid of
dots and a few barely visible white vertical ticks. Pink/red horizontal bands and red accent
triangles show through at the mesh edges and in the lower right.

## How the code works
- `setup()` (line 21) calls `generate()` once; `draw()` (line 31) is empty, so the piece is a
  single static composition. Frames 10/60 are solid black: with an empty `draw()` the P2D canvas
  capture clears — a snapshot artifact, not animation.
- Lines 38-43: `randomSeed`/`noiseSeed(seed)`; `desAng`/`detAng`/`desDes`/`detDes` seed and scale
| pwr_1.5 | `float pwr = 4.2;//random(1, 3);` -> `float pwr = 1.5;//random(1, 3);` | subtle (mean 0.0387, 8.1% px) | colour bands spread through the lower half instead of the bottom edge; mesh and bokeh unchanged | variants/pwr_1.5/frame_00001.png |
| bands_16 | `for (int k = 0; k < 4; k++) {` -> `for (int k = 0; k < 16; k++) {` | moderate (mean 0.1289, 50.6% px) | horizontal pink/red/blue bands much more visible across the lower area and at the mesh top edge | variants/bands_16/frame_00001.png |
| hairs_2500 | `for (int i = 0; i < 10000; i++) {` -> `for (int i = 0; i < 2500; i++) {` | large (mean 0.2263, 66.1% px) | hair texture far sparser; lower background reads smooth and dark | variants/hairs_2500/frame_00001.png |
| grid_40 | `sub = int(random(6, 10));` -> `sub = 40;` | large (mean 0.219, 63.1% px) | dense bright 400x400 dot lattice over the entire canvas, incl. the sky | variants/grid_40/frame_00001.png |
| mesh_300 | `for (int i = 0; i < 100; i++) {` -> `for (int i = 0; i < 300; i++) {` | large (mean 0.221, 67.2% px) | denser, busier mesh; many larger triangles, red/coral dominant; other layers shifted by the RNG | variants/mesh_300/frame_00001.png |
| veil_0 | `fill(0, 150);` -> `fill(0, 0);` | subtle (mean 0.0211, 0.1% px) | no visible change: sky still darkened by the 0..0.3h quad | variants/veil_0/frame_00001.png |
- Line 45: `background(0, 2, 4)` — near black.
- Lines 48-59: 50 full-width noise "hills" — for each, `det=random(0.01)`, base `y` in
  `0.2h..h`, height `width*(0.2-noi*0.05)`, filled `rcol()`. Dark layered bands, barely visible
  against the background.
- Lines 64-91: 4 passes x 1000 thin full-width quads; row height follows `pow(t, pwr=4.2)`, so
  the strips pile up in the bottom of the canvas. Fill `getColor(ic + dc*i)` at alpha 180 (adjacent
  palette entries lerp'd with a `pow(v%1, 10.8)` bias) — this makes the blue/pink/red horizontal
  bands.
- Lines 93-110: two per-vertex-gradient black quads (alpha 150 -> 0 across 0..0.8h, then
  130 -> 0 across 0..0.3h) darken the top — the dark sky.
- Lines 114-128: 10 small dots (`rcol()`, alpha 250) at `y = 0.16..0.2h`, each with a fading
  vertical line (stroke alpha 50 -> 0) down to `0.2h`.
- Lines 133-146: 10000 hair strokes in the lower 80%: 20-step walks through the noise angle field
  (`a = noise(x*det, y*det)*TAU*20`, `det ~ 0.0005`), colour `lerpColor(white, palette-noise, 0.5)`
  at alpha 20 — the swirling hair texture.
- Lines 153-165: 100 points at nested-random heights (biased low); a faint white line (alpha 20)
  from `(x,y)` to `(x, y-s*(val-0.18))`; the endpoint pairs are collected as `pts1`/`pts2`. The
  `ellipse` here is invisible (noFill active from line 130).
- Line 167: `blendMode(ADD)`. Lines 171-180: `sub = int(random(6,10))`, then a `sub*10 x sub*10`
  point grid (60-90 per axis), white alpha 80 — the faint dot grid.
- Lines 182-216: `Triangulate.triangulate(pts1/pts2)`; draws `tris1` in ADD blend — each triangle
  (50% skipped) emitted three times with `rcol()` alpha 90, plus a gradient copy (vertex 1 alpha
  160, others 0). This is the faceted crystal mesh.
- Lines 219-229: 40 bokeh circles; size `width*0.6*random(random(1))` (biased small). `circle()`
  (lines 257-284) builds a disk of `cc = max(8, r*PI)` segments, each rim vertex warped by
  `desform()`, filled as a fan from the warped centre with `rcol()` alpha 240; the caller adds a
  small white dot at `s*0.1`.
- `aro()` (lines 286-310) is defined but never called (dead code).
- Palette (line 320): 9 entries — six deep blues plus `#ff2000`/`#ff2010` reds. `rcol()` picks
  randomly (lines 321-323); `getColor(v)` lerps adjacent entries (lines 327-333).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
Generic blocks: `desform()` point warp; `circle()` warped bokeh disk; the noise angle-field hair
walk; the ADD-blend point grid; the Delaunay mesh with per-triangle random fills + gradient copies
(needs the triangulate library); `getColor`/`rcol` palette access; the pow-packed horizontal
gradient-band pass. One-off art decisions: the exact layer order (hills -> bands -> sky veil ->
stars -> hairs -> mesh -> bokeh), the two gradient veil quads, the star dots, the 9-colour
palette, and the nested-random height distribution of the mesh points. A clean parameter object
would be: `{seed, hillCount, bandPasses, bandPower, bandAlpha, veilAlpha, starCount, hairCount,
hairDetail, hairAlpha, meshPoints, gridSub, bokehCount, bokehMaxR, warpAmp, palette}`. `aro()`
should be deleted.
