---
sketch: 2018/Generativos/puntis5
year: 2018
renderer: P2D
size: [960, 960]
libraries: [triangulate]
deterministic: true
ms_first_frame: 3527
animated: false
techniques: [voronoi-delaunay, flow-field, noise-field, dots-stippling, blend-modes, image-source]
primitives: [point, line, shape, ellipse, image]
palette:
  colors: ["#6E4ECE", "#333333", "#9F9EA8", "#DDA852", "#E6E6ED"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: rock_cc, default: 30, tried: [90], change: moderate, effect: "finer faceting: more, smaller triangular faces on each gem, same gem shapes and positions"}
  - {name: island_count, default: 30, tried: [10], change: moderate, effect: "first 10 islands land at identical positions; 20 smaller/overlapping islands removed, composition largely preserved"}
  - {name: back_cc, default: 4000, tried: [1200], change: large, effect: "coarser, clearly visible background facets; also shifts the downstream random stream so island layout changes"}
  - {name: flow_len, default: 8, tried: [40], change: subtle, effect: "no visible change"}
  - {name: speckle_size, default: 6, tried: [24], change: subtle, effect: "no visible change"}
  - {name: connect_alpha, default: 60, tried: [180], change: none, effect: "no visible change"}
reusable_candidates:
  - {name: rock, signature: "rock(x, y, s, nPoints) -> void", note: "low-poly blob: circular point cloud, Delaunay, per-tri palette fill + stipple + ADD highlight"}
  - {name: randomTri, signature: "randomTri(x, y, s) -> void", note: "random 3-vertex filled triangle of radius s*0.5"}
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, col, alp1, alp2) -> void", note: "annular band built from quads, alpha ramp between radii"}
  - {name: drawConnections, signature: "drawConnections(list of (x,y,size)) -> void", note: "distance-threshold line network + node dots/rings"}
  - {name: pointsCir, signature: "pointsCir(n, x, y, s) -> PVector[]", note: "uniform-in-disk polar sample"}
---

## What it draws

A full-bleed, near-black field covered in a faint faceted triangular mesh and sparse white
stippling. Scattered over it are dozens of faceted low-poly gem-like clusters in purple,
gold/amber and pale grey, of very different sizes (a few tiny, a few huge), with thin white
web-like lines connecting many of their centres and small white dots at the connection points.
The overall feel is a dark night map of glowing crystals.

## How the code works

`setup()` -> `generate()` (puntis5.pde:11,27); `draw()` is empty, so the piece is static
(one-off art). `randomSeed(seed)` at puntis5.pde:32 makes each run a different random world.

1. `basicBack()` (utils.pde:1): 4000 uniform points spread past the canvas edges
   (pointsUni, pointsFunctions.pde:14), Delaunay-triangulated; each triangle is filled with
   `lerpColor(black, rcol(), random*random)` and stroked white alpha 10, then ~`area*2.1`
   random points are stippled inside it (utils.pde:32-42). This is the dark faceted background.
2. `spiderWeb()` (utils.pde:47): 200 points distributed radially about the centre,
   triangulated; a star-shaped polygon (triangle vertices, edge midpoints and centroid-pulled
   points) is drawn per triangle with `blendMode(ADD)`, adding faint webbing toward the centre.
3. A translucent black rect `fill(0,100)` (puntis5.pde:38-40) darkens everything, then
   `backGra()` paints a two-colour quad gradient (puntis5.pde:42, utils.pde:106).
4. Flow lines (puntis5.pde:44-55): 10000 random positions, angle =
   `noise(des + p*det)*TAU*2`, fixed length 8, `stroke(rcol(), 60)` with `blendMode(ADD)` —
   a faint directional grain.
5. Speckle (puntis5.pde:57-66): 10000 tiny `randomTri`s, size = `noise(...)*6`, filled `rcol()`.
6. Arcs (puntis5.pde:68-73): 20 `arc2` rings, radius up to `width*0.2`, `rcol()` alpha 80 -> 0,
   soft radial glows.
7. `islands()` (utils.pde:210): 30 random positions with size `width*random(0.02, 0.3)`. Each
   island gets a dark halo (`arc2`), then `rock()` (utils.pde:117): 30 points in a disk
   (`pointsCir`), Delaunay, per-triangle `rcol()` fill with white alpha-20 stroke, interior
   stipple, a per-vertex noise-alpha pass, and an `ADD`-blended brightening — the gems.
   0-4 thresholded stick-figure images (`tipitos.getRnd()`, `tint(rcol())`,
   Tipitos.pde:26, utils.pde:239) are placed on some rocks.
8. `drawConnections()` (utils.pde:245): a line between every pair of island centres closer
   than `0.7*(s1+s2)`, white alpha 60, plus a white dot, ring and faint outer circle at each
   centre — the web of lines and dots visible in the image.

Colour always comes from `rcol()` (puntis5.pde:231): uniform random pick from the 5-colour
array (purple, dark grey, mid grey, gold, off-white); black background.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| rock_cc_90 | `rock(p.x, p.y, p.z, 30, rcol());` -> `rock(p.x, p.y, p.z, 90, rcol());` | moderate | gems keep their shapes but each is cut into many smaller facets; denser, crisper gem surfaces | variants/rock_cc_90/frame_00001.png |
| islands_10 | `for (int i = 0; i < 30; i++) {` (islands) -> `i < 10` | moderate | same overall layout: first 10 islands at the baseline positions, 20 others absent; a few mid-size gems and their connecting lines missing | variants/islands_10/frame_00001.png |
| back_cc_1200 | `int cc = 4000;` (basicBack) -> `int cc = 1200;` | large | background mesh much coarser with large, visible triangular facets in gold/purple; island positions also differ (random stream shifted) | variants/back_cc_1200/frame_00001.png |
| flowlen_40 | `float d = 8;` (flow lines) -> `float d = 40;` | subtle | no visible change | variants/flowlen_40/frame_00001.png |
| trisize_24 | `noise(des+x*det, des+y*det)*6;` (speckles) -> `*24;` | subtle | no visible change | variants/trisize_24/frame_00001.png |
| conn_alpha_180 | `stroke(255, 60);` (drawConnections) -> `stroke(255, 180);` | none | no visible change; connection lines stay faint | variants/conn_alpha_180/frame_00001.png |

## Modularisation notes

Generic, library-ready: the `rock()` blob generator (point cloud + triangulate + per-tri fill
+ stipple + ADD highlight) is the core reusable primitive; `randomTri`, `arc2`, `pointsCir`,
`pointsUni`, `getAreaTri`/`randInTri` (barycentric point-in-triangle) and `drawConnections`
(distance-threshold network) are all self-contained utilities. The `basicBack`/`spiderWeb`
pair shows a two-layer triangulated backdrop that could be one function
`triangulatedBackdrop(points, {stipple, web})`.

One-off art decisions: the specific 5-colour palette, the 4000/200/30/30 point counts, the
`area*2.1` stipple density, the `0.7*(s1+s2)` connection threshold, the tipitos stick figures
(image source specific to this artist), and the ordering/alpha stacking (dark rect, gradient,
ADD flow lines) that produces the final look.

A clean parameter object: `{palette, nIslands, islandSizeRange, rockPoints, nBackPoints,
stippleDensity, nFlowLines, flowLen, flowAlpha, nSpeckles, speckleSize, nArcs,
connectThreshold, connectAlpha, haloOn, tipitosOn}`.
