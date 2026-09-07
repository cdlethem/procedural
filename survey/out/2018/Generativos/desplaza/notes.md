---
sketch: 2018/Generativos/desplaza
year: 2018
renderer: P2D
size: [720, 720]
libraries: []
deterministic: false
ms_first_frame: 2571
animated: true
techniques: [grid, noise-field, shader]
primitives: [shape]
palette:
  colors: ["#FFFFFF", "#F0EFEB", "#52494A", "#A67F4E", "#2DD712", "#2622F5"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: cc, default: "int(random(100)*random(1)), i.e. 0-99", tried: [20], change: large, effect: "fewer, much larger, sparser bars with wide black gaps"}
  - {name: "ww aspect multiplier (line 57)", default: 5, tried: [1], change: large, effect: "bars become squarish blocks; canvas far more densely covered"}
  - {name: "ang rotation scale (line 59)", default: "TAU*4", tried: ["TAU*1"], change: large, effect: "no systematic orientation change expected (both ranges cover full turns); observed layout difference comes from the time-driven noise, not this parameter"}
  - {name: amp, default: "random(random(0.8,1),1), i.e. 0.8-1", tried: [0.5], change: large, effect: "intended: smaller bars; observed: large green/teal/blue bars — dominated by the shifted random sequence, see caveat"}
  - {name: "colors[] (line 132)", default: "6 muted colours", tried: ["2 colours: #2DD712, #2622F5"], change: large, effect: "every bar is now green/blue/teal only (lerps of the two); no cream/grey/tan"}
  - {name: background, default: 10, tried: [250], change: large, effect: "gaps read as near-white instead of black; bars themselves unchanged"}
reusable_candidates:
  - {name: noisePaletteLerp, signature: "getColor(noiseValue) -> int", note: "index a 6-colour palette by a noise value, lerp between the two neighbouring entries (desplaza.pde:139-145)"}
  - {name: noiseRectGrid, signature: "noiseRectGrid(count, aspectW, aspectH, rotScale) -> quad[]", note: "grid cells whose width, height and rotation come from independent 3-D noise fields (desplaza.pde:53-83)"}
  - {name: gaussianBlurPost, signature: "filter(gaussian3x3Shader, texOffset) -> void", note: "3x3 1-2-1/2-4-2/1-2-1 blur via Processing PShader with texOffset (data/post.glsl)"}
---

## What it draws
A near-black canvas covered edge to edge by scattered, rotated elongated rectangles ("boards" or "bars") of widely varying lengths and thicknesses. The bars are muted two-tone: sage and bright green, cream/off-white, warm greys, pale blue, periwinkle and tan, each bar split into two slightly different shades along its long axis. Edges are softly blurred; gaps of black show through where the bars don't overlap.

## How the code works
`setup()` (desplaza.pde:4-9) makes a 720x720 P2D canvas and loads `post.glsl`. Every frame, `draw()` (13-16) calls `generate()` then applies the shader `filter(post)`.

`generate()` (26-106):
- `randomSeed(seed)` (30) reseeds per frame; `background(10)` gives the near-black ground (31).
- A square grid of `cc` x `cc` cells is built (33-34, 53-54); `cc` is `int(random(100)*random(1))` so it is 0-99 and differs every reseed.
- For each cell centre (55-56): width `ww` and height `hh` come from 2-D noise fields scaled by `*5` and `*1` (57-58) — the 5x/1x asymmetry is what makes the quads elongated bars; `ang` is 3-D noise (z = time) times `TAU*4` (59), the random-looking rotation.
- Colours `c1`/`c2` are picked by sampling two independent noise fields into `getColor()` (61-62, 139-145): the noise value indexes the 6-colour `colors[]` palette and lerps between the two adjacent entries, so neighbouring cells get similar-ish hues.
- Each bar is a 4-vertex quad (71-79) drawn in two fills: right half `c1`, left half `c2` — the visible two-tone split. `rotate(ang)` orients it.
- `post.glsl` is a 3x3 separable-weights Gaussian blur (1/16 * [1 2 1; 2 4 2; 1 2 1]) sampled around `vertTexCoord` using `texOffset`, which softens every edge.
- Animation: `time = millis()*0.001` (28) feeds the z coordinate of the angle/colour noise (50, 59-63), so bars slowly re-rotate and re-tint; `randomSeed` alone would not do it. `deterministic: false` in result.json reflects this.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| cc_20 | `int cc = int(random(100)*random(1));` -> `int cc = 20;` | large | fewer, much larger two-tone bars, sparser, wide black gaps | variants/cc_20/frame_00001.png |
| aspect_1 | `float ww = ss*pow((0.1+noise(dw+xx*tw, dw+yy*tw)), 0.5)*5;` -> same with `*1;` | large | bars no longer elongated: squarish two-tone blocks, canvas densely covered, black mostly gone | variants/aspect_1/frame_00001.png |
| rot_tau | `float ang = noise(da+xx*ta, da+yy*ta, angTime)*TAU*4;` -> same with `*TAU*1;` | large | thick bars in parallel diagonal bands; no consistent orientation effect vs baseline (TAU*1 and TAU*4 both cover full turns; layout shift is from the time-driven noise, deterministic: false) | variants/rot_tau/frame_00001.png |
| amp_0.5 | `float amp = random(random(0.8, 1), 1);` -> `float amp = 0.5;` | large | big saturated green/teal/blue bars, denser than baseline, black only in zig-zag gaps; layout also shifted because removing the two random() calls moves every later noise offset | variants/amp_0.5/frame_00001.png |
| palette_duo | `int colors[] = {#FFFFFF, #F0EFEB, #52494A, #A67F4E, #2DD712, #2622F5};` -> `int colors[] = {#2DD712, #2622F5};` | large | every bar green, blue or teal (lerps of the two colours); cream/grey/tan gone; cleanest test of the palette since no random() calls were removed | variants/palette_duo/frame_00001.png |
| bg_250 | `background(10);` -> `background(250);` | large | same bars, but the ground is near-white; gaps between bars read as white instead of black | variants/bg_250/frame_00001.png |

Caveat on scores: `deterministic: false` (millis()-driven noise z) and substitutions that delete `random()` calls (cc, amp) shift all later noise offsets, so every variant also differs in layout from the baseline. Only the palette and background variants isolate their parameter; the large scores are therefore partly layout noise, not just the changed value.

## Modularisation notes
Generic blocks: (1) the noise-indexed palette lerp `getColor()` is a self-contained utility (any palette size); (2) the "grid of noise-sized, noise-rotated quads" loop (53-83) is a reusable generator if the three noise fields (size-w, size-h, angle) and the aspect multipliers (5, 1) become parameters; (3) the blur post shader is a stock Processing Gaussian — trivially reusable.

One-off art decisions: the fixed 6-colour muted palette (132), the `n` size-kill noise field that punches holes, the two-half colour split per quad (72-76), `background(10)`.

A clean parameter object: `{count, aspectW, aspectH, rotScale (TAU multiplier), amp, holeField on/off, palette[], blurOffset, animate (time->noise z)}`.
