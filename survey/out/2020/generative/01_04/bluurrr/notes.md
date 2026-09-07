---
sketch: 2020/generative/01_04/bluurrr
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1561
animated: false
techniques: [shader, noise-field, distortion]
primitives: [ellipse]
palette:
  colors: ["#B85807", "#FAC440", "#F4C8BF", "#A0B9A6", "#A1B2EA"]
  selection: lerp-between
composition: radial
parameters:
  - {name: cc, default: 100, tried: [200], change: moderate, effect: "denser, thinner ring bands; spiral reads more finely layered"}
  - {name: ringScale, default: 1.5, tried: [1.0], change: moderate, effect: "largest ring fits inside canvas; spiral becomes a disc on flat sage background"}
  - {name: blurAmp, default: "0.0001 + i*0.0001", tried: ["0.001 + i*0.001"], change: moderate, effect: "ring bands nearly dissolve into a soft warm wash"}
  - {name: blurPasses, default: 8, tried: [2], change: subtle, effect: "almost no visible change; edges marginally crisper"}
  - {name: palette, default: "B85807,FAC440,F4C8BF,A0B9A6,A1B2EA", tried: ["6402F7,F7A4EF,F62C64,00DACA"], change: large, effect: "same spiral geometry in neon purple/pink/teal"}
reusable_candidates:
  - {name: concentricRings, signature: "concentricRings(count, maxDiameter, centerJitter, paletteFn) -> void", note: "N ellipses centered near canvas middle, diameters shrinking linearly to 0, colour cycled through a lerp'd palette"}
  - {name: noiseModulatedBlur, signature: "noiseModulatedBlur(shader, passes, baseAmp, ampStep, time) -> void", note: "iterate a directional 7-tap Gaussian PShader H+V, offset scaled by a spatial simplex-noise field that evolves with a time uniform"}
---

## What it draws
A full-bleed, very soft image of concentric ring bands spiralling around a small dense
cluster just left of centre. Warm ambers, burnt orange and pale peach alternate with
dusty blue, sage green and muted mauve-brown; every edge is smeared so bands melt into
each other. The spiral reads strongest in the outer rings; the centre collapses into a
few small blurred discs (a small yellow dot and an orange dot are the only sharp-ish
spots).

## How the code works
`setup()` calls `generate()` once; `draw()` is empty so the piece is static
(baseline frames 10/60 identical to 1).

- `background(rcol())` (line 54) fills with one random palette colour.
- Loop over `cc = 100` ellipses (lines 71-79): each centre is jittered inside a 10%
  box around the canvas middle (`width*random(0.45,0.55)`, lines 72-75), diameter
  shrinks linearly from `width*1.5` (i=0) to ~0 (i=99) via
  `ss = width*(1-(i*1./cc))*1.5` (line 76). Fill is `getColor(i*ac+ic)` (line 77),
  which walks the 5-colour palette cyclically and `lerpColor`s between adjacent
  entries (lines 115-120), so rings cycle smoothly through the palette with a random
  phase `ic` and step `ac = random(0.2,1.2)`.
- Then 8 passes (lines 84-91): each pass sets a small `direction` uniform
  (`blurAmp = 0.0001 + i*0.0001`, line 86) and applies the `blur.glsl` PShader
  horizontally then vertically. The shader's `blur13` is a 7-tap Gaussian along
  `direction`, but the offset is multiplied by `dis`, a spatially varying value from
  3-D simplex noise (`time` advances slightly per pass, lines 82-85 of the pde;
  lines 145-155 of blur.glsl). The coordinate-warp lines in the shader (st.x/st.y +=
  cos(ang)*dis) are commented out, so there is no true spiral warp — the swirl is the
  noise-modulated directional smearing applied 16 times to hard concentric circles.
- toxi/triangulate are imported (lines 1-2) but no class from them is actually used;
  all noise lives in the GLSL.
- `uses_shader: true` with `display: ":2"` (not xvfb), so the render is trustworthy.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_200 | `int cc = 100;` -> `int cc = 200;` | moderate | denser, thinner ring bands; the spiral is more finely layered, centre dots unchanged | variants/cc_200/frame_00001.png |
| ringScale_1.0 | `float ss = width*(1-(i*1./cc))*1.5;` -> `... *1.0;` | moderate | rings no longer overhang the canvas: the spiral is a disc on a flat sage-green background (rcol) | variants/ringScale_1.0/frame_00001.png |
| blurAmp_0.001 | `float blurAmp = 0.0001+(i*0.0001);` -> `0.001+(i*0.001)` | moderate | 10x amplitude: bands nearly dissolved into a soft warm wash, only faint traces of rings | variants/blurAmp_0.001/frame_00001.png |
| blurPasses_2 | `for (int i = 0; i < 8; i++) {` -> `i < 2` | subtle | no visible change: only slightly crisper edges; the later high-amplitude passes carry the look | variants/blurPasses_2/frame_00001.png |
| palette_neon | `int colors[] = {#B85807, #FAC440, #F4C8BF, #A0B9A6, #A1B2EA};` -> `{#6402F7, #F7A4EF, #F62C64, #00DACA};` | large | identical spiral geometry, recoloured neon: violet, hot pink/red, teal | variants/palette_neon/frame_00001.png |

## Modularisation notes
- Generic: the two `reusable_candidates` blocks are cleanly separable. `concentricRings`
  (lines 71-79 + `getColor(float)`) only needs count, diameter scale, centre jitter
  range and a colour function; the `getColor(float v)` cyclic lerp is a nice small
  palette helper on its own.
- Generic: the H+V directional-blur pass loop (lines 84-91) with noise-modulated
  offset is a standard "soften + smear" operator; parameters would be passes, base
  amplitude, amplitude step and the time/noise scale.
- One-off art decisions: the exact 5-colour palette, the `1.5` diameter overhang (so
  the biggest ring exceeds the canvas and the corners show only blurred mid-tones),
  the 10% centre jitter box, and choosing to comment out the actual warp in the
  shader while keeping its noise for the blur strength.
- A clean parameter object: `{seed, palette[], ringCount, ringDiameterScale,
  centerJitter, colorCycleStep, blurPasses, blurBaseAmp, blurAmpStep}`.
