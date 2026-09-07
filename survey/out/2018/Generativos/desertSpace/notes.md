---
sketch: 2018/Generativos/desertSpace
year: 2018
renderer: P3D
size: [1280, 960]
libraries: []
deterministic: true
ms_first_frame: 2015
animated: false
techniques: [particles, grid, 3d-pointcloud, dots-stippling, noise-field, pixel-ops]
primitives: [ellipse, shape, pixels, image]
palette:
  colors: ["#312845", "#81B4EB", "#C16398", "#FF433A", "#FFB31D", "#FFFFFF", "#B4AFBD", "#8D98B7", "#4772A0", "#2C5D92", "#1D4C7C"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: uh, default: 1.1, tried: [0.7], change: large, effect: "lower brings the horizon inside the canvas: flat raw-sky band below it, stars/planets/hazy quads confined above, upper sky reads pinker"}
  - {name: layers, default: 4, tried: [1], change: large, effect: "fewer overlapping hazy passes: paler sky, fewer and larger pale flat circles, fewer specks (also reflows later randoms, so planets/clusters move)"}
  - {name: stars_per_layer, default: 2000, tried: [8000], change: large, effect: "4x denser star specks covering the whole sky (reflows later randoms too)"}
  - {name: planets_per_layer, default: 5, tried: [12], change: large, effect: "many more flat disc planets fill the sky (reflows later randoms too)"}
  - {name: clusters, default: 80, tried: [160], change: moderate, effect: "roughly twice as many voxel cube fields, denser 3D coverage; 2D sky/planet layer unchanged since the cluster loop runs after it"}
  - {name: det, default: 0.01, tried: [0.004], change: moderate, effect: "noise-gated dune specks clump into larger patches; surviving points reflow the random stream so clusters shift too"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, shd1, shd2)", note: "fan of quad strips between two radii with two alpha levels; used to build soft ringed 'planets'"}
  - {name: voxelCluster, signature: "voxelCluster(cw, ch, cellSize, heightJitter, amp, palette)", note: "grid of small 3D boxes with random per-box colour, drawn in a tilted camera"}
  - {name: duneSpecks, signature: "duneSpecks(count, noiseScale, threshold, size, palette)", note: "noise-thresholded short cross-shaped 2D specks in a half-transparent dark tone"}
  - {name: grainOverlay, signature: "grainOverlay(imageW, imageH, minGray, alpha)", note: "full-screen PImage of random greys drawn with low tint alpha"}
---

## What it draws

A pale lavender-grey "sky" fills the whole canvas (seed 42). Scattered over it are several
large flat discs in muted mauve, grey, dark plum and off-white, reading as distant planets;
the biggest one is a light grey disc with a faint darker ring around it. Dozens of 3D
clusters made of small brightly coloured cubes (red, orange, yellow, pink, blue, white,
dark plum) float at various angles and depths, like voxel pyramids or checkerboards seen
in perspective. Fine dot-like specks in the palette colours sprinkle the upper area, and
tiny dark cross-shaped dashes cluster near the lower half. The whole image ends with a
light grainy noise overlay that softens the colours.

## How the code works

`setup()` (desertSpace.pde:4-15) sizes the P3D canvas, builds a 1920×1920 `PImage` of
random greys (`createNoise`, lines 167-174), and calls `generate()` once; `draw()` is empty
so the piece is static unless a key is pressed (lines 17-26).

`generate()` (lines 28-165) reseeds and paints `back` = a random sky colour from `sky[]`
(line 31, 206). Then a layer loop runs 4 times (line 43):

- Lines 44-58: a full-bleed quad whose bottom edge sits at `hh = height*1.1` (below the
  canvas) filled halfway between `back` and a random palette colour, then 2000 small
  ellipses (`random(2)*random(1)` px) in a random palette colour with high alpha — these
  are the fine star-like specks (line 57).
- Lines 60-74: 5 "planets" per layer: size `width*random(0.1, 0.8)`, random position, a
  flat filled ellipse plus four `arc2()` rings (lines 65, 69-72). `arc2` (lines 177-195)
  draws a fan of quads between two radii, each with two alpha levels (`shd1`, `shd2`),
  which produces the soft ringed-disc look. Planet colours come from `getColor`, which
  lerps between adjacent palette entries (lines 214-219).
- Lines 76-83: a second quad in `back` with low alpha (40-110), a hazy wash over the same
  region.

After the layers, lines 90-113 draw "dune specks": 400 random points, kept only where
`noise(des + x*det, des + y*det) >= 0.6` (line 93, `det = random(0.01)`, line 89), each a
short 8-vertex cross/chevron shape (lines 102-112) in a 50% black-sky mix at alpha 250
(line 87) — the dark dashes in the lower area.

Lines 116-155 set up a tilted 3D camera (`rotateX ≈ -PI*0.1`, small random Y/Z, lines
126-128) with ambient + directional light, then place 80 voxel clusters (line 134): each a
`cw×ch` grid (4-20 by 4-40 cells) of `box()`es with side `dd*random(0.4,0.9)` and random
palette colour (line 147), scattered in 3D space (line 139). These are the colourful cube
fields.

Finally lines 158-164 reset the perspective camera and draw the grain `PImage` over
everything with `tint(255, 18)` — an alpha of 18/255, i.e. a very light grey noise wash.

Colour: `colors[]` (line 205) is a six-colour palette (dark plum, light blue, mauve,
red, orange, white); `rcol()` picks uniformly at random (lines 208-210); the sky palette
`sky[]` (line 206) supplies the background. Randomness enters at: seed (line 33), every
speck/planet/cluster position and size, and the grain image (line 171).

## Experiments

| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| uh_0.7 | `  float uh = 1.1;` -> `  float uh = 0.7;` | large | horizon enters the canvas: bottom ~30% is a flat pale band of the raw sky colour, stars/planets/hazy quads confined above it, upper sky reads as a pinker half-mixed mauve | variants/uh_0.7/frame_00001.png |
| layers_1 | `  for (int c = 0; c < 4; c++) {` -> `  for (int c = 0; c < 1; c++) {` | large | paler pink sky with fewer, larger flat pale circles (grey, white, blue, pink); fewer star specks; planet and cluster positions also shift because the reduced draw count reflows the random stream | variants/layers_1/frame_00001.png |
| stars_8000 | `    for (int i = 0; i < 2000; i++) {` -> `    for (int i = 0; i < 8000; i++) {` | large | star specks visibly ~4x denser, fine dots now cover the whole sky; big grey/white discs and clusters present at new positions (random reflow) | variants/stars_8000/frame_00001.png |
| planets_12 | `    for (int i = 0; i < 5; i++) {` -> `    for (int i = 0; i < 12; i++) {` | large | many more flat disc planets (large red, blue, yellow, grey, white, orange circles) fill the sky; 2D layer busier; clusters repositioned by the reflow | variants/planets_12/frame_00001.png |
| clusters_160 | `  for (int c = 0; c < 80; c++) {` -> `  for (int c = 0; c < 160; c++) {` | moderate | roughly twice as many voxel cube fields, denser colourful 3D coverage; the 2D sky/planet layer is unchanged because the cluster loop runs after it | variants/clusters_160/frame_00001.png |
| det_0.004 | `  float det = random(0.01);` -> `  float det = random(0.004);` | moderate | dune specks form larger, clumpier patches (bigger noise blobs); the noise gate's `continue` skips random draws, so surviving points reflow the stream and the clusters also shift | variants/det_0.004/frame_00001.png |

## Modularisation notes

Generic, library-ready blocks:

- `arc2` (lines 177-195) is a self-contained "soft ring" primitive: two radii, angle
  range, colour, and two alpha levels. Works for any canvas size.
- The voxel-cluster generator (lines 134-153) is a clean `voxelCluster(cw, ch, cell,
  heightJitter, amp, palette)`; camera setup (lines 116-132) could be a
  `tiltedCamera(tiltX, jitter)` helper.
- The noise-threshold specks (lines 90-113) are a `duneSpecks(count, noiseScale,
  threshold, ...)` field — the speck *shape* (the 8-vertex chevron, lines 102-112) is a
  one-off art decision; the noise gate is generic.
- The grain overlay (lines 167-174 + 163-164) is a trivial `grainOverlay(alpha)` utility.

One-off art decisions: the 4-pass layer structure with its hazy quads (lines 43-84), the
specific planet ring recipes (lines 65, 69-72 with their hardcoded `shd1`/`shd2` values),
the `uh = 1.1` horizon that sits below the canvas, and the two fixed palettes.

A clean parameter object would contain: `skyPalette`, `colorPalette`, `layers` (4),
`starsPerLayer` (2000), `planetsPerLayer` (5), `planetSizeRange` (0.1-0.8 of width),
`speckCount` (400), `speckNoiseScale` (0.01), `speckThreshold` (0.6),
`clusterCount` (80), `clusterGridRange` (4-20 × 4-40), `cameraTilt` (≈ -0.1·PI),
`grainAlpha` (18), `horizonScale` (uh, 1.1).
