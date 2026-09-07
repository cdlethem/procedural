---
sketch: 2018/Generativos/flowwers/flowwers_001
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 2572
animated: false
techniques: [noise-field, polar]
primitives: [shape, line, ellipse]
palette:
  colors: ["#0B0B0B", "#DECFB4", "#C0B394", "#B0AA7C", "#9DA575", "#A2A879", "#66775D", "#45523A", "#606B5A", "#232D29", "#FED42E", "#FF84D4"]
  selection: random-from-list
composition: full-bleed
parameters:
  - {name: count, default: 60000, tried: [15000], change: large, effect: "quarter the leaves: field goes sparse, near-black ground shows through, individual blades read clearly"}
  - {name: leafSizeScale, default: 0.04, tried: [0.08], change: large, effect: "2x blade length: coarser texture, fewer black gaps, noise-driven size clumps more visible"}
  - {name: angleDetail, default: "random(0.02)", tried: ["random(0.005)"], change: large, effect: "smoother coarser orientation field: leaves align into large directional patches and parallel rows"}
  - {name: sizeDetail, default: "random(0.02)", tried: ["random(0.005)"], change: large, effect: "smoother coarser size field: big and small leaves form broad patches instead of fine clumps"}
  - {name: widthRatio, default: 0.3, tried: [0.6], change: moderate, effect: "blades 2x wider: chunkier rounder shapes, field fills in more, same muted colours"}
  - {name: leafPalette, default: "9 muted green/tan", tried: ["5 bright neon (yellow/pink/blue/green)"], change: large, effect: "neon pink/green/blue/yellow field; same geometry, two-tone split per blade still visible"}
reusable_candidates:
  - {name: hoja, signature: "hoja(x, y, size, angle, colorPair, widthRatio, veinAlpha)", note: "sin-profile two-tone blade with two vein-line fans"}
  - {name: arc2, signature: "arc2(x, y, r1, r2, a1, a2, color, alphaIn, alphaOut)", note: "annulus of wedges with radial alpha fade (soft halo)"}
  - {name: scatterField, signature: "scatterField(count, sizeScale, sizeDetail, angleDetail, palette)", note: "N uniform-random sprites with noise-driven size and angle"}
---

## What it draws
A full-bleed carpet of thousands of tiny two-tone leaf/blade shapes in muted olive, sage, tan and dark-green on a near-black ground with a faint warm tan wash. Leaf sizes vary smoothly in patches (bigger clumps in a wavy noise field) and orientations swirl in loose local clusters. About ten bright dots — green, blue, pink/magenta — sit on top, each with a faint pinkish radial halo.

## How the code works
`setup()` sizes 960x960 P2D, calls `generate()` once; `draw()` is empty so the piece is static (re-generated only on key press, line 14-20).

- `generate()` (22-61): `background(#0B0B0B)`, then a full-bleed quad filled `#837954` at alpha 40 (28-31) — the faint warm wash over the black. `noiseSeed`/`randomSeed` from the seed (33-34).
- Two 2-D noise fields: `det1`/`des1` drive angle, `det2`/`des2` drive size (36-39).
- Main loop (41-48): 60000 iterations, each a uniform random point; size `s = width*0.04*noise(des2+x*det2, des2+y*det2)` (44) so size varies in smooth clumps; angle `a = noise(des1+x*det1, des1+y*det1)*TAU*4` (45) so orientation follows a second noise field. Stroke colour is a random draw from the 9-colour muted list via `rcol()` (136-139).
- `hoja` (63-108): translate + rotate into local frame; blade width `w = 0.3*s`. The blade is a `beginShape` sampled over `int(s)` steps with edge `dx = sin(pow(t, 0.7)*PI)*w` (81) — a pointed leaf profile. Two halves: one in the drawn colour, the other `lerpColor(col1, black, 0.2)` (85), giving every leaf a two-tone split. Then two fans of "vein" lines from the blade base to points along each edge (94-105), each in a fresh random palette colour at alpha `random(80)`, with the base point pulled off-axis by `pow(t, 2.2)` (93, 97, 102) so veins fan out.
- Dots (50-60): 10 ellipses at random positions, radius `width*0.01..0.04`, colour random from `{#FED42E, #FF84D4, #FFAFDA, #51B9FF, #2BFF6A}`. Each gets `arc2` (111-129): a full 360° ring from radius `s` to `3*s` built as many thin wedges, inner alpha 50 fading to 0 — the soft halo.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_15000 | `for (int i = 0; i < 60000; i++) {` -> `for (int i = 0; i < 15000; i++) {` | large | field is ~quarter as dense: large black ground shows through, individual blades and dots clearly separated | variants/count_15000/frame_00001.png |
| leafsize_0.08 | `float s = width*0.04*noise(des2+x*det2, des2+y*det2);...` -> `width*0.08*noise(...);...` | large | blades 2x longer: coarser, fuller texture with fewer black gaps; size clumps from the noise field read as bigger patches | variants/leafsize_0.08/frame_00001.png |
| det1_0.005 | `float det1 = random(0.02);` -> `float det1 = random(0.005);` | large | same positions and sizes (each `random(max)` consumes one RNG draw, so the stream is unchanged); orientations now follow a smoother, larger-scale field — leaves align in visible directional patches and parallel rows, texture looks chunkier | variants/det1_0.005/frame_00001.png |
| det2_0.005 | `float det2 = random(0.02);` -> `float det2 = random(0.005);` | large | same positions and orientations; size field smoother and coarser — broad patches of big and small leaves (small-leaf ring mid-canvas, large-leaf band top right) instead of fine clumps | variants/det2_0.005/frame_00001.png |
| width_0.6 | `float w = s*0.3;` -> `float w = s*0.6;` | moderate | blades 2x wide: chunkier, rounder leaf shapes, field fills in more, colour scheme unchanged | variants/width_0.6/frame_00001.png |
| palette_bright | `int colors[] = {#DECFB4, ..., #232D29};` -> `int colors[] = {#FED42E, #FF84D4, #FFAFDA, #51B9FF, #2BFF6A};` | large | neon pink/green/blue/yellow field; geometry identical, per-blade two-tone split (half lerped 20% toward black) still visible | variants/palette_bright/frame_00001.png |

## Modularisation notes
Generic: the 60000-iteration loop is a generic "scatter N sprites with noise-driven size and angle fields" (count, size scale, size detail, angle detail are the knobs — confirmed by the experiments, each moves the look independently). `hoja` is a reusable leaf sprite parameterised by length, width ratio (0.3), profile exponent (0.7), second-half darkening (0.2), vein alpha (random 80) and vein fan exponent (2.2). `arc2` is a reusable radial-fade annulus (soft halo/glow). One-off art decisions: the exact muted 9-colour leaf palette, the bright 5-colour dot palette, dot count (10), the `#837954` alpha-40 ground wash. A clean parameter object: `{count, sizeScale, sizeDetail, sizeOffset, angleDetail, angleOffset, widthRatio, veinAlpha, palette, dotCount, dotPalette, groundWash}`.
