---
sketch: 2018/Generativos/OP/op_016
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1510
animated: false
techniques: [noise-field, grid, dots-stippling]
primitives: [ellipse]
palette:
  colors: ["#000000", "#FFFFFF"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: ss, default: 5, tried: [10], change: moderate, effect: "coarser grid, sparser and lighter texture, blobs merge less"}
  - {name: det, default: "random(0.01)", tried: [0.002], change: subtle, effect: "noise rescaled; blob arrangement and size shift, same overall density"}
  - {name: des, default: "random(1000)", tried: [500], change: subtle, effect: "noise window offset; different cluster placement, same texture density"}
  - {name: amp, default: 1.41, tried: [3.0], change: large, effect: "dots grow, dense darker blobs, stronger halftone contrast"}
  - {name: noiseDetail, default: 2, tried: [4], change: moderate, effect: "busier texture with finer substructure and more small clusters"}
  - {name: fill, default: "0 (black)", tried: ["(200,60,60)"], change: subtle, effect: "identical layout, red dots instead of black"}
reusable_candidates:
  - {name: halftoneNoiseDots, signature: "halftoneNoiseDots(step, noiseScale, amp, octaves) -> void", note: "uniform dot grid whose radius follows 2-D noise squared"}
---

## What it draws
A full-bleed black-on-white halftone texture: a fine uniform grid of small dots
covering the whole 960x960 canvas. Most dots are tiny pinpricks on white, but in
several scattered regions (large area top-right, patches mid-left, right edge,
bottom-left corner) the dots grow and merge into dense dark grey-to-black blobs.
The blob boundaries are soft and cloudy. All three captured frames are identical.

## How the code works
`setup()` (L3-9) creates the 960x960 P2D window and calls `generate()`, which only
re-seeds (`randomSeed(seed)`, L56-58). All drawing happens in `draw()` (L11-46);
with a fixed seed the output is identical every frame (hence identical PNGs).

- L16-18: grid step `ss = 5`, giving `cw = ch = 192` columns/rows (193x193 dots).
- L32-33: `noStroke()`, `fill(0)` — solid black dots.
- L34-36: `det = random(0.01)` (noise x/y scale), `des = random(1000)` (noise
  window offset), `noiseDetail(2)` (2 octaves).
- L37-45: nested loop over every grid point; `n = pow(noise(des+x*det, des+y*det), 2)`
  (L41), `amp = 1.41*n` (L42), then `ellipse(i*ss, j*ss, ss*amp, ss*amp)` (L43).
  Squaring the noise pushes most values toward 0 (tiny dots) and lets peaks reach
  up to `ss * 1.41` ~ 7 px — that is what produces the sparse-pinprick background
  with soft dark clusters where noise peaks.

Randomness enters only via `det` and `des` (L34-35) after `randomSeed(seed)`.
Colour is fixed black; the only variation is dot size. `keyPressed` (L48-54)
re-rolls the seed on any key except 's' (save).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ss_10 | `  float ss = 5;` -> `  float ss = 10;` | moderate | grid spacing doubles; dots visibly larger and sparser, one dominant central cluster, texture overall much lighter | variants/ss_10/frame_00001.png |
| det_0.002 | `  float det = random(0.01);` -> `  float det = 0.002;` | subtle | subtle: blob placement and size change (compact central cluster, denser left and bottom-right edges); overall density similar | variants/det_0.002/frame_00001.png |
| des_500 | `  float des = random(1000);` -> `  float des = 500;` | subtle | subtle: different cluster placement (small blobs top-right, mid-left, bottom-center); same texture density | variants/des_500/frame_00001.png |
| amp_3.0 | `  float amp = 1.41*n;//random(1.41);` -> `  float amp = 3.0*n;//random(1.41);` | large | dots roughly double in size, blobs merge into dense dark masses with much stronger halftone contrast | variants/amp_3.0/frame_00001.png |
| detail_4 | `  noiseDetail(2);` -> `  noiseDetail(4);` | moderate | busier texture: finer substructure inside blobs, more small dark clusters, softer large-scale contrast | variants/detail_4/frame_00001.png |
| fill_red | `  fill(0);` -> `  fill(200, 60, 60);` | subtle | no visible change in layout or density; dots are red instead of black (pixel diff is only antialiasing) | variants/fill_red/frame_00001.png |

## Modularisation notes
- Generic core: the L37-45 loop is a clean "noise-driven halftone grid" — uniform
  step, per-point noise sample, size = amplitude * noise^exponent. A library
  function `halftoneNoiseDots(step, noiseScale, noiseOffset, amp, exponent,
  octaves, color)` would cover it.
- One-off art decisions: the fixed 1.41 amplitude cap, `pow(..., 2)` shaping
  (the contrast curve between pinpricks and blobs), black-on-white palette, and
  the seed-rolling `keyPressed` interaction.
- Clean parameter object: `{step, noiseScale, noiseOffset, amplitude, exponent,
  octaves, dotColor, bgColor, size}`.
