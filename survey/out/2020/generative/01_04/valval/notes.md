---
sketch: 2020/generative/01_04/valval
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1538
animated: false
techniques: [grid, shader, distortion]
primitives: [line, shape]
palette:
  colors: ["#F7E242", "#425CBC", "#E885EA"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: cc, default: 29, tried: [15, 48], change: moderate, effect: "grid cell size; 15 = coarse ~64px grid, background reads more saturated; 48 = fine ~20px grid, dense whitish grid dominates"}
  - {name: triCount, default: 20, tried: [40], change: moderate, effect: "double the shards; busier, more overlap, less background left open"}
  - {name: triSizeMax, default: "width*0.5", tried: ["width*0.8"], change: subtle, effect: "shards extend further, some reach canvas edges; overall tone unchanged"}
  - {name: triAlphaApex, default: 180, tried: [230], change: subtle, effect: "subtle: shards slightly more opaque, same overall hazy look"}
reusable_candidates:
  - {name: gridLines, signature: "gridLines(count, strokeColor, alphaMax) -> void", note: "evenly spaced h+v lines at cell centers, each with random alpha"}
  - {name: alphaTriad, signature: "alphaTriad(x, y, a1, a2, size, color, a180, a0, a20) -> void", note: "two triangles sharing an apex, per-vertex alpha 180/0/20 gives a gradient fade from the apex"}
  - {name: chromaticBlur, signature: "chromaticBlur(shader, passes, baseAmp, stepAmp) -> void", note: "alternating H/V 13-tap gaussian, R/G/B sampled at 1.2/1.0/0.8 x offset, noise-modulated amplitude"}
---

## What it draws
A flat, soft, full-bleed abstract in lavender-mauve: a faint white grid of ~33 px cells covers the whole canvas, and large translucent triangular shards in yellow and indigo-blue overlap across the centre, each fading out towards one of its edges so the shapes read as hazy, glassy facets. The whole image has a slight blur with faint colour fringing along strong edges.

## How the code works
`setup()` loads `blur.glsl` and calls `generate()` once; `draw()` is empty, so the image is static (frames 1/10/60 identical).

- Background: `background(rcol())` (line 56) — one random colour from the 3-colour list `colors[]` (line 170: yellow `#F7E242`, indigo `#425CBC`, orchid `#E885EA`). Here it draws lavender/orchid.
- Grid: loop over `cc = 29` (line 58) draws a horizontal and a vertical white line per index at `(i+0.5)*ss` with `stroke(255, random(200))` (lines 60–66) — the faint white grid; per-line random alpha makes some lines stronger than others.
- Triangles: loop of 20 (line 68) picks a random cell-centre (snapped to the same grid, lines 74–80), a random colour `rcol()`, two angles in the lower half-plane `a1, a2` (lines 69–70), and a size `dis = width*random(0.2, 0.5)` (line 83). It then draws two triangles sharing the apex `(xx,yy)` (lines 84–100): per-vertex `fill(col, 180)` at the apex, `fill(col, 0)` at the far vertex, `fill(col, 20)` at the middle — the per-vertex alpha ramp is what produces the soft gradient fade of each shard.
- Blur: 4 passes (lines 106–113) apply the GLSL shader alternating horizontal/vertical `direction` with small growing amplitude `0.0001*(1..4)`. In `blur.glsl` each channel (R/G/B) is 13-tap gaussian-blurred at 1.2/1.0/0.8× the offset, scaled by a simplex-noise field `dis` whose 3D-noise z-phase is `time` (set from `it = random(100)` + tiny `dt` steps, lines 104–105) — this gives the softness and the faint chromatic fringing. The commented-out coordinate-displacement lines (149–150) are off.
- Randomness: `randomSeed(seed)`/`noiseSeed(seed)` (lines 54–55); seed 42 here.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_15 | `int cc = 29;` -> `int cc = 15;` | moderate | coarse ~64px grid, lines more visible; triangles snap to the coarser grid and read as larger, sparser shards; background looks more saturated (fewer whitening lines) | variants/cc_15/frame_00001.png |
| cc_48 | `int cc = 29;` -> `int cc = 48;` | moderate | fine ~20px grid dominates the image as a dense whitish mesh; shards snap to finer cells; overall lighter, busier | variants/cc_48/frame_00001.png |
| tris_40 | `for (int i = 0; i < 20; i++) {` -> `for (int i = 0; i < 40; i++) {` | moderate | twice as many shards; heavier overlap, more of the background covered, denser faceted centre | variants/tris_40/frame_00001.png |
| dis_0.8 | `float dis = width*random(0.2, 0.5);` -> `float dis = width*random(0.2, 0.8);` | subtle | shards noticeably longer (some reach the canvas edges) but same positions and overall tone; score says subtle | variants/dis_0.8/frame_00001.png |
| alpha_230 | `fill(col, 180);` -> `fill(col, 230);` (both occurrences) | subtle | no visible change beyond a slight gain in shard opacity; same hazy lavender composition (score: subtle, 0.0% of pixels) | variants/alpha_230/frame_00001.png |

## Modularisation notes
- Generic: the grid loop (count + per-line alpha), the apex-alpha-fade triangle pair (angles, size, colour, three alphas), and the alternating H/V chromatic blur pass — all three map to the `reusable_candidates` signatures above.
- One-off art decisions: the specific 3-colour palette and its use for background, the lower-half-plane angle ranges (`PI*1.0–1.5`, `PI*1.5–2.0`), the 0.2–0.5 width-relative triangle size range, and the noise-phase `it = random(100)`.
- A clean parameter object: `{seed, gridCount, gridAlphaMax, triCount, triSizeMin, triSizeMax, triAlpha: [apex, far, mid], palette, blurPasses, blurBaseAmp, blurStepAmp, blurTimePhase}`.
