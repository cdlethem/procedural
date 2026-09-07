---
sketch: 2020/generative/01_04/ciruela
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 2072
animated: false
techniques: [image-source, noise-field, particles, blend-modes]
primitives: [image]
palette:
  colors: ["#2B349E", "#F57E15", "#ED491C", "#9B407D", "#B48DC0", "#E3E8EA"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc (stamp count in generate), default: 100, tried: [30], change: large, effect: "canvas mostly black background; few stamps smeared by blur into dark blobs with ring artifacts"}
  - {name: detCol (colour noise scale), default: 0.04, tried: [0.004], change: subtle, effect: "no visible change at this 10x difference"}
  - {name: blur iterations, default: 40, tried: [5], change: large, effect: "stamp areas become sharp solid saturated blobs with a crisp edge; soft haze gone"}
  - {name: stamp alpha (tint), default: 0.6, tried: [1.0], change: moderate, effect: "stamps more opaque; colours denser and more saturated, same composition"}
  - {name: mask grid divisor, default: "random(6,16)", tried: ["random(2,4)"], change: subtle, effect: "no visible change (mask only feeds shader)"}
  - {name: colors (palette), default: "6-col bright (#2B349E..#E3E8EA)", tried: ["5-col dark (#0A0B0B,#2E361E,#ACB2A4,#B66F3A,#B91A1B)"], change: large, effect: "same composition in dark tones: rust field, dark green/maroon smudge"}
reusable_candidates:
  - {name: getColor, signature: "getColor(noiseValue, colors[]) -> int", note: "lerp between adjacent palette entries via pow(v%1, 0.6)"}
  - {name: directionalBlur, signature: "directionalBlur(shader, mask, iterations, ampStart, ampStep) -> void", note: "iterative directional blur filter with per-iteration angle and amplitude ramp"}
---

## What it draws
A heavily blurred abstract: the left ~40% is a flat, muted mauve-purple field; a soft
diagonal edge runs from top-right to bottom-left, and to its right a smudge of orange,
red and pink washes over a darker green-grey area scattered with fine bright speckles
and grain. The overall look is out-of-focus, like a blurred photograph of a painting.

## How the code works
`setup()` loads 7 brush PNGs (6 numbered + `brush2.png`) and a `blur.glsl` shader, then
calls `generate()` once (`ciruela.pde:25-41`; `draw()` is empty so the image is static).
Inside `generate()`:

1. A hidden `mask` PGraphics (960x960, black background) is built from ~60 tinted brush
   stamps: 30 on a random grid whose cell is `width/(6..16)` (`:73-89`), 30 free-floating
   (`:91-101`), each with random rotation, scale (100–350 px times random factors) and a
   grey tint from `random(255)`. This mask is only fed to the shader, never drawn.
2. `background(0)` then 100 large rotated brush images (`cc = 100`, `:111-134`) are
   sampled at `xx*detCol, yy*detCol` (`detCol = random(0.04)`, `:109`, `:126`) mapped
   through `getColor()`, which lerps between adjacent entries of the 6-colour palette
   (`#2B349E, #F57E15, #ED491C, #9B407D, #B48DC0, #E3E8EA`, `:159`) with a pow-gamma
   and alpha `random(80,260)*0.6`. The noise-driven colour index is why the orange/red
   and mauve regions sit in smooth blobs.
3. The whole canvas then passes through `blur.glsl` 40 times (`:139-149`): each pass sets
   a random direction angle and a ramping amplitude `0.0001 + i*0.02`, using the mask as
   a shader texture. This repeated directional blur is what smears the crisp brush
   stamps into the soft diagonal wash and leaves the flat mauve where stamps were sparse
   (left side). Randomness enters via `seed`/`randomSeed`/`noiseSeed` (`:105-106`).

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_30 | `cc = 100;` -> `cc = 30;` | large | canvas is almost pure black; a few dim dark-maroon and green areas, a starburst/concentric-ring artefact mid-left where the blur smeared the few remaining stamps | variants/cc_30/frame_00001.png |
| detCol_0.004 | `float detCol = random(0.04);` -> `random(0.004);` | subtle | no visible change: same mauve field left, orange/red/green smudge right | variants/detCol_0.004/frame_00001.png |
| blur_5 | `for (int i = 0; i < 40; i++) {` -> `i < 5` | large | large black area top-left; right side is a smooth, saturated orange-red-pink glow bounded by a crisp green-edged curve; no soft haze | variants/blur_5/frame_00001.png |
| alpha_1.0 | `random(80, 260)*0.6);` -> `*1.0);` | moderate | same composition but denser: more pink-lavender left field, brighter orange/pink speckles, less black showing through | variants/alpha_1.0/frame_00001.png |
| grid_2_4 | `int cc = int(random(6, 16));` -> `int(random(2, 4));` | subtle | no visible change vs baseline | variants/grid_2_4/frame_00001.png |
| palette_dark | `int colors[] = {#2B349E, ... #E3E8EA};` -> `{#0A0B0B, #2E361E, #ACB2A4, #B66F3A, #B91A1B};` | large | same layout in dark tones: flat rust/terracotta field left, dark green and dark maroon speckled smudge right | variants/palette_dark/frame_00001.png |

## Modularisation notes
- Generic: `getColor(v, colors[])` palette-lerp; the mask-building pattern (tinted,
  rotated, scaled image stamps into an offscreen buffer, later consumed by a shader);
  the iterative directional-blur pass loop.
- One-off art decisions: the specific 7 brush PNGs, the 6-colour palette, the two-stage
  mask (grid + free stamps), the blur amplitude ramp `0.0001 + i*0.02`.
- A clean parameter object would contain: `brushImages[]`, `palette[]`, `stampCount`,
  `colorNoiseScale` (detCol), `stampAlpha`, `blurIterations`, `blurAmpStep`, `maskGridDiv`,
  `seed`.
