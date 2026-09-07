---
sketch: 2018/Generativos/cintas
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1562
animated: false
techniques: [noise-field, curves]
primitives: [shape]
palette:
  colors: ["#181818", "#F19617", "#251207", "#15727F", "#CEAB81", "#BD3E36"]
  selection: random-from-list
composition: radial
parameters: []
reusable_candidates:
  - {name: noiseWalk, signature: "noiseWalk(steps, stepLength, noiseScale, noiseOffset, angleBias) -> PVector[]", note: "random walk where heading = noise(x*det, y*det)*TWO_PI - ang"}
  - {name: ribbonStrip, signature: "ribbonStrip(PVector[] pts, float z0, float z1, color fill) -> void", note: "closed quad per consecutive point pair between two z depths; flat ribbon with offset edge under 3D rotation"}
---

## What it draws
Ten wide, flat-colored ribbons radiate from the canvas center in all directions, like a starburst of petals or streamers, on a near-black background. Each ribbon is a single solid color drawn from a five-color palette: orange, tan, dark brown, teal, and brick red. The bands curve gently, overlap each other, and several run off the edges of the canvas; along some ribbon edges a thin sliver of a neighboring color shows (the offset between the ribbon's two depth layers).

## How the code works
- `setup()` (lines 2–7): 960x960 P3D, `smooth(8)`, `pixelDensity(2)` (warning: not available for this display). `draw()` is empty, so the image is produced once by `generate()` and is static.
- `generate()` (lines 20–68): background `#181818`; translate to center; `ortho()`; random 3D tilt via `rotateX`/`rotateY` up to ±1.2 rad (lines 25–26) — this is what makes each ribbon's two depth layers (z=0 and z=100) appear slightly offset on screen, creating the thin edge slivers.
- Per ribbon (loop line 33, 10 ribbons): random angle bias `ang`, random noise offset `des`, noise scale `det = random(0.001, 0.02)*random(1)` (line 32, shared across ribbons).
- Two 1000-step walks (lines 40–53): heading `a = noise(des+x*det, des+y*det)*TWO_PI - ang`, step `vel = 5` per iteration. First 1000 points are prepended (outward path), next 1000 walk in the opposite direction (`x -= cos(a)*vel`), so each ribbon is a closed loop that leaves the center and returns.
- Rendering (lines 56–67): `noFill` is NOT used — one `fill(rcol())` per ribbon (line 57, outside the segment loop), then for every consecutive point pair a closed quad is drawn with vertices at (p1,z=0), (p1,z=100), (p2,z=100), (p2,z=0). So each ribbon is a flat strip of depth 100; under the 3D rotation the far edge peeks out as a sliver.
- Color (lines 77–81): palette `{#F19617, #251207, #15727F, #CEAB81, #BD3E36}`, `rcol()` picks one random element per ribbon. `getColor`/`getColor(float)` (lerp-between) is defined but unused.
- Randomness enters via the harness-set `seed` field (line 1), then `rotateX/Y`, `det`, and per-ribbon `ang`/`des`/color.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- Generic: `noiseWalk` (heading from 2-D noise, fixed step length) and `ribbonStrip` (quad strip between two z depths) are both reusable as library primitives; `rcol` is trivially generic.
- One-off art decisions: 10 ribbons; the out-and-back trace that closes each loop; ortho + random 3D tilt of the whole ribbon plane; depth 100; dark background; the specific 5-color palette.
- Clean parameter object: `{ribbonCount: 10, steps: 1000, stepLength: 5, noiseScale: det, depth: 100, tiltRange: 1.2, palette, background}`.
