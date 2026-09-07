---
sketch: 2018/Generativos/dapo
year: 2018
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1919
animated: false
techniques: [noise-field, polar, distortion]
primitives: [shape]
palette:
  colors: ["#F6C9CC", "#119489", "#7AC3AB", "#F47AD4", "#6AC8EC", "#5BD5D4", "#1E4C5B", "#CF350A", "#F5A71C"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: circleCount, default: 150, tried: [60], change: large, effect: "sparser composition; large areas of dark slate background show through"}
  - {name: ringsPerDisc, default: 30, tried: [10], change: large, effect: "thicker, wider smooth gradient bands; less fine-segment detail"}
  - {name: darkBaseAlpha, default: 240, tried: [100], change: moderate, effect: "black ground becomes a translucent slate/teal tint; overlapping discs read as semi-transparent"}
  - {name: maxDistortion, default: 80, tried: [200], change: large, effect: "rings stretch and break into thin chaotic arcs; geometry badly mangled"}
  - {name: palette, default: "9-colour teal/pink/orange set", tried: ["3-colour white/black/orange"], change: large, effect: "same iridescent targets in orange/white/black on an orange background"}
reusable_candidates:
  - {name: noiseDistort, signature: "noiseDistort(x, y, angDetail, angSeed, distDetail, distSeed, maxDist) -> PVector", note: "simplex-noise angular + radial point displacement (desform, lines 98-102)"}
  - {name: segmentedRing, signature: "segmentedRing(x, y, r1, r2, segs, colorFn, distortFn) -> void", note: "ring built from quads between two radii, per-segment colour (aro, lines 124-155)"}
  - {name: paletteGradient, signature: "getColor(palette, t) -> color", note: "t wraps the palette, lerping between adjacent entries (lines 178-185)"}
---

## What it draws
Full-bleed canvas densely packed with overlapping concentric "discs" on a near-black ground:
each disc is a set of concentric rings made of tiny colour segments, reading like
iridescent targets or CD surfaces. Sizes range from huge (filling most of the canvas)
to pin-sized; colours are dominated by teal/cyan, orange and pink-magenta, with smooth
hue bands running around individual rings.

## How the code works
`setup()` (lines 6-11) calls `generate()` once; `draw()` is empty (13-14), so the piece is
static (confirmed: frames 10/60 identical to frame 1).

- `generate()` (24-69): background is one random palette colour (`rcol()`, line 26);
  random and noise are reseeded from `seed` (29-30). Loops 150 times (43): a random centre
  (44-45) and a size biased small, `width*random*random*random(0.5,1)` (46).
- For each centre: `fill(0, 240)` + `circle(x, y, s)` (48-50) paints a dark wobbly disc —
  the black ground each ring set sits on. `circle()` (104-122) samples the circumference,
  displaces every point with `desform()`, and fans triangles out to the displaced centre.
- Then 30 rings, `aro(x, y, s*s1, s*s2)` (62-66): `s1 = random(1-amp)`, `s2 = s1+random(amp)`
  (63-64) so inner and outer radii are random but close-ish, giving bands of varying width.
- `aro()` (124-155) builds each ring as `cc` quads between the inner and outer radius
  (`cc = max(8, max(r1,r2)*PI*random(0.8,2))`, line 127 — larger rings get more segments).
  Per-segment colour: 30% of the time a flat random palette colour (`rcol()`, 144); 70%
  (`rnd`, 134) a value `getColor(ic + dc*i)` (145) where `dc = (1..2)/cc` (137) — i.e. the
  colour walks the palette 1-2 full turns around the ring, lerping between adjacent palette
  entries (178-185). That is what makes the smooth hue bands.
- `desform()` (98-102) is the distortion: angle from simplex noise `*TAU*2`, radial offset
  `*80` — every ring vertex is pushed along a noisy direction by up to 80 px, which is why
  rings wobble organically instead of being perfect circles.
- Palette: 9 colours (167); `rcol()` (172-174) picks a random entry.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_60 | `for (int i = 0; i < 150; i++)` -> `for (int i = 0; i < 60; i++)` | large (mean 0.311, 83.2% of pixels) | about half as many discs; big flat dark-slate areas of background between them; each remaining disc unchanged in style | variants/count_60/frame_00001.png |
| rings_10 | `for (int j = 0; j < 30; j++)` -> `for (int j = 0; j < 10; j++)` | large (mean 0.3278, 75.7% of pixels) | discs read as thick, wide smooth gradient bands (orange/teal/pink) with far less fine-segment texture; bolder target look | variants/rings_10/frame_00001.png |
| darkAlpha_100 | `fill(0, 240);` -> `fill(0, 100);` | moderate (mean 0.0983, 39.6% of pixels) | geometry identical; the near-black ground becomes a dark slate/teal tint and overlapping discs look translucent, slightly lowering contrast | variants/darkAlpha_100/frame_00001.png |
| warp_200 | `desDes+y*detDes)*80;` -> `desDes+y*detDes)*200;` | large (mean 0.3102, 81.7% of pixels) | rings stretch and break into thin chaotic arcs and slivers; disc structure mostly dissolves into a web of warped lines on black | variants/warp_200/frame_00001.png |
| palette_bw | `int colors[] = {#F6C9CC, ...9 colours...};` -> `int colors[] = {#FFFFFF, #000000, #FF5500};` | large (mean 0.1957, 60.4% of pixels) | same iridescent target structure but only orange/white/black; bold graphic look; background (random palette pick) came out orange | variants/palette_bw/frame_00001.png |

## Modularisation notes
- Generic: `desform()` (noise displacement field) and `aro()` (segmented ring with a colour
  function) are self-contained; `circle()` is a one-off dark-disc base. `getColor` is a
  reusable palette-gradient sampler.
- One-off art decisions: the 9-colour palette, 150 circles / 30 rings counts, size biasing
  `random*random*random(0.5,1)`, the 70/30 split between flat-random and gradient colours,
  and the 80 px max distortion.
- A clean parameter object would hold: `count`, `ringsPerDisc`, `sizeBias` (exponent),
  `darkBaseAlpha`, `maxDistortion`, `noiseDetail`, `palette`, `flatColorProb`, and the
  `rcol`/`getColor` colour strategy.
