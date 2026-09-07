---
sketch: 2017/Generativos/acid
year: 2017
renderer: P3D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 3571
animated: false
techniques: [noise-field, distortion, pixel-ops]
primitives: [pixels]
palette:
  colors: ["#000000", "#FFFFFF", "#FF7700", "#15FF4A", "#BBBBFF"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: amp, default: "random(800)*random(1)", tried: ["random(200)*random(1)"], change: large, effect: "lower warp amplitude: larger, smoother blobs; fine crack detail mostly gone"}
  - {name: det2, default: "random(0.01)*random(1)", tried: ["random(0.002)*random(1)"], change: large, effect: "lower direction-field frequency: long coherent diagonal streaks instead of rounded billows"}
  - {name: dc, default: "random(4,20)*random(1)", tried: ["random(4,8)*random(1)"], change: large, effect: "fewer palette cycles: fewer, wider colour fields with contour-like transition bands"}
  - {name: octaves, default: 7, tried: [2], change: large, effect: "smoother FBM: blurry low-frequency blobs, fine crack detail lost"}
  - {name: angTurns, default: 2, tried: [6], change: large, effect: "faster-rotating direction field: tighter, finer, more chaotic curls and rings"}
reusable_candidates:
  - {name: fbm, signature: "fbm(x, y) -> float", note: "7-octave 2-D FBM, each octave |noise-0.5|*2 with frequency x2 and amplitude /2"}
  - {name: domainWarp, signature: "domainWarp(w, h, detAngle, detMag, amp) -> [x, y][w*h]", note: "per-pixel displacement: direction = fbm(i*detAngle, j*detAngle)*2*PI*2, magnitude = fbm(i*detMag, j*detMag)*amp"}
  - {name: paletteLerp, signature: "paletteLerp(palette[], v) -> color", note: "index = floor(v) % len, lerp to next palette entry with frac(v); palette pre-shuffled"}
---

## What it draws
A full-bleed, ink-in-water style texture at 960×960. Large smoky billows of vivid orange and
neon green float on a black ground, ringed by thin orange crack-like rims; pale white and
lavender-grey cloud masses sit in the top-left and right edges. Everything is soft-edged and
organic, with no discrete shapes — it reads like acid dye diffusing in liquid.

## How the code works
Single tab, static (draw() is empty; setup() calls generate() once).
- `setup()` (L3-8): 960×960 P3D, smooth(8), pixelDensity(2), then `generate()`.
- `generate()` (L28-52):
  - Fisher–Yates shuffles the `colors` palette with an **unseeded** `java.util.Random` (L86-104) — this is why `deterministic: false`; palette order differs every run even with the same seed.
  - Background is one random palette entry (L32).
  - Three random noise frequencies `det1..det3 = random(0.01)*random(1)` (L34-36), displacement amplitude `amp = random(800)*random(1)` (L38), colour-domain scale `dc = random(4,20)*random(1)` (L39).
  - Per-pixel double loop (L42-51): `ang = fbm(i*det2, j*det2)*2*PI*2` gives a direction field, `des = fbm(i*det3, j*det3)*amp` a magnitude field; the pixel's sample point is displaced to `(i+cos(ang)*des, j+sin(ang)*des)` — a classic **domain warp**. The colour is `getColor(fbm(xx*det1, yy*det1)*colors.length*dc)`.
  - `fbm` (L54-67): 7 octaves of 2-D Perlin noise, rectified `abs((noise-0.5)*2)`, frequency doubling, amplitude halving — always in [0, ~1), biased toward low values, which is why black (a low-value palette slot) dominates.
  - `getColor` (L76-82): wraps the warped noise value modulo palette length and **lerps between two adjacent (shuffled) palette entries**, so colours blend smoothly instead of banding.
- Visible mapping: the direction/magnitude warp folds the colour field into billows and crack rims (orange rings trace the mid-values of the colour FBM); the rectified low-biased FBM keeps large black regions.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| amp_200 | `float amp = random(800)*random(1);` -> `...random(200)...` | large (mean 0.3331, 0.835) | large, very smooth billows of orange and green on black; warp folds at a bigger scale, fine crack texture mostly lost (layout differs anyway: palette order is re-shuffled unseeded every run) | variants/amp_200/frame_00001.png |
| det2_0.002 | `float det2 = random(0.01)*random(1);` -> `...random(0.002)...` | large (mean 0.3857, 0.871) | direction varies slowly: colours smear into long, coherent diagonal streaks (orange/lavender/green bands crossing the frame) instead of rounded billows | variants/det2_0.002/frame_00001.png |
| dc_8 | `float dc = random(4, 20)*random(1);` -> `...random(4, 8)...` | large (mean 0.3872, 0.938) | noise spans fewer palette cycles: fewer, wider flat colour fields (orange, green, lavender) separated by long contour-like transition bands, with big black holes | variants/dc_8/frame_00001.png |
| octaves_2 | `for (float i= 1.; i < 8.; i++)` -> `...i < 3...` | large (mean 0.3013, 0.719) | much smoother/blurrier image: low-frequency soft blobs, broad gentle transitions; the fine crack/rim texture of the baseline is gone | variants/octaves_2/frame_00001.png |
| angTurns_6 | `float ang = fbm(i*det2, j*det2)*TWO_PI*2;` -> `...TWO_PI*6;` | large (mean 0.5011, 0.923) | direction field rotates 3x faster: tight, small, chaotic curls and concentric rings; the whole texture is noticeably finer and busier | variants/angTurns_6/frame_00001.png |

Note: `deterministic: false` — the Fisher–Yates shuffle uses an unseeded `java.util.Random`, so
palette order (and therefore exact layout and which colour lands where) differs between every run,
baseline included. The scores above are large in part for that reason; the observations compare
structure (scale, streaks, band count, curl tightness), not layout.

## Modularisation notes
- **Generic**: `fbm` (octave count could be a parameter), the domain-warp displacement
  (direction field + magnitude field, both FBM — separable from the colour step), and
  `paletteLerp` (shuffle + adjacent-entry lerp by noise value). Together these form a
  reusable "warped noise field" generator: `render(w, h, {detAngle, detMag, detColor, amp, dc, palette, octaves})`.
- **One-off art decisions**: the specific 8-entry palette (4 of 8 slots are black, which biases
  the image dark), the rectification in fbm (abs), the 2π×2 turn multiplier on the angle, and
  the unseeded shuffle (non-deterministic by design).
- Clean parameter object: `{detAngle, detMag, detColor, amp, dc, octaves, palette[], seed}` —
  note `amp` interacts with image scale (displacement is in pixels), and `dc` sets how many
  palette cycles the noise value spans.
