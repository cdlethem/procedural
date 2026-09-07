---
sketch: 2019/generativos/petis
year: 2019
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2201
animated: false
techniques: [noise-field, particles, dots-stippling, blend-modes]
primitives: [ellipse]
palette:
  colors: ["#523868", "#D11D02", "#BC8009", "#5496A8"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: loop1Count, default: 600000, tried: [150000], change: moderate, effect: "4x fewer main ellipses thins the streaked field, exposes more black background, makes colour masses sparser and grainier"}
  - {name: loop2Count, default: 60000, tried: [240000], change: subtle, effect: "4x more speckle dots; clusters slightly denser, composition otherwise unchanged"}
  - {name: speckleAlphaMult, default: 3.4, tried: [1.0], change: none, effect: "no visible change lowering the speckle alpha boost 3.4 -> 1.0"}
  - {name: gateNoiseMult, default: 5, tried: [20], change: moderate, effect: "ds2 multiplier 5 -> 20 (4x finer size-gate noise): grainier texture, colour masses relocated, more orange"}
  - {name: palette, default: "#523868,#D11D02,#BC8009,#5496A8", tried: ["#0D1B2A,#00B4D8,#FFD166,#EF476F"], change: moderate, effect: "hue shift only: cyan/teal + pink/magenta + pale yellow replace red/ochre/purple; same texture and layout"}
reusable_candidates:
  - {name: paletteNoiseColor, signature: "paletteNoiseColor(noiseVal, colors[], gamma) -> color", note: "map a noise sample onto a palette by lerping between adjacent entries with a pow curve (lines 97-103)"}
  - {name: noiseStippledField, signature: "noiseStippledField(count, sizeNoiseScale, gateNoiseScale, alpha) -> void", note: "scatter of noise-sized/gated ellipses with ADD blend producing streaked colour masses (lines 48-72)"}
---

## What it draws
Full-bleed dark field of fine vertical streaks in crimson/red, orange-gold, purple-magenta and teal, with
soft large colour masses separated by black gaps, and clusters of bright speckle dots (a band of them runs
across the top). Frame 1 is the intended image. (Note: `frame_00010.png` and `frame_00060.png` are a
washed-out near-white version — a P3D + `blendMode(ADD)` framebuffer-accumulation artifact under the headless
xvfb display, not real animation; the sketch's `draw()` is empty.)

## How the code works
- `settings()` (lines 14-19): 960x960 P3D, `smooth(8)`, `pixelDensity(2)` (warns unavailable in this display).
- `setup()` -> `generate()` (lines 21-29, 34-74): seeds `randomSeed`/`noiseSeed` with `seed`, `background(0)`,
  `blendMode(ADD)`, `noStroke()`. `draw()` is empty, so the image is generated once in setup and frame 1 is the
  intended result.
- Noise scales (lines 45-47): `dc = random(0.003,0.004)*0.7` (colour field), `ds = random(0.002,0.004)*2`
  (size field), `ds2 = random(0.002,0.004)*5` (size-gate field).
- Loop 1 (lines 48-59): 600,000 random points. Size `s = random(5) * (random(1,1.4) + noise(x*ds,y*ds)*4)`,
  then multiplied by `pow(max(noise(x*ds2,y*ds2)*1.1-0.1, 0), 1.2)` which zeroes much of the field and carves
  the black gaps between colour masses. Fill colour comes from `noise(x*dc,y*dc)` mapped through `getColor`
  (lines 97-103): index the 4-colour palette (line 90: purple #523868, red #D11D02, ochre #BC8009, teal
  #5496A8) and lerp between adjacent entries with `pow(v%1,1.6)`; alpha `random(70,110)`. Each point is drawn
  as a tall thin ellipse (width `s*0.4`, height `s*random(6)*random(1,random(12))`, up to ~8x taller than wide)
  rotated by `PI*random(-0.08,0.08)` -> the vertical-streak texture. ADD blend makes dense areas saturate bright.
- Loop 2 (lines 62-72): 60,000 speckle dots of size `random(5)`, kept only where `noise(x*ds,y*ds) < 0.4` and
  scaled by `pow(map(n,0,0.4,1,0),0.4)` so they cluster in noise valleys; colour from 3-D noise
  `noise(x*dc,y*dc,40)` with index offset +2, alpha `random(70,110)*3.4` (much brighter) -> the bright speckles.
- Deterministic (seed fields present, `deterministic: true`). `triangulate` and toxi `SimplexNoise` are imported
  but unused in this tab.
- Headless P3D + `ADD` artifact: frame 1 is correct, but later frames accumulate in the framebuffer and blow out
  to white (frames 10/60 identical, mean brightness 218 vs frame 1's 44). Not a property of the sketch.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count1_150000 | `for (int i = 0; i < 600000; i++) {` -> `... i < 150000 ...` | moderate | thinner streaked field, more black background showing, colour masses sparser and grainier | variants/count1_150000/frame_00001.png |
| count2_240000 | `for (int i = 0; i < 60000; i++) {` -> `... i < 240000 ...` | subtle | speckle dots slightly denser; composition otherwise unchanged | variants/count2_240000/frame_00001.png |
| alpha2_1.0 | `...random(70, 110)*3.4);` -> `...random(70, 110)*1.0);` | none | no visible change | variants/alpha2_1.0/frame_00001.png |
| ds2_20 | `float ds2 = random(0.002, 0.004)*5;` -> `... *20;` | moderate | grainier texture, colour masses relocated, more orange overall | variants/ds2_20/frame_00001.png |
| palette_cool | `int colors[] = {#523868, #D11D02, #BC8009, #5496A8};` -> `{#0D1B2A, #00B4D8, #FFD166, #EF476F};` | moderate | hue shift only: cyan/teal + pink/magenta + pale yellow replace red/ochre/purple; same texture and layout | variants/palette_cool/frame_00001.png |

## Modularisation notes
- Generic: `getColor(v)` / palette-lerp colour mapping (lines 97-103) is a clean library primitive
  (noise value -> palette colour with gamma). The two scatter loops share one pattern:
  (count, position sampler, noise-gated size, noise-driven colour+alpha, aspect ratio, rotation jitter) and
  could collapse into a single function with a parameter object.
- One-off art decisions: the specific 4-colour palette; the `ds2` gate exponent 1.2; the tall-thin ellipse
  aspect (`0.4` vs `random(6)*random(1,random(12))`); the `*3.4` speckle alpha boost (which the experiments
  show is not visually load-bearing); ADD blend on black.
- Suggested parameter object: `{count1, count2, colorScale: dc, sizeScale: ds, gateScale: ds2, gatePow,
  alpha1: [70,110], alpha2mult, aspectW: 0.4, aspectHRange, rotationJitter, colors[], blend: ADD}`.
- Headless caveat: under P3D + `blendMode(ADD)` on xvfb only frame 1 is trustworthy; later frames accumulate
  to white. Any library wrapper should render a single frame (or reset the framebuffer) rather than relying on
  a running draw loop.
