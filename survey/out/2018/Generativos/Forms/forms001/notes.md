---
sketch: 2018/Generativos/Forms/forms001
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2789
animated: false
techniques: [noise-field, image-source, particles]
primitives: [image]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: 16, tried: [8], effect: "tile grid 16x2 -> 8x2: same dense look, slightly darker, more background gaps"}
  - {name: pointCount, default: 3000, tried: [1500], effect: "sparser, more black shows; also shifts random stream so the 4 tint colors are redrawn (this seed: red/salmon instead of orange)"}
  - {name: sizeScale, default: 120, tried: [60], effect: "strips half width and half height: much darker, top of canvas far sparser"}
  - {name: tintAlpha, default: 180, tried: [255], effect: "opaque stamps: densest, brightest image, almost no background left"}
  - {name: stripAspect, default: 8, tried: [2], effect: "strip height s*8 -> s*2: short dashes instead of long strips, breaks vertical continuity, darkest overall"}
  - {name: yDistExp, default: 0.7, tried: [1.0], effect: "uniform y distribution: density even top-to-bottom, loses the bottom-weighted accumulation"}
reusable_candidates:
  - {name: splitIntoTiles, signature: "splitIntoTiles(PImage, cols, rows) -> PImage[]", note: "cut a sprite sheet into a cols×rows tile array"}
  - {name: noiseSizeStamps, signature: "noiseSizeStamps(count, sizeScale, detail) -> PVector[]", note: "scatter points with noise-driven size that grows toward the bottom (map on y)"}
  - {name: tintedStrip, signature: "tintedStrip(PImage, x, y, w, h, color, alpha)", note: "stamps a sprite stretched to a tall thin strip with a semi-transparent tint"}
---

## What it draws
A full-bleed black field densely packed with thin vertical strips in orange,
gray, pale blue-white and black, like weathered wood grain or a tattered
curtain. The strips are taller and denser toward the bottom of the canvas,
where the black background is mostly covered, while the top shows more
background between shorter marks.

## How the code works
`setup()` (forms001.pde:3) sets a 960×960 P2D canvas, loads the sprite sheet
`../forms.png` via `loadForms()` (line 13) which cuts it into a 16×2 grid of
32 tiles (`cc = 16`, line 16), then calls `generate()` (line 10). `draw()` is
empty (line 27), so the piece is static and rendered once; any key press
re-seeds and regenerates (line 30).

`generate()` (line 38): after `background(0)` (line 43), a random noise
offset `des` (line 45) and detail `det` in [0.0096, 0.048] (line 46) are
drawn. A loop (lines 48–61) places 3000 points at random x and random y biased
toward the bottom by `pow(random(0,1), 0.7)` (line 50). Each point's size is
`noise(...)*120*map(y, 0, height, 0.6, 1)` (line 51): 2-D noise modulates the
size so nearby strips have correlated lengths, and the `map` grows sizes from
60% at the top to 100% at the bottom. The collision check at line 55 is
disabled by `*0.0`, so all 3000 points are kept and overlap heavily.

Each point is stamped (lines 69–90) with a random tile from the 32, drawn as
`image(img, 0, 0, s*0.4, s*8)` (line 88): 8× taller than wide, producing the
vertical strips. The strip is tinted with one of four colors `c1`–`c4`
(lines 65–68), each `lerpColor` of a random palette color (line 99, colors at
line 97) toward a random gray, at alpha 180 (line 84); the branch at
lines 77–83 is degenerate (both halves of the else pick `c4`). Rotation is
commented out (line 87), so every strip stays vertical. `noiseDetail(2)`
(line 64) is set after the sizes were already computed, so it has no effect.

## Experiments
| variant | substitution | observation | image |
|---|---|---|---|
| cc_8 | `  int cc = 16;` -> `  int cc = 8;` | sprite sheet cut into 8x2=16 tiles (each 2x wider) instead of 16x2=32; same dense striated composition, marginally darker with more black gaps (dark fraction 0.10 -> 0.23) | variants/cc_8/frame_00001.png |
| pointCount_1500 | `  for (int i = 0; i < 3000; i++) {` -> `... i < 1500 ...` | half the stamps: sparser, more black background; the 4 tint colors are drawn from the random stream after the loop, so the shorter loop shifts the stream and this seed picks red/salmon tints (red pixels 0% -> 38%) | variants/pointCount_1500/frame_00001.png |
| sizeScale_60 | `*120*map(...)` -> `*60*map(...)` | strips half width and half height; much darker (dark fraction 0.44), top third far sparser, bottom keeps the dense look | variants/sizeScale_60/frame_00001.png |
| tintAlpha_255 | `    tint(col, 180);` -> `    tint(col, 255);` | opaque stamps accumulate: densest and brightest of all variants, almost no black background left (dark fraction 0.08) | variants/tintAlpha_255/frame_00001.png |
| stripAspect_2 | `    image(img, 0, 0, s*0.4, s*8);` -> `... s*0.4, s*2);` | strip height s*2 instead of s*8: short vertical dashes instead of long strips; vertical continuity breaks, texture becomes dashy/stippled, darkest image overall (dark fraction 0.48) | variants/stripAspect_2/frame_00001.png |
| yDistExp_1.0 | `    float y = random(height*pow(random(0, 1), 0.7));` -> `... 1.0));` | points uniformly distributed vertically: density even from top to bottom instead of concentrated at the bottom; sizes still grow toward the bottom via map(y) | variants/yDistExp_1.0/frame_00001.png |

## Modularisation notes
- **Generic:** the tile splitter (`loadForms`, lines 13–25) and the
  scatter-with-noise-size loop (lines 47–61) are both parameterizable library
  primitives: sprite sheet + tile count, and (count, sizeScale, noise detail,
  vertical growth map, optional collision rejection).
- **One-off art decisions:** the 8:1 strip stretch and fixed vertical
  orientation (line 88, commented-out rotation), the 5-color palette with the
  lerp-toward-random-gray treatment (lines 65–68, 97–101), the bottom bias
  exponent 0.7 (line 50), alpha 180. The dead collision check (line 55) and
  the no-op `noiseDetail` (line 64) are artifacts to drop.
- **Parameter object:** `{sprite, tiles: [cols, rows], count, sizeScale,
  noiseDetail, yBiasExponent, stripAspect (h/w), palette, tintAlpha,
  tintGrayMix, background}`.
