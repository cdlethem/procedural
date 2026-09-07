---
sketch: 2017/Generativos/terrainCollage
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1792
animated: false
techniques: [noise-field, image-source]
primitives: [image, rect]
palette:
  colors: ["#F2F2E8", "#FFE41C", "#EF3434", "#ED0076", "#3F9AFC"]
  selection: image-sampled
composition: full-bleed
parameters:
  - {name: det, default: "random(0.01)", tried: ["random(0.003)"], change: large, effect: "lower noise detail = larger, smoother terrain bands; pink background shows through more"}
  - {name: count, default: 4000, tried: [1000], change: large, effect: "fewer tiles = sparser coverage, individual tiles and gaps visible; same tile-size range so gaps not larger tiles"}
  - {name: sca, default: "random(0.2)*random(0.5,1)", tried: ["random(0.5)*random(0.5,1)"], change: large, effect: "up to 2.5x bigger tiles; dense coverage, large forest/sea/sand regions dominate"}
  - {name: swd, default: "random(5)", tried: ["random(30)"], change: none, effect: "no visible change: shadow alpha (max 40/255) is faint and shadows are quickly buried under later tiles"}
  - {name: band, default: "sand 0.4-0.5", tried: ["sand 0.45-0.6"], change: large, effect: "wider sand band: sand strongly dominant, forest shrunk to only n>=0.6 regions, sea reduced"}
reusable_candidates:
  - {name: noiseTerrains, signature: "noiseTerrains(x, y, det, offsets[], band01, band2) -> int", note: "map 3-D noise value to one of 3 terrain classes by threshold bands"}
  - {name: scatterPatches, signature: "scatterPatches(count, sizeFn, angleFn, imagePick, shadow) -> void", note: "scatter rotated image tiles with an offset soft shadow over the canvas"}
---

## What it draws
Full-bleed collage of a few thousand small rotated photo tiles: white-capped blue sea
swells, beige rippled sand, and dark green forest canopy (a couple of tiles show bright
green leaves). The tiles overlap densely, forming soft diagonal bands and clusters where
one terrain gives way to another. A thin strip of the background colour (a bright pink
from the `colors` list) peeks through at the left edge. Each tile carries a faint dark
shadow offset diagonally behind it, giving a paper-cutout depth.

## How the code works
Single tab `terrainCollage.pde`. `setup()` (L5) loads 9 photos — `sand1-3.jpg`,
`forest1-3.jpg`, `water1-3.jpg` — into three arrays (L10-18) and calls `generate()`;
`draw()` (L23) is empty, so the piece is static.

`generate()` (L31):
1. Fills the background with one random colour from `colors[]` (L32, `rcol()` L207).
2. Re-seeds the RNG (L34-35), then picks noise detail `det = random(0.01)` and a 3-D
   noise offset `des = random(1000)` (L37-38).
3. Loops 4000 times (L43): each iteration takes a random point (L44-45) and samples
   3-D Perlin noise `noise(x*det+des, y*det+des, des)` (L46). The value selects a
   terrain class by threshold (L48-50): `n < 0.4` → water, `0.4 ≤ n < 0.5` → sand,
   `n ≥ 0.5` → forest. One of the 3 photo variants is then chosen uniformly at random
   (L52-56).
4. Tile size `sca = random(0.2)*random(0.5, 1)` of the source image (L57); a random
   rotation `ang` (L60), a random shadow offset distance `swd = random(5)` (L61).
5. Inside a `pushMatrix` (L62-69): translate + rotate, draw a soft black shadow rect
   with alpha `random(40)` offset by a fixed 45° direction (L65-66), then draw the
   photo tile centred at the origin (L68).

So the layout is: random scatter of tiles whose *type* is governed by a smooth noise
field (creating the large regional bands), whose *appearance* (which of the 3 photos,
size, angle, shadow) is independent random noise. The `Form` class (L98) and
`linesIntersection` (L187) are dead code, unused by `generate()`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_0.003 | `float det = random(0.01);` -> `float det = random(0.003);` | large | larger, smoother diagonal terrain bands (one wide sea band, wide forest/sand zones); much more of the magenta background shows through the gaps | variants/det_0.003/frame_00001.png |
| count_1000 | `for (int i = 0; i < 4000; i++) {` -> `for (int i = 0; i < 1000; i++) {` | large | sparser scatter: individual rotated tiles clearly separable, gaps between them, sea+sand dominant with forest only near the top | variants/count_1000/frame_00001.png |
| sca_0.5 | `float sca = random(0.2)*random(0.5, 1);` -> `float sca = random(0.5)*random(0.5, 1);` | large | much larger tiles; dense full-bleed coverage with big contiguous forest, sea and sand regions | variants/sca_0.5/frame_00001.png |
| swd_30 | `float swd = random(5);` -> `float swd = random(30);` | none | no visible change: shadow offset distance increased 6x but the faint shadow (alpha <= 40/255) is buried under later tiles | variants/swd_30/frame_00001.png |
| band_0.45_0.6 | `if (n > 0.4 && n < 0.5) img = 1;` -> `if (n > 0.45 && n < 0.6) img = 1;` | large | sand becomes strongly dominant (large beige zone), sea reduced, forest limited to the n >= 0.6 corners | variants/band_0.45_0.6/frame_00001.png |

## Modularisation notes
- `noiseTerrains` (noise value → class index via threshold bands) is the generic core;
  the specific bands 0.4/0.5 and the 3 classes are art decisions.
- `scatterPatches` (count + per-tile size/angle/shadow + image picker) is a reusable
  scatter-collage primitive; the shadow offset direction (45°, L66) and alpha range
  are one-off styling.
- A clean parameter object: `{count, noiseDetail, noiseOffset, sizeRange, shadowDist,
  shadowAlpha, bandEdges[], images[] (3 lists of 3), bgColor}`.
- The `Form`/`linesIntersection` helpers belong to a different (polygon-subdivision)
  idea and should be dropped from this sketch.
