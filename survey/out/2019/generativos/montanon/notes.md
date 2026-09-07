---
sketch: 2019/generativos/montanon
year: 2019
renderer: P2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 2875
animated: false
techniques: [flow-field, particles, noise-field, lines-hatching]
primitives: [line]
palette:
  colors: ["#eaf762", "#E5463E", "#366A51", "#141c82"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: sub, default: 400, tried: [120], change: large, effect: "120x120 grid instead of 400x400: far sparser, individual hair strokes clearly visible, dense woven texture gone"}
  - {name: trailSteps, default: 40, tried: [120], change: large, effect: "3x longer trails: long winding curves instead of short hairs, more line-art-like"}
  - {name: alphaMul, default: 0.9, tried: [1.6], change: moderate, effect: "strokes more opaque; red and dark bands denser, texture slightly mottled"}
  - {name: strokeWeightMax, default: 1.8, tried: [3.0], change: large, effect: "bolder thicker hatching; bands read as solid strokes"}
  - {name: palette, default: "#eaf762,#E5463E,#366A51,#141c82", tried: ["#ffffff,#4da6ff,#9b59ff,#10131c"], change: large, effect: "same band structure in cool white/blue/purple tones"}
  - {name: detAmp, default: "random(0.004,0.006)*0.1", tried: ["*0.3"], change: moderate, effect: "3x colour-field frequency: narrower, more numerous colour bands"}
reusable_candidates:
  - {name: doubleNoise, signature: "DoubleNoise().noise(x, y) -> double", note: "self-contained Perlin (toxi 031112) with its own unseeded java.util.Random permutation table; nested calls build a coarse angle field"}
  - {name: cyclicPaletteLerp, signature: "getColor(v, colors[]) -> int", note: "wraps v mod colors.length and lerps between adjacent palette entries (montanon.pde:132-138)"}
  - {name: hairTrail, signature: "hairTrail(x, y, angleField, steps, vel) -> polyline", note: "short 40-step walk where angle comes from nested noise and per-step alpha decays as cos(k*osc) (montanon.pde:102-111)"}
---

## What it draws
A full-bleed black canvas covered in a dense field of hair-thin line segments, thousands of them
aligned into broad, smoothly curving bands that sweep diagonally from top-left to bottom-right.
A wide dark S-shaped channel cuts across the middle, with lighter olive-green and red-orange
streaks packed tightly along the band edges and deep navy blue filling the flatter regions.
The texture reads like woven fabric or topographic contours: fine, feathery, and directional.

## How the code works
`setup()` calls `generate()` once (montanon.pde:20); `draw()` is empty, so the image is static
(frames 10/60 were dropped as identical). `randomSeed(seed)` seeds Processing's `random()`, but
the `DoubleNoise` class (noiseDouble.pde:36-121) builds its Perlin permutation table from an
unseeded `java.util.Random` — that is why `deterministic` is false: the noise field itself
changes every run, so re-renders differ even at the same seed.

`generate()` (montanon.pde:56-114) works as follows:
- A `DoubleNoise dn` with 2 octaves (lines 66-67) plus Processing's own `noiseDetail(2)` (line 85).
- Random offsets/scales drawn once per run: `desAng/desCol/desAmp/desDes` (offsets, lines 69-81)
  and `detAng/detCol/detAmp/detDes` (field detail, all `random(0.004,0.006)*0.1`), so the field
  pattern is re-scattered per seed.
- Main loop: `sub = 400` (line 83) gives a 400x400 = 160,000 grid of polyline starts. Each start
  is placed at `width*lerp(-0.05, 1.05, (i+random(-0.3,0.3))/sub)` (lines 90-91) — a jittered
  grid slightly extending past the canvas, hence full-bleed with no margin.
- Each polyline walks 40 steps (line 103). The heading angle `a` (line 105) is nested noise:
  `dn.noise(dn.noise(200+cos(dn.noise(...)*TAU*12)*des))*TAU*20` — the innermost noise is sampled
  at canvas position (low frequency, giving the broad band structure), the outer noise adds
  per-step wobble. Step length is `velX/velY = random(0.4,1.8)*0.8` (lines 100-101), so each
  hair is a short, gently bending trail. This is the flow-field mechanism.
- Colour: base index `ic` comes from `dn.noise` sampled at the start position times
  `colors.length*2` (line 95), so colour varies smoothly over the canvas and is quantised
  through `getColor(ic+dc*k)` (lines 129-138), which wraps `v mod 4` and lerps between adjacent
  palette entries — a cyclic lerp over the 4-colour palette (line 125). Per-vertex alpha is
  `alp*cos(k*osc)` (lines 98-99, 106), fading hairs in/out along their length.
- Stroke weight is small and random, 0.2 up to 1.8 px (line 97); `smooth(8)` + `pixelDensity(2)`
  (lines 14-15) keep the result crisp at 960x960 P2D. No blend modes are active (line 62 commented out).
- The broad bands are the low-frequency innermost noise in the angle field; the dark S-channel is
  where the angle field turns the hairs away from the viewer's eye (dense dark overlap) versus
  where they pile up bright.

## Experiments
Note: `deterministic` is false — the unseeded `DoubleNoise` table reshuffles the band pattern on
every run, so part of each score below is noise-pattern difference, not the parameter effect.
Comparisons below concern only the gross changes (density, stroke length, colour, weight).
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| sub_120 | `int sub = 400;` -> `int sub = 120;` | large (mean 0.1721, 0.675) | sparse individual hair strokes on dark ground; broad flow structure kept but the dense woven texture is gone | variants/sub_120/frame_00001.png |
| trailSteps_120 | `for (int k = 0; k < 40; k++) {` -> `for (int k = 0; k < 120; k++) {` | large (mean 0.1628, 0.639) | long winding trails; distinct curving lines, strongest in the olive upper region | variants/trailSteps_120/frame_00001.png |
| alpha_1.6 | `float alp = random(40, 250)*random(0.1, 0.9);` -> `...random(0.1, 1.6);` | moderate (mean 0.1219, 0.536) | strokes more opaque; red and dark bands denser, slightly mottled | variants/alpha_1.6/frame_00001.png |
| weight_3.0 | `strokeWeight(random(0.2, random(0.4, 1.8)));` -> `strokeWeight(random(0.6, random(0.8, 3.0)));` | large (mean 0.2055, 0.738) | bolder, thicker hatching; bands read as solid strokes | variants/weight_3.0/frame_00001.png |
| palette_cool | `int colors[] = {#eaf762, #E5463E, #366A51, #141c82};` -> `int colors[] = {#ffffff, #4da6ff, #9b59ff, #10131c};` | large (mean 0.1607, 0.684) | same band structure, white/blue/purple on a dark ground instead of olive/red/navy | variants/palette_cool/frame_00001.png |
| detAmp_0.3 | `float detAmp = random(0.004, 0.006)*0.1;` -> `float detAmp = random(0.004, 0.006)*0.3;` | moderate (mean 0.1319, 0.544) | colour bands narrower and more numerous, finer colour transitions | variants/detAmp_0.3/frame_00001.png |

## Modularisation notes
- **Generic / library candidates:** (1) the nested-noise angle field — sample a low-frequency
  noise at (x, y) to get a direction, then a higher-frequency noise for per-step wobble; this is
  the reusable `flowAngle(x, y, baseFreq, wobbleFreq)` core. (2) the cyclic palette lerp
  `getColor(v, colors[])` (line 132) is a clean, dependency-free primitive. (3) the hair-trail
  generator (40-step polyline with cos-faded alpha, lines 102-111) is a good `strokeField()`
  building block. The `DoubleNoise` class is a drop-in Perlin with an independent table — useful
  when you want a noise field that is NOT affected by Processing's `noiseSeed` (here that
  accidental property causes the non-determinism).
- **One-off art decisions:** the specific 400x400 count and jitter amount, the exact nested-noise
  constants (`TAU*12`, `TAU*20`, `*0.1` detail), the 4-colour palette, and the 40-step trail
  length are the artist's taste; keep them as parameters, not logic.
- **Clean parameter object:** `{gridCount: 400, trailSteps: 40, fieldDetail: 0.0004-0.0006,
  fieldOffset: [x, y] (per channel), velRange: [0.4, 1.8]*0.8, weightRange: [0.2, 1.8],
  alphaBase: [40, 250], alphaMul: [0.1, 0.9], palette: [...4 colors], background: black}`.
- **Caveat for reuse:** seed only Processing's `random()`, not `DoubleNoise` (its table uses a
  fresh `java.util.Random`); add a `noiseSeed` passthrough if deterministic output is wanted.
