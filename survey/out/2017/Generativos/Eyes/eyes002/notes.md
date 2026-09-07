---
sketch: 2017/Generativos/Eyes/eyes002
year: 2017
renderer: JAVA2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 3118
animated: false
techniques: [image-source, particles, symmetry]
primitives: [image]
palette:
  colors: ["#0795D0", "#019C54", "#F5230D", "#DF5A48", "#F1BF16", "#F0C016", "#F4850C", "#E13E33", "#746891", "#623E86", "#00A2C6", "#EBD417"]
  selection: image-sampled
composition: full-bleed
parameters:
  - {name: scatterCount, default: 300, tried: [100], change: large, effect: "fewer randomly scattered single eyes; trails and rosettes become the dominant layers, canvas still full"}
  - {name: trailCount, default: 120, tried: [40], change: large, effect: "most of the curving eye-trails disappear; full-size scattered eyes and rosette rings stand out"}
  - {name: scatterScale, default: "random(0.1,0.9)", tried: ["random(0.4,1.4)"], change: moderate, effect: "scattered eyes are bigger with more large individual irises; the fine carpet of tiny eyes is reduced"}
  - {name: trailAlpha, default: "map(j,0,cc,40,240)", tried: ["map(j,0,cc,200,255)"], change: subtle, effect: "trail stamps less transparent; streaks slightly less faded, overall look similar"}
  - {name: trailLen, default: "int(random(20,300))", tried: ["int(random(20,80))"], change: subtle, effect: "shorter trails; canvas still dense, difference only in streak length"}
reusable_candidates:
  - {name: imageScatter, signature: "imageScatter(img, count, scaleMin, scaleMax) -> void", note: "stamp an image at random positions/rotations/scales over the canvas"}
  - {name: imageTrail, signature: "imageTrail(img, count, steps, vel, decay) -> void", note: "random-walk trail of shrinking, fading image stamps"}
  - {name: imageRosette, signature: "imageRosette(img, rings, petals, radius) -> void", note: "rotated copies arranged in a circle about the center"}
---

## What it draws
The canvas is completely covered with a dense collage of the same photographic blue human
eye (iris, pupil, sclera, pinkish lids). Most eyes are scattered at random sizes and
orientations; many eyes form thin curving "trails" that shrink and fade as they walk across
the surface, producing pale, worm-like streaks. A few larger eyes sit in loose rings around
the middle. The overall tone is pale beige/pink with blue-grey irises and black pupils.

## How the code works
`setup()` loads `eye.png` into `PImage eye` and calls `generate()` once (lines 5–11);
`draw()` is empty, so the piece is static. `generate()` (lines 32–92) has three layers,
all stamping the same image with `imageMode(CENTER)` and `pushMatrix/translate/rotate`:

1. **Scatter (lines 38–47):** 300 stamps at random `(x, y)`, random rotation, scale
   `random(0.1, 0.9)*random(1)` (so small to large, biased small). This is the dense
   background carpet of eyes.
2. **Trails (lines 49–71):** 120 random walks; each step advances `vel = random(4)`
   pixels along a direction that drifts by `ma = random(-0.03, 0.03)`, the scale decays by
   `ss = random(0.94, 0.99)`, and the eye is stamped with
   `tint(255, map(j, 0, cc, 40, 240))` (line 64) so the head of each trail is nearly
   invisible and the tail nearly opaque — hence the pale streaks. Trail length
   `cc = int(random(20, 300))` (line 58).
3. **Rosettes (lines 75–91):** 10 groups of `cc = int(random(3, 13))` copies placed on a
   circle of radius `dis = random(0.1, 0.6)*width` about the canvas center (lines 83–84),
   each rotated to its ring angle (line 87) — the radial clusters visible in the middle.

Randomness comes from the unseeded `random()` stream; the harness pins it via `seed`.
Colours are entirely from the photograph (`eye.png`); the `colors[]` array (line 95) and
`rcol()`/`getColor()` are dead code (the `background(rcol())` calls are commented out,
lines 33–34). The pale background is the untinted canvas showing through.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| scatter_100 | `for (int i = 0; i < 300; i++) {` -> `for (int i = 0; i < 100; i++) {` | large | fewer randomly scattered single eyes; the trail streaks and rosette rings now dominate, but the canvas still reads as a dense full-bleed collage | variants/scatter_100/frame_00001.png |
| trails_40 | `for (int i = 0; i < 120; i++) {` -> `for (int i = 0; i < 40; i++) {` | large | most curving eye-trails gone; the image is now mostly full-size scattered eyes and loose rings, with only a few thin streaks | variants/trails_40/frame_00001.png |
| scale_0.4-1.4 | `float s = random(0.1, 0.9)*random(1);` -> `float s = random(0.4, 1.4)*random(1);` | moderate | scattered eyes are visibly larger with more big individual irises; the fine carpet of tiny eyes is reduced | variants/scale_0.4-1.4/frame_00001.png |
| alpha_200-255 | `tint(255, map(j, 0, cc, 40, 240));` -> `tint(255, map(j, 0, cc, 200, 255));` | subtle | trail stamps are more opaque, so streaks are a little less faded/ghostly; overall composition unchanged | variants/alpha_200-255/frame_00001.png |
| traillen_20-80 | `int cc = int(random(20, 300));` -> `int cc = int(random(20, 80));` | subtle | trails are shorter; the collage still looks full-bleed, only the longest streaks are missing | variants/traillen_20-80/frame_00001.png |

## Modularisation notes
- **Generic:** the three stamping patterns are independent of the source image — a
  `Scatter` (random stamps), a `Trail` (drifting random walk with scale decay and
  per-step alpha ramp), and a `Rosette` (n copies on a circle, rotated to the radius
  angle). Any of them would take a `PImage`/draw-callback plus the counts/scales above.
- **One-off art decisions:** using one photographic eye everywhere, the alpha ramp
  `map(j, 0, cc, 40, 240)` that makes trails fade at the head, and the fixed canvas
  center for rosettes.
- **Parameter object:** `{ scatterCount, trailCount, rosetteCount, scaleRange, trailVel,
  trailDecay, trailAlphaRange, rosetteRadiusRange, rosettePetalsRange }` plus the source
  image. The `colors[]`/`getColor()` helpers should be dropped or wired to a background.
