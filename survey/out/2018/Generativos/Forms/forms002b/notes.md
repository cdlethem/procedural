---
sketch: 2018/Generativos/Forms/forms002b
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3553
animated: false
techniques: [noise-field, image-source, particles, distortion]
primitives: [image]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: det, default: "random(0.06,0.012)*0.8", tried: [3.2], effect: "higher multiplier = finer, smaller, more uniform clumps; baseline is soft large-scale clumps"}
  - {name: det2, default: "random(0.06,0.012)*0.2", tried: [1.0], effect: "higher multiplier = more even density, large voids vanish (mask frequency)"}
  - {name: count, default: 30000, tried: [60000], effect: "more candidates = denser field, voids fill in; first frame 3553ms -> 5648ms (O(n^2) rejection)"}
  - {name: size, default: 120, tried: [240], effect: "2x = bigger, busier slivers with more overlap"}
  - {name: alpha, default: 180, tried: [255], effect: "255 = opaque, brighter, more saturated, less soft overlap blending"}
  - {name: aspect, default: "s*8", tried: ["s*4"], effect: "s*4 = short stubby dashes, confetti-like instead of needle-like"}
reusable_candidates:
  - {name: rejectionScatter, signature: "rejectionScatter(n, w, h, radiusField(x,y), minDist) -> PVector[]", note: "random points kept only if further than a size-dependent distance from all accepted points (O(n^2) rejection loop, lines 50-64)"}
  - {name: noiseSizeField, signature: "noiseSizeField(seedOffset, detail, yBias, maskOffset, maskDetail) -> float", note: "two layered 2-D Perlin fields: one sets per-point size (lines 53-54), one modulates density"}
  - {name: tintedSliver, signature: "tintedSliver(img, x, y, w, h, tint, alpha) -> void", note: "random slice of a source strip, tinted and drawn stretched (w = s*0.4, h = s*8) with random rotation (lines 88-92)"}
---

## What it draws
On a black 960×960 canvas, thousands of tiny, thin slivers — elongated fragments of a
photographic source image — are scattered across the full frame at random angles. The
slivers are warm orange/red and cool blue-grey, semi-transparent, and clump together in
soft noise-driven patches; they are smaller and denser toward the top of the frame and
sparser and slightly larger toward the bottom, reading overall like a static field of
confetti or wood shavings.

## How the code works
- `loadForms()` (lines 13-25) loads `../forms.png` and slices it into `cc*2` = 32 tiles
  (16 per row), which become the visual "glyphs".
- `generate()` (lines 38-94) reseeds RNG (`randomSeed`/`noiseSeed`, lines 40-41), fills
  the background black, then draws a one-shot image; `draw()` is empty (line 27), so
  frames 1/10/60 are identical (`keyPressed` regenerates, line 30-36).
- Point placement (lines 49-64): 30000 random candidates. `y` is drawn from
  `height*pow(random(0,1),0.8)` (line 52). Each candidate's size `s` comes from a 2-D
  Perlin field `noise(des+x*det, des+y*det)*120*map(y,0,height,0.6,1)*md` (line 54),
  where `md` is a second, lower-frequency noise field acting as a density mask (line 53).
  A candidate is rejected if it lies within `(s+p.z)*0.01` of any already-accepted point
  (lines 56-62) — an O(n²) rejection loop that both thins the field and keeps large
  points apart.
- Rendering (lines 66-93): for every accepted point a random tile is picked
  (line 74), a tint is chosen by coin-flips among 4 colours (lines 79-86), each built as
  `lerpColor(rcol(), grey, amt)` from the 5-colour palette (line 100). The tile is
  tinted at alpha 180 (line 87), translated and randomly rotated (lines 88-92), and drawn
  stretched to `s*0.4` × `s*8` — the extreme aspect ratio is what turns image tiles into
  thin slivers.
- Randomness enters via: the point positions, the noise offsets `des`/`des2`
  (lines 45, 47), the noise detail scales `det`/`det2` (lines 46, 48), tile choice,
  tint choice, and rotation. The `random(0.06, 0.012)` calls use hi < lo, so the range
  is [0.012, 0.06).

## Experiments
| variant | substitution | observation | image |
|---|---|---|---|
| det_3.2 | `  float det = random(0.06, 0.012)*0.8;` -> `*3.2` | finer, more even grain; slivers smaller, large soft clumps broken up | variants/det_3.2/frame_00001.png |
| det2_1.0 | `  float det2 = random(0.06, 0.012)*0.2;` -> `*1.0` | denser, more uniform coverage; big voids gone, many small sparse pockets | variants/det2_1.0/frame_00001.png |
| size_240 | `    float s = noise(des+x*det, des+y*det)*120*map(y, 0, height, 0.6, 1)*md;` -> `*240*` | slivers ~2x larger: busier, more overlap, field reads thicker | variants/size_240/frame_00001.png |
| alpha_255 | `    tint(col, 180);` -> `tint(col, 255);` | opaque slivers: brighter, more saturated red, less soft blending | variants/alpha_255/frame_00001.png |
| aspect_4 | `    image(img, 0, 0, s*0.4, s*8);` -> `s*4` | half-length slivers: short stubby dashes, confetti-like | variants/aspect_4/frame_00001.png |
| count_60000 | `  for (int i = 0; i < 30000; i++) {` -> `60000` | denser field, voids mostly filled; same size distribution, ~1.6x slower | variants/count_60000/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `rejectionScatter` (size-aware Poisson-like thinning of random
  points), the two-field `noiseSizeField` (size field × density mask), and the
  `tintedSliver` stamp (tinted, stretched, rotated tile from a source strip). The
  O(n²) rejection loop is the main cost; a grid hash would make it usable at scale.
- One-off art decisions: the 5-colour palette and the grey-lerp tint recipe, the
  `s*0.4 × s*8` sliver aspect, alpha 180, the `pow(0.8)` y-bias, and the 32-tile source
  strip layout (depends on the external `../forms.png`).
- Clean parameter object: `{seed, canvasW, canvasH, sourceStrip, tileCount, candidateCount,
  sizeScale, sizeFieldDetail, maskDetail, yBias, minDistFactor, alpha, aspectW, aspectH,
  palette, tintGreyAmount}`.
