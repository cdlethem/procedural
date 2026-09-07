---
sketch: 2020/generative/01_04/grados
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1816
animated: true
techniques: [noise-field, polar, curves, distortion]
primitives: [shape, line]
palette:
  colors: ["#060606", "#90ff00", "#FFFFFF"]
  selection: random-from-list
composition: radial
parameters:
  - {name: cc, default: "int(random(3, 8)*5)", tried: [15, 35], change: large, effect: "more layers = denser, brighter fan of rays (also shifts the random stream, so composition changes)"}
  - {name: sca, default: 8, tried: [16], change: moderate, effect: "arcs roughly double in size; big looping ribbons fill the frame"}
  - {name: alpha (26* in alp), default: 26, tried: [130], change: large, effect: "much brighter, saturated lime/white; additive stacking blows out the core"}
  - {name: colors[], default: "6x #060606, #90ff00, #ffffff", tried: ["warm list: #FFB401 #072457 #EF4C02 #ADC7C8 #FE6567"], change: large, effect: "same composition recoloured amber/orange/red with warm-white core"}
  - {name: blendMode, default: ADD, tried: [BLEND], change: subtle, effect: "fan structure unchanged; white glow in the core lost, knot turns pale grey, slightly dimmer overall"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s, a1, a2, col, alp1, alp2, alt, desAng)", note: "alpha-graded modulated arc drawn as a polyline; clean generic primitive"}
  - {name: spiralLayers, signature: "spiralLayers(layers, turns, samples, r1, r2, pwrR, s1, s2, pwrS, noiseDetail, oscAmp, alt, alphaAmp, weightAmp, scale, rot3d, blend)", note: "the whole generate() body: per-layer random 3D rotation + polar spiral of noise-warped, individually tilted arcs"}
---

## What it draws
A black canvas covered by sweeping lime-green and pale grey-green spiral arcs that fan in from the
corners and wind toward the centre, where a dense tangle of thin white arcs knots into a bright
burst. Arc thickness and brightness vary along each path, and the additive blending gives the whole
composition a glowing, luminous look. (frames 10/60 exist but show a near-white washed canvas with
faint yellow-green specks — a P3D software-render readback artifact, not animation: `draw()` is
empty and the sketch draws once in `setup()`.)

## How the code works
Static one-shot sketch: `setup()` calls `generate()` once, `draw()` is empty (l.34-36); `keyPressed`
regenerates with a new seed (l.38-44). `generate()` (l.46-145):

- `background(0)` + `blendMode(ADD)` (l.55-57): the glow comes from additive stacking of hundreds of
  semi-transparent strokes on black.
- Outer loop `cc = int(random(3,8)*5)` layers (l.72-141): each layer first gets a random
  `rotateX/Y/Z` (l.75-77), so every 2D spiral is tilted independently in 3D — this is what makes the
  flat arcs read as twisted ribbons.
- Per-layer parameters: `amp` (l.82) sets total turn count `rot = amp*TAU` (~1-4 turns) and sample
  count `sub` (l.84, ~1.5k-6k); `sca = 8` (l.86) scales the radius and arc-size ranges
  `r1/r2`, `s1/s2` (l.88-93), each raised to random powers `pwrR/pwrS` (l.90-94) that shape the taper.
- Inner loop (l.102-140): `v = i/sub`, angle `a = da*i` advances polar angle so points trace a
  spiral; radius `r` and arc size `s` are lerped along `v` and powered (l.105-107).
- Noise warping: two `SimplexNoise` samples at `det = 0.002*v` (l.115-119) produce the arc's start
  and end angles `a1, a2`, so each arc's orientation is noise-driven and drifts slowly along the
  spiral; `osc` (l.126) adds a sinusoidal wobble of amplitude `oscAmp` (5-16) plus a `sin(a*6)`
  ripple; `xx += cos(xx*2.01)*1.8` (l.130-131) adds fine high-frequency jitter.
- `arc2` (l.147-166) draws each arc as a `beginShape`/`vertex` polyline of
  `res = (a2-a1)*r*PI*0.01` points, with `alt` (l.100) modulating the radius (`mod`, l.161);
  `rotateY(a)` (l.134) tilts each arc in 3D around its own polar angle.
- Fade in/out: alpha `alp = 26*sin(PI*v)-random(2)` (l.109) and stroke weight
  `1.2*pow(sin(PI*v),1.2)` (l.111) both peak mid-spiral and vanish at the ends.
- Colour: `rcol()` picks randomly from `colors[]` (l.183-186) — six near-black entries, `#90ff00`
  lime, `#ffffff`; each layer lerps two such picks ~0-10% toward white (l.79-80) and then lerps
  along `v` (l.108). The near-black entries are effectively invisible on the black background, so
  arcs read as lime or white/grey.
- The `triangulate` import (l.1) is unused; only `SimplexNoise` (toxi) is actually used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_15 | `int cc = int(random(3, 8)*5);` -> `int cc = 15;` | moderate | different composition (dropping the `random()` call shifts the whole stream): a dense fan of lime rays from the edges with a bright white knot near centre; brighter and busier than baseline | variants/cc_15/frame_00001.png |
| cc_35 | `int cc = int(random(3, 8)*5);` -> `int cc = 35;` | large | much denser and brighter: lime-green rays cover the whole canvas in a tight fan, white knot at centre; clearly more layers stacked | variants/cc_35/frame_00001.png |
| sca_16 | `float sca = 8;` -> `float sca = 16;` | moderate | same fan structure but arcs roughly double in size: large looping white and lime ribbons fill the frame, bigger central white tangle | variants/sca_16/frame_00001.png |
| alpha_130 | `alp = 26*sin(PI*v)-random(2);` -> `alp = 130*sin(PI*v)-random(2);` | large | strongly brighter and more saturated: intense lime and white, the core blows out to a large glowing white mass, rays form a dense web | variants/alpha_130/frame_00001.png |
| palette_warm | `int colors[] = {#060606, ..., #90ff00, #ffffff};` -> `int colors[] = {#FFB401, #072457, #EF4C02, #ADC7C8, #FE6567};` | large | identical composition (fan + central knot) but recoloured warm: amber/orange and red arcs (pixel histogram: ~61% of bright pixels hue ~30 deg orange, ~31% hue ~0 deg red), warm-white core; the dark-navy #072457 arcs are nearly invisible on black | variants/palette_warm/frame_00001.png |
| blend_BLEND | `blendMode(ADD);` -> `blendMode(BLEND);` | subtle | no visible change in structure: the white glow at the core is lost (knot turns pale grey) and the piece is slightly dimmer where arcs used to stack additively | variants/blend_BLEND/frame_00001.png |

## Modularisation notes
- `arc2(x, y, s, a1, a2, col, alp1, alp2, alt, desAng)` (l.147-166) is already a clean generic
  primitive: an alpha-graded, radius-modulated arc polyline. Usable in a library as-is (drop the
  `desAng`/`alt` modulation into options).
- The core reusable block is the layer+spiral generator: per-layer random 3D rotation, polar spiral
  with lerped+powered radius and size, noise-driven arc orientation, per-arc `rotateY` tilt,
  end-fade alpha/weight. A clean parameter object would contain: `layers` (cc), `turns` (amp),
  `samples` (sub), `r1, r2, pwrR, s1, s2, pwrS`, `noiseDetail` (det), `oscAmp`, `alt`,
  `alphaAmp` (26), `weightAmp` (1.2), `globalScale` (sca), plus `rot3d: bool` and `blendMode`.
- One-off art decisions: the `#060606`-weighted palette (invisible-arc trick), the `cos(x*2.01)*1.8`
  jitter, `ADD` blending on black, and the `sca = 8` sizing constants.
- Note for the library: `cc` is drawn from `random()` inside the loop preamble, so changing it
  shifts the downstream random stream; a clean API would take `layers` as an explicit parameter so
  other values stay comparable.
