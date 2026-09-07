---
sketch: 2018/Generativos/juice
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1804
animated: false
techniques: [noise-field, grid, packing]
primitives: [shape, line, ellipse]
palette:
  colors: ["#17E5DB", "#5442AE", "#A64AC9", "#FD6519", "#FDCF00", "#FFFFFF"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: dc, default: "random(10,33)", tried: [10], change: "", effect: ""}
  - {name: c, default: "random(500)", tried: [100], change: "", effect: ""}
  - {name: cc, default: "random(6)*random(1)", tried: [0], change: "", effect: ""}
  - {name: noiseDetail, default: 1, tried: [5], change: "", effect: ""}
  - {name: blobAlpha, default: 250, tried: [128], change: "", effect: ""}
  - {name: gridStroke, default: "stroke(0,6)", tried: [40], change: "", effect: ""}
reusable_candidates:
  - {name: noiseGridMosaic, signature: "noiseGridMosaic(dc, noiseScale, angle, ampScale, palette) -> void", note: "grid of quads split into 4 triangles at a noise-displaced center point"}
  - {name: blobField, signature: "blobField(count, sizeRange, noiseScale) -> List<Blob>", note: "random blobs sized by 2-D noise, then recursively spawned as smaller children"}
  - {name: connectBlobs, signature: "connectBlobs(blobs, threshold) -> void", note: "random-walk line segments between overlapping blobs"}
---

## What it draws
A full-bleed 960x960 image of two layered systems. The base is a grid mosaic of
quadrilateral cells, each cell split into four triangles meeting at a slightly
offset center point, so the surface reads as a faceted low-poly quilt in
saturated teal, orange, yellow, violet, purple and white. Scattered on top are
dozens of semi-transparent "jellyfish" blobs of varying sizes: soft radial
shading from a bright center to a darker rim, a tiny central dot, a faint dark
shadow cast down-right, and thin hairlines linking blobs that overlap each
other.

## How the code works
`generate()` (juice.pde:21) is called once from `setup()`; `draw()` is empty, so
the sketch is static.

1. Grid mosaic (lines 26-74): `dc` (10-33, random) sets the number of cells per
   side; cell size `dd = width/dc` (27). A single noise field sampled per cell
   corner (38-39) gives an angle and amplitude; the cell center is displaced
   by `0.4*amp` in that angle direction (40-41). Each cell draws 4 triangles
   (44-72), one per edge, filled either with a random palette color or that
   color lerped 30% toward black; `stroke(0, 6)` (33) adds faint dark cell
   edges.
2. Blob field (lines 76-101): `noiseDetail(1)` (77); `c` (500, random) blobs
   are placed at random positions (83-84) with radius scaled by 2-D noise
   (85) so blob sizes cluster spatially. Each blob then spawns `cc` (0-6,
   random) children at random angles within 1.2x its radius, at 40% size
   (89-101), making clustered families.
3. Connections (lines 103-120): O(n^2) pair loop; when two blob centers are
   closer than twice the smaller radius, a line is drawn between them as
   ~3px random-walk segments (111-117), in random palette colors — the
   hairlines visible between touching blobs.
4. Blob rendering (class Blob, 129-213): each blob's outline is a polygon of
   `res = max(8, PI*r)` points whose radius is modulated by noise (151-159),
   giving wobbly organic edges. `show()` (162) paints the body as a fan of
   triangles from the center with a two-stop alpha gradient (250 at the rim
   edge fading to 0 at the center, 167-174), a second fan in a different
   palette color at alpha 40 (179-190) for the rim tint, and a small solid
   ellipse at the center (192-193). `showShadow()` (196) draws a black
   alpha-20 offset copy (down-right) under each blob.
5. Color: `rcol()` (243) picks uniformly at random from the 6-color palette
   (240). The commented-out arrays (241-242) show the palette was a
   one-off art decision.

Randomness enters via `randomSeed(seed)` (23); all randomness is per-run
deterministic. P2D is used only for smoother polygon/ellipse fills.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: the noise-grid mosaic (1) and the blob field + connect + render
  pipeline (2-4) are self-contained and parameterizable (cell count, noise
  scale, blob count/size range, spawn rate, palette, alphas). `connectBlobs`
  is a clean candidate as a small utility (pairwise overlap + segmented line).
- One-off: the specific 6-color palette and its alternates (240-242), the
  jellyfish look (alpha fan + rim tint + center dot + shadow), and the
  `arc2` helper (220), which is defined but never called — dead code, drop it.
- Clean parameter object: `{grid: {count, noiseScale, angle, ampScale, strokeAlpha},
  blobs: {count, sizeRange, noiseScale, spawnRate, spawnScale, bodyAlpha, rimAlpha,
  shadowOffset, shadowAlpha}, palette: [..], connections: {enabled, segmentLen, threshold}}`.
