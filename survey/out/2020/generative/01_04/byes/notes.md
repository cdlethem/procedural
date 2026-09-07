---
sketch: 2020/generative/01_04/byes
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1820
animated: false
techniques: [image-source, blend-modes, shader, distortion]
primitives: [image, pgraphics]
palette:
  colors: ["#B85807", "#FAC440", "#F4C8BF", "#A0B9A6", "#A1B2EA"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: 1000, tried: [300, 3000], effect: "stamp count: 300 = sparser, smoother pastel bands with few recognisable eyes; 3000 = denser, many more eye shapes visible through the blur"}
  - {name: tintAlpha, default: 180, tried: [255], effect: "255 (fully opaque tint) = high-contrast, saturated deep reds/greens with crisp dark pupils; baseline 180 = washed-out pastel"}
  - {name: blurPasses, default: 8, tried: [2], effect: "2 = much less smearing, sharper discrete eye ellipses and shorter horizontal streaks; the collage reads more literally"}
  - {name: maskCount, default: 200, tried: [600], effect: "subtle: denser mask texture fed to the shader gives slightly more varied streaking; lower eye more legible, upper area finer-grained"}
reusable_candidates:
  - {name: stampCollage, signature: "stampCollage(imgs[], count, sizeRange, alpha, blendP, palette) -> PGraphics", note: "randomly stamp tinted images with mixed blend modes over a canvas"}
  - {name: directionalBlur, signature: "directionalBlur(canvas, passes, ampStart, ampStep) -> void", note: "iterative PShader blur with per-pass growing direction vector"}
  - {name: lerpPalette, signature: "lerpPalette(colors[], v) -> int", note: "smooth index->colour ramp wrapping around a palette list"}
---

## What it draws
A full-bleed, overexposed pastel collage of photographic eye images (18 source photos) scattered
across a 960x960 canvas. Stamps are wide and squashed, heavily tinted at low alpha, and then smudged
by an 8-pass directional shader blur into horizontal/oblique streaks; a few darker eye silhouettes and
iris circles remain recognisable, especially in the lower third. Frames 10/60 are blank-white capture
artifacts (static sketch, empty `draw()`), so frame 1 is the artwork.

## How the code works
- `setup()` (L27-46) loads 18 `eyeN.png` photos, the `blur.glsl` shader, calls `generate()` once;
  `draw()` (L48-50) is empty, so the piece is static.
- A scratch `PImage mask` (L70-84) is built by stamping 200 random eye photos at random grey tints
  (L75-82); it is later fed to the shader as a texture (L128) and drives where/how the blur samples.
- Main collage (L102-123): 1000 stamps. x is uniform; y is biased by `val = random(1)*random(1)`
  (L108), which concentrates stamps toward the bottom (L109). Width `width*random(0.7,1.4)` vs height
  `height*random(0.1,0.5)*(0.2+val)` (L112-113) makes each stamp a wide, short ellipse-like smear.
- Blend mode per stamp (L116-118): 20% ADD, 20% DARKEST, 60% NORMAL — ADD lifts areas to white,
  DARKEST leaves the darker eye silhouettes.
- Colour (L120, L166-172): `getColor(i*ac+ic)` lerps between adjacent entries of the 5-colour palette
  (L154) with `pow(v%1, 0.6)` easing; `ic` and `ac` randomise start and ramp speed per run. Tint alpha
  is `random(180)`, keeping everything translucent and washed-out.
- Blur (L128-138): 8 passes of the shader, each pass applied twice — once horizontally with
  `blurAmp = 0.0001 + i*0.002` growing each pass, once with a randomised vertical component
  (L136) — producing the streaked, smearing distortion. `it = random(100)` offsets the (unused)
  `time` uniform.
- Randomness enters only via `randomSeed(seed)`/`noiseSeed(seed)` (L86-87); deterministic per seed.

## Experiments
| variant | substitution | observation | image |
|---|---|---|---|
| cc_300 | `int cc = 1000;` -> `int cc = 300;` | sparser: broad smooth pastel bands, few recognisable eyes, more flat sky-like area | variants/cc_300/frame_00001.png |
| cc_3000 | `int cc = 1000;` -> `int cc = 3000;` | denser: large iris top-centre and clear eye bottom-left emerge from the blur; busier streaks | variants/cc_3000/frame_00001.png |
| alpha_255 | `tint(getColor(i*ac+ic), random(180));` -> `tint(getColor(i*ac+ic), random(255));` | dramatic: opaque stamps, high-contrast saturated reds/greens, crisp dark pupils, dark moody piece | variants/alpha_255/frame_00001.png |
| blurpasses_2 | `for (int i = 0; i < 8; i++) {` -> `for (int i = 0; i < 2; i++) {` | less distortion: sharper eye ellipses, short streaks, individual stamps legible | variants/blurpasses_2/frame_00001.png |
| maskcount_600 | `for (int i = 0; i < 200; i++) {` -> `for (int i = 0; i < 600; i++) {` | subtle: denser mask drives slightly more varied streak directions; lower eye and cyan mid ellipse clearer | variants/maskcount_600/frame_00001.png |

## Modularisation notes
- `generate()` is a self-contained pipeline: build mask -> stamp loop -> blur loop. Each stage is
  already parameterised by local variables, so a clean `CollageParams` object (stamp count, size
  ranges, alpha, blend probabilities, palette, blur passes/amp) would drop in directly.
- Generic library material: the tinted-stamp loop with per-stamp blend mode (works for any image set),
  the `lerpPalette` ramp, and the iterative directional-blur pass.
- One-off art decisions: the specific eye photo set, the `val` bottom-bias trick, the `pow(v%1,0.6)`
  easing, and the 5-colour palette choice. The `SimplexNoise`/triangulate imports are unused dead weight.
