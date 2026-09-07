---
sketch: 2020/generative/01_04/skys
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1763
animated: false
techniques: [image-source, shader, distortion]
primitives: [image, pgraphics]
palette:
  colors: ["#FCB375", "#FEAE02", "#FED400", "#F0EBBE", "#B0DECE", "#01B6D2", "#18AD92", "#90BC96"]
  selection: lerp-between
composition: full-bleed
parameters:
  - {name: cc, default: 1000, tried: [300], change: moderate, effect: "fewer stamps → more discrete streaks, less smooth blending"}
  - {name: blurAmp, default: 0.0006, tried: [0.002], change: subtle, effect: "no visible change; already saturated blur at 0.0006"}
  - {name: alphaMax, default: 180, tried: [255], change: subtle, effect: "slightly more saturated, bands barely more opaque"}
  - {name: ww, default: "random(0.7,1.4)", tried: ["random(0.3,0.6)"], change: moderate, effect: "narrower strokes → individual ellipses visible, less edge-to-edge continuity"}
reusable_candidates:
  - {name: stampedStreaks, signature: "stampedStreaks(brush, count, colorCycle, alphaRange, yBias) -> void", note: "stamp a soft brush image many times with palette-lerped tint; y-bias concentrates strokes at one edge"}
  - {name: progressiveBlur, signature: "progressiveBlur(shader, passes, amp, vAmp) -> void", note: "iterate a blur filter with increasing horizontal amplitude, then a vertical pass, for streaky smearing"}
---

## What it draws
A full-bleed 960×960 abstract "sky" of soft horizontal bands: wide, heavily blurred
streaks in teal/turquoise, yellow, and pale olive-green, with a few warm orange accents.
The streaks run edge to edge, are thickest and most saturated toward the top, and fade into
smoother, lighter bands toward the bottom. No discrete shapes are visible; everything is
dissolved into smooth gradients.

## How the code works
`generate()` (skys.pde:49) runs once in `setup()`; `draw()` is empty, so the piece is static
(frame 10/60 identical to frame 1).

1. **Mask texture** (skys.pde:59-72): a `mask` PGraphics is filled near-black (`background(20)`)
   then stamped with 100 random-size `brush.png` images, each randomly tinted
   (skys.pde:68). It is only used as the shader's `mask` uniform (skys.pde:109). Note it is
   generated *before* `randomSeed(seed)` (skys.pde:74), so its randomness is unseeded.
2. **Background** (skys.pde:76): one palette color picked at random via `rcol()`.
3. **Streak loop** (skys.pde:94-104): `cc = 1000` iterations. Each stamp:
   - x uniform across width (skys.pde:95); y = `height*random(1)*random(1)` — a squared
     distribution biased toward 0, so most stamps sit near the top (skys.pde:96-97).
   - width `width*random(0.7,1.4)` (skys.pde:100), height
     `height*random(0.1,0.5)*random(0.2+val)` (skys.pde:101) → wide, short ellipses.
   - tint color = `getColor(i*ac+ic)` (skys.pde:102, 147-153): the palette index advances
     linearly with the loop counter and is lerped between adjacent palette colors, so hue
     drifts smoothly as i grows; alpha is `random(180)`, keeping stamps translucent.
   - the brush image is drawn with `tint(...)` (skys.pde:103) — this is the only visible
     drawing pass.
4. **Blur shader** (skys.pde:112-119, data/blur.glsl): 8 passes of `filter(blur)`, each
   blurring horizontally with amplitude growing `0.0001 + i*0.0006`, then vertically with
   `amp*random(0.5,1)`. The growing horizontal blur is what smears the 1000 thin stamps into
   continuous edge-to-edge bands; the `mask` uniform modulates the shader output.

Randomness enters at: stamp x/y/size (skys.pde:95-101), tint alpha (skys.pde:102), palette
offset `ic` and drift speed `ac` (skys.pde:90-91), and per-pass vertical blur strength
(skys.pde:117). The base palette is a fixed 8-color list (skys.pde:137) with ~8 alternates
commented out above it.

## Experiments
| variant | substitution | change score | observation | image |
| cc_300 | `int cc = 1000;` → `int cc = 300;` | moderate (0.1092, 0.495) | more discrete streaks, less smooth blending; individual brush shapes more visible | variants/cc_300/frame_00001.png |
| blurAmp_0.002 | `float blurAmp = 0.0001+(i*0.0006);` → `...0.002);` | subtle (0.0182, 0.0) | no visible change; blur already saturates the image | variants/blurAmp_0.002/frame_00001.png |
| alpha_255 | `tint(getColor(i*ac+ic), random(180));` → `random(255));` | subtle (0.0268, 0.0) | slightly more saturated bands, barely perceptible | variants/alpha_255/frame_00001.png |
| ww_0.3_0.6 | `float ww = width*random(0.7, 1.4);` → `random(0.3, 0.6);` | moderate (0.0606, 0.183) | narrower strokes, individual ellipses visible, less edge-to-edge continuity | variants/ww_0.3_0.6/frame_00001.png |

## Modularisation notes
- **Generic**: the stamp loop (skys.pde:94-104) is a reusable "stamped streaks" primitive:
  a soft alpha brush + palette-lerped tint + y-bias distribution. The progressive blur
  (skys.pde:112-119) is a reusable post-process. `getColor(float)` (skys.pde:147) is a
  reusable smooth palette sampler.
- **One-off art decisions**: the specific 8-color palette (skys.pde:137), the squared
  y-distribution `random(1)*random(1)`, the width/height multipliers (0.7–1.4 × 0.1–0.5),
  the unseeded 100-stamp mask texture, and the `0.0001 + i*0.0006` blur ramp.
- **Parameter object**: `{brush, count, palette, colorDrift (ac), colorOffset (ic),
  alphaMax, yBias, widthRange, heightRange, blurPasses, blurAmpRamp, maskStamps}`.
