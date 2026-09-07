---
sketch: 2020/generative/01_04/spirit
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi]
deterministic: true
ms_first_frame: 2340
animated: false
techniques: [noise-field, lines-hatching, symmetry]
primitives: [shape]
palette:
  colors: ["#04F7D2", "#F70451", "#6D04F7", "#F7AA06"]
  selection: random-from-list
composition: centered
parameters: []
reusable_candidates:
  - {name: wavyThreadBundle, signature: "wavyThreadBundle(x1, y1, x2, y2, count, turns, amp, noiseDetail, noiseAmp) -> void", note: "stacks N polylines along a segment, each sinusoidally displaced (sin(v*PI)*sin(v*turns*PI)) and perturbed by simplex noise"}
  - {name: noisePerturb, signature: "noisePerturb(p, detail, offset, z) -> PVector", note: "2-D simplex offset applied to a point (def(), z fixed at 999/111 for x/y)"}
---

## What it draws
On a black background, thousands of thin neon threads woven into four long wavy bundles that run
along the horizontal, vertical and both diagonal axes. The bundles are densest and whitest in the
centre where all four cross (additive blending saturates to white), and spread toward the edges.
The dominant colour is hot pink/magenta, with a teal/cyan band along the vertical axis and a little
violet and amber in the corners, giving a symmetric, ghostly or flower-like central shape.

## How the code works
- `settings()` (spirit.pde:17): 960x960 P2D canvas, `smooth(8)`.
- `setup()` (24) calls `generate()` once; `draw()` (35) calls `generate()` again every frame, but
  `generate()` re-seeds with the fixed `seed` (54-55), so every frame is identical -> static.
- `generate()` (52): black background, `blendMode(ADD)` (58). Draws four "lines" via `linee()`
  (70-76): the horizontal and vertical axes get `stroke(rcol(), 40)`, the two diagonals
  `stroke(rcol(), 26)`. Each gets an independent random palette colour (rcol(), 136-138: random
  from `{#04F7D2, #F70451, #6D04F7, #F7AA06}`, 134).
- `linee()` (79): for a segment of length `lar`, draws `cc` (160-200)*1.5 (86) stacked polylines.
  Each polyline has `res = lar*2` vertices (92); the perpendicular offset is
  `sin(v*PI)*sin(v*turns*PI)*amp` (101-106) with `turns` 4-13 (84) and
  `amp = lar*random(0.3,0.8)*0.4*random(1,3)` (82) — a standing-wave shape that tapers to zero at
  the segment ends. Each vertex is additionally displaced by `def()` (108), a 2-D simplex-noise
  offset (118-121) with `ampDef = 18` (117), detail `detDes = random(0.0006,0.001)*8` (61) and
  random offset `desDes` (62). The angle `ang+HALF_PI+k*da` (103) fans the bundle around the
  segment direction.
- Randomness enters via `randomSeed(seed)`/`noiseSeed(seed)`: palette pick per line, turns, amp,
  cc, and the noise offset/detail.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `linee()` + `def()` together are the generic core: "noisy wavy thread bundle along a segment"
  (signature above). The segment endpoints, count, wave turns/amplitude and noise detail/amplitude
  are the natural parameters; the colour/alpha is injected per call.
- One-off art decisions: the fixed set of four axis/diagonal segments, the ADD blend mode, the
  specific 4-colour neon palette, and the per-line alpha values (40 vs 26) that make diagonals
  dimmer and let the centre saturate to white.
- A clean parameter object: `{segments: [[x1,y1,x2,y2,color,alpha]...], bundleCount, turns,
  ampFactor, noiseDetail, noiseAmp, blend}`.
