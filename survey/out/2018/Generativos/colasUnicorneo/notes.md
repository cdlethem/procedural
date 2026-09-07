---
sketch: 2018/Generativos/colasUnicorneo
year: 2018
renderer: P3D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1687
animated: false
techniques: [spiral, curves, dots-stippling]
primitives: [ellipse, shape]
palette:
  colors: ["#FF4B00", "#FFC500", "#00DEB5", "#3030D0", "#FF97D6"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: tailCount, default: 80, tried: [40], change: large, effect: "sparser composition; more background shows through between tails"}
  - {name: shrink, default: 0.99, tried: [0.97], change: large, effect: "tails become short stubby teardrops; no long tapering tips"}
  - {name: colorDrift, default: "random(0.02)", tried: ["random(0.1)"], change: large, effect: "rapid rainbow banding along each tail instead of one smooth two-colour blend"}
  - {name: vel, default: 0.02, tried: [0.08], change: large, effect: "longer, straighter, more elongated tails with gentler curves"}
  - {name: startSize, default: "width*random(0.1, 0.3)", tried: ["width*random(0.05, 0.1)"], change: large, effect: "much smaller, thinner tails; lots of flat background visible"}
  - {name: decoCount, default: "random(-2, 4)", tried: ["random(4, 8)"], change: large, effect: "more small gradient rings and dots scattered across the canvas"}
reusable_candidates:
  - {name: taperTail, signature: "taperTail(x, y, size, ang, vel, shrink, angleJitter, colorDrift, alpha) -> void", note: "walk a drifting angle, draw shrinking ellipses until size < 0.5; produces the flame/tail shapes"}
  - {name: gradientRing, signature: "gradientRing(x, y, r1, r2, c1, c2) -> void", note: "two-tone annulus of quads whose colour lerps around the circumference (circle())"}
  - {name: paletteLerp, signature: "paletteLerp(colors, v) -> color", note: "wrap a float index around a palette and lerp between adjacent entries (getColor)"}
---

## What it draws
A full-bleed mosaic of large, smoothly blended organic flame/tail shapes that taper to
needle points, in saturated orange, blue, pink, green and yellow. Each shape's colour
shifts gradually along its length (e.g. orange into blue, yellow into teal). Scattered on
top are small two-tone gradient rings and a few tiny dots.

## How the code works
- `setup()` calls `generate()` once; `draw()` is empty, so the image is static
  (regenerated only on key press, lines 13-23).
- `generate()` (lines 25-64): background is a random palette colour (line 26, `rcol()`);
  `noStroke()`. The outer loop (line 28) draws 80 "tails": each starts at a random point
  with diameter 10-30% of the width (lines 29-31), a random angle and a random colour
  index `ic` with slow drift `dc` (lines 33-34).
- The inner `while (s > 0.5)` loop (lines 36-49) is the core: each step the angle
  wiggles by `random(-0.1, 0.1)` (line 37), the point advances by `s*vel` in the
  angle's direction (lines 38-39), `ic += dc` (line 40), then an ellipse of diameter
  `s` is drawn at alpha 250 (lines 41-42) and `s *= 0.99` (line 48). Overlapping
  ellipses of shrinking size trace a curved, tapering tail whose colour drifts along its
  length.
- With 0.2% probability per step a small gradient ring is stamped at the tip
  (lines 43-47).
- After each tail, `cc = random(-2, 4)` small decorations are placed (lines 51-62): a
  solid dot plus a two-tone ring via `circle()`.
- `circle()` (lines 66-85) builds the ring as `res` quads between radii `r1` and `r2`;
  each quad's fill lerps between two palette colours by the absolute cosine of its
  angle, so colour varies smoothly around the circumference.
- `getColor(float)` (lines 99-106) wraps the float index modulo the 5-colour palette
  and `lerpColor`s between adjacent entries, so any float gives a smooth colour.
- Randomness enters through the seed field (line 1), positions/sizes/angles per tail,
  the per-step angle jitter, ring placements, and the background colour.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| k_40 | `for (int k = 0; k < 80; k++) {` -> `for (int k = 0; k < 40; k++) {` | large | sparser: same-sized tails but half as many, more flat blue-violet background visible between them | variants/k_40/frame_00001.png |
| shrink_0.97 | `s *= 0.99;` -> `s *= 0.97;` | large | tails are short and stubby, rounded droplets with only a small pointed tip; no long tapers | variants/shrink_0.97/frame_00001.png |
| dc_0.1 | `float dc = random(0.02);` -> `float dc = random(0.1);` | large | each tail shows many rapid colour transitions - striped rainbow cones (orange/blue/green/pink bands) instead of a single smooth blend | variants/dc_0.1/frame_00001.png |
| vel_0.08 | `float vel = 0.02;` -> `float vel = 0.08;` | large | much longer, straighter, more elongated tapering ribbons sweeping across the canvas; curves are gentler | variants/vel_0.08/frame_00001.png |
| sstart_0.05 | `float s = width*random(0.1, 0.3);` -> `float s = width*random(0.05, 0.1);` | large | small, thin teardrop tails; large areas of flat blue background dominate | variants/sstart_0.05/frame_00001.png |
| cc_8 | `int cc = int(random(-2, 4));` -> `int cc = int(random(4, 8));` | large | many more small two-tone gradient rings and dots scattered over a densely packed canvas | variants/cc_8/frame_00001.png |

Note: every substitution shifts the `random()` stream, so in each variant the whole
composition (tail positions, background colour) also differs from the baseline; the
observations above isolate the parameter's effect on shape/colour/density.

## Modularisation notes
- The while-loop tail (lines 36-49) is fully generic: given start position/size/angle,
  step velocity, shrink rate, angle jitter, colour drift and alpha it draws a tapering
  curved ribbon. `taperTail(x, y, size, ang, vel, shrink, angleJitter, colorDrift,
  alpha)` would be the library function.
- `circle()`/`gradientRing` is generic and decoupled from the palette (takes two
  colour indices); `getColor(float)`/`paletteLerp` is a reusable palette utility.
- Art decisions: the 5-colour palette, 80 tails, start size range 0.1-0.3 of width,
  `vel = 0.02`, shrink 0.99, jitter 0.1, `dc < 0.02`, decoration count -2..3.
- A clean parameter object: `{tailCount, sizeRange, vel, shrink, angleJitter,
  colorDrift, alpha, decoCount, palette}`.
