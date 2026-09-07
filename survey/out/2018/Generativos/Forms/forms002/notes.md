---
sketch: 2018/Generativos/Forms/forms002
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2754
animated: false
techniques: [noise-field, image-source, particles, distortion]
primitives: [image]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: count, default: 3000, tried: [1500, 6000], effect: "fewer = sparser field with more black ground (coverage 69% vs 86%); more = denser weave. Side effect: count also shifts the tint palette, because c1-c4 are drawn from the random stream after the placement loop"}
  - {name: det (noise scale), default: "random(0.06, 0.012)*0.8", tried: ["random(0.06, 0.012)*0.3"], effect: "lower = coarser noise field, larger smoother size variation, full-bleed soft columns"}
  - {name: stretchY, default: "s*8", tried: ["s*2"], effect: "4x shorter strips: dashed/dabbed texture instead of flowing, coverage drops 86% -> 48%, much more black ground"}
  - {name: tintAlpha, default: 180, tried: [90], effect: "half opacity: darker overall, strips read thinner, more black ground showing between them, same palette"}
reusable_candidates:
  - {name: imageStripScatter, signature: "imageStripScatter(stripTiles[], count, noiseScale, stretch) -> void", note: "scatter tall tinted image strips, size from 2-D noise, y-biased placement"}
---

## What it draws
A full-bleed field of hundreds of thin, vertically stretched brush-like strips on a black ground. The strips are
translucent and overlap heavily, reading as a dense vertical weave of orange, warm grey, off-white and dark
strokes. The strips are bigger and more saturated toward the bottom, thinner and sparser-looking toward the
top, giving the whole image a curtain-like, top-down flow.

## How the code works
- `setup()` (L3-11): P2D canvas 960×960, then `loadForms()` and a single `generate()` call; `draw()` (L27) is
  empty, so the sketch is static — all three baseline frames are byte-identical.
- `loadForms()` (L13-25): loads `../forms.png` and cuts it into a 16×2 grid of 32 tile `PImage`s — the raw
  brush-stroke material (`image-source`).
- `generate()` (L38-91):
  - L40-41 re-seed random/noise; L43 black background.
  - L45-46: `des` is a large random noise offset; `det` a small noise scale (~0.01–0.06 × 0.8).
  - L48-61: loop 3000 times, placing a point at random x and at `y = height * random(0,1)^0.7` (L50) which
    biases y toward the bottom. Each size `s` is `noise(des+x*det, des+y*det) * 120 * map(y, 0, height,
    0.6, 1)` (L51) — 2-D Perlin noise sets the size field, and the `map` term makes strips ~1.67× bigger at
    the bottom edge (the size gradient). The collision check at L53-59 is disabled (`< (s+p.z)*0.0`), so all
    3000 points are kept.
  - L64-68: `noiseDetail(2)`; four tint colours are built by `lerpColor(rcol(), random gray, random(1))` —
    each is a blend of a random palette entry (L97: `#FF3D20 #FC9D43 #3998C2 #3E56A8 #090D0E`) with a random
    grey, which explains the desaturated oranges/greys/whites against the pure palette.
  - L69-90: for every point, pick a random tile (L71), pick one of the four tints via nested coin flips
    (L76-83, note c4 is picked twice so c3 is never used), `tint(col, 180)` for ~70% opacity, and draw the
    tile as `image(img, 0, 0, s*0.4, s*8)` (L88) — width `s*0.4`, height `s*8`, i.e. a 20:1 vertical stretch
    that turns square tiles into the tall strips. No rotation (commented out, L87).
- Randomness enters at: point positions (L49-50), sizes (L51, noise + seed), tile choice (L71), and tint
  choice (L77-82). Determinism comes from the harness injecting `seed := 42` and L40-41.
- Coupling trap: c1-c4 (L65-68) are sampled from the same random stream that the placement loop consumes,
  so changing the point count also changes the palette. This is confirmed by the experiments: count_1500
  and count_6000 land on different tint sets (redder; blue+tan) while det/stretch/alpha variants keep the
  baseline palette exactly.

## Experiments
| variant | substitution | observation | image |
|---|---|---|---|
| count_1500 | `for (int i = 0; i < 3000; i++) {` -> `... i < 1500 ...` | sparser field, more black ground (coverage 69% vs 86%); tint state shifted redder (count feeds the stream that draws the tints) | variants/count_1500/frame_00001.png |
| count_6000 | `for (int i = 0; i < 3000; i++) {` -> `... i < 6000 ...` | denser, busier weave (coverage 86%, most covered of all); tint state shifted to blue + tan | variants/count_6000/frame_00001.png |
| det_0.3 | `float det = random(0.06, 0.012)*0.8;` -> `...*0.3;` | coarser noise: larger, smoother size variation, full-bleed soft columns; same palette as baseline | variants/det_0.3/frame_00001.png |
| stretch_2 | `image(img, 0, 0, s*0.4, s*8);` -> `..., s*2);` | strips 4x shorter: dashed/dabbed texture, coverage 86% -> 48% (lowest), lots of black showing; same palette | variants/stretch_2/frame_00001.png |
| alpha_90 | `tint(col, 180);` -> `tint(col, 90);` | half opacity: darker, strips read thinner, more black ground; same palette | variants/alpha_90/frame_00001.png |

## Modularisation notes
- Generic: the noise-sized scatter loop (L48-61) is a reusable "noise-field particle placement" with
  disabled collision; the `map(y, 0, height, 0.6, 1)` size gradient is a nice one-line vertical ramp.
- One-off art decisions: the 20:1 vertical stretch (`s*0.4, s*8`), the grey-lerped tints, the disabled
  collision check (left in as dead code), the `y^0.7` bottom bias, and the dead `c3`/`getColor` helpers.
- A clean parameter object: `{count, noiseScale (det), noiseOffset (des), sizeMultiplier (120),
  sizeRamp (0.6→1), stretchX (0.4), stretchY (8), yBiasExp (0.7), tintAlpha (180), tiles}`.
