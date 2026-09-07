---
sketch: 2019/generativos/consta
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 1518
animated: false
techniques: [polar, 3d-pointcloud]
primitives: [line, rect]
palette:
  colors: ["#ED4248", "#EF8228", "#E5D242", "#49BC88", "#1E3059"]
  selection: random-from-list
composition: radial
parameters:
  - {name: spoke_count, default: 30, tried: [60], change: subtle, effect: "denser starburst, more overlapping spokes toward center"}
  - {name: box_rows, default: 2, tried: [4], change: subtle, effect: "wider band of dashes per spoke (4 offset rows)"}
  - {name: box_scale, default: "sss*0.2/0.5/0.2", tried: ["sss*0.5/1.0/0.5"], change: subtle, effect: "chunkier dashes, fat dashed spokes"}
  - {name: spoke_length, default: "width*random(0.3,0.5)", tried: ["width*random(0.5,0.9)"], change: subtle, effect: "spokes reach near the canvas edges, more coverage"}
  - {name: dash_spacing, default: "sss=random(10,20)", tried: ["sss=random(30,60)"], change: subtle, effect: "fewer, larger, more widely spaced dashes"}
  - {name: palette, default: "5 warm colors", tried: ["5 cool colors"], change: none, effect: "warm->cool hue shift; metric reads none (starburst covers ~4% of black canvas; variant frame confirmed 0 warm-palette px)"}
reusable_candidates:
  - {name: radialSpokes, signature: "radialSpokes(count, lengthRange, boxSpacing, boxRows, palette) -> void", note: "N random-3D-direction lines from the origin, each decorated with parallel rows of small boxes"}
  - {name: paletteColor, signature: "paletteColor(palette) -> color", note: "random-from-list color pick (rcol)"}
---

## What it draws
A black field with a 3-D starburst: about 30 thin lines radiate from the exact
center in every direction, and each line is flanked by one or two rows of tiny
box-shaped dashes. The dashes read as small colored cubes in orange, red,
yellow, teal and dark blue; because of the 3-D perspective, boxes on lines
pointing toward the viewer appear large, while receding lines fade into small
specks. The overall look is a sparse, wireframe-like explosion of colored
dotted spokes.

## How the code works
- `settings()` (l.14-19): 960×960 P3D canvas, `smooth(8)`; `pixelDensity(2)`
  fails on the headless display (warning in stderr).
- `setup()` (l.21) calls `generate()` once; `draw()` (l.31) is empty, so the
  image is static (frames 10/60 dropped as identical).
- `generate()` (l.34): black background (l.36), `noiseSeed`/`randomSeed(seed)`
  (l.38-39) — the only randomness is `random()`, toxi `SimplexNoise` is
  imported (l.1) but never used; `lights()` (l.42) shades the 3-D boxes.
- `cc = int(random(120,160)*0.5)` (l.44) → 60-80, giving
  `ss = width/(cc+2)` (l.45) ≈ 11.7 px; `ss` is only used by commented-out
  grid code (l.47-54) and the box size on l.90.
- Main loop (l.71-96): 30 times. Each iteration pushes the matrix, applies
  three random rotations `rotateX/Y/Z(random(TAU))` (l.73-75) so the local
  +Z axis points in a random 3-D direction, then:
  - a thin line from the origin of length `s = width*random(0.3, 0.5)`
    (l.76, 78) stroked in a random palette color `rcol()`;
  - `sss = random(10, 20)` (l.82) sets both dash spacing and dash size;
    `ccc = int(random(s/sss))` (l.84) dash count per row (~14-48);
  - for `k = 0, 1` (l.86) a second loop places boxes along the line from
    `sss*0.5` to `s - sss*0.5` (l.89), offset ±`sss*0.6` sideways (l.89),
    each a small box `box(sss*0.2, sss*0.5, sss*0.2)` (l.90) filled with an
    independent random palette color.
- `rcol()` (l.115-117) picks uniformly from the 5-color array (l.114);
  `getColor` (l.118-127, lerp between neighbors) is never called.
- `keyPressed` (l.106) regenerates with a new seed; irrelevant headless.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| lines_60 | `for (int i = 0; i < 30; i++) {` -> `... i < 60 ...` | subtle | ~2x spokes; denser starburst, spokes overlap more near the center; box size/length unchanged | variants/lines_60/frame_00001.png |
| rows_4 | `for (int k = 0; k < 2; k++) {` -> `... k < 4 ...` | subtle | each spoke now carries 4 offset rows of dashes (wider band) instead of 2 | variants/rows_4/frame_00001.png |
| boxsize_1.0 | `box(sss*0.2, sss*0.5, sss*0.2);` -> `box(sss*0.5, sss*1.0, sss*0.5);` | subtle | dashes become chunky bars (2.5x per axis); fat dashed spokes | variants/boxsize_1.0/frame_00001.png |
| length_0.5_0.9 | `float s = width*random(0.3, 0.5);` -> `width*random(0.5, 0.9)` | subtle | spokes reach near the canvas edges; more of the frame covered | variants/length_0.5_0.9/frame_00001.png |
| spacing_30_60 | `float sss = random(10, 20);` -> `random(30, 60)` | subtle | fewer, larger, more widely spaced dashes (spacing and dash size both scale with sss) | variants/spacing_30_60/frame_00001.png |
| palette_cool | `int colors[] = {#ED4248, #EF8228, #E5D242, #49BC88, #1E3059};` -> `{#1E3059, #49BC88, #6FCF97, #16213E, #49BC88}` | none | warm->cool hue shift (teal/green/navy, no red/orange/yellow); metric reads none because the starburst covers only ~4% of the black canvas | variants/palette_cool/frame_00001.png |

## Modularisation notes
- Generic: the spoke generator (random 3-D direction + line + N evenly spaced
  box dashes in K parallel rows) is cleanly parameterisable as
  `radialSpokes(count, lengthRange, spacing, boxSize, rows, palette)`; the
  random direction via three Euler rotations is a reusable "random unit
  vector" helper (uniform on the sphere would be more correct than Euler
  angles, which bias toward the poles).
- Generic: `paletteColor(palette)` random-from-list pick.
- One-off art decisions: the specific 5-color palette, the 0.3-0.5 width
  length range, box proportions (0.2 × 0.5 × 0.2 of `sss`), the ±`sss*0.6`
  row offset, and using `random` (not `noise`) for everything.
- Dead code to drop in a library version: `cc`/`ss` cell logic and the
  commented grid/arc blocks, the unused `getColor` lerp family, the unused
  toxi import, `export`/`saveImage` plumbing.
- Clean parameter object: `{count, lengthMin, lengthMax, spacingRange,
  boxScale, rows, palette, seed}`.
