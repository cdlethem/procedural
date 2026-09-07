---
sketch: 2018/Generativos/poda
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1969
animated: false
techniques: [noise-field, distortion, polar]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#000000"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: blobCount, default: 150, tried: [40], change: large, effect: "fewer separate swirl islands, large black gaps between them"}
  - {name: ringsPerBlob, default: 30, tried: [8], change: large, effect: "coarser, wider ribbon bands; fine ribbed texture lost"}
  - {name: displaceScale, default: 120, tried: [30], change: large, effect: "vortices vanish; rings stay near-concentric with gentle wobble"}
  - {name: noiseFreq, default: "random(0.002,0.01)*0.2", tried: ["random(0.002,0.01)"], change: large, effect: "5x frequency: tighter, sharper, smaller-scale folds, more chaotic"}
  - {name: blobSize, default: "width*r*r*random(0.5,1)", tried: ["width*random(0.5,1)"], change: large, effect: "a few huge tangled ball-like systems dominate; gaps between"}
  - {name: coreAlpha, default: 240, tried: [120], change: moderate, effect: "semi-transparent core discs; rings show through centers, more gray midtone"}
reusable_candidates:
  - {name: desform, signature: "desform(x, y, desAng, detAng, desDes, detDes, maxOffset) -> PVector", note: "simplex-noise-driven displacement: direction = noise*TAU*8, magnitude = noise*maxOffset"}
  - {name: aro, signature: "aro(x, y, r1, r2, desform) -> void", note: "noise-warped annulus drawn as quads between two radii"}
  - {name: warpedCircle, signature: "circle(x, y, r, desform) -> void", note: "noise-warped filled disk as triangles from displaced center to rim"}
---

## What it draws
A full-bleed monochrome field of liquid, chrome-like swirls. Dozens of concentric ring systems overlap across the whole 960x960 canvas; every ring is warped by a smooth noise field into ribbons that curl into vortices, with strong black-and-white contrast and thin bright edges. The overall read is molten metal or topographic contours being stirred.

## How the code works
Static one-shot: `setup()` calls `generate()` (poda.pde:10), `draw()` is empty (13-14).
- `generate()` (24-68): background is a random palette color (effectively black or white, line 26/170-173); then 150 iterations, each picking a random center (44-45) and a size biased small: `width*random(1)*random(1)*random(0.5,1)` (46).
- Per blob: a warped filled core disk — black fill alpha 240 with a faint white stroke (48-50, `circle()` 103-121) — then 30 annuli via `aro()` (61-65). Each annulus picks an inner radius `s1` and outer `s2 = s1 + random(amp)` where `amp` is a small random band width (60-63), so rings stack outward with irregular gaps.
- `aro()` (123-154) builds the ring as `cc` quads between the two radii; each corner is displaced by `desform()` (139-142). Fill is per-quad: 70% of rings use an angularly varying color `getColor(ic + dc*i)` that lerps through the palette around the ring (133-144), the rest use a flat random palette color.
- Palette (line 170) is 10 slots: 3 white, 7 black; `rcol()` picks uniformly (171-173), so the image is near-pure black/white with occasional gray from lerp in `getColor` (177-183) and alpha blending (P2D).
- Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)` (29-30); the seed field is `seed`, set by the harness. Deterministic per seed.
- The `triangulate` import is unused; `SimplexNoise` (toxi) is the only active dependency.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| blobs_40 | `for (int i = 0; i < 150; i++)` -> `for (int i = 0; i < 40; i++)` | large | far fewer blobs; each swirl system reads as a separate island with big flat black background gaps | variants/blobs_40/frame_00001.png |
| rings_8 | `for (int j = 0; j < 30; j++)` -> `for (int j = 0; j < 8; j++)` | large | coarser stack: fewer, wider ribbon bands, larger smooth black regions, chunkier arcs; the baseline's fine ribbed texture is gone | variants/rings_8/frame_00001.png |
| disp_30 | `...noise(desDes+x*detDes, desDes+y*detDes)*120;` -> `... *30;` | large | the big vortices disappear; rings stay roughly concentric with only gentle wobble; looks like nested wavy contours, much calmer | variants/disp_30/frame_00001.png |
| freq_5x | `detAng = random(0.002, 0.01)*0.2;` -> `detAng = random(0.002, 0.01);` | large | tighter, higher-frequency distortion: ribbons twist into short sharp folds, busier small-scale chaos, less of the large smooth swirls | variants/freq_5x/frame_00001.png |
| size_big | `float s = width*random(1)*random(1)*random(0.5, 1);` -> `float s = width*random(0.5, 1);` | large | blobs much larger: a few huge tangled ball-like swirl systems dominate the canvas with black gaps between, instead of a uniform full-bleed field | variants/size_big/frame_00001.png |
| corealpha_120 | `fill(0, 240);` -> `fill(0, 120);` | moderate | composition essentially unchanged (same seeds/rings) but core discs are semi-transparent, so stacked rings show through the centers; centers look busier and the image gains gray midtones | variants/corealpha_120/frame_00001.png |

## Modularisation notes
- `desform()` is the reusable core: a parameterised 2D displacement field (direction noise + magnitude noise, `maxOffset` scale). Worth extracting as a library `noiseDisplace(x, y, freq, maxOffset, seed)` or a `DisplaceField` object.
- `aro()` (warped annulus) and `circle()` (warped disk) are generic given a displacement function — good candidates as `warpedRing(center, r1, r2, segments, displace, fillFn)` and `warpedDisk(center, r, segments, displace, fill)`.
- One-off art decisions: the 150-blob scatter with `r*r*random(0.5,1)` size bias, the 30-annulus stack with random band width `amp`, the 70%/30% per-quad color mode, and the black/white palette.
- Clean parameter object: `{ count, ringsPerBlob, sizeBias, ampRange, displaceFreq, displaceMaxOffset, palette, coreAlpha, angularColorChance }`.
