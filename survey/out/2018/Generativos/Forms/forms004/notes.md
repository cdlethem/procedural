---
sketch: 2018/Generativos/Forms/forms004
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 4330
animated: false
techniques: [image-source, noise-field, packing]
primitives: [image]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: count, default: 50000, tried: [20000], change: moderate, effect: "sparser fur, more black background visible between strokes"}
  - {name: gapFactor, default: 0.02, tried: [0.06], change: moderate, effect: "looser packing, strokes longer-sparser with more gaps"}
  - {name: sizeScale, default: 120, tried: [240], change: moderate, effect: "strokes ~2x longer, spikier, bottom dominated by long blades"}
  - {name: tintAlpha, default: 180, tried: [255], change: subtle, effect: "no visible change at this density"}
  - {name: aspect, default: "random(4,6)", tried: ["random(1,1.5)"], change: moderate, effect: "shorter near-round stamps, mottled grainy texture instead of blades"}
  - {name: pwr, default: "random(0.1,0.2)", tried: ["random(0.6,0.8)"], change: subtle, effect: "subtle: hue shifts from rust-red to dark steel-blue, same fur structure"}
reusable_candidates:
  - {name: scatterPacked, signature: "scatterPacked(n, sizeFn, gapFactor) -> PVector[]", note: "random candidates with noise-driven size and pairwise distance rejection (packing)"}
  - {name: stampField, signature: "stampField(points, tiles, sizeScale, aspectRange, rotNoise) -> void", note: "stamp image tiles with noise rotation, elongated scale, random tint"}
  - {name: noiseColor, signature: "noiseColor(v, power, palette) -> color", note: "palette index from noise^power with lerp to next entry (getColor, lines 112-118)"}
---

## What it draws
A full-bleed black canvas covered in thousands of fine, elongated blade-like strokes, like dark fur or dried grass. Density is highest at the top; strokes get visibly longer and coarser toward the bottom. Dominant colours are dark rust-red and near-black, with scattered dark blue-grey and a few bright grey/white slivers.

## How the code works
- `setup` (lines 3-11) loads `../forms.png` and `loadForms` (13-25) crops it into a 16x2 grid of 32 tiles.
- `generate` (38-98) is the whole artwork; `draw()` (27-28) is empty, so it renders once per keypress (static).
- Scatter (45-61): 50000 candidates; x uniform, y biased toward the top via `height*pow(random(0,1),0.8)` (line 50). Size `s = noise(...)*120*map(y,0,height,0.6,1)` (line 51) grows toward the bottom. A point is rejected if within `(s+p.z)*0.02` of any kept point (53-60) — a packing constraint.
- Stamping (71-97): per kept point pick a random tile; four candidate colours from `pow(noise(...), pwr)` over the 5-colour `colors[]` array (78-81, `getColor` at 112-118 lerps adjacent palette entries), each further lerped toward a random grey; one of four chosen randomly (83-90). `tint(col, 180)` (91) makes every stamp semi-transparent so overlaps darken. Rotation is pure noise (94); stamps drawn elongated: `s*0.4` wide by `s*random(4,6)` tall (95).
- The black background plus 180-alpha tinting is what gives the dense, layered fur look.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_20000 | `for (int i = 0; i < 50000; i++) {` -> `... i < 20000 ...` | moderate (mean 0.093, 0.383) | sparser; more black background showing, strokes smaller and more isolated | variants/count_20000/frame_00001.png |
| gap_0.06 | `... (s+p.z)*0.02) {` -> `... *0.06) {` | moderate (mean 0.094, 0.388) | looser packing; bigger gaps, strokes appear longer and finer | variants/gap_0.06/frame_00001.png |
| scale_240 | `... *120*map(y, 0, height, 0.6, 1);` -> `... *240*...` | moderate (mean 0.132, 0.551) | strokes roughly twice as long; spikier, bottom half full of long thin blades | variants/scale_240/frame_00001.png |
| alpha_255 | `tint(col, 180);` -> `tint(col, 255);` | subtle (mean 0.035, 0.036) | no visible change; at this density the alpha is already saturated | variants/alpha_255/frame_00001.png |
| aspect_1 | `... s*random(4, 6));` -> `... s*random(1, 1.5));` | moderate (mean 0.086, 0.370) | stamps near-square/short; blade look gone, mottled grainy texture | variants/aspect_1/frame_00001.png |
| pwr_0.7 | `float pwr = random(0.1, 0.2);` -> `random(0.6, 0.8);` | subtle (mean 0.050, 0.151) | subtle: overall hue shifts from rust-red to dark steel-blue; fur structure unchanged | variants/pwr_0.7/frame_00001.png |

## Modularisation notes
- `loadForms` (13-25) is a generic sprite-sheet cropper: `cropSheet(img, cols, rows) -> PImage[][]`.
- The scatter+rejection block (45-61) is a reusable packing routine parameterised by a size function and gap factor; its O(n^2) rejection is the main cost.
- The stamping block (71-97) is reusable: point list + tile set + (size scale, aspect range, rotation noise, tint alpha). The 4-way random colour pick (78-90) is a one-off art decision; the `getColor` palette-lerp (112-118) is cleanly reusable.
- Clean parameter object: `{count, yBiasExponent, sizeScale, sizeYMap:[0.6,1], gapFactor, tileCols, tileRows, tintAlpha, aspect:[4,6], pwr, noiseDetail, palette}`.
