---
sketch: 2019/generativos/maja
year: 2019
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1673
animated: false
techniques: [grid, polar]
primitives: [rect, ellipse, arc]
palette:
  colors: ["#EF002C", "#E9C500", "#DB92AE", "#E44509", "#42A1C1", "#37377A", "#D87291", "#D65269"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: ccc, default: "random(12, 69)", tried: [20], change: large, effect: "coarser checkerboard: ~20x20 big cells instead of fine ~40x40; burst layer unchanged"}
  - {name: burstCount, default: 80, tried: [30], change: moderate, effect: "fewer, more isolated bursts; dense central cluster thins out"}
  - {name: sizeScale, default: 0.2, tried: [0.5], change: large, effect: "much larger bursts; the biggest is pushed to centre and dominates the canvas"}
  - {name: background, default: "#EF002C", tried: ["#FFFFFF"], change: large, effect: "red ground gone; white checkerboard becomes invisible, bursts float on plain white"}
  - {name: palette, default: "warm 7 colours", tried: ["cool 7 colours"], change: moderate, effect: "same structure, colours shift from warm (yellow/pink/orange) to cool (blue/teal/off-white)"}
reusable_candidates:
  - {name: checkerGrid, signature: "checkerGrid(cols, inset, alphaMax) -> void", note: "cols x cols grid of rounded rects, each white with random alpha, over a solid background"}
  - {name: radialBurst, signature: "radialBurst(x, y, size, palette, shrink, gapMin, gapMax) -> void", note: "concentric shrinking circles/arcs; each ring randomly a filled ellipse, fine radial spokes (small gap), or fat pie wedges (big gap)"}
---

## What it draws
Flat red field tiled with a fine grid of white squares, each at a different opacity, giving a noisy checkerboard. Over it sit about 80 circular "burst" clusters of widely varying sizes: concentric rings that alternate between solid discs, thin radial spoke patterns (like sunbursts or spoked wheels), and segmented pie-like arcs, plus a small dot at the centre of each. Colours are a warm 7-colour set (yellow, pinks, orange-red, cyan, dark blue) on the red ground. The biggest bursts cluster in the middle of the canvas; small ones scatter to the corners.

## How the code works
Single-tab sketch; `setup()` calls `generate()` once, `draw()` is empty (maja.pde#31-32), so the image is static.

- `generate()` (maja.pde#52) reseeds RNG from `seed`, paints `background(#EF002C)` (#57).
- **Checkerboard** (maja.pde#59-68): `ccc = int(random(12, 69))` picks grid resolution; a double loop draws `ccc*ccc` rounded rects (`rect(..., 2)`) inset by 1px, each `fill(255, random(255))` — white at a random alpha, so cells range from solid white to nearly invisible against the red.
- **Bursts** (maja.pde#71-129): 80 iterations. Radius `s = width*random(0.2)*random(0.2, 1)*random(1)*3` (#72) — product of uniforms, biased to small values, so a few large bursts dominate. Position `x = random(s, width-s)` (#73) shrinks the allowed range as `s` grows, which pushes the largest bursts toward the centre — hence the dense central cluster.
- Each burst is a `while` loop (#80-124) that shrinks a running size `ss *= random(0.4, 0.9)` per ring. Each ring is randomly one of: (0) a filled ellipse, sometimes with a 1px stroke (#89-92); (1) arcs with a tiny gap `bb = random(0.06)` → fine radial spokes (#93-107); (2) arcs with a big gap `bb = random(0.35, 0.46)` → fat pie wedges (#108-123). Fills use `rcol()` (random from the 7-colour array, maja.pde#139, #141-143) at `random(250)` alpha for arcs. A small `s*0.05` centre dot caps each burst (#127-128).
- Imports of triangulate/toxi are unused. `pixelDensity(2)` warns "not available for this display" in the baseline run.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| ccc_20 | `int ccc = int(random(12, 69));` -> `int ccc = 20;` | large (mean 0.2076, 0.664) | checkerboard cells ~2x bigger (about 20 columns); burst layer looks the same as baseline | variants/ccc_20/frame_00001.png |
| bursts_30 | `for (int i = 0; i < 80; i++)` -> `i < 30` | moderate (mean 0.0595, 0.207) | noticeably fewer bursts; central cluster much thinner, more isolated small bursts | variants/bursts_30/frame_00001.png |
| size_0.5 | `width*random(0.2)*random(0.2, 1)*random(1)*3` -> `width*random(0.5)*...` | large (mean 0.161, 0.58) | bursts much bigger; one huge burst dominates the centre, small ones pushed to the edges | variants/size_0.5/frame_00001.png |
| background_white | `background(#EF002C);` -> `background(#FFFFFF);` | large (mean 0.2876, 0.644) | red ground gone; white grid cells invisible against white, bursts sit on plain white | variants/background_white/frame_00001.png |
| palette_cool | warm 7-colour array -> cool 7-colour array | moderate (mean 0.1075, 0.325) | same composition; colours shift to blues, teals, off-white with a little yellow | variants/palette_cool/frame_00001.png |

## Modularisation notes
- **Generic blocks**: the checkerboard (grid + random-alpha fill) and the radial burst (concentric shrinking rings, ring-type lottery, gap-size parameter) are both cleanly separable into library functions with the signatures above. The burst's `shrink` factor and the two gap ranges are the parameters that define its look.
- **One-off art decisions**: the red ground colour, the specific 7-colour warm palette, the centre-bias via `random(s, width-s)`, and the count 80 are style choices.
- **Clean parameter object**: `{gridCols, cellAlphaMax, groundColor, burstCount, sizeScale, shrinkRange, gapRanges: {spokes, wedges}, palette, centerBias: true}`.
