---
sketch: 2019/generativos/limo002
year: 2019
renderer: P3D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 3052
animated: false
techniques: [noise-field, flow-field, particles, lines-hatching, dots-stippling]
primitives: [ellipse, line]
palette:
  colors: ["#043387", "#0199DC", "#BAD474", "#FBE710", "#FFE032", "#EB8066", "#E7748C", "#DF438A", "#D9007E", "#6A0E80"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: iterations, default: 20000, tried: [4000], change: large, effect: "5x fewer emitters: sparse field; discrete starburst/asterisk spikes and short curved strands, lots of white between them"}
  - {name: det, default: "random(0.0006,0.0008)*0.8", tried: ["random(0.003,0.005)"], change: large, effect: "higher noise zoom: strands shorter, curlier, finer; field reads darker and denser, clear 5% white margin"}
  - {name: amp, default: "random(16,20)*random(0.5,1)", tried: ["random(2,4)"], change: large, effect: "smaller angle amplitude: strands straighter/more linear, swirls gone; denser linear fuzzy mass, a few near-white gaps"}
  - {name: "lar2 (branches/emitter)", default: "random(26,32)", tried: ["random(70,90)"], change: large, effect: "~3x more spikes per emitter: busier, darker, more overlapping starbursts; fewer white gaps, clear margin"}
  - {name: branchAlpha, default: 20, tried: [90], change: large, effect: "4.5x branch alpha: starburst branches prominent and dark; dense, near-regular asterisk/star field"}
reusable_candidates:
  - {name: doubleNoiseAngle, signature: "doubleNoiseAngle(x, y, offset, detail, amp) -> float angle", note: "nested double Perlin noise (dn.noise(dn.noise(..)*amp*3)*amp) mapping a point to a flow direction"}
  - {name: emitterBurst, signature: "emitterBurst(x, y, flowFn, spineLen, branches, branchLen) -> shape", note: "one noise-following wavy spine plus N radiating short spikes from the endpoint"}
---

## What it draws
A full-bleed, monochrome fibrous field on a near-white (250) background. It reads as dense
grass / fur / hair: thousands of short, wavy hair-like strands, each tipped with a tiny
starburst of spiky branches, cover the whole square. Density and darkness vary in soft
organic patches — darker, thicker clumps in some regions and sparser, near-white gaps in
others — giving a swirling, flow-field-like grain. The only colours actually drawn are black
dots and grey strokes (the defined 10-colour `colors[]` palette is never used).

## How the code works
`setup()` calls `generate()` once; `draw()` is empty, so the sketch is static (frames 1/10/60
identical). `settings()` uses P3D, 960x960, `smooth(8)`. `generate()` (limo002.pde) seeds
random + noise with `seed`, paints `background(250)`, builds a custom `DoubleNoise dn`
(NoiseDouble.pde, toxi-style Perlin) with `noiseDetail(9)` (9 octaves), then draws
20000 emitters in a loop (`limo002.pde:59-94`):

- Each emitter starts at a random point in the inner 90% area (`width*random(0.05,0.95)`,
  line 60-61), draws a 2px black dot with random alpha (`ellipse(x,y,2,2)`, line 62-63),
  then opens a `beginShape()`.
- **Main spine (flow field):** length `lar = 80*noise(...) - 20` comes from a second,
  coarse noise field (`desLar`/`detLar`, line 68), so strand length varies spatially.
  For each step the direction `a` is a *nested double noise* —
  `dn.noise(dn.noise(des+x*det, des+y*det)*amp*3)*amp` (line 71) — which maps the point to
  an angle; the pen then advances `x+=cos(a); y+=sin(a)` (line 72-73). `det` (~0.0005) is
  the noise zoom and `amp` (~8-20) the angular amplitude, together shaping the swirls.
  Stroke is grey, alpha pulsing via cosine `stroke(80, 50+cos(ic+j*dc)*40)` (line 70).
- **Starburst branches:** at the spine's end (`lx,ly`) a loop of `lar2 = random(26,32)`
  short spikes (line 79) is drawn, each with a random base angle `da`, speed `v1`, and
  length `lar3 = random(4,12)` (line 85). Each spike also follows the double-noise field
  at 10x zoom (`det*10`, line 87). Branches use a low-alpha grey
  `stroke(random(255)*random(1), 20)` (line 78), so they are faint — which is what makes
  the tips look like fuzzy spiky halos.
- Randomness enters at every emitter (start point, dot alpha, `ic`/`dc`, `da`, `v1`) and
  through the noise fields; `deterministic` is false, so runs differ by noise even at a
  fixed seed. Colour is purely grey/black — the `colors[]` array (line 106) and
  `rcol()`/`getColor()` (line 108-119) are defined but never called.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_4000 | `for (int i = 0; i < 20000; i++)` -> `... i < 4000 ...` | large (mean 0.263, 71%) | 5x fewer emitters: sparse field; discrete starburst/asterisk spikes and short curved strands now clearly separate, lots of white between them | variants/count_4000/frame_00001.png |
| det_0.004 | `float det = random(0.0006,0.0008)*0.8;` -> `random(0.003,0.005);` | large (mean 0.199, 63%) | higher noise zoom: strands shorter, curlier, finer; whole field darker/denser with a clear 5% white margin | variants/det_0.004/frame_00001.png |
| amp_3 | `float amp = random(16,20)*random(0.5,1);` -> `random(2,4);` | large (mean 0.178, 62%) | smaller angle amplitude: strands straighter/more linear, swirls gone; denser linear fuzzy mass, a few near-white gaps | variants/amp_3/frame_00001.png |
| branches_80 | `float lar2 = random(26,32);` -> `random(70,90);` | large (mean 0.223, 66%) | ~3x more spikes per emitter: busier, darker, more overlapping starbursts; fewer white gaps, clear margin | variants/branches_80/frame_00001.png |
| alpha_90 | `stroke(random(255)*random(1), 20);` -> `... 90);` | large (mean 0.246, 70%) | 4.5x branch alpha: starburst branches prominent and dark; reads as a dense, near-regular asterisk/star field | variants/alpha_90/frame_00001.png |

## Modularisation notes
Generic / library-worthy: `DoubleNoise` (a self-contained 2D Perlin with octave + seed
control) and the *double-noise angle* mapping — a point-to-direction flow function
(`dn.noise(dn.noise(..)*amp*3)*amp`) is a reusable flow-field primitive with params
`offset, detail, amp`. The `emitterBurst` pattern (one noise-followed spine + N radiating
spikes, all lengths/counts randomised) is a reusable "hair/straw" primitive.

One-off art decisions: the exact emitter count (20000), the 5% margin, the two-stage
spine-then-sparks structure, the faint 20-alpha branch stroke, and the near-white 250
background. A clean parameter object: `{count, margin, spineLenGain, detail, amp,
branches, branchLen, branchAlpha, dotSize, bg}`.
