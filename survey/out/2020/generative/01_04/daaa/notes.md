---
sketch: 2020/generative/01_04/daaa
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1478
animated: false
techniques: [grid, noise-field]
primitives: [shape]
palette:
  colors: ["#7D7FD8", "#F7AA06", "#EA79B7", "#FF0739", "#12315E", "#E6E6E6"]
  selection: random-from-list
composition: margins
parameters:
  - {name: cc, default: "random(12,45)", tried: [12], change: large, effect: "sparser, coarser grid; fewer and wider bands with larger grey gaps"}
  - {name: bb, default: 40, tried: [0], change: moderate, effect: "grey margin removed; bands run edge to edge (full bleed)"}
  - {name: alpha, default: "random(255)", tried: [255], change: large, effect: "opaque bands; saturated high-contrast colours, ground barely visible"}
  - {name: noiseDetail, default: "random(0.01) x4", tried: [0.002], change: large, effect: "smoother, slower width taper along each band; fewer thin slivers"}
  - {name: widthFactor, default: 2, tried: [4], change: moderate, effect: "bands twice as thick; canvas more covered, fewer background gaps"}
  - {name: palette, default: "5-colour list", tried: ["3-colour greyscale"], change: large, effect: "same structure in black/grey/white"}
reusable_candidates:
  - {name: wobblyBand, signature: "wobblyBand(x1, y1, x2, y2, w1, w2, c1, a1, c2, a2) -> quad", note: "closed 4-vertex ribbon of width w1..w2 across a line, two-tone with per-end alpha"}
  - {name: wovenGrid, signature: "wovenGrid(count, margin, noiseDetail, widthFactor, palette) -> void", note: "cc vertical + cc horizontal noise-width bands over a margin box"}
---

## What it draws
A woven, plaid-like composition: roughly two dozen full-height vertical and full-width
horizontal bands of varying width overlap across a light grey ground (seed 42). The bands
are semi-transparent, so overlaps build up muddy blends. Dominant colours are pink/magenta
and periwinkle blue, with accents of amber/orange, bright red, and dark navy. Band edges
are straight and axis-aligned, but each band's width varies slightly along its length, so
they read as soft ribbons rather than perfect rectangles. A thin grey margin frames the
whole grid.

## How the code works
Static one-shot: `generate()` runs once from `setup()` (daaa.pde:24); `draw()` is empty
(34-36), so frames 1/10/60 are identical.

- Canvas: 960x960 P3D, `smooth(8)`, light grey `background(230)` (50).
- `generate()` (46-72): seeds `random`/`noise` from `seed` (47-48). `cc = int(random(12,45))`
  (56) sets the band count; `dd = ss/cc` is the cell size with `bb = 40` margin (54-57).
- Loop (62-71): for each of `cc` iterations a random column/row index is picked
  (`dx`, `dy` at 63-64), then 4 noise samples with independently random frequencies
  `det1..det4 = random(0.01)` (58-61, 65-68) give two widths per band, scaled to `dd*2`.
  `line2(dx, bb, dx, height-bb, str1, str2)` draws a full-height vertical band and
  `line2(bb, dy, width-bb, dy, str3, str4)` a full-width horizontal band (69-70).
- `line2` (74-88): builds a closed 4-vertex quad perpendicular to the band direction;
  width is `str1` at the start end and `str2` at the far end, so the ribbon tapers/wobbles
  with the noise. Each end gets an independent random palette colour `rcol()` (106-108)
  and a random alpha `random(255)` (78-79); the two-tone fill is done with two `fill()`
  calls inside one `beginShape()` (80-87).
- Palette (105): `{#7D7FD8, #F7AA06, #EA79B7, #FF0739, #12315E}`, chosen by
  `rcol()` = uniform random element; the `getColor()` lerp helpers (110-119) exist but
  are unused. No blend modes, no shaders. The `triangulate` and `toxi SimplexNoise`
  imports (1-2) are never used in the code.
- Randomness enters via: band count (56), band positions (63-64), noise frequencies
  (58-61), band widths (65-68), colours and alphas (76-79).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_12 | `int cc = int(random(12, 45));` -> `int cc = 12;` | large | sparser, coarser grid: fewer, wider bands with bigger grey gaps | variants/cc_12/frame_00001.png |
| bb_0 | `float bb = 40;` -> `float bb = 0;` | moderate | grey margin gone, bands reach all four edges (full bleed) | variants/bb_0/frame_00001.png |
| alpha_255 | `float alp1 = random(255);` + `float alp2 = random(255);` -> `255` | large | bands fully opaque; saturated, high-contrast colour fields, ground barely visible | variants/alpha_255/frame_00001.png |
| det_0.002 | `float det1..det4 = random(0.01);` -> `0.002` | large | width taper along each band is slower and smoother; fewer thin slivers | variants/det_0.002/frame_00001.png |
| width_dd4 | `*dd*2` -> `*dd*4` (4 lines) | moderate | bands twice as thick; canvas more covered, fewer background gaps | variants/width_dd4/frame_00001.png |
| palette_gray | `colors[]` 5-colour list -> `{#0F0F0F, #7C7C7C, #4C4C4C}` | large | identical structure in black/grey/white | variants/palette_gray/frame_00001.png |

## Modularisation notes
- Generic: `wobblyBand` (the `line2` quad ribbon) is reusable as-is — a two-tone,
  per-end-alpha quad along an axis with noise-driven taper. `wovenGrid` (the `generate()`
  loop) is a clean primitive: a margin box tiled by N vertical + N horizontal
  noise-width bands from a random palette.
- One-off art decisions: the specific 5-colour palette, the 40px margin, the `dd*2`
  width factor, random (not lerp-based) colour+alpha per band end, and the fixed
  background grey.
- A clean parameter object: `{count, margin, cellSize, noiseDetail (x1..4), widthFactor,
  palette, alphaRange, background}`.
