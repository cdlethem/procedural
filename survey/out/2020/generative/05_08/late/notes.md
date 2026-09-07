---
sketch: 2020/generative/05_08/late
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1554
animated: false
techniques: [noise-field, grid]
primitives: [rect, ellipse]
palette:
  colors: ["#FF0700", "#FEC626", "#FEDE88", "#1AC1A2", "#42040A"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: count, default: 300, tried: [150], change: moderate, effect: "half the tiles: sparser scatter, more black ground showing"}
  - {name: det, default: "random(0.004, 0.01)", tried: ["random(0.001, 0.002)"], change: large, effect: "smoother noise field: fewer, broader large-tile patches and more empty space between them"}
  - {name: sizeExponent, default: 2.4, tried: [1.2], change: large, effect: "most tiles become large: canvas nearly fully covered, dense quilt, little black ground"}
  - {name: ccMax, default: 14, tried: [6], change: large, effect: "coarser subdivision: chunky cells, dense 14x14 mosaics disappear, flatter look"}
  - {name: shadowAlpha, default: 40, tried: [120], change: subtle, effect: "shadow quad is mostly hidden under each tile; only slight darkening at tile bottoms"}
  - {name: palette, default: "5 colors FF0700/FEC626/FEDE88/1AC1A2/42040A", tried: ["057EBF/DBB304/E1E7ED/04140C"], change: moderate, effect: "identical structure, blue/yellow/white/dark-green colours instead of red/yellow/cream/teal/maroon"}
reusable_candidates:
  - {name: noiseSizedTile, signature: "noiseSizedTile(x, y, det, exp, maxSize) -> float", note: "tile size from 2-D noise raised to a power (most tiles small, few large)"}
  - {name: subdividedTile, signature: "subdividedTile(x, y, s, cc, gap, palette) -> void", note: "split a square into a cc x cc grid of random-palette cells with a random inner rect per cell"}
  - {name: palettePick, signature: "rcol(colors[]) -> int", note: "uniform random pick from a small palette list"}
---

## What it draws
On a black 960x960 canvas, a few hundred square "super-tiles" in red, yellow, cream,
teal and dark maroon are scattered with heavy overlap. Each super-tile is subdivided
into a small grid of flat colored squares (from a single cell up to a dense mosaic),
and larger tiles tend to cluster in patches, producing a mosaic/patchwork look.
Occasional small circles appear inside cells, and every tile casts a faint soft
shadow below it.

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the image is static
(late.pde:30-32, 20-28). `generate()` (43-94):

- Tile size comes from `pow(noise(x*det, y*det), 2.4) * 320 * random(0.5, 1)` at a
  random position per tile (51-55). `det` is one value in `random(0.004, 0.01)` for
  the whole run (51). Raising the 0-1 Perlin noise to 2.4 pushes most values down, so
  most tiles are small and only noise peaks give the large ones; the shared noise
  field makes big tiles cluster spatially (the "patches").
- Positions are snapped to an 8 px grid (`x -= x%8`, 57-58), so overlapping tiles
  align and interlock.
- A `beginShape()` quad with `fill(0, 40)` to `fill(0, 0)` (60-67) draws a vertical
  black-to-transparent gradient below each tile: the soft shadow.
- The tile body is two stacked rects: `s` then `s-8` (69-72), each in a random
  palette color, giving a two-tone border/inner look.
- Subdivision: `cc = int(random(1, random(1, 14)))` (74) - a nested random, so low
  counts are far more common than 14. The tile is split into a cc x cc grid; each
  cell is drawn twice: a full cell rect then a `random(ss)`-sized inner rect (80-82),
  making most cells two-toned. With 1% chance per cell a small ellipse pair is added
  (84-90).
- Color: `rcol()` picks uniformly at random from the 5-color list (105-108);
  `getColor`/`lerpColor` variants (110-120) exist but are unused. The toxi and
  triangulate imports (1-2) are also unused. P3D renderer with `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_150 | `for (int i = 0; i < 300; i++) {` -> `for (int i = 0; i < 150; i++) {` | moderate (mean 0.1418, 28.3% px) | sparser scatter, more black ground between tiles; same style | variants/count_150/frame_00001.png |
| det_0.001 | `float det = random(0.004, 0.01);` -> `float det = random(0.001, 0.002);` | large (mean 0.2398, 49.8% px) | large-tile clusters become fewer and broader, with bigger empty gaps between patches | variants/det_0.001/frame_00001.png |
| exp_1.2 | `pow(noise(x*det, y*det), 2.4)` -> `pow(noise(x*det, y*det), 1.2)` | large (mean 0.3619, 73.8% px) | almost all tiles large; canvas nearly fully covered, dense quilt, little black ground | variants/exp_1.2/frame_00001.png |
| cc_6 | `int cc = int(random(1, random(1, 14)));` -> `... random(1, 6) ...` | large (mean 0.2754, 56.6% px) | chunky cells, no dense mosaics; coarser flatter patchwork | variants/cc_6/frame_00001.png |
| shadow_120 | `fill(0, 40);` -> `fill(0, 120);` | subtle (mean 0.0133, 6.0% px) | no visible structural change; slightly darker fringe under tile bottoms (shadow mostly occluded by tiles) | variants/shadow_120/frame_00001.png |
| palette_alt | `int colors[] = {#FF0700, #FEC626, #FEDE88, #1AC1A2, #42040A};` -> `{#057EBF, #DBB304, #E1E7ED, #04140C};` | moderate (mean 0.1194, 39.0% px) | identical layout and sizes (same seed); blue/yellow/white/dark-green instead of red/yellow/cream/teal/maroon | variants/palette_alt/frame_00001.png |

## Modularisation notes
- Generic: `noiseSizedTile` (noise->power->scale size), `subdividedTile` (grid
  subdivision with per-cell random inner rect + optional dot), `rcol` palette pick,
  and the shadow quad. All four are pure functions of their parameters and would
  compose directly.
- One-off art decisions: the 8 px grid snap, the `s-8` inset double-rect border,
  the nested `random(1, random(1, 14))` distribution, the 1% ellipse chance, and the
  specific 5-color palette.
- A clean parameter object: `{count, det, sizeExp, maxSize, posJitter, snap, shadow,
  ccMin, ccMax, cellGap, dotChance, palette}`.
