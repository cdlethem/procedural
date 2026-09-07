---
sketch: 2018/Generativos/grit
year: 2018
renderer: P2D
size: [3250, 3250]
libraries: []
deterministic: true
ms_first_frame: 2658
animated: false
techniques: [subdivision, grid, noise-field]
primitives: [rect, ellipse, shape]
palette:
  colors: ["#4A3088", "#03786C", "#06A397", "#00A459", "#E72428", "#F06DA3", "#FDF9CB", "#FCCD21", "#F89C1A", "#F35E22"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: "int(random(10000))", tried: [500], change: large, effect: "fewer splits = coarser, larger mosaic tiles; sliver bands thinner, fewer ultra-dense fragments"}
  - {name: cw, default: "int(random(1,4))", tried: ["int(random(1,3))"], change: large, effect: "wider tiles; layout nearly identical to baseline, but random stream shifts so many fills change colour"}
  - {name: det, default: "random(0.02)", tried: [0.002], change: large, effect: "lower detail = dot sizes vary smoothly over large areas; giant cells get giant dots"}
  - {name: dotScale, default: "min(r.w,r.h)", tried: ["min(r.w,r.h)*0.5"], change: none, effect: "no visible change: dots/rings slightly smaller, below the change threshold"}
  - {name: wedgeAlpha, default: "random(140)", tried: ["random(40)"], change: moderate, effect: "lower alpha = diagonal half-wedges much more transparent; cells read as soft two-tone gradients"}
reusable_candidates:
  - {name: subdivideRects, signature: "subdivideRects(seed, nSplits, minCells, maxCells) -> Rect[]", note: "stochastic mosaic: repeatedly split a random rect into a 1..3 grid, tiling the canvas"}
  - {name: arcRing, signature: "arcRing(x, y, rIn, rOut, col, alphaIn, alphaOut)", note: "draws a ring as many small trapezoid wedges with per-wedge alpha (arc2)"}
  - {name: rectFrame, signature: "rectFrame(x, y, w, h, inset, col, alphaInner, alphaOuter)", note: "soft trapezoid frame around a rect, two insets (srect)"}
  - {name: paletteLerp, signature: "getColor(t) -> Color", note: "lerp between adjacent entries of a fixed palette on a continuous t"}
---

## What it draws
Full-bleed rectangular mosaic on a black background. The left third of the canvas is a dense, multicoloured sliver-mosaic (thousands of tiny rectangles and dots in purple, teal, green, orange, pink, cream and yellow); the right two-thirds are only two or three huge flat rectangles (olive and salmon/peach), each carrying one large centred dot (orange, yellow) with soft concentric halos, plus faint trapezoidal edge frames on the larger tiles. Overall it reads as a high-contrast mix of "packed noise" and "quiet giant cells".

## How the code works
- `setup()` (grit.pde:2-11): 3250x3250 P2D, calls `generate()` once, saves and exits; `draw()` is empty so the image is static.
- Mosaic (grit.pde:39-55): starts with one rect covering the whole canvas; `sub = int(random(10000))` iterations each pick a random rect and replace it by a `cw x ch` grid of children with `cw, ch in 1..3` (grit.pde:45-46). Heavily-picked columns fragment into thousands of slivers; the rest stay as giant cells. This is the whole structural logic.
- Per-rect decoration (grit.pde:62-100): centre `(xx,yy)`; dot size `ss = noise(des+xx*det, des+yy*det) * min(r.w,r.h)` (grit.pde:60-66) so dot sizes vary smoothly across the canvas (2-D Perlin, `det` in 0..0.02, offset `des` in 0..1000).
- Fill: `rect(xx,yy,r.w,r.h)` in `getColor()` (grit.pde:67-68). With 50% chance one diagonal half of the rect is overpainted as a two-tone translucent wedge (`fill(getColor(), random(140))`, grit.pde:70-88) — the soft diagonal tonal shifts.
- Dots/halos: solid ellipse of size `ss` (grit.pde:91-92); then `arc2` rings — outer `ss x ss*1.8` palette colour alpha 30, mid `ss x ss*1.1` black alpha 20, inner `ss x ss*0.4` palette colour alpha 30 (grit.pde:93-95). `arc2` (grit.pde:138-156) renders the ring as many small trapezoid wedges, each with its own fill/alpha, giving the soft halo.
- Frames: `srect` (grit.pde:163-205) draws four trapezoids per side at two insets (`-0.25*minDim` and `-0.1*minDim`, alpha 20) — the faint bevelled borders on big cells.
- Colour: 10-entry palette (grit.pde:207) purple/teal/green/red/pink/cream/yellow/orange; `getColor` (grit.pde:211-221) takes `random(colors.length)` and `lerpColor`s between adjacent entries, so every fill is a blend of two neighbouring palette colours (selection: lerp-between).
- Randomness enters via the harness-set `seed` (grit.pde:1, 37): rect picks, split factors, quadrant choice, every colour, every alpha (`random(140)`), and the noise offset/detail.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_500 | `int sub = int(random(10000));` -> `int sub = 500;` | large | coarser, more even mosaic: left half is larger medium tiles with a narrower sliver band instead of the ultra-dense slivers of the baseline; right side keeps two giant cells (olive with orange dot, pink with yellow dot) | variants/sub_500/frame_00001.png |
| cw_3 | `int cw = int(random(1, 4));` -> `int cw = int(random(1, 3));` | large | layout nearly identical to baseline (same two giant cells, same orange/yellow dots); mosaic tiles slightly wider, and the shifted random stream changes many fill colours across the mosaic | variants/cw_3/frame_00001.png |
| det_0.002 | `float det = random(0.02);` -> `float det = 0.002;` | large | same structure (left mosaic, right giant cells) but dot sizes vary much more slowly: the two giant cells now carry very large dots (cream on red, orange on cream-yellow) while the mosaic keeps small dots | variants/det_0.002/frame_00001.png |
| dot_0.5 | `float ss = noise(des+xx*det, des+yy*det)*min(r.w, r.h);` -> `...*min(r.w, r.h)*0.5;` | none | no visible change: dots and halos are half-sized but the image reads the same (score: mean 0.0097, 4.2% of pixels) | variants/dot_0.5/frame_00001.png |
| alpha_40 | `fill(getColor(), random(140));` -> `fill(getColor(), random(40));` (all 4 occurrences) | moderate | diagonal half-wedges far more transparent: large cells fade into soft two-tone gradients (olive fading to brown, salmon/orange cells), and the left mosaic looks softer and less flat | variants/alpha_40/frame_00001.png |

## Modularisation notes
- Generic: `subdivideRects` (the split loop, grit.pde:39-55) is a clean, parameterised primitive — `nSplits`, split-factor range, canvas size; `arcRing`/`arc2` and `rectFrame`/`srect` are reusable stroke-free halo/frame primitives; `paletteLerp` is a standard palette function.
- One-off art decisions: the per-rect recipe (base rect + 50% diagonal wedge + dot + three specific ring ratios 1.8/1.1/0.4 + two frame insets) and the fixed 10-colour palette; the commented-out second pass (grit.pde:102-134) is an abandoned alternate style (scattered arc-bursts with radial bars).
- Clean parameter object: `{seed, size, nSplits, splitMin, splitMax, noiseDetail, noiseOffset, dotScale, wedgeChance, wedgeAlpha, rings: [{scale, col, alpha}], frames: [{inset, alpha}], palette}`.
