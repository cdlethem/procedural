---
sketch: 2020/generative/01_04/cc
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2069
animated: false
techniques: [noise-field, grid, lines-hatching, distortion]
primitives: [line]
palette:
  colors: ["#080F1C", "#3B2887", "#EFDF51", "#D7AAE0", "#6EA8BF"]
  selection: random-from-list
composition: centered
parameters: []
reusable_candidates:
parameters:
  - {name: div, default: "random(160,220)*random(1.8,2)*0.5 ≈ 144-220", tried: ["random(60,90)"], change: moderate, effect: "sparser, more skeletal mesh with visible grid cells"}
  - {name: strokeAlpha, default: "random(25,35)", tried: ["random(120,160)"], change: large, effect: "much heavier darker hatching; lobes become dark masses"}
  - {name: warpAmp, default: "120 (+ second octave 30)", tried: ["240 (+30)"], change: moderate, effect: "form spreads to near full-bleed; finer, flame-like spikes"}
  - {name: kkk, default: "random(0.4,0.6)*random(0.03,0.04)*random(0.2,1)*random(0.5,1)*0.4 ≈ 0.0005-0.0096", tried: ["2x (trailing *0.8)"], change: moderate, effect: "finer tighter swirl; lighter open web-like texture"}
  - {name: background, default: 230, tried: [20], change: large, effect: "near-black field; low-alpha black lines barely visible"}
  - {name: warpedGrid, signature: "warpedGrid(cx, cy, w, h, divisions, amp, warp) -> void", note: "grid of vertical + horizontal polylines, each vertex warped (render.pde form())"}
---

## What it draws
One large, spiky, organic blob roughly centred in the frame on a light grey
background. The blob reads like a leaf, starfish, or flame cluster: many long
curved lobes with sharp pointed tips. The whole form is built from a dense
mesh of thin dark lines — a distorted grid — that swirls, folds and pinches
itself, so the interior looks like tangled hatching while the silhouette stays
a single connected outline of light-grey gaps between the lobes.

## How the code works
- `settings()` (cc.pde:13-18) opens a 960x960 P3D window; `setup()` calls
  `generate()` and exits (export = true), so the piece is static.
- `generate()` (cc.pde:42-53) seeds RNG, scales by `scale` (=1 here) and calls
  `back()` (render.pde:10-33).
- `back()` sets `background(230)` (light grey), draws one `form()` at the
  canvas centre with w=h=2x the canvas size, after a random `translate`
  jitter of ±50.
- `form()` (render.pde:35-64) computes `div` (≈160-440 line steps) and, in a
  loop over `div`, draws two polylines per step: one vertical, one horizontal,
  both `div`-cells long and centred — i.e. a square grid of lines. Each line
  is sampled at 2 points per unit (`fline`, render.pde:66-79) and every vertex
  passes through `def()`.
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| div_60_90 | `int div = int(random(160, 220)*random(1.8, 2)*(min(w,h)*0.5/sheight));` -> `random(60, 90)` | moderate (mean 0.0801, 0.328) | sparser, more skeletal mesh: individual thin lines and open grid cells visible, large plain-grey gaps inside the lobes; same spiky silhouette | variants/div_60_90/frame_00001.png |
| alpha_120_160 | `stroke(0, random(25, 35));` -> `stroke(0, random(120, 160));` | large (mean 0.2178, 0.659) | same geometry, much heavier lines: dense black hatching, lobes read as dark masses, grey gaps nearly filled in | variants/alpha_120_160/frame_00001.png |
| warp_240 | `*2-1)*120;` -> `*2-1)*240;` (both q.x and q.y offset lines) | moderate (mean 0.0901, 0.364) | form spreads out: spikes reach all four edges (near full-bleed), hatching finer and more flame-like, silhouette larger and more scattered | variants/warp_240/frame_00001.png |
| kkk_0.8 | trailing `*0.4;` -> `*0.8;` in the kkk product chain | moderate (mean 0.0974, 0.404) | same extent, but swirl is finer: smaller grid cells, tighter web-like texture, form looks lighter and more open | variants/kkk_0.8/frame_00001.png |
| bg_20 | `background(230);` -> `background(20);` | large (mean 0.718, 1.0) | near-black field; the low-alpha black lines are barely distinguishable, image reads as a faint dark mesh on black | variants/bg_20/frame_00001.png |
  additive noise offsets of amplitude 120 and 30. This warps the straight grid
  into the swirling spiky mesh; `kkk` controls how large the swirls are and
  the 120/30 offsets control how far lines deviate.
- Stroke is `stroke(0, random(25, 35))` (render.pde:58): black at very low
  alpha, so the look is monochrome despite the 5-colour palette defined in
  cc.pde:67 — `rcol()`/`getColor()` exist but the only palette-using stroke
  call is commented out (render.pde:50).
- Depth test is disabled (render.pde:12) and everything is drawn flat in the
  z=0 plane; P3D is only needed for toxi's simplex noise, not for 3-D geometry.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic / library-worthy: `def()` as a noise-warp transform (rotation + two
  octave offsets, parameterised by scale and amplitudes); `fline()` as a
  resampled polyline; `form()` as a "warped line grid" generator (divisions,
  per-line amplitude, warp function as callback); the alpha-only dark stroke
  on a light background is the whole "hatching" recipe.
- One-off art decisions: the single centred blob at 2x canvas size, the
  specific `kkk` product chain (render.pde:28), the 120/30 offset amplitudes,
  the unused colour palette.
- Clean parameter object: {width, height, divisions, lineAlpha, noiseScale,
  warpAmp1, warpAmp2, lineAmpMin, lineAmpMax, background}.
