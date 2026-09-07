---
sketch: 2018/Generativos/cnotc
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1750
animated: false
techniques: [noise-field, packing, dots-stippling]
primitives: [ellipse, line, shape]
palette:
  colors: ["#313CCB", "#4E99ED", "#27B360", "#FF603A", "#FFDE55", "#FF9EE3", "#FBFBFB", "#000000"]
  selection: random-from-list
composition: scattered
parameters:
  - {name: cc, default: 200000, tried: [50000], change: moderate, effect: "fewer candidate points -> sparser field, fewer circles, fewer/longer network lines"}
  - {name: det, default: "random(0.01)", tried: ["random(0.002)"], change: moderate, effect: "coarser noise scale -> circle sizes vary in broad patches, visible clumps of similar-sized circles"}
  - {name: max, default: "width*random(0.0625, 0.1875)", tried: ["width*random(0.03, 0.1)"], change: large, effect: "smaller max radius -> no huge circles, denser field of small-medium dots"}
  - {name: sep, default: "random(1.2, 2.4)", tried: ["random(1.8, 3.2)"], change: moderate, effect: "larger minimum separation -> fewer, more widely spaced circles, bigger gaps; outline rings (radius c.z*sep) farther out"}
  - {name: ringprob, default: 0.2, tried: [0.8], change: subtle, effect: "rings on nearly every circle, but thin strokes -> small pixel change"}
  - {name: rejectPack, signature: "rejectPack(w, h, n, sizeField, sep) -> PVector[]", note: "O(n^2) minimum-distance rejection sampling of circle positions, size from a 2-D noise field"}
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alpha1, alpha2)", note: "annulus band between two radii drawn as per-segment quads with per-vertex alpha"}
  - {name: poly, signature: "poly(x, y, s, angle, seg)", note: "regular n-gon outline centred on a point"}
---

## What it draws
A full-bleed scatter of flat, solidly coloured circles (dominantly blue, green, yellow, orange-red and pink) on an off-white background, in sizes from tiny dots to large blobs. Some circles carry a thin black outline ring at a larger radius, a few have a small black polygon (triangle to hexagon) inscribed around their centre, and some have a small pale dot at the centre. Thin black lines link the centres of nearby circles, with a small black dot at each end, giving a sparse network/constellation overlay.

## How the code works
`generate()` (cnotc.pde:26) is called once from `setup()`; `draw()` is empty, so the piece is static.

1. **Placement + size (lines 30–59):** draws `cc = 200000` random candidates across the canvas. Each candidate's radius comes from 2-D Perlin noise sampled at a random offset (`des`) and scale (`det`), power-warped (`pwr`) and mapped to `[min, max]` (lines 42–43), with a linear fade of size toward the end of the loop (line 45). A candidate is kept only if it is at least `(c.z + s) * sep * 0.5` away from every accepted circle (lines 47–54) — a minimum-distance circle packing that thins the field to a few hundred non-overlapping circles.
2. **Circle decoration (lines 62–92):** each accepted circle is filled with `rcol()`, a uniform random pick from the 6-colour list (line 145). Then, per circle: a 5% chance of a small background-coloured concentric dot (line 68), a 10% chance of a black inscribed regular polygon with 3–6 sides (line 73, via `poly`), a 20% chance of a black outline ring at radius `c.z * sep` (line 82), and (always, since `random(1) < 20.2`) a full-turn `arc2` annulus between `c.z` and `c.z*0.5` filled with a random palette colour at very low alpha (14) — this is the faint concentric tinting/edge seen on many circles.
3. **Network lines (lines 94–105):** `circles.size() * 10` random pairs are drawn; a line is kept only if the two centres are within `(c1.z + c2.z) * sep * 0.7`, so only near-touching circles get connected; small dots are drawn at both endpoints.

Randomness enters at the candidate positions, the noise offset `des`, all the `random(...)` parameters (`det`, `max`, `min`, `pwr`, `sep`), the palette picks, and the decoration probabilities. No blend modes; plain P2D fills and strokes.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_50000 | `int cc = 200000;` -> `int cc = 50000;` | moderate | sparser field: fewer circles, more white space, fewer and longer connecting lines | variants/cc_50000/frame_00001.png |
| det_0.002 | `float det = random(0.01);` -> `float det = random(0.002);` | moderate | sizes vary in broad noise patches: visible clumps of similarly-sized circles (e.g. green cluster lower-left, yellow centre) | variants/det_0.002/frame_00001.png |
| maxsize_0.03_0.1 | `float max = width*random(0.0625, 0.1875);` -> `...random(0.03, 0.1);` | large | all circles noticeably smaller; the large blobs of the baseline are gone, denser small-medium field | variants/maxsize_0.03_0.1/frame_00001.png |
| sep_1.8_3.2 | `float sep = random(1.2, 2.4);` -> `random(1.8, 3.2);` | moderate | fewer, more widely spaced circles with larger white gaps; black outline rings sit farther from their circles | variants/sep_1.8_3.2/frame_00001.png |
| ringprob_0.8 | `if (random(1) < 0.2) {` -> `if (random(1) < 0.8) {` | subtle | rings now appear on nearly every circle, but the strokes are thin so only a small fraction of pixels changes | variants/ringprob_0.8/frame_00001.png |

## Modularisation notes
The core is a generic **noise-sized rejection circle packing** (`rejectPack`): parameters `count`, `minSize`/`maxSize` (or a size field), `sep`, `noiseScale`. The decoration pass (concentric dot / polygon / ring / low-alpha annulus, each with a per-circle probability) is a stack of independent, parameterisable "badge" layers — clean candidate for a `decoratedCircles(circles, badges)` helper. The network pass is a generic **proximity edge drawer** (sample N random pairs, keep if `dist < (r1+r2)*k`) — reusable as `linkNearby(circles, k, samples)`. One-off art decisions: the specific 6-colour palette, the `pwr` warp range, the size fade after `cc/2`, and the `sep`-relative thresholds, which couple spacing to decoration sizes.
