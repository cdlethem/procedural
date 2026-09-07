---
sketch: 2018/Generativos/ostracity
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1702
animated: false
techniques: [packing, polar, shader, distortion]
primitives: [shape, pixels]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: lerp-between
composition: scattered
parameters:
  - {name: maxSize, default: 0.8, tried: [0.4], change: large, effect: "halves max circle size: no edge-clipped giants, denser field of small/mid pinwheels, more black ground, whole packing re-flows"}
  - {name: wedgeDensity, default: 0.5, tried: [1.5], change: moderate, effect: "3x more wedges per circle: much finer stripes, rims sample more smoothly so lobes look softer/rounder; layout unchanged"}
  - {name: edgePow, default: 0.3, tried: [0.8], change: moderate, effect: "higher power dips the rim more at the cosine minimum: pinwheels gain pronounced scalloped, heart-like notches instead of gently wavy rims"}
  - {name: palette, default: "FF3D20/FC9D43/3998C2/3E56A8/090D0E", tried: ["687FA1/AFE0CD/FDECB4/F63A49/FE8141"], change: moderate, effect: "same geometry, pastel warm palette (peach/salmon, pale teal, cream): far lighter, lower-contrast look"}
  - {name: des, default: "random(TAU)", tried: [0], change: large, effect: "removes per-circle random rotation: all fans align to the same angle, notches point the same way, pinwheel randomness lost, composition reads as directional fans"}
reusable_candidates:
  - {name: packCircles, signature: "packCircles(count, maxR, minGap) -> PVector[]", note: "rejection-sampled non-overlapping circle packing (size stored in z)"}
  - {name: radialWedgeBlob, signature: "radialWedgeBlob(x, y, r, sub, des, colorSeq) -> void", note: "fan of triangles with cosine-modulated rim radius and per-wedge lerped palette colour"}
  - {name: grainVignetteBlur, signature: "grainVignetteBlur(amt, grain) -> PShader", note: "3x3 separable-style blur + grain + brightness/sat/contrast + radial vignette (post.glsl)"}
---

## What it draws
A black full-bleed field covered with non-overlapping "pinwheel" circles of many sizes,
from huge edge-clipped fans to tiny specks. Each circle is a fan of thin radial wedges
with a gently wavy (lobed) rim; the wedges alternate red/orange against blue/indigo in
fine stripes, and the stripes twist so the pinwheels look like folded fans or flowers.
A soft blur and a subtle dark vignette (plus faint grain) from a post shader tie the
hard edges together. Static: frames 1/10/60 are identical.

## How the code works
- `setup()` (ostracity.pde:3-10) sizes 960x960 P2D, loads `data/post.glsl`, calls
  `generate()` once; `draw()` is empty so the piece is static.
- `generate()` (ostracity.pde:23-71): `randomSeed(seed)` then `background(0)` (black).
  - Packing loop (lines 28-42): up to 10000 candidate points at random positions with
    diameter `s = width*random(0.8)`; a candidate is rejected if its distance to any
    accepted circle is less than the sum of radii (`(s+ant.z)*0.5`, line 36), giving a
    non-overlapping circle packing. Randomness enters via position and size only.
  - Drawing loop (lines 44-68): for each circle, radius `r = p.z*0.5` (line 46);
    wedge count `sub = max(4, int(PI*r*0.5))` grows with size (line 47); `des` is a
    random per-circle rotation (line 49). Two colour sequences start at random palette
    indices `ic1`, `ic2` with random per-wedge steps `dc1`, `dc2` (lines 50-53).
    Each wedge is a 3-vertex triangle (rim point at angle `ang`, rim point at
    `ang+da`, circle centre; lines 55-66). The rim radius is
    `r*pow(map(cos(des+ang), -1, 1, 0, 1), 0.3)` (line 57): the cosine power makes the
    rim undulate into the wavy lobes seen in the image. Fills come from
    `getColor(v)` (lines 85-91), which lerps between the two palette entries adjacent
    to the (wrapped) value `v` — that is what produces the smooth striped red/orange vs
    blue gradient around each pinwheel, with the rim and the centre vertex on
    independent colour sequences.
  - Post filter (line 70): `filter(post)`, where `post.glsl` mixes in a 9-tap
    weighted blur at 0.9 (lines 32-56, 63), adds 2% per-pixel grain (line 67), applies
    brightness 1.2 / saturation scaled by radius / contrast 1.0 via `csb` (lines
    18-30, 68), multiplies by a radial vignette `dis` (lines 65, 68), and nudges the
    green channel with a 0.98 gamma (line 71).
- Note: `uses_shader` is true but the display was `:2` (virtual X, not xvfb); the
  baseline image shows the blur/grain/vignette rendered correctly, so the shader
  output is trustworthy.
- `rcol()` (line 79) is dead code; a second palette is commented out at line 78.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| maxSize_0.4 | `float s = width*random(0.8);` -> `float s = width*random(0.4);` | large | no giant edge-clipped circles; field of smaller pinwheels, more black ground, packing re-flowed entirely | variants/maxSize_0.4/frame_00001.png |
| wedgeDensity_1.5 | `int sub = max(4, int(PI*r*0.5));` -> `int sub = max(4, int(PI*r*1.5));` | moderate | 3x finer stripes in every fan; rims look smoother/rounder, lobes less pronounced; same layout | variants/wedgeDensity_1.5/frame_00001.png |
| edgePow_0.8 | `float rr = r*pow(map(cos(des+ang), -1, 1, 0, 1), 0.3);` -> `... , 0.8);` | moderate | rims scallop harder: circles read as heart/flower lobes with deep notches instead of gently wavy rims | variants/edgePow_0.8/frame_00001.png |
| palette_alt | `int colors[] = {#FF3D20, #FC9D43, #3998C2, #3E56A8, #090D0E};` -> commented-out pastel set | moderate | identical geometry, pastel peach/teal/cream palette, much lighter overall | variants/palette_alt/frame_00001.png |
| des_0 | `float des = random(TAU);` -> `float des = 0;` | large | all fans aligned to the same angle; notches all point one way, loses the random pinwheel twist, reads as directional fans | variants/des_0/frame_00001.png |

## Modularisation notes
- Generic / library-ready: the rejection packing loop (lines 28-42) is a clean
  `packCircles` — parameters: max attempts, max radius, gap factor. The wedge fan
  (lines 44-68) is a reusable `radialWedgeBlob` with parameters (x, y, r, sub, des,
  rim exponent, rim frequency, colour start/step for rim and centre). The palette
  lerp `getColor` (lines 85-91) is a small `paletteLerp(colors, v)` utility.
  `post.glsl` is a self-contained grain/blur/vignette shader, reusable as-is with its
  `texOffset` uniform for blur radius.
- One-off art decisions: the specific 5-colour warm/cool palette; the `pow(..., 0.3)`
  rim shaping constant; the 0.9 blur mix / 2% grain / 2.4 vignette power in the
  shader; the "ostracity" look of dense small circles mixed with a few huge ones
  (emergent from `s = width*random(0.8)`, which biases the packing toward small
  circles).
- A clean parameter object: `{count, maxR, gap, wedgeK (0.5), rimPow (0.3), des
  (random|fixed), palette[], colorSteps (0.4, 1), blurMix, grain, vignettePow}`.
