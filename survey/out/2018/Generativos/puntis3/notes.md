---
sketch: 2018/Generativos/puntis3
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 2342
animated: false
techniques: [voronoi-delaunay, dots-stippling, image-source]
primitives: [point, rect, image, shape]
palette:
  colors: ["#EC629E", "#E85237", "#ED7F26", "#C28A17", "#114635", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(280, 2200)", tried: [700], change: large, effect: "fewer points -> coarser, larger triangles, more black showing at the top"}
  - {name: stippleDensity, default: 2.1, tried: [6], change: large, effect: "much denser grain; also reshuffles per-triangle colours (stream shift)"}
  - {name: darkTriCount, default: 1000, tried: [300], change: subtle, effect: "slightly fewer thin dark triangles; otherwise same image"}
  - {name: darkTriSize, default: "random(20)*sca*12", tried: [30], change: none, effect: "no visible change (dark triangles are slivers, width ss*0.1)"}
  - {name: figureTint, default: 0, tried: [255], change: none, effect: "no visible change (figures too small to read)"}
reusable_candidates:
  - {name: triMeshFill, signature: "triMeshFill(points, palette) -> void", note: "Delaunay-triangulate scattered points, fill each triangle with a random palette colour"}
  - {name: stippleTriangle, signature: "stippleTriangle(tri, density, colors, alpha) -> void", note: "uniform random points inside a triangle, count proportional to area"}
  - {name: depthScatter, signature: "depthScatter(count, sizeFromY, drawFn) -> void", note: "random x, y biased toward bottom, size grows with y (fake depth)"}
---

## What it draws
A full-bleed mosaic of flat triangles in pink, orange-red, orange-yellow and dark green over black,
covering the whole 960x960 canvas. Every triangle is covered in a fine speckled grain (faint white
and black dots). Scattered on top: thin dark translucent triangles, small light-grey squares, and
small black figure-like silhouettes, all getting larger toward the bottom of the frame.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static (puntis3.pde:6-15).
`generate()` (puntis3.pde:27-143) works in four passes:

1. **Triangle mesh** — `cc = int(random(280, 2200))` random points are scattered with a 200px
   margin past the canvas edges; y is drawn from a double-random range (40 to up to ~1.4x height)
   so points reach the whole canvas (lines 37-41). `Triangulate.triangulate` builds the Delaunay
   mesh (line 43). Each triangle is filled with a random palette colour from
   `colors[] = {#EC629E, #E85237, #ED7F26, #C28A17, #114635, #000000}` via `rcol()`
   (lines 62, 155-158), with a barely visible `stroke(255, 10)` (line 61).
2. **Stipple grain** — per triangle, `area*2.1` points are placed uniformly inside it (sqrt-biased
   barycentric pick, lines 74-85); each dot is faint white or faint black, alpha 40
   (`stroke(int(r1*2)*255, 40)`, line 79) — the speckled texture over every triangle.
3. **Dark triangle scatter** — 1000 thin dark translucent triangles, colour
   `lerpColor(rcol(), color(40), pow(1-dv,2))` alpha 140-255, width scaled by `y` via
   `pow(map(y,0,h,0.1,1),1.1)` so they grow toward the bottom (lines 107-119).
4. **Grey squares + figure stamps** — 100 light-grey squares (`lerpColor(rcol(), color(180))`,
   lines 122-132) and 100 `tipitos` images (small figure pictures from `data/tipitos/`,
   `tint(0)` = black silhouettes) stamped at the same depth-scaled size (lines 134-142).

Randomness: `seed` is re-rolled and `randomSeed` called inside `generate()` (lines 29, 48); the
harness pins the seed field to 42, and the baseline rerun was bit-identical (deterministic: true).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_700 | `int cc = int(random(280, 2200*random(1))*random(1));` -> `int cc = int(random(280, 700)*random(1));` | large | coarser mesh: fewer, much larger triangles, more black gaps at the top edge; grey squares and figures read as relatively bigger | variants/cc_700/frame_00001.png |
| stipple_6 | `for (int j = 0; j < area*2.1; j++) {` -> `for (int j = 0; j < area*6; j++) {` | large | grain clearly denser, fills look washed-out; per-triangle colours and overlay scatter also reshuffled because the stipple loop consumes the random stream (mesh geometry unchanged) | variants/stipple_6/frame_00001.png |
| tris_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | subtle | subtle: slightly fewer thin dark triangles, rest of the image identical | variants/tris_300/frame_00001.png |
| ss_30 | `ss = random(20)*sca*12;` -> `ss = random(20)*sca*30;` | none | no visible change (dark triangles are slivers, so tripling the base size is invisible) | variants/ss_30/frame_00001.png |
| tint_255 | `tint(0);` -> `tint(255);` | none | no visible change (figures too small to distinguish black vs white) | variants/tint_255/frame_00001.png |

## Modularisation notes
Generic blocks: (1) the Delaunay fill pass is a clean `triMeshFill(points, palette)`; (2) the
stipple pass is a reusable `stippleTriangle(tri, density, colors, alpha)` — area-proportional dot
count with uniform-in-triangle sampling; (3) the three scatter loops share one shape: random x,
bottom-biased y, size = f(y) — factor into `depthScatter(count, sizeFromY, drawFn)`; (4) image
stamping with tint/scale is a one-liner utility. One-off art decisions: the 6-colour palette, the
double-random y distributions (lines 40, 111, 124), the specific alphas and lerp targets (40 / 180
grey), and the tipitos figure set. A clean parameter object: `{pointCount, margin, stippleDensity,
palette, darkTriCount, darkTriSize, rectCount, rectSize, figureCount, figureScale, background}`.
