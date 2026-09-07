---
sketch: 2015/Generativos/gridsCircles
year: 2015
renderer: P2D
size: [800, 800]
libraries: []
deterministic: true
ms_first_frame: 1728
animated: false
techniques: [grid, symmetry, shader, distortion, polar]
primitives: [ellipse, rect, pixels]
palette:
  colors: ["#0A0A0A", "#FAFAFA", "#000000", "#FFFFFF"]
  selection: random-from-list
composition: centered
  - {name: ringCount, default: 10, tried: [2], change: moderate, effect: "only 2 rings (one thick white, one hairline black); the small central disc vanishes; tile positions shift because the random stream shifts"}
  - {name: tileCount, default: 50, tried: [150], change: subtle, effect: "denser scatter of checkerboard tiles, rings unchanged"}
  - {name: ringWeightGain, default: 0.2, tried: [0.5], change: moderate, effect: "rings become much thicker: fat white and black bands instead of mostly hairlines"}
  - {name: tileBgAlpha, default: 240, tried: [100], change: none, effect: "no visible change (tiles only marginally more see-through)"}
  - {name: bgGrain, default: 5, tried: [30], change: subtle, effect: "background clearly grainier; per-pixel deltas stay below the changed-pixel threshold"}
reusable_candidates:
  - {name: mirrorHalf, signature: "mirrorHalf(rg) -> void", note: "pixel-copy right half of a PGraphics onto the left half (left-right mirror)"}
  - {name: checkerTile, signature: "checkerTile(x, y, size, cells, bg, fg) -> void", note: "cells x cells checkerboard of rects snapped to a size-multiple grid"}
  - {name: concentricRings, signature: "concentricRings(cx, cy, maxD, n, strokeFn, weightFn) -> void", note: "n random-diameter centered ellipses with per-ring stroke colour/weight"}
---

## What it draws
A vertical gradient background running magenta/purple at the top to blue at the bottom, with faint
fine-grained pixel noise. In the centre, several concentric rings of pure white and black with very
different thicknesses (a few hairline circles plus a couple of thick bands) surround a small filled
black disc. Scattered around the canvas are dark squares containing a light checkerboard pattern
(8x8 cells) in three sizes; the whole composition is mirrored left-to-right around the vertical axis.
The corners are darkened by a radial vignette and the image carries subtle horizontal banding and a
slight RGB fringe that grows toward the edges.

## How the code works
Single tab, single-shot `generate()` called from `setup()` (line 7); `draw()` is empty, so the sketch
is static and regenerates only on key press (lines 13-16).

1. Background (lines 19-28): two fully random RGB colours `c1`, `c2`; per-pixel loop lerps between
   them vertically (`j/height`) and adds `random(-5, 5)` to each channel → gradient with grain
   (lines 21-28).
2. Rings (lines 30-36): 10 concentric `ellipse()` at canvas centre, diameter `random(width*0.8)`,
   stroke randomly black or white (`255*int(random(2))`, line 33), stroke weight
   `max(2, tt*random(0.2)*random(1))` (line 34) — the extra `random(1)` usually kills the weight, so
   most rings are hairlines and a few come out thick.
3. Checker tiles (lines 38-56): 50 tiles; size `t = int(5*pow(2, int(random(1,4))))` so t is 10, 20
   or 40 px; position snapped to the t-grid (`x -= x%t`, lines 42, 44); a near-opaque dark rect
   `fill(10, 240)` (line 45) with a light `fill(250, 240)` checker on even (i+j)%2 cells of an 8x8
   grid of `t/10`-sized cells (lines 48-55).
4. Symmetry (lines 57-63): `loadPixels()`, then copies every pixel of the right half onto the
   mirrored position of the left half → exact left-right mirror.
5. Post shader `data/post.glsl` (line 64): radial chromatic-aberration (RGB sampled at small
   offsets scaled by distance from centre, line 25 of the GLSL), a horizontal scanline brightness
   wave (line 55), and a radial black vignette `mix(col, black, dist^2)` (line 57).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| circles_2 | `  for (int i = 0; i < 10; i++) {` -> `  for (int i = 0; i < 2; i++) {` | moderate | one thick white ring and one hairline black ring; no central disc; tile placements differ (shifted random stream) | variants/circles_2/frame_00001.png |
| tiles_150 | `  for (int c = 0; c < 50; c++) {` -> `  for (int c = 0; c < 150; c++) {` | subtle | noticeably denser scatter of checkerboard tiles, incl. between rings and at the edges; rings identical | variants/tiles_150/frame_00001.png |
| ringWeight_0.5 | `strokeWeight(max(2, tt*random(0.2)*random(1)));` -> `strokeWeight(max(2, tt*random(0.5)*random(1)));` | moderate | rings much thicker: fat white and black bands, larger central disc | variants/ringWeight_0.5/frame_00001.png |
| tileAlpha_100 | `    fill(10, 240);` -> `    fill(10, 100);` | none | no visible change (tiles marginally more see-through, below noise) | variants/tileAlpha_100/frame_00001.png |
| grain_30 | `      float b = random(-5, 5);` -> `      float b = random(-30, 30);` | subtle | background clearly grainier/salt-and-pepper, gradient still magenta-to-blue | variants/grain_30/frame_00001.png |

## Modularisation notes
Generic blocks: `mirrorHalf` (pixel mirror of one half), `checkerTile` (snapped checkerboard stamp,
parameterised by grid size, cell count, bg/fg), `concentricRings` (centred random-diameter ellipses
with pluggable colour/weight), the per-pixel gradient+grain fill, and the post shader (chromatic
aberration + scanlines + vignette — could ship as a parameterised fragment shader). One-off art
decisions: the specific 50-tile / 10-ring counts, the discrete tile-size ladder {10, 20, 40}, the
`max(2, ...)` hairline-vs-thick weight lottery, and the two fixed semi-transparent greys
(10, 240)/(250, 240). A clean parameter object: {bgColours: [c1, c2], grain: 5, rings: {n: 10, maxD: 0.8*w, weightGain: 0.2}, tiles: {n: 50, sizes: [10, 20, 40], cells: 8, bg: [10, 240], fg: [250, 240]}, mirror: true, post: {aberration: 0.006, scanlines: 0.02, vignette: 2.0}}.
