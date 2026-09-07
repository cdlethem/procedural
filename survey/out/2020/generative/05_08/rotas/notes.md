---
sketch: 2020/generative/05_08/rotas
year: 2020
renderer: P3D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1619
animated: false
techniques: [particles, image-source, noise-field, packing, blend-modes, 3d-pointcloud]
primitives: [image]
palette:
  colors: ["#130038", "#94A039", "#F90400", "#DDAB4D", "#F0F2F5"]
  selection: noise-driven
composition: scattered
parameters:
  - {name: cc, default: "int(random(4,7))", tried: ["int(random(8,11))"], change: subtle, effect: "clusters slightly fuller and softer; same overall density"}
  - {name: clusters, default: 3400, tried: [6800], change: none, effect: "no visible change — packing rejection saturates; extra candidates mostly rejected"}
  - {name: detCol, default: "random(0.005) (reroll per generate)", tried: ["random(0.02)"], change: none, effect: "no visible change — colour already varies enough across the 5-colour wrap"}
  - {name: ampSca, default: 0.3, tried: [0.6], change: moderate, effect: "clearly larger, denser, more overlapping feathers; busier canvas"}
  - {name: palette, default: "#130038,#94A039,#F90400,#DDAB4D,#F0F2F5", tried: ["#0A1F44,#2E86AB,#A3CEF1,#E8F1FA,#F6C445"], change: subtle, effect: "hue clearly shifted to cool blues + gold (pixel diff low: most of the canvas is dark background)"}
reusable_candidates:
  - {name: poissonScatter, signature: "poissonScatter(count, radiusFn, minDistFn) -> PVector[]", note: "rejection-sampled scatter with per-point radius and min-distance test"}
  - {name: layeredSprite, signature: "layeredSprite(img, x, y, size, layers, rotFn, tintFn) -> void", note: "draw N rotated/tinted copies of a sprite at one point with per-copy scale falloff"}
---

## What it draws
A near-black (very dark warm grey) field scattered edge-to-edge with small feather-like
shapes (a feather stamp rotated in 3D). Dominant colours: dull red-orange and olive in the
mid tones, pale grey-lavender/whitish feathers, with a few bright red and gold ones.
Denser toward the centre, where a faint reddish-brown glow accumulates; sparser and darker
toward the corners. A few thin white starburst glints (additive-blended feathers) are
scattered across the whole canvas.

## How the code works
`setup()` loads `plumas.png` (feather stamp) and calls `generate()` once (line 30);
`draw()` is empty (line 38), so the piece is static. `generate()` (lines 51-146):

1. `background(10)` (line 55) — the near-black ground.
2. First loop, 1200 iters (line 65): random position, tint of the feather with colour
   `noise(x*detCol,y*detCol)*10` and alpha ~`random(10)` (line 79) — an extremely faint
   speckle/haze layer across the whole canvas (alpha so low it is barely visible).
3. Second loop, 3400 iters (line 93): Poisson-disk-like rejection scatter. Each candidate
   point is dropped if within `width*random(0.38,0.7)` of centre (line 103, random radius
   per attempt — gives uneven central density) or closer than `(sca+o.z)*0.28` to an
   accepted point (lines 115-122). 30% of points get `blendMode(ADD)` with `mult=0.1`
   (lines 96-98) — these are the faint starburst glints.
4. Per accepted point, `cc = int(random(4,7))` copies of the feather are drawn (line 129):
   each with random 3D rotations (`rotateX/Y/Z`, lines 133-135), scale falloff
   `1-k*0.02` (line 132) and `ampSca = 0.3` (line 139), so each cluster is a small rosette
   times a noise amplitude gate (lines 105-108).
5. Colour: `nc = noise(x*detCol,y*detCol)*colors.length*2` with `detCol ~ 0.0005-0.005`
   (lines 85, 127); per-copy index `col = sca*0.6+nc+k*0.5` (line 136) walks through the
   5-colour palette `{#130038,#94A039,#F90400,#DDAB4D,#F0F2F5}` (line 153) via
   `getColor(v)` (lines 162-168), which lerps between adjacent palette entries — so colour
   is noise-driven and also depends on cluster size and copy index. Alpha is
   `random(255)*random(0.9,1)*mult*1.5` (line 137).
6. `hint(DISABLE_DEPTH_MASK)` (line 91) keeps all sprite layers blending instead of
   z-testing.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_8_11 | `int cc = int(random(4, 7));` -> `int cc = int(random(8, 11));` | subtle (mean 0.0392, 0.14) | subtle: clusters look slightly fuller/softer, a few larger rosettes; same density and palette | variants/cc_8_11/frame_00001.png |
| clusters_6800 | `for (int i = 0; i < 3400; i++)` -> `for (int i = 0; i < 6800; i++)` | none (mean 0.0035, 0.013) | no visible change — with the same seed the first 3400 candidates are identical to baseline and the extra 3400 are almost all rejected by the min-distance test, so density is capped by packing, not iteration count | variants/clusters_6800/frame_00001.png |
| detCol_0.02 | `detCol = random(0.005);` -> `detCol = random(0.02);` (first attempt failed: line 85 is a reassignment without `float`) | none (mean 0.0089, 0.03) | no visible change — finer colour-noise detail is not distinguishable at this alpha/palette | variants/detCol_0.02/frame_00001.png |
| ampSca_0.6 | `float ampSca = 0.3;` -> `float ampSca = 0.6;` | moderate (mean 0.0517, 0.195) | clearly larger, denser, more overlapping feather rosettes; canvas reads busier with more red/olive/gold visible | variants/ampSca_0.6/frame_00001.png |
| palette_cool | `int colors[] = {#130038, #94A039, #F90400, #DDAB4D, #F0F2F5};` -> `int colors[] = {#0A1F44, #2E86AB, #A3CEF1, #E8F1FA, #F6C445};` | subtle (mean 0.0221, 0.027) | subtle per pixel diff (dark background dominates), but the hue is visibly shifted: pale blue/light blue/gold feathers replace the red/olive/warm-grey mix | variants/palette_cool/frame_00001.png |

## Modularisation notes
- Generic: the rejection scatter loop (candidate + distance test + per-point radius) and
  the layered rotated-sprite stamp (N copies with rotation, scale falloff, tint callback)
  are both reusable; `getColor` (noise index -> lerped palette walk) is a small reusable
  helper.
- One-off art decisions: the specific feather asset, the two-stage faint-haze + packed
  rosette structure, the 5-colour palette, the central-glow distance test with random
  radius, the 30% ADD-blend glints.
- A clean parameter object: `{seed, bg, hazeCount, clusterCount, minDistFactor,
  clusterRadius, copiesRange, spriteScale, ampScale, colorDetail, colorAmp, palette,
  addBlendProbability, alphaGain}`.
