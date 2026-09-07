---
sketch: 2020/generative/05_08/sundi
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2573
animated: false
techniques: [noise-field, particles, 3d-pointcloud, distortion]
primitives: [point]
palette:
  colors: ["#E90510", "#FCA700", "#A7AFFF", "#2116C7"]
  selection: noise-driven
composition: radial
parameters:
  - {name: kLayers, default: 14, tried: [4], change: "", effect: ""}
  - {name: amp, default: "random(300,800)", tried: [1500], change: "", effect: ""}
  - {name: max, default: 0.3, tried: [0.15], change: "", effect: ""}
  - {name: det, default: "random(0.01)", tried: [0.0005], change: "", effect: ""}
  - {name: alpha, default: "random(40,170)", tried: ["random(120,255)"], change: "", effect: ""}
reusable_candidates:
  - {name: noiseRidgePointRelief, signature: "scatter(w, h, layers, perLayer, spread, detail, osc1, osc2, amp) -> vertices[]", note: "uniformly-scattered points whose z is a noise-gated sine-ridge relief, projected in 3D"}
  - {name: paletteRamp, signature: "getColor(colors[], v) -> color", note: "index a color list by v and lerp adjacent entries with pow(v%1,0.6)"}
---

## What it draws
A dense radial starburst / explosion of tiny translucent points filling the frame on a pure black background. A bright, tightly-packed core sits at the center where deep red, orange and pale lavender concentrate, and the points thin out into feathery, spiky arms radiating outward toward the corners. Colours band across a 4-colour palette (deep red, orange, pale blue-lavender, indigo blue) chosen by noise, giving a glowing, noisy, almost cosmic-burst look.

## How the code works
`setup()` and `draw()` both call `generate()`; because `randomSeed`/`noiseSeed` are re-seeded with the fixed `seed` each call, every frame is identical (frames 1/10/60 are all the same image).

`generate()` (sundi.pde:45-82):
- `background(0)` → pure black (line 50).
- Per-run random hyperparameters: `det = random(0.01)` (z-noise scale, line 52), `osc1`/`osc2` (oscillation frequencies, lines 54-56), `amp = random(300,800)` (z amplitude, line 58), `detCol`/`des` (colour-noise scales, lines 60-61), `max = 0.3` (spread, line 64).
- Outer loop `k = 0..13` (line 65): 14 layers, each with a random center offset `dx,dy = ±0.3 * width/height` (lines 66-67).
- Inner loop `i = 0..79999` (line 70): 80,000 points/layer. `x,y` are sampled uniformly in a central window scaled by `vv = random(random(random(max),max))` (lines 71-73, so points cluster toward the canvas centre); `y += cos(x*10)` adds a thin wobble (line 74).
- `dep = SimplexNoise.noise(x*det, y*det, seed*0.01)` (line 75) and `z = max(cos(x*osc1), sin(y*osc2))*amp*dep` (line 76): the 3D height is two orthogonal sine ridges gated by a 3-D noise field, scaled by `amp`. This relief is what the P3D perspective warps into the burst.
- Per-vertex colour: `stroke(getColor(y*detCol*5 + noise(x*des,y*des)*6), random(40,170))` (line 77). `getColor(float)` (lines 100-105) indexes the fixed 4-colour list `colors[]` (line 91) by `abs(v)`, lerps the two adjacent palette entries with `pow(v%1,0.6)`, and the random alpha (40-170) keeps points translucent so they accumulate additively over the black background.
- Renderer: P3D with perspective (settings() line 15) — the z-relief is projected in 3D, packing the core dense and stretching the outer arms thin.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic (library-ready):** `noiseRidgePointRelief` — scatter N points uniformly in a central window, set each z to `max(cos(x*osc1), sin(y*osc2))*amp*noise3d(x*detail,y*detail,z0)`, draw as 3D POINTS. The starburst look is entirely a function of (detail, osc1, osc2, amp, layers, perLayer, spread). `paletteRamp` — the noise-driven 4-colour lerp ramp is a reusable palette function.
- **One-off art decisions:** the specific 4-colour palette (red/orange/lavender/indigo); the per-run random hyperparameter ranges (the `random()` expressions that set det/osc/amp); the `y += cos(x*10)` wobble; the 14-layer × 80k-point counts; the 40-170 alpha range; the black background.
- **Clean parameter object:** `{ layers, pointsPerLayer, spread (max), zDetail (det), osc1, osc2, zAmp (amp), colorDetail (detCol), colorNoise (des), alphaRange, palette, background }`.
