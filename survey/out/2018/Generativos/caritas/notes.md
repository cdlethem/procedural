---
sketch: 2018/Generativos/caritas
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: false
ms_first_frame: 1909
animated: false
techniques: [noise-field, shader, distortion]
primitives: [shape, ellipse]
palette:
  colors: ["#FBECE7", "#D5EDDD", "#B8E9E6", "#A0A5E7", "#E2B8DE", "#F4CCD4", "#FF0000", "#000000", "#FFFFFF"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: "random(80,300)", tried: [300], change: large, effect: "denser stacking; since yy is mapped over cc, every row remaps — more layers and more visible faces"}
  - {name: fillAlpha, default: 240, tried: [120], change: none, effect: "no visible change — line 49 fill(rcol(), 240) is dead code: arc2() resets the fill per strip (lines 89/92) before it is ever used"}
  - {name: des, default: "random(1000)", tried: ["random(10)"], change: large, effect: "smoother noise field: dome sizes vary coherently over larger areas, larger flatter domes"}
  - {name: spread, default: "height*1.6", tried: ["height*0.8"], change: large, effect: "rows compressed into top 80% of height: much denser vertical packing, more overlap layers per column"}
  - {name: baseSize, default: "width*random(0.6)", tried: ["width*random(0.3)"], change: large, effect: "smaller, more numerous domes; less overlap so several complete faces are visible"}
reusable_candidates:
  - {name: arc2, signature: "arc2(x, y, s1, s2, a1, a2, color, alp1, alp2) -> void", note: "fan of quads with per-strip alpha gradient; makes soft radial-gradient discs/domes"}
  - {name: postShader, signature: "filter(post) // blur(0.9 mix) + grain(0.1) + csb(sat 8.6-10.2, con 1.2) + vignette + gamma", note: "GLSL that turns the pastel palette into vivid saturated output"}
---

## What it draws
A full-bleed field of overlapping rounded domes ("hills"/mounds) stacked in loose vertical columns, drawn top-to-bottom so lower domes cover upper ones. Colours are highly saturated magentas, cyans, blues, greens and purples with soft grainy, blurred edges and a slight vignette. Most domes are plain, but a few show a tiny face — two small black dot eyes and a small black mouth (a magenta face upper-right, a green face lower-centre, a blue face at the right edge in the seed-42 baseline); the rest are hidden under later, larger domes. The warm off-white background is almost never visible.

## How the code works
`setup()` (caritas.pde:5-13): 960×960 P2D, loads `post.glsl`, calls `generate()` once; `draw()` is empty so the sketch is static (frames 10/60 were identical and dropped). The baseline is flagged non-deterministic, but same-seed runs come out nearly pixel-identical (see fillAlpha variant, mean diff 0.003): the per-run variation is the `millis()`-based size jitter at line 43.

`generate()` (27-72): `des = random(1000)` and `det = random(0.001)` are drawn BEFORE `randomSeed(seed)` (lines 31-34), so they depend on the harness's initial RNG state rather than `seed`. Background `#FBECE7` (35) is almost never visible. Loop `cc = int(random(80,300))` domes (39): x is uniform random (41), y is mapped linearly from 0 to `height*1.6` (42) so the field extends past the bottom edge. Base size `ss = width*random(0.6)` (44) is then modulated by 2-D noise: `ss = pow(noise(det+xx*des, det+yy*des)+(0.1+ms),1)*width*0.5` (47) — the noise scale `des` (up to 1000) makes neighbouring domes vary in size coherently.

Each dome is drawn with the `arc2` helper (79-97), which approximates a circle as many thin quads between radii s1→s2, each filled with a linear alpha ramp (alp1→alp2) — a soft radial-gradient disc:
- main dome `arc2(..., ss, 0, 0, TAU, getColor(), 255, 240)` (50): colour from `getColor()` which lerps between two adjacent entries of the 5-colour pastel palette `{#D5EDDD, #B8E9E6, #A0A5E7, #E2B8DE, #F4CCD4}` (99-111);
- inner glow `arc2(..., ss*0.2, ..., rcol(), 60, 0)` (52): pale centre wash from a random palette pick;
- two faint black rings at `ss*1.2`/`ss*1.6`, alpha 20 (53-54): soft dark halo/shadow around each dome;
- two tiny red `color(255,0,0)` alpha-20 arcs at ±ss*0.1 (57-58): almost invisible blush;
- face (60-63): black eyes as two small vertical ellipses at ±ss*0.1·fs, mouth as a black ellipse below centre whose height scales with `random(0.4,1.8)*fs` (open/closed mouth);
- highlight (65-67): white alpha-40 ellipse + white alpha-40→0 arc at the centre.

Note: `fill(rcol(), 240)` (line 49) is dead code — `arc2()` sets its own fill per strip (lines 89/92), so the line-49 fill is never used (confirmed by the fillAlpha experiment: no visible change). It does consume one RNG draw, so deleting it would shift the whole layout.

Finally `filter(post)` (70-71) applies `post.glsl`: a 9-tap Gaussian blur (mixed in at 0.9 — strong softening), 10% random grain, `csb()` with saturation 8.6–10.2 and contrast 1.2 (this is what turns the pastels into the vivid magenta/cyan/green seen in the image), a vignette (`dis` term), and per-channel gamma (r^1.1, g^0.98, b^0.9).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_300 | `int cc = int(random(80, 300));` -> `int cc = 300;` | large (0.2839, 83%) | much denser stacking: more layers per column, more small faces visible (several dot-eyes across the field); dome size unchanged; whole layout remaps because yy depends on cc | variants/cc_300/frame_00001.png |
| fillAlpha_120 | `fill(rcol(), 240);` -> `fill(rcol(), 120);` | none (0.0028, 0.1%) | no visible change — the line-49 fill is dead code: `arc2()` overrides the fill for every strip (lines 89/92), so the dome body never uses it; residual diff is per-run millis() jitter | variants/fillAlpha_120/frame_00001.png |
| des_10 | `des = random(1000);` -> `des = random(10);` | large (0.2, 60%) | smoother size field: neighbouring domes get similar sizes, producing larger flatter domes and broader same-colour regions instead of locally varied sizes | variants/des_10/frame_00001.png |
| spread_0.8 | `float yy = map(i, 0, cc, 0, height*1.6);` -> `... height*0.8);` | large (0.3215, 90%) | rows compressed into the top 80% of the height: vertical packing about twice as dense, much more overlap per column, bottom rows still cover the canvas edge | variants/spread_0.8/frame_00001.png |
| baseSize_0.3 | `float ss = width*random(0.6);` -> `... random(0.3);` | large (0.1932, 56%) | smaller, more numerous domes; less overlap, so several complete faces are visible (cyan, pink and green faces lower half) instead of mostly hidden ones | variants/baseSize_0.3/frame_00001.png |

## Modularisation notes
- `arc2` (79-97) is the reusable core: a generic "gradient disc/dome" primitive — a fan of quads with a per-strip alpha ramp between two radii/angles. Library candidate `gradientArc(x, y, rOuter, rInner, a1, a2, color, alphaOuter, alphaInner)`.
- The dome-composition recipe (main disc + inner glow + dark halo rings + blush + face + highlight) is the one-off art decision, but it is a clean parameter object: `{size, paletteIndex, face: {eyeScale, mouthOpen}, haloAlpha}`.
- The noise-driven size modulation (line 47) is a small generic piece: sample 2-D noise at a scale, add jitter, multiply by width — `noiseScaleSize(x, y, scale, base)`.
- `post.glsl` is a self-contained reusable post pass (blur+grain+CSB+vignette+gamma); its saturation constant (8.6) is the single most important look parameter of the sketch — the palette in the code is pastel, the output is vivid only because of the shader.
- Cleanup candidates for any library port: delete dead `fill(rcol(), 240)` (line 49) — but note it consumes an RNG draw, so layouts would shift; the `ms` variable (line 43) bakes `millis()` into the geometry, which is what makes runs non-deterministic — replace with a seeded value for reproducibility.
- Suggested parameter object: `{seed, count, sizeBase, noiseScale, spread, faceScale, palette, post: {blurMix, grain, sat, con, vignette}}`.
