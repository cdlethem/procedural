---
sketch: 2018/Generativos/pelotas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1838
animated: false
techniques: [packing, polar, symmetry]
primitives: [ellipse, line, shape]
palette:
  colors: ["#F8C43D", "#023390", "#6AA6E2", "#F35076", "#F6F6F6"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: overlapFactor, default: 0.55, tried: [0.8], change: moderate, effect: "higher = denser packing, more circles per screen"}
  - {name: sizeMax, default: 260, tried: [120], change: moderate, effect: "no giant suns; field denser and more uniform in size"}
  - {name: spokesMax, default: 13, tried: [6], change: subtle, effect: "3-6 spokes per sun; many read as Y or cross shapes"}
  - {name: attempts, default: 1000000, tried: [200000], change: moderate, effect: "sparser field, more background visible"}
  - {name: spokeWeight, default: 0.2, tried: [0.35], change: moderate, effect: "thicker capsule spokes, chunkier suns"}
reusable_candidates:
  - {name: randomCirclePacking, signature: "randomCirclePacking(w, h, attempts, sizeRange, overlapFactor) -> PVector[]", note: "rejection sampling: try random circle, keep if dist < (s+sz)*overlapFactor vs all kept circles"}
  - {name: sunburst, signature: "sunburst(x, y, size, spokes, rotation, color, shadow) -> void", note: "central ellipse + N thick radial line segments (capsule spokes), drawn in shadow/colour/background layers"}
---

## What it draws
Full-bleed scatter of stylized suns on a coral-pink background. Each sun is a small
central disc (concentric rings) surrounded by 3–12 thick, rounded radial spokes
(capsule-shaped rays), in yellow, navy blue, light blue and white, ranging from
tiny to very large. Faint translucent discs sit under some suns, and a barely
visible colour wash covers the whole canvas.

## How the code works
- `setup()` (lines 4–12): 960×960 P2D, `smooth(8)`, `pixelDensity(2)` (unavailable on the
  harness display, so frames are 1×), then one `generate()` call. `draw()` (line 14) is
  empty, so the image is static; `keyPressed` regenerates with a new seed.
- Background: one random palette colour (line 27); with seed 42 it is the pink #F35076.
- Packing (lines 33–49): 1,000,000 attempts; each tries a random position and diameter
  `s` in [20, 260] (lines 34–36) and keeps it only if it does not overlap any kept circle
  by more than `(s+p.z)*0.55` (line 41) — a naive O(n²) random circle packing, so the
  canvas ends up with a few hundred non-overlapping circles of mixed sizes.
- Faint disc layer (lines 51–55): every circle is drawn by `arc2` (lines 106–124) as a
  half alpha 0 — a barely visible translucent halo behind each sun.
- Sun layer (lines 57–94): for each circle, a "sun" glyph in three stacked passes, all
  the same geometry: a central ellipse of diameter `ss*0.4` plus `cc` spokes, `cc`
  random in [3,13] (line 64), each a thick line (strokeWeight `ss*0.2`) from radius
  `ss*0.5` to `ss*0.9` at angles `da*j + a` with `a` a random rotation (lines 65–66,
  72–75, 80–84, 89–93). Pass 1 is a drop shadow offset by (+2,+2) in
  `lerpColor(back, color(20), 0.1)` (lines 70–75); pass 2 in a random palette colour
  that is not the background (lines 62–63, 78–84); pass 3 a thin inner ring in the
  background colour (lines 86–93), which makes the central disc read as a ring.
- Wash (lines 96–103): a full-canvas quad filled with a random palette colour at alpha 30,
  a very subtle tint over everything.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| overlap_0.8 | `if (dist(x, y, p.x, p.y) < (s+p.z)*0.55) {` -> `... *0.8) {` | moderate | denser packing: more circles per screen, more mid-sized suns | variants/overlap_0.8/frame_00001.png |
| sizeMax_120 | `float s = random(20, 260);` -> `random(20, 120);` | moderate | no giant suns; field denser and more uniform in size | variants/sizeMax_120/frame_00001.png |
| spokes_3_6 | `int cc = int(random(3, 13));` -> `random(3, 6);` | subtle | 3-6 spokes per sun; many read as Y or cross shapes | variants/spokes_3_6/frame_00001.png |
| attempts_200000 | `for (int i = 0; i < 1000000; i++) {` -> `i < 200000` | moderate | sparser field, more background visible | variants/attempts_200000/frame_00001.png |
| spokeWeight_0.35 | `strokeWeight(ss*0.2);` -> `ss*0.35);` | moderate | spokes visibly thicker, chunkier suns | variants/spokeWeight_0.35/frame_00001.png |

## Modularisation notes
- Generic: the packing loop (lines 33–49) is a standard rejection-sampled circle packing
  parameterised by attempts, size range and overlap factor — a clean library function
  `randomCirclePacking`. The sun glyph (central disc + N radial capsule spokes, optional
  shadow offset) is a reusable primitive `sunburst`; the alpha-30 full-screen quad is a
  trivial `tintWash`.
- One-off art decisions: the fixed 5-colour palette, the three-pass shadow/colour/inner-ring
  rendering, the alpha-20 halo discs, size range [20,260] and overlap factor 0.55.
- A clean parameter object: `{w, h, attempts, sizeMin, sizeMax, overlapFactor, spokes: [min, max],
  spokeWeight (fraction of size), palette, bg, washAlpha, shadowOffset}`.
