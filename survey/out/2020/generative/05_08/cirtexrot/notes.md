---
sketch: 2020/generative/05_08/cirtexrot
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1696
animated: false
techniques: [image-source, blend-modes]
primitives: [image]
palette:
  colors: ["#FFFFFF", "#FFB0D0", "#F7DE20", "#245C0E", "#EB6117", "#F72C11", "#C6356B", "#953DC4", "#003399", "#02060D"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: stampCount, default: 1000, tried: [400], change: large, effect: "fewer stamps: darker overall, individual mottled patches separate with black ground visible in gaps"}
  - {name: tintAlphaMax, default: 80, tried: [160], change: large, effect: "higher tint alpha: much brighter, large areas blow out to white, pink/magenta/yellow more saturated"}
  - {name: sizeScale, default: "0.1-0.2", tried: ["0.05-0.1"], change: large, effect: "half-size stamps: smaller finer mottling, darkest variant, black ground shows between patches"}
  - {name: palette, default: "10-color warm/mixed list", tried: ["10-color blue monochrome list"], change: large, effect: "hue swaps entirely to blue/cyan/teal with pale blue-white highlights; mottling structure unchanged"}
  - {name: smooth, default: 8, tried: [2], change: none, effect: "no visible change (pixel-identical to baseline)"}
reusable_candidates:
  - {name: brushStampScatter, signature: "brushStampScatter(brushes[], count, sizeRange, alphaMax, palette, blend) -> void", note: "scatter N tinted brush stamps at random positions/sizes with a given blend mode; the whole look of this sketch"}
  - {name: randomPaletteTint, signature: "randomPaletteTint(colors[]) -> color", note: "pick one of N palette colors at random (rcol)"}
---

## What it draws
Full-bleed soft, mottled cloud texture on a dark ground, like overlapping watercolor or
spray-paint blotches. Dominant hues are purple/magenta, orange-red and yellow-ochre, with
green-grey and pink fields; where many stamps overlap the additive blending brightens areas
toward pale yellow-white. The texture is grainy at close range (a fine speckled grain), and
the corners and edges of the canvas are darker and sparser.

## How the code works
- `setup()` (cirtexrot.pde:24-39) loads two brush textures `brush/brush01.png`,
  `brush/brush02.png` — both are nearly-white images with a fine speckled grain — then calls
  `generate()` once. `draw()` (41-43) is empty, so everything is drawn a single time in
  setup; the sketch is static.
- `generate()` (54-144): `randomSeed(seed)`/`noiseSeed(seed)` (56-57), `background(0)` (58),
  `rectMode(CENTER)`/`imageMode(CENTER)` (60-61), `noStroke()` (85), `blendMode(ADD)` (87).
- The only active loop is lines 89-97: 1000 iterations. Each picks a random position
  (90-91), a size `s = width*random(0.1,0.2)*3*random(0.4,1)` i.e. roughly 115-576 px at 960
  (92), tints a randomly chosen brush with a random palette color at low alpha,
  `tint(rcol(), random(80))` (94), and stamps it with `image()` (96).
- Colour: `rcol()` (154-156) picks one of the 10 colors in `colors[]` (153) at random.
  Because the brush PNGs are nearly white, the tint color is what you see; the grain in the
  PNGs gives the mottled speckle. 1000 low-alpha stamps accumulated in ADD blend mode build
  the hazy overlapping color fields, and ADD pushes dense overlaps toward white/pale yellow.
- Lines 77-83 compute noise parameters (`detAng`, `desAng`, `detAmp`, `detCol1/2`) that are
  only used by the commented-out second loop (99-143), which would have drawn
  noise-oriented, noise-coloured textured rings. The `SimplexNoise` (toxi) and triangulate
  imports are therefore vestigial in the active code path — no noise actually drives the
  visible output.
- Baseline note: `frame_00010.png`/`frame_00060.png` are a full-canvas white clear
  (renderer artifact of the empty `draw()` under P2D), not sketch animation; only
  `frame_00001.png` shows the artwork.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_400 | `for (int i = 0; i < 1000; i++)` -> `for (int i = 0; i < 400; i++)` | large (mean 0.2408, 91.2% px) | darker; the mottling breaks into distinct separate blotches with black ground showing between them; same warm purple/orange/yellow scheme | variants/count_400/frame_00001.png |
| alpha_160 | `tint(rcol(), random(80)*random(1));` -> `random(160)` | large (mean 0.3267, 98.6% px) | far brighter and more saturated; large blown-out white highlights, pink/magenta/yellow dominate; same mottled structure | variants/alpha_160/frame_00001.png |
| size_0.05 | `float s = width*random(0.1, 0.2)*3*random(0.4, 1);` -> `random(0.05, 0.1)` | large (mean 0.2969, 95.0% px) | mottling much smaller and finer; darkest variant, black ground visible between small patches; warm scheme retained | variants/size_0.05/frame_00001.png |
| palette_cool | `int colors[] = {#FFFFFF, #FFB0D0, #F7DE20, ...}` -> `{#FFFFFF, #9FD0FF, #00CFFF, #003399, #02060D, ...}` (blue monochrome) | large (mean 0.203, 90.1% px) | same mottled cloud structure, hue completely swapped to blue/cyan/teal with grey-lavender shadows and pale blue-white highlights | variants/palette_cool/frame_00001.png |
| smooth_2 | `smooth(8);` -> `smooth(2);` | none (mean 0.0, 0.0% px) | no visible change; frame is pixel-identical to the baseline | variants/smooth_2/frame_00001.png |

## Modularisation notes
The entire visible result comes from one generic block: the 1000-stamp scatter loop
(89-97). A clean `brushStampScatter(brushes, count, sizeRange, alphaMax, palette, blendMode)`
would reproduce it; the art decisions are the specific values (1000 count, 0.1-0.2 size
multiplier, alpha max 80, the 10-color palette, ADD blend) and the choice of white grainy
brush PNGs. Everything else (noise parameter setup at 77-83, the commented ring loop at
99-143, the `getColor` lerp helpers at 158-168) is dead/unused for the current look and can
be dropped. The commented-out ring loop is a separate, self-contained reusable idea
(noise-driven orientation + noise-driven palette index on a textured annulus) if ever
reactivated.
