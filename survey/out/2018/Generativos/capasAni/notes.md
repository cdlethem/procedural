---
sketch: 2018/Generativos/capasAni
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1673
animated: false
techniques: [flow-field, grid, particles, shader]
primitives: [shape, ellipse]
palette:
  colors: ["#FE603C", "#242D3B", "#027ECB", "#E5B270", "#FD9EC8", "#FDD3C7"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: "random(1,50)", tried: [8], change: large, effect: "coarse grid: big overlapping discs tile the whole canvas in a regular clover-like pattern, grid dots prominent"}
  - {name: fishCount, default: 80, tried: [300], change: subtle, effect: "many more small comet trails scattered over the canvas; large arcs and overall tone unchanged"}
  - {name: fishSize, default: "random(200)", tried: [400], change: subtle, effect: "trails become thicker and chunkier; composition unchanged"}
  - {name: arcAlpha, default: 120, tried: [255], change: large, effect: "big discs become strong opaque pastel masses covering most of the canvas; trails barely visible"}
  - {name: veil, default: "fill(0,20)", tried: [120], change: subtle, effect: "overall slightly darker; trails a touch less visible"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, col, alp1, alp2)", note: "annular sector built from quads with alpha gradient from alp1 (outer) to alp2 (inner)"}
  - {name: noiseTrail, signature: "noiseTrail(x, y, size, steps, offset, detail) -> PVector[]", note: "walk backwards along a 2-D Perlin flow field, one point per step (Fish.update)"}
  - {name: taperedTrail, signature: "taperedTrail(points, angles, width, col1, col2)", note: "closed tapered shape along a path, width ~ pow(t,0.7), lerpColor fill (Fish.show)"}
  - {name: blurVignetteGrain, signature: "blurVignetteGrain(brt, satGain, con, noiseAmt)", note: "GLSL post: 9-tap Gaussian blur + CSB color shift + radial vignette + random grain"}
---

## What it draws
A dark, hazy composition (deep maroon-black at the edges, warmer brown in the middle) filled with
several huge translucent ring/arc shapes in salmon pink, red-orange and muted blue that overlap
across the whole canvas. Scattered over them are dozens of small elongated comet or teardrop
trails in orange, pink and pale blue, each fading to a sharp point, plus tiny coloured dots at
regular grid intervals. A blur + vignette + grain post-filter gives the whole image a soft,
filmic, out-of-focus look.

## How the code works
- `setup()` (lines 5-15): 960x960 P2D, loads `post.glsl`, calls `generate()` once. `draw()` is
  empty (line 17-19), so the image is static; `keyPressed` would regenerate but the harness never
  presses keys.
- `generate()` (lines 32-115): picks a noise offset `des = random(1000)` and noise detail
  `det = random(0.004)` (lines 36-37), reseeds with `seed`, `background(10)`.
- Fish (lines 45-50): 80 `Fish` objects at random positions with size `random(200)`.
  `Fish.update()` (lines 186-225) samples the 2-D Perlin field `noise(des+x*det, des+y*det)*TAU`
  for a direction and walks backwards along it (`cos(ang+PI)`, line 216), storing one point and
  angle per step (`s/10` steps). An amplitude envelope (lines 195-200) fades the trail in and
  out over its life. `Fish.show()` (lines 227-255) builds the comet: for each point it offsets
  perpendicularly by a width `pow(val,0.7)*ss*0.5` (line 240) so the trail tapers to a point at
  its tail, filling with `lerpColor(col1, col2, val)` between two drifting palette colours
  (lines 190-193, 241); an `ellipse` head is added at (x,y) (line 254).
- Veil (lines 53-55): a full-canvas `fill(0, 20)` rect darkens the fish layer slightly.
- Grid arcs (lines 57-65): at each of `(cc+1)^2` grid points (cc = 1..50 random, line 42) a full
  annulus `arc2(xx, yy, s*2, s*0.8, 0, TAU, rcol(), 120, 0)` is drawn — outer radius `s`, inner
  `0.4s`, in a random palette colour, alpha 120 fading to 0 across the ring. These are the big
  soft translucent circles.
- Grid dots (lines 67-75): a tiny `s*0.08` ellipse in a random palette colour at every grid point.
- Post-filter (lines 113-114, `data/post.glsl`): 9-tap Gaussian blur (lines 32-56), then
  `csb()` colour shift with brightness 1.1, saturation `1.2+(1-dis)*1.4` (higher at centre),
  contrast 1.2 (line 66), multiplied by a radial vignette `dis` (line 64, 1.0 at centre to ~0.74
  at corners), 4% random grain (line 67), and a slight per-channel gamma (lines 69-70).
- `arc2` (lines 140-158) tessellates the annulus into quads, each filled with a single alpha
  interpolated across the ring; `rcol()` (lines 259-261) picks a random palette entry;
  `getColor(float)` (lines 265-271) lerps between adjacent palette entries for the fish colours.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_8 | `int cc = int(max(1, random(50)*random(1)));` -> `int cc = 8;` | large | huge translucent discs now tile the whole canvas in a regular repeating clover/flower grid; coloured grid dots clearly visible at every intersection; comet trails still scattered on top | variants/cc_8/frame_00001.png |
| fishCount_300 | `for (int i = 0; i < 80; i++) {` -> `for (int i = 0; i < 300; i++) {` | subtle | many more small comet trails scattered across the whole canvas, including the dark corners; big arcs and overall tone unchanged | variants/fishCount_300/frame_00001.png |
| fishSize_400 | `Fish f = new Fish(random(width), random(height), random(200));` -> `Fish f = new Fish(random(width), random(height), random(400));` | subtle | trails are thicker and chunkier (fatter heads and wider tails); same scatter and tone as baseline | variants/fishSize_400/frame_00001.png |
| arcAlpha_255 | `arc2(xx, yy, s*2, s*0.8, 0, TAU, rcol(), 120, 0);` -> `arc2(xx, yy, s*2, s*0.8, 0, TAU, rcol(), 255, 0);` | large | the big discs are now strong opaque pink/orange/salmon masses covering most of the canvas; trails are barely visible underneath | variants/arcAlpha_255/frame_00001.png |
| veil_120 | `fill(0, 20);` -> `fill(0, 120);` | subtle | overall slightly darker and duller; trails a touch less visible; big arcs unchanged | variants/veil_120/frame_00001.png |

## Modularisation notes
- `arc2` is fully generic (position, radii, angle span, colour, two alpha values) and a strong
  library candidate: an alpha-gradient annulus is a primitive no other sketch in this folder
  seems to provide.
- The `Fish` class is a two-step flow-field trail generator (sample field backwards, then render
  a tapered closed shape with a colour gradient). The update and show halves are separable:
  `noiseTrail()` (pure geometry) and `taperedTrail()` (pure rendering).
- The post shader is self-contained and parameterisable (blur offset, brt/sat/con, vignette
  strength, grain amount) — a reusable `blurVignetteGrain` filter.
- One-off art decisions: the exact 6-colour palette, the two-pass grid (rings + dots), the
  `fill(0,20)` veil, the `cc` count range, the fish life/size ranges. A clean parameter object
  would hold: `cc`, `fishCount`, `fishSizeMax`, `arcAlpha`, `veilAlpha`, `noiseDetail`,
  `noiseOffset`, palette, and the shader's `brt/sat/con/grain` values.
