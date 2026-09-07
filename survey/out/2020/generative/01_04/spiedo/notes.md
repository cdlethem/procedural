---
sketch: 2020/generative/01_04/spiedo
year: 2020
renderer: P3D
size: [800, 800]
libraries: [peasy]
deterministic: false
ms_first_frame: 1505
animated: true
techniques: [spiral, polar, distortion]
primitives: [line]
palette:
  colors: ["#4E87C5", "#BA8FE7", "#F76A0B"]
  selection: lerp-between
composition: radial
parameters: []
reusable_candidates:
  - {name: oscSpiral, signature: "oscSpiral(res, endAngle, initR, endR, powR, endOsc, initAmp, endAmp) -> vertex[]", note: "polar polyline: angle lerp'd over many turns, radius lerp'd through a pow curve, radius modulated by sin(osc), z = cos(osc)*amp"}
  - {name: cyclicLerpColor, signature: "getColor(v, colors) -> color", note: "cyclic palette index: lerpColor between adjacent entries with gamma pow(v%1, 0.6)"}
---

## What it draws
Dark charcoal (near-black grey) background with a single continuous glowing stroke that forms a spiral: a dense band of many overlapping thin lines, tightly wound, sitting in the upper-left of the canvas, thinning out into a fine curling tail that sweeps across the bottom and up the right side. The band is a braid of blue, purple and orange segments (they additively blend where lines cross, so crossings read brighter); the tail is a single thin multicoloured thread. Only part of the spiral is visible — the centre of the winding is off to the left, so the frame shows one side of the coil.

## How the code works
- `settings()` (spiedo.pde:20-25): `scale = nwidth/swidth = 800/960`, so the actual P3D window is 800x800; `smooth(8)`.
- `setup()` (27-30): creates a `PeasyCam` at distance 400 and calls `generate()`. `draw()` (32-35) calls `generate()` **every frame**, so the piece is animated: the whole polyline rotates (`rotTime1 = millis()*0.001*0.4`, line 48) and the oscillation phase drifts (`rotTime2 = t*0.2`, line 49). This is also why renders are non-deterministic: geometry depends on `millis()`, not just the seed.
- `generate()` (45-105): reseeds RNG (51-52), sets a random perspective `fov = PI/random(1,3)` (55-58), `background(40)` (60), `blendMode(ADD)` (62), then draws ONE `beginShape()`/`endShape()` (87-104) of `res = 10000` vertices (64) with `noFill()` (85) and `strokeWeight(2)` (83).
- Per-vertex (88-103), with `v = i/res`:
  - `angle = lerp(0, PI*random(20), v) + rotTime1` (90) — the line can sweep up to ~10 full turns.
  - `radius = lerp(width*random(0.1), width*random(0.4,0.6), pow(v, powRadius))` (91) with `powRadius = random(0.5, 2)` (71) — the pow curve decides where the turns pack: with `powRadius > 1` most turns sit at small radius (the dense band), and the line then runs off to a sparse outer tail.
  - `osc = lerp(0, PI*random(400), v) + rotTime2` (93), `amp = lerp(width*random(0.01), width*random(0.05), v)` (94); `xx/yy` add `cos(angle)/sin(angle)*sin(osc)*amp` (98-99) — a radial zigzag that grows toward the outer end, and `zz = cos(osc)*amp` (100) pushes the same oscillation out of the plane, so the band is a 3D twisted ribbon, not a flat line.
- Colour: the initial `stroke(rcol())` (86) is immediately overwritten; every vertex sets `stroke(getColor(ic + dc*i + time))` (101) with `dc = random(0.2)*random(1)` (81), so the palette index advances (slowly or fast) along the line and cycles through the 3-colour palette `#4E87C5, #BA8FE7, #F76A0B` (115). `getColor(float)` (125-130) takes `v % 3` and `lerpColor`s between the two adjacent palette entries with gamma `pow(v%1, 0.6)`.
- Randomness enters via: `fov`, `endAngle`, `initRadius`, `endRadius`, `powRadius`, `endOsc`, `initAmp`, `endAmp`, `dc`, `rcol()` — all under `randomSeed(seed)` (51). `millis()`-driven rotation and colour phase break frame-to-frame determinism (`deterministic: false` in baseline/result.json), so only large differences between renders are meaningful.
- `PShader noi` (line 18) and the `toxi`/`triangulate` imports (1-2) are declared but never used.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
(pending experiments)
