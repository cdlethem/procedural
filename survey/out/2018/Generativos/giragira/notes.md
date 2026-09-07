---
sketch: 2018/Generativos/giragira
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2819
animated: false
techniques: [noise-field, flow-field, polar, grid, dots-stippling]
primitives: [line, ellipse, shape]
palette:
  colors: ["#040001", "#050F32", "#FFFFFF", "#26A9C5", "#E50074"]
  selection: random-from-list
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: estrella, signature: "estrella(x, y, s1, s2, a, seg, c1, c2)", note: "layered star polygon: seg triangles alternating inner/outer radius, per-vertex fill colours"}
  - {name: noiseWalk, signature: "noiseWalk(x, y, steps, detail, offset, scaleMul, alpha)", note: "unit-step walk along a 2-D noise angle field, one line segment per step"}
  - {name: gridSnappedSize, signature: "size = width / 2^int(random(1,6)); x -= x % size", note: "place shape on a self-aligned grid cell of power-of-two size"}
---

## What it draws
A dense full-bleed field on a near-black background. The dominant elements are large
multi-pointed spiky stars — layered rosettes of thin triangles in white, cyan and magenta —
overlapping everywhere; at the largest scales the rosettes fuse into solid-looking discs
(a big magenta disc centre-frame, navy and white discs at the edges). Beneath the stars,
fine curving filaments of pale pink and white noise-walk lines form a web-like background
texture, and small white dots plus tiny rotated ellipse "eye" pairs are scattered across
the whole canvas.

## How the code works
`setup()` → `generate()` once with `randomSeed(seed)` (line 29), `background(10)`; `draw()`
is empty, so the image is static (regeneration only on key press). Four passes:

1. **Filament field** (lines 34–49): 20000 walks, each 100 unit steps; angle per step is
   `noise(des+x*det, des+y*det)*TAU*20` (line 41), so lines follow a fine noise angle field
   and bend into the pale web. Stroke colour `rcol()` at alpha 50 (line 38).
2. **Star rosettes** (lines 52–68): 200 stars. Size `s = width / 2^int(random(1,6))`
   (line 53) and position snapped to that size's grid (`x -= x % s`, lines 57–58). Each star
   is drawn 51 times shrinking by `pow(map(j,0,50,1,0), pow)` (line 65) — nested,
   increasingly tight copies. `estrella()` (lines 128–155) draws `seg` (12–30, line 59)
   triangles alternating inner radius `s1` and outer radius `s2`, with per-vertex fills
   `rcol()`/`rcol()` and faint white strokes — this produces the spiky rosettes; the
   largest nested copies overlap so much they read as solid discs.
3. **White walks + dots** (lines 70–90): 200 walks of 200 steps, white stroke alpha 60,
   coarser field (`noise(...)*TAU*10`, detail up to 0.02), 70% of steps drawn (line 82);
   each walk ends with a small dot: 8px ellipse alpha 20 + 5px ellipse alpha 220
   (lines 86–89) — the scattered bright specks.
4. **Dot/eye field** (lines 92–120): 20000 tiny "eyes": two ellipses (8×2 at alpha 80,
   2×1 at alpha 180) rotated ±`rot` about a centre, scaled by `noise(des+det*xx, ...)`
   (line 98), rotated by `random(TAU)` (line 104) — the fine mottled texture.

Colour comes from `rcol()` (lines 186–188): uniform random pick from `colors[]`
(line 184) — near-black `#040001`, deep navy `#050F32`, white, teal `#26A9C5`, magenta
`#E50074`. The `post.glsl` shader is loaded (lines 10, 124) but `filter(post)` is
commented out (line 125), so no post effect is applied.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- `estrella()` is generic as-is: (centre, inner size, outer size, rotation, segment count,
  two colours) — a clean library star-polygon function. The nested-shrink call loop
  (lines 64–67) is the one-off art decision (the rosette look).
- The noise-walk pass (1, 3) is a reusable `noiseWalk` with parameters for step count,
  field scale, angle multiplier, alpha and draw probability.
- Grid snapping (lines 53–58) is a reusable placement primitive: power-of-two cell size,
  position modulo cell.
- A clean parameter object would hold: walk counts (filament, white), walk lengths, noise
  scales (`det` ranges), angle multipliers (TAU*20 / TAU*10), star count, size exponent
  range (1–6), segment range (12–30), shrink exponent (0.4–0.8), dot-field count, and the
  `colors[]` palette.
