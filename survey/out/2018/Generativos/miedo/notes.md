---
sketch: 2018/Generativos/miedo
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1723
animated: false
techniques: [noise-field, polar, dots-stippling, packing, shader]
primitives: [ellipse, shape, line]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: layerCount, default: 4, tried: [1], change: large, effect: "one background wash layer instead of four: darker, flatter navy ground; lavender gradient wash nearly gone"}
  - {name: starsPerLayer, default: 2000, tried: [6000], change: moderate, effect: "3x more small star dots; visibly denser fine grain, same overall composition"}
  - {name: conesPerLayer, default: 5, tried: [15], change: large, effect: "many more overlapping cones and big circles; composition gets crowded and busy"}
  - {name: streakCount, default: 100000, tried: [25000], change: moderate, effect: "streak texture sparser; large circles, cones and radar lines read much more clearly"}
  - {name: streakSize, default: 0.04, tried: [0.08], change: large, effect: "streaks twice as long: dense horizontal scratch/rain texture dominates and buries the circles"}
  - {name: palette[0], default: "#FF3D20", tried: ["#FFD23F"], change: subtle, effect: "red-orange elements become yellow-amber; only 1 of 5 palette colors changed"}
reusable_candidates:
  - {name: arcCone, signature: "arcCone(x, y, r1, r2, a1, a2, color, alpha1, alpha2)", note: "radial quads between two radii with per-edge alpha: soft cone/frustum glow (arc2)"}
  - {name: arcBridge, signature: "arcBridge(p1, r1, p2, r2, color, alpha1, alpha2)", note: "quads bridging two circles at the same angle (arc3)"}
  - {name: dashedLine, signature: "dashedLine(x1, y1, x2, y2, dashLen, duty)", note: "manual dash drawing (lineDashed)"}
  - {name: circlePack, signature: "circlePack(count, maxRadius, minDistFactor) -> PVector[]", note: "rejection-sampled non-overlapping circles (lines 131-149)"}
  - {name: noiseStreaks, signature: "noiseStreaks(count, detail, sizeScale, baseAngle) -> draw", note: "per-point 2-D noise gates size, second noise field steers a thin quad + dot + halo (lines 101-129)"}
---

## What it draws
A full-bleed field fading from dark navy-purple at the top to lighter lavender at the bottom,
scattered with many overlapping translucent circles and soft cone-shaped frustums in red-orange,
orange, teal, and deep blue. Fine grain-like streaks and tiny star dots cover the whole surface,
and a web of very thin pale lines connects small dots (nodes) across the composition. No outline
artifacts; everything is soft alpha compositing.

## How the code works
`setup()` -> `generate()` (miedo.pde:15-24, 47) with `randomSeed(seed)`; `background(0)`; `draw()` is empty
(static, confirmed: frames 10/60 identical).

- **Background wash** (lines 53-58, 91-98): `back = rcol()`, horizon `hh = 1.1*height`. Four repeated
  layers each paint a translucent quad from y=0 to hh (top edge `lerpColor(back, rcol(), 0.5)`, bottom
  edge `back` at alpha 40-110), building the vertical gradient over black.
- **Stars** (lines 67-73): 2000 dots per layer, size 0-2, alpha 200-256, random palette color.
- **Cones** (lines 75-89): 5 per layer. Each is a big `ellipse` (diameter up to 0.8*width) plus 4-5
  `arc2()` calls. `arc2` (199-217) draws many thin quads between an inner radius (alpha `alp1`) and an
  outer radius (alpha `alp2`), so one radius is solid and the other fades out: a soft radial cone/frustum.
  `getColor()` (258-263) lerps between adjacent palette entries for these.
- **Streak field** (lines 101-129): 100000 random points. Per-point size `s = random(0.04)*noise(des1+x*det1, des1+y*det1)`
  with `det1 ~ 0.002-0.003`; `s -= 0.02` discards roughly half the points (noise gate). Angle `a` comes
  from a second independent noise field. Each survivor draws a thin 4-vertex quad (length `d = s*random(2,30)`,
  width ~`s*0.1`) in a random palette color, plus a `fill(rcol())` dot and a white `arc2` halo. This is the
  grain/streak texture.
- **Radar network** (lines 131-187): up to 100 circles packed by rejection (diameter up to 0.12*width,
  snapped to 20 px, kept only if `dist > (s+other.z)*0.5`). Each node: palette ellipse, an `arc3` wedge
  (bridge quads to a second random circle), a line to a small "radar" dot placed along one global angle
  `ang`. Radar pairs closer than 14x combined radius get a faint white line plus a colored dashed line
  (`lineDashed`, 237-248).
- **Palette** (line 250): 5 hex colors, `rcol()` picks uniformly at random; `getColor(v)` lerps between
  neighbours.
- **Shader**: `post.glsl` (3x3 blur mix 0.9, brightness 1.2, saturation boosted by radial falloff, slight
  green gamma lift, 2% random grain, radial darkening) is loaded at lines 16/190, but `filter(post)` is
  **commented out** (line 191), so the rendered image is pure P2D with no post pass.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| layers_1 | `for (int c = 0; c < 4; c++) {` -> `... c < 1 ...` | large | darker, flatter navy background; the soft lavender wash of the baseline is mostly gone, so cones and circles pop against a near-black ground | variants/layers_1/frame_00001.png |
| stars_6000 | `for (int i = 0; i < 2000; i++) {` -> `... i < 6000 ...` | moderate | noticeably denser field of tiny star dots and grain; composition otherwise the same | variants/stars_6000/frame_00001.png |
| cones_15 | `for (int i = 0; i < 5; i++) {` -> `... i < 15 ...` | large | three times as many cones/frustums and large circles; much more crowded, shapes overlap into a dense cluster field | variants/cones_15/frame_00001.png |
| streaks_25000 | `for (int i = 0; i < 100000; i++) {` -> `... i < 25000 ...` | moderate | fine streak texture is sparser; the big translucent circles, cones and thin radar lines stand out clearly | variants/streaks_25000/frame_00001.png |
| dotSize_0.08 | `float s = random(0.04)*...noise(...)` -> `random(0.08)*...` | large | streaks twice as long and dense: the whole image becomes a horizontal scratch/rain texture that buries the circles | variants/dotSize_0.08/frame_00001.png |
| palette_yellow | `int colors[] = {#FF3D20, ...}` -> `{#FFD23F, ...}` | subtle | the red-orange circles shift to yellow-amber; rest of palette unchanged, so overall shift is modest | variants/palette_yellow/frame_00001.png |

## Modularisation notes
- Generic, library-worthy: `arc2`/`arc3` (radial cone and bridge quads with dual alpha), `lineDashed`,
  the rejection circle packer, and the noise-streak field (size-gated by 2-D noise, angle-steered by a
  second noise field). The 5-color random palette + neighbor-lerp `getColor` is a clean reusable palette object.
- One-off art decisions: the 4-layer background wash with 1.1x horizon, the specific 0.04 size scale and
  0.02 noise gate, the 14x radar-link distance, the disabled post shader (kept as an optional effect:
  blur + saturation + grain + vignette).
- Clean parameter object: {layerCount, starsPerLayer, conesPerLayer, coneSizeMax, streakCount, streakSize,
  noiseDetail, noiseGate, nodeCount, nodeRadiusMax, linkFactor, palette[], post:bool}.
