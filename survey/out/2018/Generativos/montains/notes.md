---
sketch: 2018/Generativos/montains
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1498
animated: false
techniques: [noise-field, grid]
primitives: [shape]
palette:
  colors: ["#db3b4b", "#edd23b", "#d4dbdd", "#2172ba"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: "random(8,30)", tried: [30], change: large, effect: "more, narrower vertical mosaic columns in the upper zone"}
  - {name: cc, default: "random(8,~120)", tried: [8], change: large, effect: "fewer, much taller/coarser mosaic blocks per column"}
  - {name: det, default: "random(0.006)", tried: [0.03], change: large, effect: "higher = higher-frequency, more wiggly wave edges"}
  - {name: div, default: "random(1,100)", tried: [6], change: large, effect: "fewer, thicker horizontal wave bands"}
  - {name: pwr, default: "random(0.8,1.2)", tried: [2.0], change: large, effect: "higher = sharper, more spiky peaks in the wave bands"}
  - {name: "colors[1]", default: "#edd23b", tried: ["#2ecc71"], change: moderate, effect: "yellow replaced by green across mosaic and wave bands"}
reusable_candidates:
  - {name: mosaicColumns, signature: "mosaicColumns(columns, bandsPerColumn, width, height, colorFn)", note: "randomly subdivided vertical columns filled with random bands (upper mosaic)"}
  - {name: noiseBands, signature: "noiseBands(bands, detail, power, offset, colorFn) -> shape", note: "horizontal bands whose top/bottom edges are 1-D noise curves, drawn top-to-bottom to overlap"}
---

## What it draws
A full-bleed square split into two zones. The upper third is a dense mosaic of
irregular colored rectangles: vertical columns of varying width, each sliced
into many short horizontal bands, all filled from a 4-color palette (coral red,
yellow, off-white, blue) blended into pastel tones. The lower two-thirds is a
stack of horizontal wavy bands whose edges are smooth 1-D noise curves, so they
look like rolling hills / waves. The palette is the same in both zones; the
bottom bands are drawn over the mosaic, hiding it below the wavy boundary.
Static — the image does not change over frames.

## How the code works
`setup()` (line 3) sizes a 960x960 P2D canvas, `pixelDensity(2)`, then calls
`generate()` once; `draw()` (line 11) is empty, so the picture is one-shot and
static. Any key press reseeds and regenerates (line 14).

`generate()` (line 22):
- `background(80)` (line 23) paints a dark-gray ground that shows through as
  thin gaps between shapes.
- **Mosaic (lines 25-57):** `sub` (8-30) random x-breakpoints sorted into
  `ps` define vertical columns. For each column, `cc` (8 up to ~120) random
  y-breakpoints define horizontal bands. Each band is a `beginShape`/`vertex`
  rectangle (lines 48-55) filled with `getMix()` — a `lerpColor` between two
  random palette entries (line 105), giving the pastel blends. Column width and
  band height are the gaps between sorted breakpoints, so cells are irregular.
- **Wave bands (lines 62-84):** `div` (1-100) horizontal slices of height
  `dh`. For slice `j`, a closed shape is built: the top edge samples
  `pow(noise(des+i*det, y1*det), pwr)` mapped to `height*0.2..0.7` (line 75),
  the bottom edge the same at `y2` (line 80), sweeping `i` across the width by
  2px. Each slice is filled with a fresh `getMix()`. Slices are drawn top to
  bottom, so lower slices paint over higher ones; the noise floor at
  `height*0.2` leaves the upper mosaic visible. `det` sets the noise
  frequency (wave wiggliness), `pwr` its contrast, `des` the noise offset.

Color: fixed 4-color list (line 97); `rcol()` picks a random entry, `getMix()`
lerps two of them, so every fill is a random pastel blend of the palette.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_30 | `int sub = int(random(8, 30));` -> `int sub = 30;` | large | far more, narrower vertical columns in the upper mosaic; wave bands unchanged in character | variants/sub_30/frame_00001.png |
| cc_8 | `int cc = int(random(8, random(40, 120)));` -> `int cc = 8;` | large | mosaic is much coarser: fewer, tall blocks per column (e.g. big red and cream blocks); wave bands unchanged | variants/cc_8/frame_00001.png |
| det_0.03 | `float det = random(0.006);` -> `float det = 0.03;` | large | wave edges are high-frequency and much more wiggly/rippled instead of broad smooth hills; mosaic unchanged | variants/det_0.03/frame_00001.png |
| div_6 | `int div = int(random(1, 100));` -> `int div = 6;` | large | only ~6 thick horizontal wave bands instead of many thin ones; mosaic unchanged | variants/div_6/frame_00001.png |
| pwr_2.0 | `float pwr = random(0.8, 1.2);` -> `float pwr = 2.0;` | large | wave peaks turn sharp and spiky (jagged mountain ridges) instead of rounded; mosaic unchanged | variants/pwr_2.0/frame_00001.png |
| palette_green | `#edd23b` -> `#2ecc71` in colors[] | moderate | yellow is replaced by green throughout the mosaic and wave bands; layout unchanged | variants/palette_green/frame_00001.png |

## Modularisation notes
Two cleanly separable blocks. `mosaicColumns` (lines 25-57) is generic: given a
column count, bands-per-column, and a color function, it lays out the upper
mosaic; the specific random ranges (8-30 columns, 8-120 bands) are art
decisions. `noiseBands` (lines 62-84) is generic: given band count, noise
`detail`, `power`, and an offset, it renders the overlapping wavy strata; the
`0.2-0.7` map range and the draw-order overlap are the artistic choices. A clean
parameter object: `{columns, bandsPerColumn, waveBands, noiseDetail, noisePower,
noiseOffset, mapRange:[0.2,0.7], palette:[...], bg}`. The color helpers
(`rcol`/`getMix`) are reusable as a palette-blend primitive.
