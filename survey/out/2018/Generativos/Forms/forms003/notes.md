---
sketch: 2018/Generativos/Forms/forms003
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 4395
animated: false
techniques: [noise-field, image-source]
primitives: [image]
palette:
  colors: ["#FF3D20", "#FC9D43", "#3998C2", "#3E56A8", "#090D0E"]
  selection: noise-driven
composition: full-bleed
parameters:
  - {name: count, default: 50000, tried: [15000], change: large, effect: "sparser field; individual strokes and the black ground show through, bottom third becomes open"}
  - {name: sizeBase, default: 120, tried: [240], change: large, effect: "longer, chunkier brushstrokes; coarser texture, vortices still readable"}
  - {name: aspectW, default: 0.4, tried: [1.2], change: moderate, effect: "thicker flatter strokes, more brush-like (first run at 50000 points timed out; retry used count 15000 too)"}
  - {name: alpha, default: 180, tried: [80], change: moderate, effect: "more transparent, lighter and hazier; black ground shows through more"}
  - {name: rotationGain, default: 2, tried: [8], change: moderate, effect: "orientations more chaotic; coherent vortices break into finer tangled scribble"}
reusable_candidates:
  - {name: spriteStrip, signature: "spriteStrip(img, cols, rows) -> PImage[]", note: "split a sprite sheet into a grid of tiles"}
  - {name: noiseFieldSlivers, signature: "noiseFieldSlivers(n, sizeBase, detail, aspectW, aspectH) -> void", note: "scatter elongated tinted sprite slivers with noise-driven size and rotation"}
---

## What it draws
The whole 960x960 canvas is densely packed with thousands of tiny, very elongated slivers — a fur- or
paint-stroke-like texture — that swirl into soft vortices and radial bursts. Colour is dominated by dark
steel-blue and indigo strokes, with scattered patches of orange/rust, on a black ground. Strokes look
slightly longer and denser toward the bottom of the frame.

## How the code works
- `setup()` (lines 3-11) sizes 960x960 P2D, calls `loadForms()` then `generate()` once; `draw()` is empty
  (line 27-28) so the piece is a static one-shot; any other key reseeds and regenerates (lines 30-36).
- `loadForms()` (lines 13-25) loads `../forms.png` and cuts it into a 16x2 grid = 32 sprite tiles (`cc=16`,
  two rows), kept in `images[]`.
- Point phase (lines 45-61): 50000 candidate points; `x` uniform, `y` biased toward the bottom by
  `pow(random(0,1), 0.7)` (line 50). Per-point size `s = noise(x*det, y*det) * 120 * map(y, 0, height, 0.6, 1)`
  (line 51): Perlin noise sets the size field and strokes grow ~67% toward the bottom. The collision loop
  (lines 53-59) is dead code: the test `dist < (s+p.z)*0.0` is never true, so all 50000 points are kept.
- Draw phase (lines 69-95): each point picks a random tile (`images[int(random(images.length))]`, line 71).
  Colour: one of 4 noise-indexed palette samples (noise z-offsets 0/10/50/90 -> `getColor`, lines 110-116
  lerp between the 5 palette colours), each lerped toward a random gray by a random amount (lines 76-79),
  chosen by a 2-bit random (lines 81-88); `tint(col, 180)` gives ~70% opacity (line 89). Each sliver is
  rotated by `noise(...)*TAU*2` (line 92) and drawn at `s*0.4` wide by `s*random(4,6)` tall (line 93) —
  a strip ~10-15x longer than wide, which creates the hair look. The swirling vortices come from sampling
  the same low-detail noise field (det ~0.008-0.06) for both size and rotation.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|
| count_15000 | `for (int i = 0; i < 50000; i++) {` -> `... 15000 ...` | large (mean 0.1632, 0.617) | sparser field; individual slivers and black ground visible, bottom third much more open | variants/count_15000/frame_00001.png |
| size_240 | `*120*map(y, 0, height, 0.6, 1);` -> `*240*...` | large (mean 0.2008, 0.759) | strokes ~2x longer and chunkier; coarser brush texture, vortices still readable | variants/size_240/frame_00001.png |
| aspectW_1.2 | `image(img, 0, 0, s*0.4, ...)` -> `s*1.2` (+ count 15000) | moderate (mean 0.139, 0.564) | wider flat brush-like strokes; first run at 50000 points timed out (90 s), retry halved to 15000 points | variants/aspectW_1.2/frame_00001.png |
| alpha_80 | `tint(col, 180);` -> `tint(col, 80);` | moderate (mean 0.1003, 0.546) | lighter, hazier, more ghostly; black ground shows through, orange patches stand out more | variants/alpha_80/frame_00001.png |
| rotGain_8 | `*TAU*2);` -> `*TAU*8);` | moderate (mean 0.1062, 0.438) | orientations more chaotic; coherent vortices break into finer tangled scribble | variants/rotGain_8/frame_00001.png |

## Modularisation notes
- Generic: `loadForms()` sprite-sheet splitting; the noise-field-driven scatter of rotated, tinted,
  elongated sprite slivers (size field, rotation field, aspect ratio, alpha, palette lerp are all
  separable parameters); the `getColor(v)` palette-noise lerp helper.
- One-off art decisions: the dead collision loop (lines 53-59) suggests a packing attempt that was
  disabled; the y-density bias `pow(random, 0.7)` and the 0.6->1 size growth; the 4-way random color
  choice over 4 noise samples.
- Clean parameter object: `{count, sizeBase, yGrowth: [0.6, 1], detail, aspectW: 0.4, aspectH: [4, 6],
  alpha: 180, rotationGain: 2, palette, grayLerp} -> scatter(points)`.
