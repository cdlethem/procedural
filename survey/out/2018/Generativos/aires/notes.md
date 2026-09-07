---
sketch: 2018/Generativos/aires
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 4379
animated: false
techniques: [grid, dots-stippling, polar]
primitives: [point, line, ellipse, rect, shape]
palette:
  colors: ["#34302E", "#72574C", "#9A4F7D", "#488753", "#D9BE3A", "#D9CF7C", "#E2DFDA", "#CF4F5C", "#368886"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cw, default: "int(random(8, 33))", tried: [4], change: large, effect: "fewer, much wider columns — mosaic becomes large flat colour blocks"}
  - {name: ch, default: "int(random(8, 33))", tried: [40], change: large, effect: "more, thinner rows — finer horizontal banding"}
  - {name: circleCount, default: 30, tried: [10], change: moderate, effect: "sparser circles; more of the banded mosaic shows through"}
  - {name: burstHalfAngle, default: "random(0.2, 0.44)", tried: ["random(0.5, 0.9)"], change: moderate, effect: "starburst fans widen to near half-circles around each circle"}
  - {name: circleSizeRange, default: "width*random(0.05, 0.2)", tried: ["width*random(0.02, 0.08)"], change: moderate, effect: "circles much smaller; halos and stipple shrink with them"}
reusable_candidates:
  - {name: pelis, signature: "pelis(x, y, r, ang) -> void", note: "radial cone burst: thin lines from center to random points within a polar-angle spread, tipped with tiny dots"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2) -> void", note: "annular ring drawn as closed quad strips between two radii with alpha gradient (alp1->alp2)"}
  - {name: rcol, signature: "rcol() -> int", note: "uniform random pick from a palette array"}
---

## What it draws
A full-bleed 960×960 composition in a muted palette (pinks/reds, yellows, teals/greens, browns, purples, black, off-white). The background is a mosaic of horizontal bands: each band is a row of rectangular cells, each cell filled flat with one palette colour and overlaid with dense low-alpha dots that break the flat fill into a grainy, slightly banded texture. On top sit roughly 30 scattered circles of varying size: each has a solid palette-coloured disc, a fan of fine radiating lines (a starburst) around it, a thin dark ring, and a halo of stippled black/white dots inside and outside the disc. The overall look is flat, poster-like, with heavy grain everywhere.

## How the code works
`setup()` sizes 960×960 P2D and calls `generate()` once; `draw()` is empty so the piece is static (aires.pde:3-12). All randomness is driven by `randomSeed(seed)` (line 24).

- **Background grain** (lines 26-31): `background(lerpColor(color(240), rcol(), 0.2))` gives a pale off-white; then `width*height` (≈921 600) points are plotted at random positions with `stroke(random(256), random(16))` — a very light speckle over the whole canvas.
- **Cell mosaic** (lines 33-59): `cw`/`ch` are random 8..32, so the canvas is split into a grid of `ww×hh` cells. Each cell is filled flat with a random palette colour `c1` (`fill(c1); rect(...)`, lines 43-45), then two stippling passes run inside it: `ar = ww*hh` white-ish points (`stroke(255, random(60))`, lines 46-51) and `3*ar` points in a second palette colour `c2` (chosen ≠ `c1`, lines 52-57). The dot density is proportional to cell area, which is why smaller cells look smoother. Because `cw` is typically smaller than `ch`, cells are wide-and-short, reading as horizontal bands.
- **Circles** (lines 74-114): 30 iterations. Each picks a random center and size `s = width*random(0.05, 0.2)`, a palette colour, and draws:
  - `pelis()` (lines 117-135): a radial cone burst — `area*0.2` lines from the center out to random polar points within a half-angle `aa ∈ (0.2, 0.44)` rad, each line stroked in one palette colour at alpha 20 and tipped with a tiny dot in a second colour. This produces the fan/starburst visible around most circles.
  - a solid disc `fill(col); ellipse(...)` (lines 82-84).
  - two dark rings via `arc2` with black at low alpha (lines 85-86): one elliptical (s × 1.6s) and one circular (s × 1.1s), giving the thin dark outline.
  - two stippling passes: `area` black dots inside the disc radius (lines 88-95) and `area` dots in the disc colour extending to 1.5× the radius (lines 97-103).
  - a pale outer ring `arc2` in white alpha 40 (line 106) plus `2*area` black-or-white dots out to ~2× the radius (lines 107-113), the halo.
- `arc2` (lines 142-160) approximates an annulus by drawing `cc` closed quad strips between radii `s1/2` and `s2/2`, filling the inner edge at `alp1` and outer at `alp2`.
- Palette (line 163): 9 fixed hex colours; `rcol()` picks uniformly at random (lines 165-167). A commented-out alternative palette exists on lines 162/164.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cw_4 | `int cw = int(random(8, 33));` -> `int cw = 4;` | large | only 4 very wide columns now: the mosaic reads as big flat colour blocks (a coarse checkerboard) instead of fine horizontal bands; circles unchanged | variants/cw_4/frame_00001.png |
| ch_40 | `int ch = int(random(8, 33));` -> `int ch = 40;` | large | 40 thin rows: much finer horizontal banding, smaller cells, smoother per-cell grain; circles unchanged | variants/ch_40/frame_00001.png |
| circles_10 | `for (int i = 0; i < 30; i++) {` -> `for (int i = 0; i < 10; i++) {` | moderate | only ~10 circles scattered sparsely; the banded mosaic dominates the image | variants/circles_10/frame_00001.png |
| pelisSpread_0.9 | `float aa = random(0.2, 0.44);` -> `float aa = random(0.5, 0.9);` | moderate | the radiating starburst fans widen from narrow beams to wide half-circle fans around most circles | variants/pelisSpread_0.9/frame_00001.png |
| circSize_0.08 | `float s = width*random(0.05, 0.2);` -> `float s = width*random(0.02, 0.08);` | moderate | all circles much smaller (small dots with tight halos) scattered over the mosaic; background far more visible | variants/circSize_0.08/frame_00001.png |

## Modularisation notes
- **Generic**: `rcol()` (palette sampling), `pelis()` (radial cone burst with per-line colour and dot tips), `arc2()` (alpha-gradient annulus), the area-proportional stippling pattern (dot count ∝ area, alpha from a small random range) — all could be library functions parameterised by count/size/alpha/colour.
- **One-off art decisions**: the 9-colour palette, the specific layering order (burst → disc → dark rings → inner/outer stipple → pale halo), the background `lerpColor(color(240), rcol(), 0.2)` tint, and the fixed 30-circle count.
- **Clean parameter object**: `{palette, cellCols, cellRows, dotAlphaRange, circleCount, circleSizeRange, burstHalfAngle, burstLineAlpha, haloRadiusFactor, backgroundTint}`.
