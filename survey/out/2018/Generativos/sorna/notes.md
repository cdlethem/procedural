---
sketch: 2018/Generativos/sorna
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3321
animated: false
techniques: [noise-field, particles, lines-hatching]
primitives: [ellipse]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: det, default: "random(0.06,0.012)*0.4", tried: ["random(0.06,0.012)*1.6"], change: large, effect: "finer placement/size noise: new point layout, coarser mottled texture with larger, more visible individual bursts"}
  - {name: candidates, default: 50000, tried: [10000], change: large, effect: "much sparser field (black ground shows); palette shifts to blue-grey/cream with scattered orange; directional flow lost"}
  - {name: strokeAlpha, default: 20, tried: [90], change: moderate, effect: "same layout; strokes gain a visible dark outline, texture reads darker and more sketched, strokes more individually legible"}
  - {name: pwr, default: "random(0.1,0.2)*10", tried: ["random(0.1,0.2)*30"], change: moderate, effect: "same layout; colours pushed to palette extremes: vivid reds + near-black + cream, mid blue-greys gone, higher contrast"}
  - {name: rotateMult, default: "TAU*2", tried: ["TAU*8"], change: moderate, effect: "same layout; the noise-driven flow field disappears, strokes point chaotically in all directions"}
reusable_candidates:
  - {name: noiseRejectionSample, signature: "noiseRejectionSample(width, height, candidates, det, sizeFn) -> PVector[]", note: "Poisson-like placement: reject candidate if within noise-driven radius of any kept point"}
  - {name: paletteColor, signature: "paletteColor(palette, noiseValue, power) -> color", note: "pow(noise, pwr) scaled across palette with lerp between neighbours (getColor, sorna.pde:100)"}
---

## What it draws
A dense full-bleed field of thousands of thin, elongated elliptical strokes (small three-armed
bursts at each point) over a black ground. Strokes point in many directions but cluster into
curving directional patches; the overall texture is slightly coarser and larger toward the top.
Dominant colours are burnt orange/red and pale cream, with grey, grey-blue and near-black
strokes scattered through; a few tiny solid dots appear.

## How the code works
`setup()` (sorna.pde:2) calls `generate()` once; `draw()` is empty, so the image is static.
- **Placement (lines 28–44):** 50000 random candidates over the canvas. Each gets a size
  `s = noise(des+x*det, des+y*det)*120*map(y,0,height,0.8,1)` — 2-D Perlin noise sampled at a
  random offset, scaled up slightly toward the top. A candidate is rejected if it lies within
  `(s+p.z)*0.02` of any kept point (O(n²) rejection loop, line 36), so the kept points form a
  noise-modulated sparse cloud — larger noise size = larger exclusion zone = sparser region.
- **Drawing (lines 51–85):** per kept point, `s = p.z*0.2`. Four candidate colours are built
  (lines 57–60): `getColor(pow(noise(...), pwr)*colors.length)` — noise raised to a random
  power `pwr` in [1,2] and mapped across the 5-colour palette with neighbour lerp — then each
  is lerped toward a random grey (`lerpColor(c, color(random(256)), random(1))`), which is why
  the strokes read as orange/cream/grey mix. One of the four is chosen uniformly at random
  (lines 62–69).
- **Per-stroke shape (lines 70–84):** translate to the point, rotate by `noise(...)*TAU*2`
  (line 73, the visible directional patches), then draw three overlapping thin ellipses
  `s*0.4 x s*random(4,6)` at successive fixed rotation offsets (-0.3*HALF_PI, +0.6*HALF_PI)
  with a faint dark stroke (`stroke(0,20)`), making a small asterisk/burst. With 2% chance
  (line 80) a small solid circle in a random palette colour is added.
- **Renderer:** P2D, `smooth(8)`; `pixelDensity(2)` is unavailable on the headless display
  (warning, harmless). Randomness enters only via `random`/`noise` seeded by `seed`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_1.6 | `  float det = random(0.06, 0.012)*0.4;` -> `  float det = random(0.06, 0.012)*1.6;` | large | new point layout; coarser, mottled texture, larger more prominent bursts, a few dark red/black stars | variants/det_1.6/frame_00001.png |
| candidates_10000 | `  for (int i = 0; i < 50000; i++) {` -> `  for (int i = 0; i < 10000; i++) {` | large | sparser (black ground visible), blue-grey/cream dominant with scattered orange, no directional flow | variants/candidates_10000/frame_00001.png |
| stroke_90 | `    stroke(0, 20);` -> `    stroke(0, 90);` | moderate | same layout; dark outlines on every stroke, darker more sketched texture | variants/stroke_90/frame_00001.png |
| pwr_30 | `  float pwr = random(0.1, 0.2)*10;` -> `  float pwr = random(0.1, 0.2)*30;` | moderate | same layout; colour contrast up: vivid reds, near-black, cream; mid blue-greys gone | variants/pwr_30/frame_00001.png |
| rotate_8 | `    rotate(noise(des+x*det, des+y*det)*TAU*2);` -> `... *TAU*8);` | moderate | same layout; flow field gone, stroke directions chaotic | variants/rotate_8/frame_00001.png |

## Modularisation notes
- **Generic:** the rejection sampler (placement by noise-gated minimum distance) and
  `getColor`/`paletteColor` (noise-pow-driven palette indexing with neighbour lerp) are
  reusable as library functions. The per-point "burst of thin ellipses at fixed rotation
  offsets" is a reusable stamp/brush primitive.
- **One-off art decisions:** the specific palette, the 3-ellipse burst shape with its fixed
  angle offsets, the 2% dot sprinkle, the `map(y,0,height,0.8,1)` vertical size ramp.
- **Parameter object:** `{width, height, seed, candidates, placeDet, placeOffset, sizeScale,
  minDistFactor, drawDet, drawOffset, colorPower, palette, greyLerpChance, aspect, dotChance}`.
