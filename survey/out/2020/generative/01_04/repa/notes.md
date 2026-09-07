---
sketch: 2020/generative/01_04/repa
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate, peasy]
deterministic: false
ms_first_frame: 3748
animated: false
techniques: [noise-field, dots-stippling, grid]
primitives: [point]
palette:
  colors: ["#C8CBF4", "#EA77BA", "#EA0071", "#F71D04", "#301156", "#FFFF00"]
  selection: noise-driven
composition: centered
parameters:
  - {name: cc, default: 6000000, tried: [1000000], change: moderate, effect: "sparser, lighter panel; white grid lines become much more prominent"}
  - {name: displaceAmp, default: 300, tried: [100], change: moderate, effect: "weaker noise warp: more compact, rounder disc; less bleed toward the square frame"}
  - {name: gridSpacing, default: 50, tried: [100], change: subtle, effect: "grid cells doubled; fewer, larger cells, rest unchanged"}
  - {name: detCol, default: 0.002, tried: [0.008], change: moderate, effect: "finer, busier colour cells with darker mixed-colour edges (value drawn uniform in [0, limit))"}
  - {name: weightScale, default: 1.2, tried: [4.0], change: large, effect: "thicker dots fill the grid gaps: smooth saturated colour fields, grid disappears"}
  - {name: colors, default: "C8CBF4,EA77BA,EA0071,F71D04,301156,FFFF00", tried: ["072457,EF4C02,ADC7C8,FE6567"], change: large, effect: "same structure recoloured to navy/orange/salmon/pale blue"}
reusable_candidates:
  - {name: noiseDisplace, signature: "noiseDisplace(x, y, offset, detail, amp, z0, z1) -> [x', y']", note: "2-D simplex-noise offset applied independently to x and y with different z slices"}
  - {name: paletteLerp, signature: "paletteLerp(colors[], v) -> color", note: "index v into palette, lerpColor between entry floor(v) and floor(v)+1 with pow(frac, 0.3)"}
  - {name: gridExclusion, signature: "skipOnGrid(x, y, spacing, margin) -> bool", note: "drop points within margin of x%spacing or y%spacing == 0 to carve background grid lines"}
---

## What it draws
A dense stipple of tiny dots filling a centered square panel on an off-white ground. The dots are
pulled into broad, flowing ribbons of colour — magenta/pink, red-orange, yellow, dark purple and
pale lavender — that snake around one another like a topographic or liquid marble pattern. A faint
white grid of straight lines (roughly 50 px apart, slightly warped where the displacement is strong)
cuts across the whole panel, and the panel edges are soft and slightly rounded.

## How the code works
- `settings()` (lines 17-22): 960x960 `P3D`, `smooth(8)`, `pixelDensity(2)` (unavailable on the
  harness display — see warning in baseline result.json).
- `setup()` calls `generate()` once (line 26); `draw()` is empty (lines 36-38), so the image is
  static: frames 10/60 are identical to frame 1.
- `generate()` (lines 60-120): `randomSeed(seed)`, `noiseSeed(seed)` (68-69), `background(250)`
  (71), translate to center (73). `time = millis()*0.001` feeds a tiny angle offset (line 89),
  which is why the run is marked non-deterministic: each run is a different realization of the same
  distributions.
- Point loop (lines 83-109): `cc = 6000000` iterations (82), batched into `beginShape(POINTS)`
  chunks of 4096 (85-88) to keep the P3D buffer from overflowing.
  - Position: uniform random angle `a` (89), `v = random(1)`, radius
    `d = sqrt(v)*width*0.5*random(0.8, 1)` (91) — sqrt makes the area uniform inside a disc.
  - Square mask: skip if `|xx| > width*0.42` or `|yy| > width*0.42` (98-99) — the panel's square
    outline with soft, sparse edges.
  - Grid carve-out: skip points within 1 px of a 50-px grid line (101) — this is what leaves the
    white grid lines visible in the render.
  - `strokeWeight(random(1.2)*v)` (104): dots near the center (small v, small d) are smaller.
  - Displacement (105-106): `xx` and `yy` each shifted by `(noise(desDes + detDes*x, desDes + detDes*y, z)*2-1)*300`
    with z-slices 999 and 111, `detDes = random(0.001)` (79) — two independent simplex-noise fields
    bend the disc into the wavy ribbons.
  - Colour (107): `stroke(getColor(v + noise(desCol + xx*detCol, desCol + yy*detCol) * colors.length*5), ~250-255)`.
    `v` plus a smooth noise field in [0, 5) indexes the 6-entry palette; `getColor(float)` (144-149)
    takes `abs(v) % 6` and `lerpColor`s between the two neighbouring palette entries with
    `pow(frac, 0.3)`, giving the smooth colour bands.
  - `vertex(xx, yy, d*0.1)` (108) plus `DISABLE_DEPTH_TEST` (66) — z is only a slight lift, no
    sorting/occlusion.
- Palette (line 132): pale periwinkle, pink, magenta, red-orange, dark purple, yellow. Several
  alternative palettes are commented out (129-135, 133-135).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_1000000 | `int cc = 6000000;` -> `int cc = 1000000;` | moderate | sparser, lighter panel; dots no longer fully overlap so the white grid lines stand out much more | variants/cc_1000000/frame_00001.png |
| disp_100 | `*300` -> `*100` in both noise-displacement lines (105-106) | moderate | more compact, rounder disc; less bleed toward the square frame, sparser corners | variants/disp_100/frame_00001.png |
| grid_100 | `if (abs(xx%50) < 1 ...` -> `abs(xx%100) < 1 ...` | subtle | grid cells doubled to ~100 px (fewer, larger cells); no other visible change | variants/grid_100/frame_00001.png |
| detCol_0.008 | `float detCol = random(0.002);` -> `random(0.008)` | moderate | finer, busier colour cells with darker mixed-colour edges; marble structure noticeably finer | variants/detCol_0.008/frame_00001.png |
| weight_4 | `strokeWeight(random(1.2)*v);` -> `random(4.0)` | large | dots ~3x thicker: smooth saturated colour fields, white grid disappears, edges of panel rougher | variants/weight_4/frame_00001.png |
| palette_alt | `int colors[] = {#C8CBF4, #EA77BA, #EA0071, #F71D04, #301156, #ffff00};` -> `{#072457, #EF4C02, #ADC7C8, #FE6567}` | large | same warped-ribbon structure and grid, recoloured to navy / orange / salmon / pale blue | variants/palette_alt/frame_00001.png |

The sketch is non-deterministic (a `millis()`-based angle offset, line 89), so ribbon positions
differ between runs; observations above compare texture/structure, not exact layout.

## Modularisation notes
- Generic / library-ready: `paletteLerp` (palette indexing with pow-eased lerp, lines 144-149),
  `noiseDisplace` (the two-line simplex offset, 105-106), `gridExclusion` (the modulo carve-out,
  101), and the sqrt-radius uniform-disc sampler (89-91).
- One-off art decisions: the exact palette (132), the 300-px displacement amplitude and
  `*colors.length*5` colour-noise gain, the 50-px grid spacing, the `width*0.42` square mask,
  chunking the point buffer at 4096.
- A clean parameter object would contain: `count` (cc), `mask` (square half-extent / radius),
  `displaceAmp`, `displaceDetail`, `gridSpacing` (0 = off), `colorDetail`, `colorGain`,
  `palette[]`, `weightScale`, `seed`.
