---
sketch: 2018/Generativos/numbers
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1940
animated: false
techniques: [flow-field, typography, particles]
primitives: [text]
palette:
  colors: ["#D81D03", "#101A9D", "#1C7E4E", "#F6A402", "#EFD4BF", "#E2E0EF", "#050400"]
  selection: fixed
composition: full-bleed
parameters:
  - {name: det (noise scale), default: "random(0.02)", tried: ["random(0.02)*0.1", "random(0.02)*8"], change: large, effect: "lower = long gentle curves, digits legible, sparser; higher = short jittery turns, finer texture"}
  - {name: trail count, default: 1000, tried: [300], change: large, effect: "fewer trails = elongated parallel bands, more background showing"}
  - {name: sub (stamps per trail), default: 200, tried: [50], change: large, effect: "fewer stamps = short separate petal clumps with white gaps"}
  - {name: vel, default: 0.5, tried: [2.0], change: large, effect: "faster = stamps spread out, individual digits legible, sparser coverage"}
  - {name: fill alpha, default: 50, tried: [200], change: subtle, effect: "no visible structural change; dense overlap already saturates the field"}
reusable_candidates:
  - {name: advectGlyphs, signature: "advectGlyphs(glyphs, count, steps, speed, noiseScale, noisePhase, alpha, rampFrom, rampTo) -> void", note: "N glyphs advected along a 2-D Perlin angle field, drawn with a linear fill fade along the trail"}
  - {name: fadeRamp, signature: "fadeRamp(step, steps, from, to, alpha) -> color", note: "linear grayscale ramp along a trail, 230 -> 30 at alpha 50"}
---

## What it draws
Full-bleed, almost monochrome field: a light gray ground packed edge to edge with
hundreds of soft, swirling, petal- or feather-like shapes. Each shape is a single digit
(0–9) stamped ~200 times while drifting along a smooth noise-driven flow, with the fill
fading from near-white to near-black along the trail. The heavy overlap of translucent
stamps dissolves the individual digits into organic, leaf-like grayscale strokes; no
digit is legible at normal zoom. Dominant tones: light gray, mid gray, near-black.

## How the code works
- `setup()` (lines 5–13): 960×960 P2D, `smooth(8)`, creates a 96 px "Archivo Black" font
  (font missing on this system, fallback used per stderr), calls `generate()` once.
  `draw()` (lines 15–16) is empty, so the image is static; `keyPressed` regenerates with
  a new random seed (lines 18–24).
- `generate()` (lines 26–52): `background(230)` light-gray ground (line 27);
  `noiseDetail(1)` — one octave of Perlin noise (line 32); `det = random(0.02)` (line 34)
  is the spatial frequency of the flow field; `des = random(TWO_PI)` (line 35) a phase
  offset so the field differs per run.
- Outer loop (line 36): 1000 trails. Each picks a random digit `val` 0–9 (line 37), a
  random start slightly outside the canvas (lines 38–39), constant speed `vel = 0.5`
  (line 40), `sub = 200` stamps per trail (line 42), and a random glyph size 8–96 px
  (line 43).
- Inner loop (lines 44–50): `fill` maps the stamp index `j` 0→sub from gray 230 down to
  30 at alpha 50 (line 45), so each trail fades light→dark; the digit is drawn at (x, y)
  (line 46); the heading is `ang = noise(des + x*det, des + y*det) * TWO_PI` (line 47) —
  2-D Perlin noise sampled at the current position — and the point advances by `vel`
  along that angle (lines 48–49). That advection along a smooth angle field is what turns
  a row of repeated digits into a curving, tapering "petal".
- The `colors[]` array and `rcol()` / `getColor()` (lines 59–71) are never called — dead
  code; the visible image is pure grayscale from the `fill` ramp and background.
- Randomness: `seed` (line 1, set by harness to 42), digit, start position, glyph size,
  `det`, `des`. Deterministic per seed (baseline `result.json`: deterministic true).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| det_x0.1 | `float det = random(0.02);` -> `float det = random(0.02)*0.1;` | large (mean 0.2399, 0.662) | 10x lower noise frequency: trails curve gently over long distances and spread apart; individual digits (9, 5, 2, 6...) clearly legible; larger, sparser clumps | variants/det_x0.1/frame_00001.png |
| det_x8 | `float det = random(0.02);` -> `float det = random(0.02)*8;` | large (mean 0.2358, 0.656) | 8x higher noise frequency: small fast jittery turns; dense forest of short digit trails, many small individual digits visible, finer texture | variants/det_x8/frame_00001.png |
| trails_300 | `for (int i = 0; i < 1000; i++) {` -> `for (int i = 0; i < 300; i++) {` | large (mean 0.2325, 0.613) | 3x fewer trails: coverage drops, long parallel curved bands stand out diagonally, more light-gray background visible | variants/trails_300/frame_00001.png |
| steps_50 | `int sub = 200;` -> `int sub = 50;` | large (mean 0.2824, 0.732) | 4x shorter trails: the mottled field breaks into separate leaf/petal clumps with clear white gaps between them | variants/steps_50/frame_00001.png |
| vel_2 | `float vel = 0.5;` -> `float vel = 2.0;` | large (mean 0.2350, 0.719) | 4x speed: stamps spread along longer paths; individual digits 0-9 clearly legible with slight motion blur; much more light background showing | variants/vel_2/frame_00001.png |
| alpha_200 | `fill(map(j, 0, sub, 230, 30), 50);` -> `fill(map(j, 0, sub, 230, 30), 200);` | subtle (mean 0.0373, 0.085) | no visible structural change: same dense mottled field, near-identical overall tone; pale trail heads slightly more visible (verified: mean gray 139.7 vs 134.7) | variants/alpha_200/frame_00001.png |

Note: the det variants multiply the same `random(0.02)` call rather than replacing it
with a constant, so the random-number stream stays identical to the baseline and only
the noise frequency differs.

## Modularisation notes
- Generic block: the glyph-advection loop (lines 36–51) — N glyphs, each stamped S times
  while following a 2-D Perlin angle field with a linear fill fade. Candidate:
  `advectGlyphs(glyphs, count, steps, speed, noiseScale, noisePhase, alpha, rampFrom, rampTo)`.
  Works with any glyph set, not just digits.
- Generic: the fill ramp `map(j, 0, sub, 230, 30)` with fixed alpha — a simple
  trail-fade; could be parameterised (ramp colours, alpha, optional non-linear curve).
- One-off art decisions: using digits 0–9 as the glyph set, Archivo Black at random
  8–96 px size, background 230, the 7-colour array (unused), keyboard regeneration.
- Clean parameter object: `{count: 1000, steps: 200, speed: 0.5, noiseScale: det,
  noisePhase: des, sizeRange: [8, 96], alpha: 50, ramp: [230, 30], background: 230,
  glyphs: "0123456789"}`.
