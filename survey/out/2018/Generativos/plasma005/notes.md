---
sketch: 2018/Generativos/plasma005
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 4143
animated: false
techniques: [grid, noise-field, particles, dots-stippling, packing]
primitives: [point, line, ellipse, arc]
palette:
  colors: ["#000F29", "#FE0706", "#F85E8D", "#3E56A8", "#090D0E", "#06A5FF"]
  selection: noise-driven
composition: scattered
parameters:
  - {name: blobSizeMax, default: 0.7, tried: [0.2], change: large, effect: "max blob radius as fraction of width (random(0.04, 0.7)); 0.2 removes the giant spheres, leaving only medium/small blobs"}
  - {name: pointsPerSphere, default: 8, tried: [2], change: moderate, effect: "the *8 multiplier on per-sphere point count (line 119); lower = sparser, pointier spheres with cleaner concentric banding"}
  - {name: spherePointAlpha, default: 140, tried: [255], change: none, effect: "max alpha of sphere points (random(140), line 131); 255 gave no visible change - points already read as solid"}
  - {name: packCandidates, default: 1000, tried: [300], change: large, effect: "candidate count in the packing loop (line 89); 300 = busier, more even field of medium/small blobs, more connecting lines, no giants"}
  - {name: blobSkipProb, default: 0.6, tried: [0.2], change: large, effect: "chance of skipping a packed point (line 109); 0.2 draws most points as blobs - denser, overlapping spheres"}
reusable_candidates:
  - {name: packSpheres, signature: "packSpheres(count, minSize, maxSize, canvas) -> PVector[]", note: "rejection-sample non-overlapping spheres snapped to a grid"}
  - {name: noiseSphere, signature: "noiseSphere(center, radius, count, detail, offset, amp) -> PVector[]", note: "point cloud on a noise-modulated sphere (spherical angles + 3-D Perlin radius)"}
  - {name: lerpPalette, signature: "lerpPalette(colors, v) -> color", note: "lerp between adjacent palette entries by a noise value"}
---

## What it draws
On a near-white field with a barely-visible 40px grid and faint grid-intersection dots,
several scattered "planet" blobs of different sizes. Each blob is a cloud of thousands of
small colored points arranged on a sphere, with a banded, cloudy internal texture: the
largest (top-right) shows concentric rings of green centre, yellow, red, blue and teal,
while smaller ones are solid green, blue or red. A few blobs have a small solid center dot
and one has a thin elliptical ring around it. Very faint thin lines and one curved arc
connect random pairs of blobs across the canvas.

## How the code works
`setup()` (line 13) calls `generate()` once; `draw()` (line 21) is empty, so the image is
static. A `PShader add` is declared (line 12) but both `loadShader` (line 44) and
`shader(add)` (line 87) are commented out, so the result is plain 2D point rendering, not
shader output (the `uses_shader: true` in result.json comes from the code scan only).

- Palette: `aux[]` (line 46) is 9 hex colors, hue-rotated in HSB by `hr = random(360)`
  (lines 49-56) then converted back to RGB. This is why the colors read as a shifted
  rainbow rather than the literal hex values.
- Background `background(252)` (line 61) gives the off-white field.
- Grid: two loops (lines 74-77 and 80-84) draw horizontal/vertical `line()`s every 40px at
  `stroke(0,4)` (alpha 4, nearly invisible) and `point()`s at every intersection at
  `stroke(0,30)`.
- Blob packing: `for i < 1000` (line 89) proposes random points snapped to the 40px grid
  (`x -= x%40`, lines 92-93) with size `s = width*random(0.04, 0.7)` (line 94). Rejection
  sampling keeps a point only if it does not overlap an already-kept one within
  `(s+p.z)*0.5` (line 98) — producing the scattered, non-overlapping planets.
- Per-blob skip: `if (random(1) < 0.6) continue` (line 109) drops 60% of the kept points,
  so only ~40% become visible blobs.
- Sphere: `cc = r*r*PI*random(0.4, 0.5)*8` points (line 119) are placed on a unit sphere via
  spherical angles `a1 in TAU`, `a2 in PI` (lines 122-127). The radius is modulated by 3-D
  Perlin `noise(desD + d*detD)` constrained to [0.5, 1] (line 128) and scaled by `amp` and
  `desSize`. Each point is drawn `stroke(col, random(140))` (line 131) at `p + d*r` (line
  132). The noise-driven radius (lines 127-129) plus noise-driven color
  `getColor(noise(desC + d*detC)...)` (line 130) produce the banded cloudy texture.
- Core dot: `fill(rcol(), random(200)); ellipse(p.x, p.y, r*0.1, r*0.1)` (lines 165-166) is
  the small solid center dot.
- Ring: 20% chance (line 150) draws 4000 points in a rotated elliptical spiral
  (lines 152-161) — the thin elliptical ring.
- Connections: `points.size()*random(0.3, 0.4)` iterations (line 169) pick random point
  pairs; 50% draw a thin `line()` (stroke alpha 256, line 173), otherwise a faint
  `arc()` (fill alpha 4, line 182) — the thin lines and curved arcs.

Color selection is mixed: `rcol()` is random-from-list, `getColor(float)` (lines 200-205)
lerps between adjacent palette entries by a noise value (noise-driven).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| maxsize_0.2 | `random(0.04, 0.7)` -> `random(0.04, 0.2)` | large | the two giant spheres are gone; all blobs capped at ~0.2 of width (medium blue top-right, red bottom-right, plus smaller ones) with more empty space | variants/maxsize_0.2/frame_00001.png |
| ptsper_2 | `...random(0.4, 0.5)*8;` -> `...random(0.4, 0.5)*2;` | moderate | spheres slightly sparser/pointier at the edges; top-right sphere shows cleaner concentric color bands; positions/sizes unchanged | variants/ptsper_2/frame_00001.png |
| pointalpha_255 | `stroke(col, random(140));` -> `stroke(col, random(255));` | none | no visible change | variants/pointalpha_255/frame_00001.png |
| count_300 | `for (int i = 0; i < 1000; i++)` -> `for (int i = 0; i < 300; i++)` | large | busier, more even field of many medium/small blobs with more connecting lines; the baseline's two giant spheres are absent | variants/count_300/frame_00001.png |
| skip_0.2 | `if (random(1) < 0.6) continue;` -> `if (random(1) < 0.2) continue;` | large | much denser: most packed points drawn as blobs, many overlapping spheres filling the frame | variants/skip_0.2/frame_00001.png |

## Modularisation notes
- Generic / library-worthy:
  - The rejection-sampled packing loop (lines 88-106) is a clean `packSpheres(count,
    minSize, maxSize, canvas)` that returns non-overlapping, grid-snapped spheres.
  - The sphere point-cloud (lines 121-134) is a reusable `noiseSphere(...)` — spherical
    angles + 3-D Perlin radius modulation + noise-driven color. Decoupling the color source
    (noise-driven vs random) makes it general.
  - `getColor(float)` (lines 200-205) is a small, reusable `lerpPalette(colors, v)`.
- One-off art decisions: the 40px background grid + intersection dots (lines 73-84), the
  60% per-blob skip (line 109), the 20% elliptical-ring branch (lines 150-163), the
  line/arc connector pass (lines 169-184), and the specific 9-color palette with a random
  full-hue rotation (lines 46-56).
- A clean parameter object would contain: `count` (candidate points), `sizeMin`,
  `sizeMax` (as fraction of width), `skipProb`, `pointsPerSphere` (the `*8` factor in
  line 119), `pointAlpha` (140), `sphereAmp` (0.4-1.2), `noiseDetail`/`noiseOffset`,
  `gridStep` (40), `connectFrac` (0.3-0.4), `palette`, and `hueRotation`.
