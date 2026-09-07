---
sketch: 2020/generative/01_04/perlinas
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 7597
animated: false
techniques: [noise-field, dots-stippling, packing]
primitives: [point]
palette:
  colors: ["#000000", "#0E1C00", "#6D9100", "#D61406", "#E2A218"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: detSize, default: "random(0.04)", tried: [0.01], change: large, effect: "sparser field of smaller, more separated blobs; more red background visible"}
  - {name: detAmp, default: "random(0.03)", tried: [0.005], change: large, effect: "much denser; low-frequency amp layer forms large regions of big blobs (gold/olive cloud top-left)"}
  - {name: attempts, default: 1400, tried: [400], change: moderate, effect: "fewer, smaller blobs; large clusters disappear, more red shows through"}
  - {name: sizeScale, default: 9, tried: [3], change: large, effect: "blobs ~3x smaller and more uniform; canvas looks sparser, mostly small specks"}
  - {name: alpha, default: "random(random(100),180)", tried: [30], change: large, effect: "blobs very faint and washed out; red background dominates, dots barely visible"}
  - {name: palette, default: "black/green/olive/red/yellow", tried: [blue], change: large, effect: "same structure, new ground colour (light cyan) with navy/steel-blue/grey/white blobs"}
reusable_candidates:
  - {name: stippledDisc, signature: "stippledDisc(x, y, r, baseColor, addProb, alphaRange) -> void", note: "draw a fuzzy disc as r^2-scaled number of point() calls with random alpha and occasional ADD blending"}
  - {name: noiseSizeField, signature: "noiseSizeField(x, y, freq, ampFreq) -> float", note: "two-layer noise (simplex * pow of perlin) shaping point size, produces size clustering"}
  - {name: poissonScatter, signature: "poissonScatter(count, width, height, sizeOf) -> PVector[]", note: "rejection-based non-overlapping random scatter with per-point radius"}
---

## What it draws
A full-bleed vivid red field (seed 42 background) covered in soft, fuzzy circular blobs of
densely packed fine dots. Blobs range from tiny specks to large ~200px clouds, in muted
white-grey, olive green, dark brown/black, gold, and dusty pink tones. Larger blobs cluster
into loose groups across the canvas while smaller ones scatter between them; edges of every
blob are grainy and fade into the background. No outlines, no text.

## How the code works
- `setup()` (line 21) calls `generate()` once; `draw()` is empty, so the piece is static.
- `generate()` (line 44): `randomSeed`/`noiseSeed` from the seed field (lines 48-49).
  Background is one random palette entry via `rcol()` (line 53) — at seed 42 it lands on
  `#D61406` (red), which is why the field is red.
- 1400 candidate points (line 58), each at a random (x, y) (lines 59-60).
- Point size is modulated by a **noise field**: `SimplexNoise.noise(x*detSize, y*detSize)`
  (line 61) shaped by `pow(ns, 1.8)+0.2` (line 62), multiplied by a second layer
  `pow(noise(x*detAmp, y*detAmp), 0.8)*4` (line 63). The two noise layers at different
  frequencies make size vary smoothly in space, so nearby blobs tend to be similar size —
  the loose clusters seen in the image. The base size is then multiplied by a random
  integer (line 64).
- **Packing / rejection**: a candidate is kept only if its circle (half-sum of radii) does
  not overlap any accepted point (lines 68-74), giving a Poisson-disc-like scatter that
  keeps blobs from fully merging.
- Each accepted point becomes a **stippled disc**: `cc = int(r*r*PI)` iterations (line 84),
  `lerpColor(white, palette(desCol+sqrt(s)), random)` (line 81) then lerped toward black
  (line 82) — larger blobs (bigger `s`) pull more saturated palette colours, smaller ones
  go dark. Each `point()` is drawn at `x + cos/sin(ang)*dis` with random alpha
  (lines 88-92), giving the fuzzy, grainy edges.
- Palette is a 5-entry table (line 110); `getColor(float)` (lines 117-123) lerps between
  adjacent entries, so blob colours are blends of black, dark green, olive, red, yellow —
  matching the muted gold/olive/brown/pink tones seen over the red ground.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| detSize_0.01 | `float detSize = random(0.04);` -> `float detSize = 0.01;` | large | sparser: smaller, more separated blobs, more red background visible | variants/detSize_0.01/frame_00001.png |
| detAmp_0.005 | `float detAmp = random(0.03);` -> `float detAmp = 0.005;` | large | much denser overall; low-frequency amp layer makes large size regions (big gold/olive cloud top-left), blobs overlap into merged masses | variants/detAmp_0.005/frame_00001.png |
| count_400 | `for (int i = 0; i < 1400; i++) {` -> `... i < 400; i++) {` | moderate | sparser: fewer and smaller blobs, the large baseline clusters are gone, red shows through everywhere | variants/count_400/frame_00001.png |
| sizeScale_3 | `float s = ns*9*int(...)` -> `float s = ns*3*int(...)` | large | all blobs ~3x smaller and more uniform in size; dense fine speckle, few medium clusters, more red visible | variants/sizeScale_3/frame_00001.png |
| alpha_30 | `stroke(..., random(random(100), 180));` -> `stroke(..., random(30));` | large | blobs very faint and washed out; red background dominates, only ghostly dot clusters remain | variants/alpha_30/frame_00001.png |
| palette_blue | `int colors[] = {#000000, #0E1C00, #6D9100, #D61406, #E2A218};` -> `int colors[] = {#0B1026, #1B3B6F, #3E7CB1, #86C5DA, #E0FBFC};` | large | identical structure; ground becomes light cyan (same palette slot), blobs are navy, steel blue, grey and white | variants/palette_blue/frame_00001.png |

## Modularisation notes
- **Generic / library candidates**: the stippled-disc painter (area-scaled point count,
  ADD-blend probability, alpha jitter), the two-layer noise size field, and the rejection
  scatter — each is independent of the art decisions and matches the signatures above.
- **One-off art decisions**: the specific 5-colour palette (line 110), using the same
  palette for the background (line 53), the `pow` exponents (1.8 / 0.8) and the `*9` size
  scale, the 1400-attempt count, the 20% ADD probability.
- **Clean parameter object**: `{width, height, seed, attempts, sizeScale, simplexFreq
  (detSize), perlinFreq (detAmp), palette[], bgFromPalette: bool, addProb, alphaMin,
  alphaMax, overlap: bool}`.
