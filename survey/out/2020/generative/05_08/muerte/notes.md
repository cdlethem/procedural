---
sketch: 2020/generative/05_08/muerte
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 4037
animated: false
techniques: [dots-stippling, blend-modes]
primitives: [ellipse, point]
palette:
  colors: ["#2e2a14", "#5d6643", "#f2c4d1", "#e4e1e6", "#2934cc"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: blobCount, default: 47, tried: [70], change: moderate, effect: "more blobs -> denser, flatter haze; dark corners fill in, colour patches become uniform fog"}
  - {name: blobSizeMax, default: 30, tried: [60], change: large, effect: "2x blob radius -> ~4x dot count; whole canvas covered in bright uniform haze, center bias and dark edges lost"}
  - {name: ellAlpha, default: 8, tried: [16], change: moderate, effect: "double ellipse underlay alpha -> periwinkle tint over the whole field, structure unchanged"}
  - {name: addProb, default: 0.1, tried: [0.3], change: subtle, effect: "slight overall brightening, no structural change"}
  - {name: palette, default: "#2e2a14,#5d6643,#f2c4d1,#e4e1e6,#2934cc", tried: ["#7D7FD8,#F7AA06,#EA79B7,#FF0739,#12315E"], change: moderate, effect: "same texture, warm palette: orange/red/pink patches on navy"}
reusable_candidates:
  - {name: scatterDots, signature: "scatterDots(cx, cy, radius, count, color, alpha, addProb) -> void", note: "stippled dot cloud around a center, radius ~ sqrt(random) for density falloff, optional ADD-blend glints"}
  - {name: biasedCenter, signature: "biasedCenter(width, height, pull) -> [x, y]", note: "random point lerped toward canvas center by random(pull)"}
---

## What it draws
A dark, cosmic-dust field on a black background: a fine uniform grain of tiny dots
covers the whole canvas, broken up by soft hazy patches of color — saturated blue,
pale pink, and near-white cream — that cluster toward the center of the image. A few
bright, overexposed glints (white/blue hotspots) stand out where dots overlap, and
the edges fall off to near-black. It reads like a nebula or star field rendered as
stippling.

## How the code works
`generate()` (muerte.pde:40-71) is the only drawing path; `draw()` is empty so the
piece is static (confirmed: baseline frames 10/60 identical to frame 1).

- Seeded with `noiseSeed`/`randomSeed` from `int seed` (line 4); the harness overrides
  it to 42.
- `background(0)` (line 44): the black field.
- Outer loop (lines 46-70): 47 blob centers. Each center is a random point lerped
  toward the canvas center by `random(0.3)` (lines 49-50) — this is what pulls the
  color patches toward the middle and leaves the corners darker.
- Each blob draws three concentric ellipses at alpha 8 (lines 55-58) — barely visible
  soft underlays that widen the haze.
- Per-blop dot loop (lines 59-69): `s*s*0.3` points (tens of thousands per blob,
  millions total). Each point is placed at angle `random(TAU)` and distance
  `sqrt(random(1))*s*random(random(0.1),1)` (line 61) — sqrt gives a roughly
  uniform disc density that thins toward the rim. Color is one random entry of the
  5-color palette (line 53, `rcol()` line 89), drawn at stroke alpha `random(60,90)`
  (line 62) — the dense overlapping translucent dots are what produce the grain.
- 10% of points are drawn a second time with `blendMode(ADD)` (lines 64-68) — these
  are the bright overexposed glints.
- Palette (line 85): dark olive, sage green, pale pink, off-white, saturated blue;
  many alternative palettes are commented out above it (lines 78-88).
- The toxi/triangulate imports (lines 1-2) are unused in the code.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_70 | `for (int i = 0; i < 47; i++) {` -> `for (int i = 0; i < 70; i++) {` | moderate | denser, flatter haze; dark corners fill in, colour patches read as a uniform grey-green fog | variants/count_70/frame_00001.png |
| size_60 | `s *= random(30);` -> `s *= random(60);` | large | entire canvas covered in bright uniform periwinkle haze; center bias and dark edges lost | variants/size_60/frame_00001.png |
| ellalpha_16 | `fill(col, 8);` -> `fill(col, 16);` | moderate | periwinkle/blue tint over the whole field; composition and grain unchanged | variants/ellalpha_16/frame_00001.png |
| addp_0.3 | `if (random(1) < 0.1) {` -> `if (random(1) < 0.3) {` | subtle | slight overall brightening; no structural change | variants/addp_0.3/frame_00001.png |
| palette_warm | `int colors[] = {#2e2a14, #5d6643, #f2c4d1, #e4e1e6, #2934cc};` -> `{#7D7FD8, #F7AA06, #EA79B7, #FF0739, #12315E}` | moderate | same stipple texture in warm palette: orange/red/pink patches on deep navy, cream glints | variants/palette_warm/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: the dot-cloud scatter (center + sqrt-falloff radius +
  per-point alpha + optional ADD glint) and the center-biasing of random points. Both
  are parameter-free of this sketch's art decisions except palette/counts.
- One-off art decisions: the 3-layer concentric-ellipse underlay at alpha 8, the
  specific 5-color palette, the 0.1 ADD probability, the `s*s*0.3` density law (count
  scales with area — expensive; a density-per-area constant would be cleaner).
- A clean parameter object: `{centerBias, blobCount, blobSizeMax, dotDensity,
  dotAlpha, addProb, palette, ellAlpha}`.
