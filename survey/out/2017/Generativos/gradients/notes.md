---
sketch: 2017/Generativos/gradients
year: 2017
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1474
animated: false
techniques: [grid]
primitives: [rect]
palette:
  colors: ["#FFFFFF", "#09080C", "#D1370C", "#094C22", "#C997A7"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: ch, default: "int(random(3, 10))", tried: [2], change: large, effect: "2 tall (480px) bands instead of 8; top band becomes one full-width smooth horizontal gradient, bottom band ~15 wide strips"}
  - {name: cw, default: "int(random(30, 100))", tried: [10, 300], change: large, effect: "10 = 10 wide ~96px discrete colour blocks per band, gradient smoothness lost; 300 = every band uniform ultra-fine ~3px vertical stripes"}
  - {name: dc, default: "random(5)*random(1)*random(1)", tried: ["random(5)"], change: large, effect: "undamped sweep speed: within-band colour sweeps smoother with longer, gentler colour regions"}
  - {name: colors, default: "5-colour palette incl. #D1370C", tried: ["#D1370C -> #3366CC"], change: moderate, effect: "orange-red replaced by blue throughout; band layout and strip positions identical to baseline"}
reusable_candidates:
  - {name: paletteSweep, signature: "paletteSweep(palette, startIdx, step) -> color", note: "getColor(): walk a palette by a fractional index, lerpColor between adjacent entries (gradients.pde:50-56)"}
  - {name: bandedStripGrid, signature: "bandedStripGrid(bandCount, stripsFn, startFn, speedFn, palette) -> void", note: "outer loop over horizontal bands, inner loop over vertical strips, per-band palette shuffle (gradients.pde:31-41)"}
---

## What it draws
A full-bleed composition of 8 horizontal bands stacked top to bottom, each ~120 px tall.
Each band is subdivided into 30-100 narrow vertical strips (roughly 10-30 px wide) whose
fills form smooth gradient sweeps: within one band the colour drifts continuously through
the palette (white, near-black, orange-red, dark green, dusty pink), wrapping around
several times, so each band reads as a run of soft vertical colour steps. One band
(second from the bottom) is a single long horizontal gradient from dusty pink on the left
through orange-red to dark brown on the right. Dominant colours: white/cream, orange-red,
dark green, dusty pink, near-black. The image is static (frames 10/60 identical to frame 1).

## How the code works
`setup()` (gradients.pde:3-8) calls `generate()` once; `draw()` is empty, so the image is
static. `generate()` (lines 23-42):

1. `background(0)` (line 24).
2. Number of horizontal bands `ch = int(random(3, 10))` (line 27); band height
   `sh = height/ch` (line 28).
3. For each band `j` (lines 31-41): a new random strip count `cw = int(random(30, 100))`
   (line 32), strip width `sw = width/cw` (line 33), a random starting palette index
   `ic` (line 34), and a sweep speed `dc = random(colors.length)*random(1)*random(1)`
   (line 35; the double `random(1)` damps the speed to typically ~0.5-2.5 palette entries
   per full row). `shuffleArray(colors)` (line 36, defined 58-65) reorders the palette for
   that band, so each band's gradient walks a different colour order.
4. Inner loop `i = 0..cw-1` (lines 37-40): `fill(getColor(ic + dc*i))` then a full-band
   strip `rect(i*sw, j*sh, sw, sh)` (noStroke, line 30).
5. `getColor(v)` (lines 50-56) takes the fractional index, mods it by the palette length,
   and `lerpColor`s between the two adjacent palette entries - this is what turns the
   discrete per-strip fills into smooth gradients.

No blend modes, no transforms, no shader. Randomness enters only via band count, per-band
strip count, start index, sweep speed, and the per-band palette shuffle; the harness seeds
the `seed` field (line 1) so the result is deterministic per seed.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ch_2 | `int ch = int(random(3, 10));` -> `int ch = 2;` | large | two bands of 480px: top is a full-width smooth horizontal gradient (pale green -> dark green -> orange-red -> near-black -> pink), bottom ~15 wide vertical strips | variants/ch_2/frame_00001.png |
| cw_10 | `int cw = int(random(30, 100));` -> `int cw = 10;` | large | all 8 bands split into 10 wide (~96px) square blocks; discrete colour blocks, no smooth within-band gradient | variants/cw_10/frame_00001.png |
| cw_300 | `int cw = int(random(30, 100));` -> `int cw = 300;` | large | every band a uniform run of ~300 ultra-fine (~3px) vertical stripes; fine hairline texture, colours alternating in thin lines | variants/cw_300/frame_00001.png |
| dc_full | `float dc = random(colors.length)*random(1)*random(1);` -> `float dc = random(colors.length);` | large | same band structure; within-band colour sweeps smoother, with longer gentler colour regions (fewer, wider transitions) | variants/dc_full/frame_00001.png |
| palette_blue | `int colors[] = {#ffffff, #09080c, #d1370c, #094c22, #c997a7};` -> same line with `#3366cc` for `#d1370c` | moderate | identical layout to baseline (same bands, strip counts and positions); orange-red replaced by blue in every band | variants/palette_blue/frame_00001.png |

## Modularisation notes
- `getColor(v)` (palette lerp by fractional index) is fully generic - a clean library
  function `paletteLerp(palette[], float index) -> color`.
- `shuffleArray` is a standard in-place Fisher-Yates; generic as `shuffleInPlace(int[])`.
- The band/strip grid in `generate()` is the core reusable block: parameterise by
  `bandCount`, per-band `stripsPerBand`, `startIdx`, `sweepSpeed`, and `palette`.
- A clean parameter object: `{bandCount, stripsPerBand: int[], paletteStart: float[],
  sweepSpeed: float[], palette: int[]}`.
