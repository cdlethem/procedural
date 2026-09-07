---
sketch: 2017/Generativos/erosion
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 280
animated: false
techniques: [noise-field]
primitives: [pixels]
palette:
  colors: ["#000000", "#808080", "#FFFFFF"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: det1, default: "random(0.01)", tried: ["random(0.003)"], change: moderate, effect: "lower base frequency = larger, more diffuse blobs"}
  - {name: det2, default: "random(0.06)", tried: ["random(0.02)"], change: subtle, effect: "coarser second octave = slightly less fine grain"}
  - {name: min, default: "random(0.3)", tried: ["random(0.1)"], change: none, effect: "no visible change for this seed"}
  - {name: max, default: "random(0.8, 1)", tried: ["random(0.5, 0.6)"], change: large, effect: "lower max = high contrast: white patches with dark veins"}
  - {name: lim, default: "random(0.08)*random(1)", tried: ["random(0.3)*random(1)"], change: none, effect: "no visible change for this seed"}
  - {name: val1, default: "random(0.7, 1)", tried: ["random(0.2, 0.4)"], change: large, effect: "lower first-octave amplitude = pale, low-contrast hazy gray field"}
reusable_candidates:
  - {name: twoOctaveGrayscaleField, signature: "field(w, h, det1, det2, amp1, amp2, gamma1, gamma2, min, max, lim, seed) -> PImage", note: "two-octave Perlin noise per pixel, pow-shaped, with extreme-value compression remap into gray"}
  - {name: downhillErosion, signature: "erode(PImage img, walks, maxSteps) -> PImage", note: "random-walk erosion: from a random pixel walk downhill in brightness (weighted by drop size), darkening each visited pixel by 1 (key 'e' only)"}
---

## What it draws
A full-bleed 960x960 grayscale cloud texture: soft, amorphous blobs of light gray,
mid gray, and a few dark-gray patches, with no sharp edges. It looks like a
blurred smoke or ink-in-water field. The image is static; nothing animates.
Despite the sketch name, the "erosion" pass is not visible in the headless
render (it only runs on key press 'e').

## How the code works
- `setup()` (erosion.pde:1-4) calls `generate()` once; `draw()` is empty, so the
  image is a one-shot pixel field (static).
- `generate()` (erosion.pde:22-44) randomises all parameters up front:
  - octave 1: `det1 = random(0.01)` (line 23), `val1 = random(0.7, 1)` amplitude (25), `pow1 = random(0.7, 1)` gamma (26);
  - octave 2: `det2 = random(0.06)` (27), `val2 = random(-0.3, 0.3)*random(1)` signed amplitude (29), `pow2` (30);
  - remap: `min = random(0.3)` (31), `max = random(0.8, 1)` (32), `lim = random(0.08)*random(1)` (33).
- Nested loop over every pixel (34-43): `val = pow(noise(i*det1+des1, j*det1+des1)*val1, pow1)` plus the
  signed second octave (37). Then a three-way remap: values below `min` are
  compressed into `[0, lim]` (38), above `max` into `[1-lim, 1]` (39), and the
  middle band `min..max` is stretched into `lim..1-lim` (40). This clamping is
  what kills the extremes and gives the flat, low-contrast mid-gray look.
  Finally `set(i, j, color(val*255))` (41) writes a grayscale pixel; offset
  `des1/des2 = random(100000)` decorrelates the two octaves.
- Randomness enters only via the seed-driven `random()`/`noise()` calls;
  deterministic per seed (baseline `deterministic: true`).
- `erosion()` (46-91) is NOT part of the rendered image: it is triggered by
  key 'e' (11). It performs 100000 random walks; at each pixel it finds darker
  neighbours in the 3x3 window, probabilistically steps toward the steepest
  drop, and darkens each visited pixel by 1 — a hand-made erosion that would
  carve valleys along the noise field.

## Experiments
| variant | substitution | change score | observation | image |
| det1_0.003 | `float det1 = random(0.01);` -> `float det1 = random(0.003);` | moderate | larger, more diffuse and spaced-out blobs; dark patches softer and more spread | variants/det1_0.003/frame_00001.png |
| det2_0.02 | `float det2 = random(0.06);` -> `float det2 = random(0.02);` | subtle | barely distinguishable; slightly less fine grain | variants/det2_0.02/frame_00001.png |
| min_0.1 | `float min = random(0.3);` -> `float min = random(0.1);` | none | no visible change | variants/min_0.1/frame_00001.png |
| max_0.55 | `float max = random(0.8, 1);` -> `float max = random(0.5, 0.6);` | large | high contrast: white patches separated by thin dark-gray veins | variants/max_0.55/frame_00001.png |
| lim_0.3 | `float lim = random(0.08)*random(1);` -> `float lim = random(0.3)*random(1);` | none | no visible change | variants/lim_0.3/frame_00001.png |
| val1_0.3 | `float val1 = random(0.7, 1);` -> `float val1 = random(0.2, 0.4);` | large | pale, low-contrast field: mostly light gray with only faint dark spots | variants/val1_0.3/frame_00001.png |

## Modularisation notes
- The `generate()` per-pixel loop is fully generic: a two-octave noise field
  with per-octave frequency, signed amplitude, gamma, and an extreme-compression
  remap. Clean parameter object: `{det1, det2, amp1, amp2, gamma1, gamma2,
  min, max, lim, seed}`.
- The remap (lines 38-40) is the interesting reusable piece: it maps
  `[0,min] -> [0,lim]`, `[min,max] -> [lim,1-lim]`, `[max,1] -> [1-lim,1]`,
  i.e. it tames both extremes with a single `lim`.
- `erosion()` is a self-contained image filter (downhill random walks with
  brightness decrement) and would be a clean library function, but it is an
  art decision specific to this piece and needs interaction to run here.
- One-off: the exact parameter ranges (0.01, 0.06, 0.3, 0.8, 0.08) are tuning
  for the cloudy look.
